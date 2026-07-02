from rest_framework.permissions import BasePermission


class IsLecturer(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'lecturer'


class IsLeader(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'leader'


class IsRep(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'rep'


class IsStudent(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'student'


class IsLecturerOrRep(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['lecturer', 'rep']


class IsLeaderOrLecturer(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in ['leader', 'lecturer', 'rep']
