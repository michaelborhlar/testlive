import io
from datetime import timedelta

from django.conf import settings
from django.db.models import Avg, Count, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User

from .importer import (
    DocumentError,
    build_questions,
    extract_text,
    ollama_available,
    store_image,
)
from .models import Answer, Attempt, Choice, Question, Test
from .permissions import IsAttemptOwner, IsExamAdmin
from .serializers import (
    AttemptResultSerializer,
    AttemptRowSerializer,
    AttemptSerializer,
    SaveAnswerSerializer,
    TestBriefSerializer,
    TestListSerializer,
    TestSerializer,
)


def close_if_expired(attempt: Attempt) -> Attempt:
    """Grade an abandoned attempt whose clock has run out."""
    if attempt.status == Attempt.Status.IN_PROGRESS and attempt.is_expired:
        attempt.grade(expired=True)
    return attempt


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------


class AdminTestViewSet(viewsets.ModelViewSet):
    """Full CRUD over tests, including the nested question editor payload."""

    permission_classes = [IsExamAdmin]
    queryset = Test.objects.prefetch_related("questions__choices", "attempts")

    def get_serializer_class(self):
        return TestListSerializer if self.action == "list" else TestSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get("status")
        search = self.request.query_params.get("search")
        if status_filter:
            qs = qs.filter(status=status_filter)
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(description__icontains=search))
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        test = self.get_object()
        if not test.pool_size:
            raise ValidationError("Add at least one question before publishing.")
        test.status = Test.Status.PUBLISHED
        test.save(update_fields=["status", "updated_at"])
        return Response(TestSerializer(test, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def unpublish(self, request, pk=None):
        test = self.get_object()
        test.status = Test.Status.DRAFT
        test.save(update_fields=["status", "updated_at"])
        return Response(TestSerializer(test, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def duplicate(self, request, pk=None):
        source = self.get_object()
        questions = list(source.questions.prefetch_related("choices"))
        source.pk = None
        source.title = f"{source.title} (copy)"
        source.status = Test.Status.DRAFT
        source.created_by = request.user
        source.save()
        for question in questions:
            choices = list(question.choices.all())
            question.pk = None
            question.test = source
            question.save()
            for choice in choices:
                choice.pk = None
                choice.question = question
                choice.save()
        return Response(
            TestSerializer(source, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["get"])
    def attempts(self, request, pk=None):
        test = self.get_object()
        rows = test.attempts.select_related("candidate", "test")
        return Response(AttemptRowSerializer(rows, many=True).data)


class AdminAttemptViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only access to every candidate attempt, with full review detail."""

    permission_classes = [IsExamAdmin]
    queryset = Attempt.objects.select_related("candidate", "test")

    def get_serializer_class(self):
        return AttemptRowSerializer if self.action == "list" else AttemptResultSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        test_id = self.request.query_params.get("test")
        status_filter = self.request.query_params.get("status")
        if test_id:
            qs = qs.filter(test_id=test_id)
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs


class QuestionImageUploadView(APIView):
    """Upload a graph, chart or diagram to attach to a question."""

    permission_classes = [IsExamAdmin]
    parser_classes = [MultiPartParser, FormParser]

    ALLOWED = {"image/png", "image/jpeg", "image/gif", "image/webp"}
    MAX_BYTES = 5 * 1024 * 1024

    def post(self, request):
        upload = request.FILES.get("image")
        if not upload:
            raise ValidationError({"image": "Choose an image to upload."})
        if upload.size > self.MAX_BYTES:
            raise ValidationError({"image": "Images must be 5 MB or smaller."})
        if upload.content_type not in self.ALLOWED:
            raise ValidationError({"image": "Use a PNG, JPEG, GIF or WebP image."})

        data = upload.read()
        try:
            from PIL import Image

            Image.open(io.BytesIO(data)).verify()
        except ImportError:
            pass  # Pillow is optional; the content type check still applies.
        except Exception as exc:
            raise ValidationError({"image": "That file is not a readable image."}) from exc

        extension = (upload.name or "png").rsplit(".", 1)[-1]
        path = store_image(data, extension)
        return Response(
            {
                "image": path,
                "image_url": request.build_absolute_uri(f"{settings.MEDIA_URL}{path}"),
            },
            status=status.HTTP_201_CREATED,
        )


class QuestionImportView(APIView):
    """Read questions out of an uploaded PDF / Word / text document.

    Nothing is written to the database — the parsed questions are returned so
    the administrator can review and edit them before saving the test.
    """

    permission_classes = [IsExamAdmin]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        return Response(
            {
                "engines": ["document-parser", "local-ai"],
                "local_ai_available": ollama_available(),
                "accepted": [".pdf", ".docx", ".txt", ".md"],
                "max_mb": 10,
            }
        )

    def post(self, request):
        upload = request.FILES.get("file")
        if not upload:
            raise ValidationError({"file": "Attach a document to import."})

        try:
            text = extract_text(upload)
            questions, stats, engine = build_questions(text)
        except DocumentError as exc:
            raise ValidationError({"file": str(exc)}) from exc

        if not questions:
            raise ValidationError(
                {
                    "file": "No questions could be read from that document. Number each "
                    "question (1., 2., …), label the options (A., B., …) and give the "
                    "answer as 'Answer: B' — or add an answer key at the end."
                }
            )

        return Response(
            {
                "engine": engine,
                "source": upload.name,
                "stats": stats,
                "questions": questions,
            }
        )


class AdminStatsView(APIView):
    permission_classes = [IsExamAdmin]

    def get(self, request):
        graded = Attempt.objects.exclude(status=Attempt.Status.IN_PROGRESS)
        summary = graded.aggregate(avg=Avg("percentage"), passed=Count("id", filter=Q(passed=True)))
        recent = graded.select_related("candidate", "test")[:8]
        return Response(
            {
                "tests_total": Test.objects.count(),
                "tests_published": Test.objects.filter(status=Test.Status.PUBLISHED).count(),
                "questions_total": Question.objects.count(),
                "candidates_total": User.objects.filter(role=User.Role.CANDIDATE).count(),
                "attempts_total": graded.count(),
                "attempts_in_progress": Attempt.objects.filter(
                    status=Attempt.Status.IN_PROGRESS
                ).count(),
                "average_score": round(summary["avg"] or 0, 1),
                "pass_rate": round(
                    (summary["passed"] / graded.count() * 100) if graded.count() else 0, 1
                ),
                "recent_attempts": AttemptRowSerializer(recent, many=True).data,
            }
        )


# ---------------------------------------------------------------------------
# Candidate
# ---------------------------------------------------------------------------


class CandidateTestViewSet(viewsets.ReadOnlyModelViewSet):
    """Published tests a candidate may sit, plus the start action."""

    permission_classes = [IsAuthenticated]
    serializer_class = TestBriefSerializer

    def get_queryset(self):
        return (
            Test.objects.filter(status=Test.Status.PUBLISHED)
            .annotate(n=Count("questions"))
            .filter(n__gt=0)
            .prefetch_related("questions")
        )

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        test = self.get_object()

        for stale in test.attempts.filter(
            candidate=request.user, status=Attempt.Status.IN_PROGRESS
        ):
            close_if_expired(stale)

        live = test.attempts.filter(
            candidate=request.user, status=Attempt.Status.IN_PROGRESS
        ).first()
        if live:
            return Response(AttemptSerializer(live, context={"request": request}).data)

        used = test.attempts.filter(candidate=request.user).exclude(
            status=Attempt.Status.IN_PROGRESS
        ).count()
        if used >= test.max_attempts:
            raise PermissionDenied(
                f"You have used all {test.max_attempts} permitted attempt(s) for this test."
            )

        question_ids = test.build_question_set()
        if not question_ids:
            raise ValidationError("This test has no questions yet.")

        attempt = Attempt.objects.create(
            test=test,
            candidate=request.user,
            question_ids=question_ids,
            expires_at=timezone.now() + timedelta(minutes=test.duration_minutes),
        )
        return Response(
            AttemptSerializer(attempt, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class AttemptViewSet(viewsets.ReadOnlyModelViewSet):
    """The candidate's own attempts: live paper, autosave, submit and results."""

    permission_classes = [IsAuthenticated, IsAttemptOwner]

    def get_queryset(self):
        return Attempt.objects.filter(candidate=self.request.user).select_related("test")

    def get_serializer_class(self):
        return AttemptRowSerializer if self.action == "list" else AttemptSerializer

    def retrieve(self, request, *args, **kwargs):
        attempt = close_if_expired(self.get_object())
        if attempt.status != Attempt.Status.IN_PROGRESS:
            return Response(
                AttemptResultSerializer(attempt, context={"request": request}).data
            )
        return Response(AttemptSerializer(attempt, context={"request": request}).data)

    def _require_live(self, attempt):
        close_if_expired(attempt)
        if attempt.status != Attempt.Status.IN_PROGRESS:
            raise ValidationError("This attempt is already closed.")

    @action(detail=True, methods=["post"])
    def answer(self, request, pk=None):
        """Autosave a single answer. Called on every candidate interaction."""
        attempt = self.get_object()
        self._require_live(attempt)

        payload = SaveAnswerSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data

        if data["question"] not in attempt.question_ids:
            raise ValidationError("That question is not part of this attempt.")
        question = Question.objects.get(id=data["question"])

        answer, _ = Answer.objects.get_or_create(attempt=attempt, question=question)
        if "text_answer" in data:
            answer.text_answer = data["text_answer"]
        if "flagged" in data:
            answer.flagged = data["flagged"]
        answer.save()

        if "selected_choices" in data:
            valid = Choice.objects.filter(id__in=data["selected_choices"], question=question)
            if len(valid) != len(set(data["selected_choices"])):
                raise ValidationError("One or more options do not belong to this question.")
            if question.type in (Question.Type.SINGLE, Question.Type.TRUE_FALSE) and len(valid) > 1:
                raise ValidationError("This question accepts only one option.")
            answer.selected_choices.set(valid)

        return Response(
            {
                "question": question.id,
                "saved_at": timezone.now().isoformat(),
                "remaining_seconds": attempt.remaining_seconds,
            }
        )

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        attempt = self.get_object()
        if attempt.status == Attempt.Status.IN_PROGRESS:
            attempt.grade(expired=attempt.is_expired)
        return Response(AttemptResultSerializer(attempt, context={"request": request}).data)

    @action(detail=True, methods=["get"])
    def result(self, request, pk=None):
        attempt = close_if_expired(self.get_object())
        return Response(AttemptResultSerializer(attempt, context={"request": request}).data)