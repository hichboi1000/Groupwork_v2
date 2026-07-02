from django.contrib import admin
from .models import Unit, Assignment, UnitOffering, GroupAssignment, Submission


@admin.register(Unit)
class UnitAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'created_by', 'lecturer_list', 'created_at']
    filter_horizontal = ['lecturers']
    search_fields = ['code', 'name']

    def lecturer_list(self, obj):
        return ", ".join(u.get_full_name() or u.username for u in obj.lecturers.all()) or "— none assigned —"
    lecturer_list.short_description = 'Lecturers'


@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    list_display = ['title', 'unit', 'deadline', 'created_by']
    list_filter = ['unit']


@admin.register(UnitOffering)
class UnitOfferingAdmin(admin.ModelAdmin):
    list_display = ['unit', 'class_field', 'status', 'attached_by', 'attached_at', 'closed_at']
    list_filter = ['status', 'unit']


admin.site.register(GroupAssignment)
admin.site.register(Submission)
