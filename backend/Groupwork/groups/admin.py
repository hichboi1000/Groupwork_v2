from django.contrib import admin
from .models import Group

@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'leader', 'class_field', 'created_at']
    list_filter = ['class_field']
    filter_horizontal = ['members']
