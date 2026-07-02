from rest_framework import serializers
from users.models import User
from classes.models import Class
from groups.models import Group
from tasks.models import Task
from assignments.models import Unit, Assignment, UnitOffering, GroupAssignment, Submission
from notifications.models import Notification


# ─── USERS ────────────────────────────────────────────────────────────────────

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'password', 'email', 'first_name', 'last_name',
                  'full_name', 'role', 'avatar_initials']
        read_only_fields = ['avatar_initials']

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class UserMiniSerializer(serializers.ModelSerializer):
    """Lightweight serializer used inside task/group/class responses."""
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'full_name', 'role', 'avatar_initials']

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


# ─── CLASSES ──────────────────────────────────────────────────────────────────

class ClassSerializer(serializers.ModelSerializer):
    reps = UserMiniSerializer(many=True, read_only=True)
    created_by = UserMiniSerializer(read_only=True)
    group_count = serializers.SerializerMethodField()
    active_offering = serializers.SerializerMethodField()

    class Meta:
        model = Class
        fields = ['id', 'name', 'code', 'program', 'stage', 'cohort_year', 'status',
                  'reps', 'created_by', 'group_count', 'active_offering', 'created_at']

    def get_group_count(self, obj):
        return obj.groups.count()

    def get_active_offering(self, obj):
        offering = obj.unit_offerings.filter(status='active').first()
        if not offering:
            return None
        return {
            'id': offering.id,
            'unit_code': offering.unit.code,
            'unit_name': offering.unit.name,
        }


# ─── GROUPS ───────────────────────────────────────────────────────────────────

class GroupSerializer(serializers.ModelSerializer):
    leader = UserMiniSerializer(read_only=True)
    members = UserMiniSerializer(many=True, read_only=True)
    member_count = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()
    class_name = serializers.CharField(source='class_field.name', read_only=True, default=None)

    class Meta:
        model = Group
        fields = ['id', 'name', 'code', 'description', 'leader', 'members',
                  'member_count', 'progress', 'class_field', 'class_name', 'created_at']

    def get_member_count(self, obj):
        return obj.members.count()

    def get_progress(self, obj):
        return obj.get_progress_summary()


class JoinGroupSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=20)


# ─── UNITS ────────────────────────────────────────────────────────────────────

class UnitSerializer(serializers.ModelSerializer):
    created_by = UserMiniSerializer(read_only=True)
    lecturers = UserMiniSerializer(many=True, read_only=True)

    class Meta:
        model = Unit
        fields = ['id', 'name', 'code', 'created_by', 'lecturers', 'created_at']


class CreateUnitSerializer(serializers.Serializer):
    """
    Separate serializer for the create-unit endpoint because the create
    flow has special logic (co-lecturer join on existing code, fuzzy name
    check) that doesn't belong in the general-purpose UnitSerializer.
    """
    code = serializers.CharField(max_length=20)
    name = serializers.CharField(max_length=200)


# ─── UNIT OFFERINGS (attach/detach) ────────────────────────────────────────────

class UnitOfferingSerializer(serializers.ModelSerializer):
    unit_detail = UnitSerializer(source='unit', read_only=True)
    class_detail = ClassSerializer(source='class_field', read_only=True)
    attached_by_detail = UserMiniSerializer(source='attached_by', read_only=True)
    has_unsubmitted_work = serializers.SerializerMethodField()

    class Meta:
        model = UnitOffering
        fields = ['id', 'unit', 'unit_detail', 'class_field', 'class_detail',
                  'status', 'attached_by', 'attached_by_detail', 'attached_at', 'closed_at',
                  'has_unsubmitted_work']
        read_only_fields = ['attached_by', 'attached_at', 'closed_at']

    def get_has_unsubmitted_work(self, obj):
        return obj.has_unsubmitted_work()


class AttachClassSerializer(serializers.Serializer):
    """Rep-facing: attach their class to a unit by entering its code."""
    unit_code = serializers.CharField(max_length=20)
    class_id = serializers.IntegerField()


# ─── ASSIGNMENTS ──────────────────────────────────────────────────────────────

class AssignmentSerializer(serializers.ModelSerializer):
    created_by = UserMiniSerializer(read_only=True)
    unit_detail = UnitSerializer(source='unit', read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    days_remaining = serializers.IntegerField(read_only=True)

    class Meta:
        model = Assignment
        fields = ['id', 'title', 'description', 'unit', 'unit_detail',
                  'deadline', 'is_overdue', 'days_remaining', 'created_by', 'created_at']


class GroupAssignmentSerializer(serializers.ModelSerializer):
    assignment_detail = AssignmentSerializer(source='assignment', read_only=True)
    group_name = serializers.CharField(source='group.name', read_only=True)
    offering_detail = UnitOfferingSerializer(source='offering', read_only=True)

    class Meta:
        model = GroupAssignment
        fields = ['id', 'offering', 'offering_detail', 'group', 'group_name',
                  'assignment', 'assignment_detail', 'status', 'submitted_at']


class SubmissionSerializer(serializers.ModelSerializer):
    submitted_by = UserMiniSerializer(read_only=True)
    group_name = serializers.CharField(source='group.name', read_only=True)
    assignment_title = serializers.CharField(source='assignment.title', read_only=True)

    class Meta:
        model = Submission
        fields = ['id', 'assignment', 'assignment_title', 'group', 'group_name',
                  'submitted_by', 'content', 'file', 'submitted_at']


# ─── TASKS ────────────────────────────────────────────────────────────────────

class TaskSerializer(serializers.ModelSerializer):
    assigned_to_detail = UserMiniSerializer(source='assigned_to', read_only=True)
    created_by_detail = UserMiniSerializer(source='created_by', read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    has_evidence = serializers.BooleanField(read_only=True)
    assignment_title = serializers.CharField(source='assignment.title', read_only=True, default=None)

    class Meta:
        model = Task
        fields = ['id', 'title', 'description', 'assignment', 'assignment_title',
                  'group', 'assigned_to', 'assigned_to_detail', 'status',
                  'submission_text', 'submission_file', 'has_evidence', 'due_date',
                  'is_overdue', 'created_by', 'created_by_detail', 'created_at', 'updated_at']
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def validate(self, data):
        """
        Enforce the evidence requirement: a task cannot be saved with
        status='done' unless it has text or a file attached.
        See DESIGN_DECISIONS.md section 8.
        """
        new_status = data.get('status', getattr(self.instance, 'status', None))
        if new_status == 'done':
            text = data.get('submission_text', getattr(self.instance, 'submission_text', None))
            file = data.get('submission_file', getattr(self.instance, 'submission_file', None))
            if not text and not file:
                raise serializers.ValidationError({
                    'status': "Can't mark a task as done without attaching a file or text as evidence."
                })
        return data


# ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'notification_type', 'title', 'message', 'is_read',
                  'task', 'group', 'created_at']
