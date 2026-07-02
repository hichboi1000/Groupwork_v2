from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ['username', 'email', 'first_name', 'last_name', 'role']
    list_filter = ['role']
    fieldsets = UserAdmin.fieldsets + (
        ('Role', {'fields': ('role', 'avatar_initials')}),
    )
