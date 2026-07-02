from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):

    ROLE_CHOICES = [
        ('student', 'Student'),
        ('leader', 'Leader'),
        ('rep', 'Class Representative'),
        ('lecturer', 'Lecturer'),
    ]

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student')
    email = models.EmailField(unique=True, blank=True, null=True)
    avatar_initials = models.CharField(max_length=3, blank=True)

    def save(self, *args, **kwargs):
        if not self.avatar_initials:
            parts = self.get_full_name().split()
            if parts:
                self.avatar_initials = ''.join(p[0].upper() for p in parts[:2])
            else:
                self.avatar_initials = self.username[:2].upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.role})"
