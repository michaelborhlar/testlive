from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AdminAttemptViewSet,
    AdminStatsView,
    AdminTestViewSet,
    AttemptViewSet,
    CandidateTestViewSet,
    QuestionImageUploadView,
    QuestionImportView,
)

admin_router = DefaultRouter()
admin_router.register("tests", AdminTestViewSet, basename="admin-test")
admin_router.register("attempts", AdminAttemptViewSet, basename="admin-attempt")

candidate_router = DefaultRouter()
candidate_router.register("tests", CandidateTestViewSet, basename="test")
candidate_router.register("attempts", AttemptViewSet, basename="attempt")

urlpatterns = [
    path("admin/stats/", AdminStatsView.as_view(), name="admin-stats"),
    path("admin/import-questions/", QuestionImportView.as_view(), name="admin-import-questions"),
    path("admin/question-image/", QuestionImageUploadView.as_view(), name="admin-question-image"),
    path("admin/", include(admin_router.urls)),
    path("", include(candidate_router.urls)),
]
