from django.contrib import admin
from .models import Class


@admin.register(Class)
class ClassAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'program', 'stage', 'cohort_year', 'status', 'rep_list', 'created_by']
    list_filter = ['program', 'stage', 'status', 'cohort_year']
    filter_horizontal = ['reps']
    search_fields = ['name', 'program']

    def rep_list(self, obj):
        return ", ".join(u.get_full_name() or u.username for u in obj.reps.all()) or "— none assigned —"
    rep_list.short_description = 'Reps'
