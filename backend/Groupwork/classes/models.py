from django.db import models
from django.conf import settings


class Class(models.Model):
    """
    Represents one specific cohort at one specific stage — e.g. "BBIT 3.2"
    for the 2024 intake. This is deliberately NOT a reusable label: next
    year's BBIT 3.2 (a different batch of students) gets its own Class row,
    distinguished by cohort_year. See DESIGN_DECISIONS.md section 3.
    """

    STAGE_CHOICES = [
        ('1.1', 'Year 1, Semester 1'),
        ('1.2', 'Year 1, Semester 2'),
        ('2.1', 'Year 2, Semester 1'),
        ('2.2', 'Year 2, Semester 2'),
        ('3.1', 'Year 3, Semester 1'),
        ('3.2', 'Year 3, Semester 2'),
        ('4.1', 'Year 4, Semester 1'),
        ('4.2', 'Year 4, Semester 2'),
    ]

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('archived', 'Archived'),  # graduated / no longer in session
    ]

    name = models.CharField(
        max_length=100,
        help_text="e.g. 'BBIT 3.2' — display label, not used for uniqueness"
    )
    program = models.CharField(max_length=100, help_text="e.g. 'BBIT'")
    stage = models.CharField(max_length=10, choices=STAGE_CHOICES)
    cohort_year = models.PositiveIntegerField(
        help_text="The year this cohort first enrolled — disambiguates "
                   "this year's 3.2 from next year's 3.2"
    )
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='active')

    # Class code — lets a group leader self-attach their group to this
    # class, same low-friction pattern as group codes and unit codes.
    # Distinct from Unit.code on purpose: multiple classes can do the same
    # unit, so a shared code there would break this. See conversation log.
    code = models.CharField(max_length=20, unique=True)

    # Multiple reps supported for handover periods — see DESIGN_DECISIONS.md section 3
    reps = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='managed_classes',
        blank=True,
        limit_choices_to={'role': 'rep'}
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_classes'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('program', 'stage', 'cohort_year')
        ordering = ['-cohort_year', 'program', 'stage']

    def __str__(self):
        return f"{self.name} ({self.cohort_year} intake)"
