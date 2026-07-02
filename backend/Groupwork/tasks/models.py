from django.db import models
from django.conf import settings
from django.utils import timezone


class Task(models.Model):

    STATUS_CHOICES = [
        ('todo', 'To Do'),
        ('progress', 'In Progress'),
        ('done', 'Done'),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)

    assignment = models.ForeignKey(
        'assignments.Assignment',
        on_delete=models.CASCADE,
        related_name='tasks',
        null=True,
        blank=True
    )

    group = models.ForeignKey(
        'groups.Group',
        on_delete=models.CASCADE,
        related_name='tasks'
    )

    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='tasks'
    )

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='todo')

    # Evidence requirement: a task cannot transition to 'done' unless at
    # least one of these is populated. Enforced in the view layer, not
    # just the model, since the check needs to run on the transition
    # attempt. See DESIGN_DECISIONS.md section 8.
    submission_text = models.TextField(blank=True, null=True)
    submission_file = models.FileField(upload_to='task_evidence/%Y/%m/', blank=True, null=True)

    due_date = models.DateTimeField(null=True, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_tasks'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def is_overdue(self):
        if self.due_date and self.status != 'done':
            return timezone.now() > self.due_date
        return False

    @property
    def has_evidence(self):
        return bool(self.submission_text) or bool(self.submission_file)

    def __str__(self):
        return f"{self.title} → {self.assigned_to.username}"
