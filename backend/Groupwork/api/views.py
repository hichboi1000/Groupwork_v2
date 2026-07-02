import random
import string

from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db.models import Q

from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from users.models import User
from classes.models import Class
from groups.models import Group
from tasks.models import Task
from assignments.models import Unit, Assignment, UnitOffering, GroupAssignment, Submission
from notifications.models import Notification
from notifications.utils import (
    notify_task_assigned,
    notify_task_status_updated,
    notify_member_joined,
    notify_group_assignment_linked,
)

from .serializers import (
    UserSerializer, UserMiniSerializer,
    ClassSerializer,
    GroupSerializer, JoinGroupSerializer,
    UnitSerializer, CreateUnitSerializer,
    UnitOfferingSerializer, AttachClassSerializer,
    AssignmentSerializer,
    GroupAssignmentSerializer, SubmissionSerializer,
    TaskSerializer, NotificationSerializer,
)
from .permissions import IsLecturer, IsLeader, IsRep, IsLecturerOrRep, IsLeaderOrLecturer


# ─── HELPERS ──────────────────────────────────────────────────────────────────

# Below this similarity score (0-1), a name typed against an existing unit
# code is considered different enough to warrant a confirmation prompt
# rather than a silent co-lecturer join. See DESIGN_DECISIONS.md section 6.
UNIT_NAME_SIMILARITY_THRESHOLD = 0.45


def generate_group_code():
    while True:
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        if not Group.objects.filter(code=code).exists():
            return code


def generate_class_code():
    while True:
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        if not Class.objects.filter(code=code).exists():
            return code


def get_user_group(user):
    """Return the user's current group or None."""
    return Group.objects.filter(members=user).first()


def get_user_classes(user):
    """Classes this rep manages. Empty for everyone else."""
    if user.role != 'rep':
        return Class.objects.none()
    return Class.objects.filter(reps=user)


def get_lecturer_units(user):
    """
    Units this lecturer actually teaches. This is the scoping boundary —
    a lecturer's role grants the ABILITY to manage units/assignments,
    but this query decides WHICH ones they can see and touch.
    """
    return Unit.objects.filter(lecturers=user)


def get_rep_units(user):
    """
    Units reachable through any class this rep manages — traced through
    that class's active UnitOfferings, not a direct FK. A rep managing
    multiple classes can see units across all of them.
    """
    classes = get_user_classes(user)
    return Unit.objects.filter(offerings__class_field__in=classes).distinct()


def get_visible_units(user):
    """Single entry point: which units can this user see, based on their role."""
    if user.role == 'lecturer':
        return get_lecturer_units(user)
    if user.role == 'rep':
        return get_rep_units(user)
    return Unit.objects.none()


def get_visible_offerings(user):
    """
    UnitOfferings this user can act on. Lecturers see offerings of units
    they teach; reps see offerings of classes they manage. This is the
    real scoping boundary for assignment/submission data, since that data
    hangs off the offering, not the unit directly.
    """
    if user.role == 'lecturer':
        return UnitOffering.objects.filter(unit__in=get_lecturer_units(user))
    if user.role == 'rep':
        return UnitOffering.objects.filter(class_field__in=get_user_classes(user))
    return UnitOffering.objects.none()


# ─── AUTH / USERS ─────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def register_user(request):
    serializer = UserSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=201)
    return Response(serializer.errors, status=400)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    """Return the currently logged-in user's profile."""
    serializer = UserSerializer(request.user)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_list(request):
    users = User.objects.all()
    serializer = UserMiniSerializer(users, many=True)
    return Response(serializer.data)


@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def user_detail(request, pk):
    user = get_object_or_404(User, pk=pk)

    if request.method == 'GET':
        return Response(UserSerializer(user).data)

    if request.method in ['PUT', 'PATCH']:
        partial = request.method == 'PATCH'
        serializer = UserSerializer(user, data=request.data, partial=partial)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    if request.method == 'DELETE':
        user.delete()
        return Response({'message': 'User deleted'}, status=204)


# ─── CLASSES (rep-managed cohorts) ──────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def classes_view(request):
    """
    GET: a rep sees only the classes they manage. Lecturers/leaders/students
    don't get a global class list — Class is strictly a rep/lecturer
    coordination concept. See DESIGN_DECISIONS.md section 9.
    POST: any rep can create a class and is automatically added as its rep.
    """
    if request.method == 'GET':
        if request.user.role != 'rep':
            return Response({'error': 'Only class reps manage classes'}, status=403)
        qs = get_user_classes(request.user).prefetch_related('reps', 'groups')
        return Response(ClassSerializer(qs, many=True).data)

    if request.method == 'POST':
        if request.user.role != 'rep':
            return Response({'error': 'Only class reps can create a class'}, status=403)

        serializer = ClassSerializer(data=request.data)
        # ClassSerializer is read-heavy (nested reps/created_by), so build
        # the instance directly instead of relying on serializer.save()
        # for input validation of the writable fields only.
        required = ['name', 'program', 'stage', 'cohort_year']
        missing = [f for f in required if not request.data.get(f)]
        if missing:
            return Response({'error': f"Missing fields: {', '.join(missing)}"}, status=400)

        if Class.objects.filter(
            program=request.data['program'],
            stage=request.data['stage'],
            cohort_year=request.data['cohort_year']
        ).exists():
            return Response({'error': 'A class with this program, stage, and cohort year already exists'}, status=400)

        new_class = Class.objects.create(
            name=request.data['name'],
            program=request.data['program'],
            stage=request.data['stage'],
            cohort_year=request.data['cohort_year'],
            code=generate_class_code(),
            created_by=request.user,
        )
        new_class.reps.add(request.user)
        return Response(ClassSerializer(new_class).data, status=201)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def class_detail(request, pk):
    cls = get_object_or_404(Class, pk=pk)

    if request.user.role != 'rep' or not cls.reps.filter(id=request.user.id).exists():
        return Response({'error': 'You do not manage this class'}, status=403)

    if request.method == 'GET':
        return Response(ClassSerializer(cls).data)

    if request.method == 'PATCH':
        allowed = {'name', 'status'}
        for field in allowed:
            if field in request.data:
                setattr(cls, field, request.data[field])
        cls.save()
        return Response(ClassSerializer(cls).data)

    if request.method == 'DELETE':
        cls.delete()
        return Response({'message': 'Class deleted'}, status=204)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_rep_to_class(request, pk):
    """Supports rep handovers — multiple reps per class. See DESIGN_DECISIONS.md section 3."""
    cls = get_object_or_404(Class, pk=pk)
    if not cls.reps.filter(id=request.user.id).exists():
        return Response({'error': 'You do not manage this class'}, status=403)

    new_rep_id = request.data.get('user_id')
    new_rep = get_object_or_404(User, id=new_rep_id, role='rep')
    cls.reps.add(new_rep)
    return Response(ClassSerializer(cls).data)


# ─── GROUPS ───────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsLeader])
def create_group(request):
    if Group.objects.filter(members=request.user).exists():
        return Response({'error': 'You already belong to a group'}, status=400)

    group = Group.objects.create(
        name=request.data.get('name', ''),
        description=request.data.get('description', ''),
        code=generate_group_code(),
        leader=request.user,
    )
    group.members.add(request.user)

    # Link to a class via its code — same self-service pattern as group
    # and unit codes. The leader needs to know their class's code (shared
    # by their rep), not browse a list of all classes.
    class_code = request.data.get('class_code', '').strip().upper()
    if class_code:
        cls = Class.objects.filter(code=class_code).first()
        if cls:
            group.class_field = cls
            group.save()
        else:
            return Response({'error': f"No class found with code '{class_code}'"}, status=400)

    return Response(GroupSerializer(group).data, status=201)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def join_group(request):
    serializer = JoinGroupSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)

    code = serializer.validated_data['code']
    group = get_object_or_404(Group, code=code)

    if Group.objects.filter(members=request.user).exists():
        return Response({'error': 'You already belong to a group'}, status=400)

    if request.user.role == 'leader':
        return Response({'error': 'Leaders must create their own group'}, status=400)

    group.members.add(request.user)
    notify_member_joined(group, request.user)

    return Response({'message': f'You joined {group.name}', 'group': GroupSerializer(group).data})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_group(request):
    group = get_user_group(request.user)
    if not group:
        return Response({'error': 'You do not belong to any group'}, status=404)
    return Response(GroupSerializer(group).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def all_groups(request):
    """
    Lecturers see groups whose CLASS is currently attached (via an active
    UnitOffering) to a unit they teach.
    Reps see groups in classes they manage.
    Nobody sees every group in the institution by default.
    """
    if request.user.role not in ['lecturer', 'rep']:
        return Response({'error': 'Not authorised'}, status=403)

    if request.user.role == 'rep':
        classes = get_user_classes(request.user)
        groups = Group.objects.filter(class_field__in=classes)
    else:
        visible_units = get_lecturer_units(request.user)
        active_class_ids = UnitOffering.objects.filter(
            unit__in=visible_units, status='active'
        ).values_list('class_field_id', flat=True)
        groups = Group.objects.filter(class_field_id__in=active_class_ids)

    groups = groups.prefetch_related('members', 'leader')
    return Response(GroupSerializer(groups, many=True).data)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def leave_group(request):
    group = get_user_group(request.user)
    if not group:
        return Response({'error': 'You are not in a group'}, status=404)
    if group.leader == request.user:
        return Response({'error': 'Leaders cannot leave — delete the group instead'}, status=400)
    group.members.remove(request.user)
    return Response({'message': f'You left {group.name}'})


# ─── UNITS ────────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def units(request):
    """
    GET only here — unit CREATION moved to create_unit below because it
    needs special co-lecturer-join logic, not a plain serializer.save().
    """
    user = request.user
    if user.role in ['lecturer', 'rep']:
        qs = get_visible_units(user)
    else:
        group = get_user_group(user)
        if group and group.class_field:
            qs = Unit.objects.filter(offerings__class_field=group.class_field, offerings__status='active').distinct()
        else:
            qs = Unit.objects.none()
    return Response(UnitSerializer(qs, many=True).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsLecturer])
def create_unit(request):
    """
    Create a unit, OR join an existing one as a co-lecturer if the code
    already exists. The unit code IS the join code — see
    DESIGN_DECISIONS.md section 6.
    """
    serializer = CreateUnitSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)

    code = serializer.validated_data['code'].strip().upper()
    name = serializer.validated_data['name'].strip()

    existing = Unit.objects.filter(code=code).first()

    if not existing:
        unit = Unit.objects.create(code=code, name=name, created_by=request.user)
        unit.lecturers.add(request.user)
        return Response({
            'created_new': True,
            'unit': UnitSerializer(unit).data
        }, status=201)

    # Code already exists — this is a co-lecturer join, not a duplicate.
    if existing.lecturers.filter(id=request.user.id).exists():
        return Response({'error': 'You already teach this unit'}, status=400)

    similarity = existing.name_similarity(name)
    force = request.data.get('confirm_join', False)

    if similarity < UNIT_NAME_SIMILARITY_THRESHOLD and not force:
        return Response({
            'needs_confirmation': True,
            'message': (
                f"This code is already registered as '{existing.name}'. "
                f"The name you entered ('{name}') looks quite different. "
                f"Continue and join as a co-lecturer anyway?"
            ),
            'existing_unit': UnitSerializer(existing).data,
        }, status=409)

    existing.lecturers.add(request.user)
    return Response({
        'created_new': False,
        'joined_existing': True,
        'unit': UnitSerializer(existing).data
    }, status=200)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_units(request):
    """What units does the logged-in lecturer/rep actually have scope over."""
    qs = get_visible_units(request.user)
    return Response(UnitSerializer(qs, many=True).data)


# ─── UNIT OFFERINGS (attach / detach — rep-controlled) ──────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def unit_offerings(request):
    """
    Active offerings visible to the requester. Defaults to active only —
    see /unit-offerings/history/ for closed ones.
    See DESIGN_DECISIONS.md section 7.
    """
    qs = get_visible_offerings(request.user).filter(status='active').select_related('unit', 'class_field')
    return Response(UnitOfferingSerializer(qs, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def unit_offerings_history(request):
    """Closed offerings — past semesters' work, never deleted, just filtered out of the default view."""
    qs = get_visible_offerings(request.user).filter(status='closed').select_related('unit', 'class_field')
    return Response(UnitOfferingSerializer(qs, many=True).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsRep])
def attach_class(request):
    """
    Rep attaches one of their classes to a unit by entering its code.
    This is the ONLY way an offering gets created — lecturers cannot
    initiate this. See DESIGN_DECISIONS.md section 5.
    """
    serializer = AttachClassSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)

    unit_code = serializer.validated_data['unit_code'].strip().upper()
    class_id = serializer.validated_data['class_id']

    cls = get_object_or_404(Class, id=class_id)
    if not cls.reps.filter(id=request.user.id).exists():
        return Response({'error': 'You do not manage this class'}, status=403)

    unit = get_object_or_404(Unit, code=unit_code)

    if UnitOffering.objects.filter(unit=unit, class_field=cls, status='active').exists():
        return Response({'error': 'This class is already attached to this unit'}, status=400)

    offering = UnitOffering.objects.create(
        unit=unit, class_field=cls, attached_by=request.user, status='active'
    )
    return Response(UnitOfferingSerializer(offering).data, status=201)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsRep])
def detach_class(request, pk):
    """
    Closes (never deletes) a UnitOffering. If there's unsubmitted work,
    requires confirm=true to proceed — see DESIGN_DECISIONS.md section 7.
    """
    offering = get_object_or_404(UnitOffering, pk=pk, status='active')

    if not offering.class_field.reps.filter(id=request.user.id).exists():
        return Response({'error': 'You do not manage this class'}, status=403)

    confirm = request.data.get('confirm', False)

    if offering.has_unsubmitted_work() and not confirm:
        return Response({
            'needs_confirmation': True,
            'message': (
                f"{offering.class_field.name} still has unsubmitted work under "
                f"{offering.unit.code}. Detaching will close this offering but "
                f"won't delete anything — you'll still be able to view it under "
                f"past offerings. Continue?"
            ),
        }, status=409)

    offering.close()
    return Response(UnitOfferingSerializer(offering).data)


# ─── PROGRESS DASHBOARD ──────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def group_progress(request):
    """
    The accountability dashboard. Returns per-member task breakdown for the
    leader's group (or any group if lecturer/rep passes ?group_id=X, scoped
    to units/classes they actually have access to).
    """
    if request.user.role in ['lecturer', 'rep']:
        group_id = request.query_params.get('group_id')
        if not group_id:
            return Response({'error': 'Pass ?group_id=X'}, status=400)

        if request.user.role == 'rep':
            classes = get_user_classes(request.user)
            group = get_object_or_404(Group, id=group_id, class_field__in=classes)
        else:
            visible_units = get_lecturer_units(request.user)
            active_class_ids = UnitOffering.objects.filter(
                unit__in=visible_units, status='active'
            ).values_list('class_field_id', flat=True)
            group = get_object_or_404(Group, id=group_id, class_field_id__in=active_class_ids)
    else:
        group = get_user_group(request.user)
        if not group:
            return Response({'error': 'You are not in a group'}, status=404)
        if request.user.role == 'student':
            return Response({'error': 'Only leaders can view group progress'}, status=403)

    tasks = Task.objects.filter(group=group).select_related('assigned_to', 'assignment')

    members_data = []
    for member in group.members.all():
        member_tasks = tasks.filter(assigned_to=member)
        members_data.append({
            'member': UserMiniSerializer(member).data,
            'tasks': TaskSerializer(member_tasks, many=True).data,
            'summary': {
                'total': member_tasks.count(),
                'todo': member_tasks.filter(status='todo').count(),
                'in_progress': member_tasks.filter(status='progress').count(),
                'done': member_tasks.filter(status='done').count(),
                'overdue': sum(1 for t in member_tasks if t.is_overdue),
            }
        })

    return Response({
        'group': GroupSerializer(group).data,
        'overall': group.get_progress_summary(),
        'members': members_data,
    })


# ─── TASKS ────────────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def tasks(request):
    if request.method == 'GET':
        user = request.user
        if user.role == 'lecturer':
            visible_units = get_lecturer_units(user)
            active_class_ids = UnitOffering.objects.filter(
                unit__in=visible_units, status='active'
            ).values_list('class_field_id', flat=True)
            task_qs = Task.objects.filter(group__class_field_id__in=active_class_ids)
        elif user.role == 'rep':
            classes = get_user_classes(user)
            task_qs = Task.objects.filter(group__class_field__in=classes)
        elif user.role == 'leader':
            task_qs = Task.objects.filter(group__leader=user)
        else:
            task_qs = Task.objects.filter(assigned_to=user)

        assignment_id = request.query_params.get('assignment')
        if assignment_id:
            task_qs = task_qs.filter(assignment_id=assignment_id)

        task_qs = task_qs.select_related('assigned_to', 'created_by', 'assignment', 'group')
        return Response(TaskSerializer(task_qs, many=True).data)

    if request.method == 'POST':
        if request.user.role != 'leader':
            return Response({'error': 'Only group leaders can create tasks'}, status=403)

        group_id = request.data.get('group')
        assigned_to_id = request.data.get('assigned_to')

        group = get_object_or_404(Group, id=group_id)

        if group.leader != request.user:
            return Response({'error': 'You can only create tasks for your own group'}, status=403)

        if not group.members.filter(id=assigned_to_id).exists():
            return Response({'error': 'Assigned user must be a group member'}, status=400)

        serializer = TaskSerializer(data=request.data)
        if serializer.is_valid():
            task = serializer.save(created_by=request.user)
            notify_task_assigned(task)
            if task.assignment:
                ga = GroupAssignment.objects.filter(group=group, assignment=task.assignment).first()
                if ga:
                    ga.auto_update_status()
            return Response(TaskSerializer(task).data, status=201)

        return Response(serializer.errors, status=400)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def task_detail(request, pk):
    task = get_object_or_404(Task, pk=pk)
    user = request.user

    if user.role == 'student' and task.assigned_to != user:
        return Response({'error': 'You can only access your own tasks'}, status=403)

    if user.role == 'leader' and task.group.leader != user:
        return Response({'error': 'You can only access tasks in your group'}, status=403)

    if request.method == 'GET':
        return Response(TaskSerializer(task).data)

    if request.method == 'PATCH':
        # Students may only change status and attach evidence
        if user.role == 'student':
            allowed = {'status', 'submission_text', 'submission_file'}
            data = {k: v for k, v in request.data.items() if k in allowed}
        else:
            data = request.data

        serializer = TaskSerializer(task, data=data, partial=True)
        if serializer.is_valid():
            updated_task = serializer.save()
            notify_task_status_updated(updated_task, user)
            if updated_task.assignment:
                ga = GroupAssignment.objects.filter(
                    group=updated_task.group,
                    assignment=updated_task.assignment
                ).first()
                if ga:
                    ga.auto_update_status()
            return Response(TaskSerializer(updated_task).data)
        return Response(serializer.errors, status=400)

    if request.method == 'DELETE':
        if user.role != 'leader' or task.group.leader != user:
            return Response({'error': 'Only the group leader can delete tasks'}, status=403)
        task.delete()
        return Response({'message': 'Task deleted'}, status=204)


# ─── ASSIGNMENTS ──────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def assignments_view(request):
    if request.method == 'GET':
        user = request.user
        if user.role in ['lecturer', 'rep']:
            visible_units = get_visible_units(user)
            qs = Assignment.objects.filter(unit__in=visible_units)
        else:
            group = get_user_group(user)
            if group and group.class_field:
                offering_units = Unit.objects.filter(
                    offerings__class_field=group.class_field, offerings__status='active'
                )
                qs = Assignment.objects.filter(unit__in=offering_units)
            else:
                qs = Assignment.objects.none()
        return Response(AssignmentSerializer(qs.select_related('unit', 'created_by'), many=True).data)

    if request.method == 'POST':
        if request.user.role not in ['lecturer', 'rep']:
            return Response({'error': 'Only lecturers can create assignments'}, status=403)

        unit_id = request.data.get('unit')
        if request.user.role == 'lecturer':
            if not get_lecturer_units(request.user).filter(id=unit_id).exists():
                return Response({'error': 'You can only post assignments for units you teach'}, status=403)

        serializer = AssignmentSerializer(data=request.data)
        if serializer.is_valid():
            assignment = serializer.save(created_by=request.user)
            return Response(AssignmentSerializer(assignment).data, status=201)
        return Response(serializer.errors, status=400)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def assignment_detail(request, pk):
    assignment = get_object_or_404(Assignment, pk=pk)

    if request.method == 'GET':
        return Response(AssignmentSerializer(assignment).data)

    if request.method in ['PATCH', 'DELETE']:
        if request.user.role not in ['lecturer', 'rep']:
            return Response({'error': 'Not authorised'}, status=403)
        if request.user.role == 'lecturer' and not get_lecturer_units(request.user).filter(id=assignment.unit_id).exists():
            return Response({'error': 'You can only manage assignments for units you teach'}, status=403)

    if request.method == 'PATCH':
        serializer = AssignmentSerializer(assignment, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    if request.method == 'DELETE':
        assignment.delete()
        return Response({'message': 'Assignment deleted'}, status=204)


# ─── GROUP ASSIGNMENTS (linking groups to assignments, scoped to an offering) ───

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def group_assignments(request):
    if request.method == 'GET':
        user = request.user
        if user.role == 'lecturer':
            visible_offerings = get_visible_offerings(user)
            qs = GroupAssignment.objects.filter(offering__in=visible_offerings)
        elif user.role == 'rep':
            visible_offerings = get_visible_offerings(user)
            qs = GroupAssignment.objects.filter(offering__in=visible_offerings)
        else:
            group = get_user_group(user)
            qs = GroupAssignment.objects.filter(group=group) if group else GroupAssignment.objects.none()
        return Response(GroupAssignmentSerializer(
            qs.select_related('group', 'assignment__unit', 'offering'), many=True
        ).data)

    if request.method == 'POST':
        if request.user.role not in ['lecturer', 'rep']:
            return Response({'error': 'Only lecturers can link assignments to groups'}, status=403)

        group_obj = get_object_or_404(Group, id=request.data.get('group'))
        assignment_obj = get_object_or_404(Assignment, id=request.data.get('assignment'))

        if not group_obj.class_field:
            return Response({'error': 'This group has no class assigned'}, status=400)

        offering = UnitOffering.objects.filter(
            unit=assignment_obj.unit, class_field=group_obj.class_field, status='active'
        ).first()

        if not offering:
            return Response({
                'error': "This group's class isn't attached to this assignment's unit. "
                         "The rep needs to attach the class first."
            }, status=400)

        # Scope check: lecturer must teach this unit; rep must manage this class
        if request.user.role == 'lecturer' and not get_lecturer_units(request.user).filter(id=assignment_obj.unit_id).exists():
            return Response({'error': 'You can only link assignments for units you teach'}, status=403)
        if request.user.role == 'rep' and not get_user_classes(request.user).filter(id=group_obj.class_field_id).exists():
            return Response({'error': 'You can only link groups in classes you manage'}, status=403)

        ga, created = GroupAssignment.objects.get_or_create(
            group=group_obj, assignment=assignment_obj,
            defaults={'offering': offering}
        )
        if not created:
            return Response({'error': 'This group is already linked to this assignment'}, status=400)

        notify_group_assignment_linked(ga)
        return Response(GroupAssignmentSerializer(ga).data, status=201)


# ─── SUBMISSIONS ──────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def submissions(request):
    if request.method == 'GET':
        user = request.user
        if user.role in ['lecturer', 'rep']:
            visible_offerings = get_visible_offerings(user)
            scoped_group_ids = GroupAssignment.objects.filter(
                offering__in=visible_offerings
            ).values_list('group_id', flat=True)
            qs = Submission.objects.filter(group_id__in=scoped_group_ids)
        elif user.role == 'leader':
            group = get_user_group(user)
            qs = Submission.objects.filter(group=group) if group else Submission.objects.none()
        else:
            return Response({'error': 'Not authorised'}, status=403)
        return Response(SubmissionSerializer(qs, many=True).data)

    if request.method == 'POST':
        if request.user.role != 'leader':
            return Response({'error': 'Only group leaders can submit'}, status=403)

        group = get_user_group(request.user)
        if not group:
            return Response({'error': 'You are not in a group'}, status=400)

        serializer = SubmissionSerializer(data=request.data)
        if serializer.is_valid():
            submission = serializer.save(submitted_by=request.user)
            GroupAssignment.objects.filter(
                group=group,
                assignment=submission.assignment
            ).update(status='submitted', submitted_at=timezone.now())
            return Response(SubmissionSerializer(submission).data, status=201)
        return Response(serializer.errors, status=400)


# ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_notifications(request):
    notifications = Notification.objects.filter(recipient=request.user)
    return Response(NotificationSerializer(notifications, many=True).data)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def mark_notification_read(request, pk):
    notif = get_object_or_404(Notification, pk=pk, recipient=request.user)
    notif.is_read = True
    notif.save()
    return Response({'message': 'Marked as read'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_all_notifications_read(request):
    Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
    return Response({'message': 'All notifications marked as read'})


# ─── STATS / SUMMARY ──────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    """A single endpoint the frontend calls to populate the dashboard summary cards."""
    user = request.user

    if user.role in ['lecturer', 'rep']:
        visible_units = get_visible_units(user)
        active_offerings = get_visible_offerings(user).filter(status='active')
        active_class_ids = active_offerings.values_list('class_field_id', flat=True)

        scoped_groups = Group.objects.filter(class_field_id__in=active_class_ids)
        scoped_assignments = Assignment.objects.filter(unit__in=visible_units)
        scoped_tasks = Task.objects.filter(group__class_field_id__in=active_class_ids)
        scoped_group_ids = GroupAssignment.objects.filter(
            offering__in=active_offerings
        ).values_list('group_id', flat=True)
        scoped_submissions = Submission.objects.filter(group_id__in=scoped_group_ids)
        scoped_users = User.objects.filter(joined_groups__class_field_id__in=active_class_ids).distinct()

        return Response({
            'role': user.role,
            'units_count': visible_units.count(),
            'units': list(visible_units.values_list('code', flat=True)),
            'active_offerings_count': active_offerings.count(),
            'total_groups': scoped_groups.count(),
            'total_users': scoped_users.count(),
            'total_assignments': scoped_assignments.count(),
            'total_tasks': scoped_tasks.count(),
            'total_submissions': scoped_submissions.count(),
            'unread_notifications': Notification.objects.filter(
                recipient=user, is_read=False
            ).count(),
        })

    group = get_user_group(user)

    if user.role == 'leader' and group:
        tasks_qs = Task.objects.filter(group=group)
        return Response({
            'role': user.role,
            'group_name': group.name,
            'group_code': group.code,
            'member_count': group.members.count(),
            'tasks_total': tasks_qs.count(),
            'tasks_todo': tasks_qs.filter(status='todo').count(),
            'tasks_in_progress': tasks_qs.filter(status='progress').count(),
            'tasks_done': tasks_qs.filter(status='done').count(),
            'unread_notifications': Notification.objects.filter(
                recipient=user, is_read=False
            ).count(),
        })

    # Student
    my_tasks = Task.objects.filter(assigned_to=user)
    return Response({
        'role': user.role,
        'group_name': group.name if group else None,
        'tasks_total': my_tasks.count(),
        'tasks_todo': my_tasks.filter(status='todo').count(),
        'tasks_in_progress': my_tasks.filter(status='progress').count(),
        'tasks_done': my_tasks.filter(status='done').count(),
        'unread_notifications': Notification.objects.filter(
            recipient=user, is_read=False
        ).count(),
    })
