from django.urls import path
from . import views

urlpatterns = [
    # Auth & Users
    path('register/', views.register_user, name='register'),
    path('me/', views.me, name='me'),
    path('users/', views.user_list, name='user-list'),
    path('users/<int:pk>/', views.user_detail, name='user-detail'),

    # Classes (rep-managed cohorts)
    path('classes/', views.classes_view, name='classes'),
    path('classes/<int:pk>/', views.class_detail, name='class-detail'),
    path('classes/<int:pk>/add-rep/', views.add_rep_to_class, name='add-rep-to-class'),

    # Groups
    path('groups/create/', views.create_group, name='create-group'),
    path('groups/join/', views.join_group, name='join-group'),
    path('groups/mine/', views.my_group, name='my-group'),
    path('groups/all/', views.all_groups, name='all-groups'),
    path('groups/leave/', views.leave_group, name='leave-group'),
    path('groups/progress/', views.group_progress, name='group-progress'),

    # Tasks
    path('tasks/', views.tasks, name='tasks'),
    path('tasks/<int:pk>/', views.task_detail, name='task-detail'),

    # Units
    path('units/', views.units, name='units'),
    path('units/create/', views.create_unit, name='create-unit'),
    path('units/mine/', views.my_units, name='my-units'),

    # Unit Offerings (attach/detach — rep controlled)
    path('unit-offerings/', views.unit_offerings, name='unit-offerings'),
    path('unit-offerings/history/', views.unit_offerings_history, name='unit-offerings-history'),
    path('unit-offerings/attach/', views.attach_class, name='attach-class'),
    path('unit-offerings/<int:pk>/detach/', views.detach_class, name='detach-class'),

    # Assignments
    path('assignments/', views.assignments_view, name='assignments'),
    path('assignments/<int:pk>/', views.assignment_detail, name='assignment-detail'),

    # Group Assignments (linking)
    path('group-assignments/', views.group_assignments, name='group-assignments'),

    # Submissions
    path('submissions/', views.submissions, name='submissions'),

    # Notifications
    path('notifications/', views.my_notifications, name='notifications'),
    path('notifications/<int:pk>/read/', views.mark_notification_read, name='notification-read'),
    path('notifications/read-all/', views.mark_all_notifications_read, name='notifications-read-all'),

    # Dashboard
    path('dashboard/', views.dashboard_stats, name='dashboard-stats'),
]
