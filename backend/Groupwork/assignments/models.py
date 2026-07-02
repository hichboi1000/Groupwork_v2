import difflib

from django.db import models
from django.conf import settings
from django.utils import timezone


class Unit(models.Model):
    """
    Permanent, reusable record of a real-world unit (e.g. CS302 — Database
    Systems). The `code` field doubles as the join code: any lecturer who
    enters an existing code is added as a co-lecturer rather than creating
    a duplicate. See DESIGN_DECISIONS.md section 6.
    """
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=20, unique=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_units'
    )

    # Scoping mechanism: a lecturer only "owns" units they teach.
    # Many-to-many supports co-teaching the same unit.
    lecturers = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='taught_units',
        blank=True,
        limit_choices_to={'role': 'lecturer'}
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.code} – {self.name}"

    def name_similarity(self, candidate_name):
        """
        Returns a 0-1 similarity score between this unit's stored name and
        a candidate name a second lecturer is entering against the same
        code. Used to decide whether to silently allow a co-lecturer join
        or surface a soft confirmation warning. See DESIGN_DECISIONS.md
        section 6 — this is intentionally a soft/fuzzy check, not exact.
        """
        return difflib.SequenceMatcher(
            None, self.name.strip().lower(), candidate_name.strip().lower()
        ).ratio()


class Assignment(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField()

    unit = models.ForeignKey(
        Unit,
        on_delete=models.CASCADE,
        related_name='assignments'
    )

    deadline = models.DateTimeField()

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_assignments'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def is_overdue(self):
        return timezone.now() > self.deadline

    @property
    def days_remaining(self):
        delta = self.deadline - timezone.now()
        return max(0, delta.days)

    def __str__(self):
        return self.title


class UnitOffering(models.Model):
    """
    The semester layer: one Class doing one Unit, for one term. This is
    what makes Unit safely reusable across years without cohorts' data
    colliding. All assignment/submission data attaches here, not directly
    to Unit. See DESIGN_DECISIONS.md sections 2 and 7.

    Multiple classes can be attached to the same unit simultaneously
    (e.g. two different classes both doing "Software Development" this
    semester) — each gets its own UnitOffering row.
    """

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('closed', 'Closed'),
    ]

    unit = models.ForeignKey(
        Unit,
        on_delete=models.CASCADE,
        related_name='offerings'
    )

    class_field = models.ForeignKey(
        'classes.Class',
        on_delete=models.CASCADE,
        related_name='unit_offerings'
    )

    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='active')

    attached_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='attached_offerings',
        help_text="The rep who attached this class to the unit"
    )
    attached_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        # Prevents the same class being attached to the same unit twice
        # while one offering is already active. A class CAN re-attach to
        # the same unit later (e.g. retake), which is why this isn't a
        # blanket unique_together on (unit, class_field) — only one
        # ACTIVE offering at a time is enforced at the application layer.
        ordering = ['-attached_at']

    def __str__(self):
        return f"{self.class_field.name} → {self.unit.code} ({self.status})"

    def has_unsubmitted_work(self):
        """
        Used to decide whether detaching should show a confirmation
        warning. See DESIGN_DECISIONS.md section 7.
        """
        return self.group_assignments.exclude(
            status__in=['submitted', 'reviewed']
        ).exists()

    def close(self):
        """Soft-close: never deletes anything underneath, just flips status."""
        self.status = 'closed'
        self.closed_at = timezone.now()
        self.save()


class GroupAssignment(models.Model):
    """
    A group's work on one assignment, scoped to the specific UnitOffering
    it was created under. Scoping through the offering (not just the unit)
    is what keeps two different cohorts' submissions from ever mixing,
    even if they're doing the same unit. See DESIGN_DECISIONS.md section 2.
    """

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('submitted', 'Submitted'),
        ('reviewed', 'Reviewed'),
    ]

    offering = models.ForeignKey(
        UnitOffering,
        on_delete=models.CASCADE,
        related_name='group_assignments'
    )

    group = models.ForeignKey(
        'groups.Group',
        on_delete=models.CASCADE,
        related_name='group_assignments'
    )

    assignment = models.ForeignKey(
        Assignment,
        on_delete=models.CASCADE,
        related_name='group_assignments'
    )

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    submitted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('group', 'assignment')

    def __str__(self):
        return f"{self.group.name} → {self.assignment.title}"

    def auto_update_status(self):
        """Called after task status changes to keep GroupAssignment in sync."""
        tasks = self.group.tasks.filter(assignment=self.assignment)
        if not tasks.exists():
            return
        total = tasks.count()
        done = tasks.filter(status='done').count()
        in_prog = tasks.filter(status='progress').count()

        if done == total:
            self.status = 'in_progress'  # ready to submit
        elif in_prog > 0 or done > 0:
            self.status = 'in_progress'
        else:
            self.status = 'pending'
        self.save()


class Submission(models.Model):
    assignment = models.ForeignKey(
        Assignment,
        on_delete=models.CASCADE,
        related_name='submissions'
    )

    group = models.ForeignKey(
        'groups.Group',
        on_delete=models.CASCADE,
        related_name='submissions'
    )

    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='submissions'
    )

    content = models.TextField(blank=True, null=True)
    file = models.FileField(upload_to='submissions/%Y/%m/', blank=True, null=True)
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('assignment', 'group')

    def __str__(self):
        return f"{self.group.name} – {self.assignment.title}"
