from rest_framework.permissions import BasePermission


class IsExamAdmin(BasePermission):
    """Only administrators may author tests and read the answer key."""

    message = "You need administrator access for this action."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_exam_admin)


class IsAttemptOwner(BasePermission):
    message = "This attempt belongs to another candidate."

    def has_object_permission(self, request, view, obj):
        return obj.candidate_id == request.user.id or request.user.is_exam_admin
