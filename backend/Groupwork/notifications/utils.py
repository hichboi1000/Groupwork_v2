from .models import Notification


def notify_task_assigned(task):
    """Notify the member that a task was assigned to them."""
    Notification.objects.create(
        recipient=task.assigned_to,
        notification_type='task_assigned',
        title='New task assigned to you',
        message=f'"{task.title}" has been assigned to you by {task.created_by.get_full_name() or task.created_by.username}.',
        task=task,
        group=task.group,
    )


def notify_task_status_updated(task, updated_by):
    """Notify the group leader when a task status changes."""
    leader = task.group.leader
    if leader == updated_by:
        return  # Leader updated it themselves, no need to notify
    Notification.objects.create(
        recipient=leader,
        notification_type='task_updated',
        title='Task progress updated',
        message=f'{updated_by.get_full_name() or updated_by.username} marked "{task.title}" as {task.get_status_display()}.',
        task=task,
        group=task.group,
    )


def notify_member_joined(group, new_member):
    """Notify the group leader that someone joined."""
    Notification.objects.create(
        recipient=group.leader,
        notification_type='group_joined',
        title='New member joined your group',
        message=f'{new_member.get_full_name() or new_member.username} joined {group.name}.',
        group=group,
    )


def notify_assignment_posted(assignment, groups):
    """Notify all leaders in the class when a new assignment is posted."""
    for group in groups:
        Notification.objects.create(
            recipient=group.leader,
            notification_type='assignment_posted',
            title='New assignment posted',
            message=f'A new assignment "{assignment.title}" has been posted for {assignment.unit.name}. Deadline: {assignment.deadline.strftime("%d %b %Y")}.',
            group=group,
        )


def notify_group_assignment_linked(group_assignment):
    """Notify all group members when an assignment is linked to their group."""
    group = group_assignment.group
    assignment = group_assignment.assignment
    for member in group.members.all():
        Notification.objects.create(
            recipient=member,
            notification_type='group_assigned',
            title='Assignment linked to your group',
            message=f'Your group "{group.name}" has been assigned "{assignment.title}". Deadline: {assignment.deadline.strftime("%d %b %Y")}.',
            group=group,
        )
