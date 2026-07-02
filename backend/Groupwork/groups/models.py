from django.db import models
from django.conf import settings


class Group(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField(blank=True, null=True)

    leader = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='led_groups'
    )

    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='joined_groups',
        blank=True
    )

    # Groups belong to their Class PERMANENTLY — they progress together
    # through semesters and only get archived when the class graduates.
    # A group's relationship to a Unit is now indirect, through whichever
    # UnitOffering its Class is currently attached to (if any).
    # See DESIGN_DECISIONS.md section 4.
    class_field = models.ForeignKey(
        'classes.Class',
        on_delete=models.SET_NULL,
        related_name='groups',
        null=True,
        blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    def current_offering(self):
        """
        The active UnitOffering this group's class is currently attached
        to, if any. A group has no direct unit relationship — this always
        traces through the class. Returns None if the class isn't
        currently attached to anything.
        """
        if not self.class_field:
            return None
        return self.class_field.unit_offerings.filter(status='active').first()

    def get_progress_summary(self):
        """Returns a dict with task status counts for this group."""
        tasks = self.tasks.all()
        return {
            'total': tasks.count(),
            'todo': tasks.filter(status='todo').count(),
            'in_progress': tasks.filter(status='progress').count(),
            'done': tasks.filter(status='done').count(),
        }
