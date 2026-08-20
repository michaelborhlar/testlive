import random

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from accounts.serializers import UserSerializer

from .models import Answer, Attempt, Choice, Question, Test

# ---------------------------------------------------------------------------
# Admin-facing serializers (include the answer key)
# ---------------------------------------------------------------------------


class ChoiceSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)

    class Meta:
        model = Choice
        fields = ["id", "order", "text", "is_correct"]


class QuestionSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    choices = ChoiceSerializer(many=True, required=False)
    image_url = serializers.SerializerMethodField()
    class Meta:
        model = Question
        fields = [
            "id",
            "order",
            "type",
            "text",
            "hint",
            "points",
            "image",
            "image_caption",
            "image_url",
            "accepted_answers",
            "explanation",
            "choices",
        ]
    def get_image_url(self, obj):
        request = self.context.get("request")
        if obj.image and request:
            return request.build_absolute_uri(obj.image.url)
        return None

    def validate(self, attrs):
        qtype = attrs.get("type", getattr(self.instance, "type", Question.Type.SINGLE))
        choices = attrs.get("choices")
        if qtype == Question.Type.SHORT_TEXT:
            return attrs
        if choices is not None:
            if len(choices) < 2:
                raise serializers.ValidationError(
                    {"choices": "Provide at least two options for a choice question."}
                )
            correct = [c for c in choices if c.get("is_correct")]
            if not correct:
                raise serializers.ValidationError(
                    {"choices": "Mark at least one option as correct."}
                )
            if qtype in (Question.Type.SINGLE, Question.Type.TRUE_FALSE) and len(correct) > 1:
                raise serializers.ValidationError(
                    {"choices": "This question type allows only one correct option."}
                )
        return attrs


class TestSerializer(serializers.ModelSerializer):
    """Full read/write representation used by the admin test editor."""

    questions = QuestionSerializer(many=True, required=False)
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True)
    pool_size = serializers.IntegerField(read_only=True)
    served_question_count = serializers.IntegerField(read_only=True)
    total_points = serializers.SerializerMethodField()
    attempt_count = serializers.SerializerMethodField()

    class Meta:
        model = Test
        fields = [
            "id",
            "title",
            "description",
            "instructions",
            "status",
            "duration_minutes",
            "question_count",
            "pass_mark",
            "max_attempts",
            "shuffle_questions",
            "shuffle_choices",
            "allow_backtracking",
            "show_result_immediately",
            "allow_calculator",
            "proctoring_enabled",
            "require_camera",
            "require_fullscreen",
            "flag_tab_switching",
            "snapshot_interval_seconds",
            "questions",
            "pool_size",
            "served_question_count",
            "total_points",
            "attempt_count",
            "created_by_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "created_by_name"]

    def get_total_points(self, obj):
        return sum(q.points for q in obj.questions.all())

    def get_attempt_count(self, obj):
        return obj.attempts.count()

    def validate(self, attrs):
        if attrs.get("duration_minutes", 1) < 1:
            raise serializers.ValidationError(
                {"duration_minutes": "Duration must be at least one minute."}
            )
        if attrs.get("pass_mark", 0) > 100:
            raise serializers.ValidationError({"pass_mark": "Pass mark cannot exceed 100%."})
        return attrs

    # -- nested write ------------------------------------------------------

    def _sync_choices(self, question, choices_data):
        keep_ids = []
        for index, choice_data in enumerate(choices_data):
            choice_id = choice_data.pop("id", None)
            choice_data["order"] = choice_data.get("order", index)
            instance = Choice.objects.filter(id=choice_id, question=question).first()
            if instance:
                for field, value in choice_data.items():
                    setattr(instance, field, value)
                instance.save()
            else:
                instance = Choice.objects.create(question=question, **choice_data)
            keep_ids.append(instance.id)
        question.choices.exclude(id__in=keep_ids).delete()

    def _sync_questions(self, test, questions_data):
        keep_ids = []
        for index, question_data in enumerate(questions_data):
            choices_data = question_data.pop("choices", [])
            question_id = question_data.pop("id", None)
            question_data["order"] = question_data.get("order", index)
            instance = Question.objects.filter(id=question_id, test=test).first()
            if instance:
                for field, value in question_data.items():
                    setattr(instance, field, value)
                instance.save()
            else:
                instance = Question.objects.create(test=test, **question_data)
            if instance.type == Question.Type.SHORT_TEXT:
                instance.choices.all().delete()
            else:
                self._sync_choices(instance, choices_data)
            keep_ids.append(instance.id)
        test.questions.exclude(id__in=keep_ids).delete()

    @transaction.atomic
    def create(self, validated_data):
        questions_data = validated_data.pop("questions", [])
        test = Test.objects.create(**validated_data)
        self._sync_questions(test, questions_data)
        return test

    @transaction.atomic
    def update(self, instance, validated_data):
        questions_data = validated_data.pop("questions", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        if questions_data is not None:
            self._sync_questions(instance, questions_data)
        return instance


class TestListSerializer(serializers.ModelSerializer):
    """Lightweight row for the admin test table."""

    pool_size = serializers.IntegerField(read_only=True)
    served_question_count = serializers.IntegerField(read_only=True)
    attempt_count = serializers.SerializerMethodField()

    class Meta:
        model = Test
        fields = [
            "id",
            "title",
            "description",
            "status",
            "duration_minutes",
            "question_count",
            "pass_mark",
            "proctoring_enabled",
            "allow_calculator",
            "pool_size",
            "served_question_count",
            "attempt_count",
            "updated_at",
        ]

    def get_attempt_count(self, obj):
        return obj.attempts.count()


# ---------------------------------------------------------------------------
# Candidate-facing serializers (answer key withheld)
# ---------------------------------------------------------------------------


class CandidateChoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Choice
        fields = ["id", "text"]


class CandidateQuestionSerializer(serializers.ModelSerializer):
    choices = serializers.SerializerMethodField()
    number = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Question
        fields = [
            "id",
            "number",
            "type",
            "text",
            "hint",
            "points",
            "image_url",
            "image_caption",
            "choices",
        ]

    def get_number(self, obj):
        order = self.context.get("question_order", [])
        return order.index(obj.id) + 1 if obj.id in order else obj.order + 1
    
    def get_image_url(self, obj):
        request = self.context.get("request")
        if obj.image and request:
            return request.build_absolute_uri(obj.image.url)
        return None
    
    def get_choices(self, obj):
        choices = list(obj.choices.all())
        attempt = self.context.get("attempt")
        if attempt and attempt.test.shuffle_choices:
            # Deterministic per attempt+question so reloads keep the same order.
            random.Random(f"{attempt.id}-{obj.id}").shuffle(choices)
        return CandidateChoiceSerializer(choices, many=True).data


class AnswerStateSerializer(serializers.ModelSerializer):
    selected_choices = serializers.PrimaryKeyRelatedField(many=True, read_only=True)

    class Meta:
        model = Answer
        fields = ["question", "selected_choices", "text_answer", "flagged"]


class TestBriefSerializer(serializers.ModelSerializer):
    """What a candidate sees before starting: rules, not content."""

    served_question_count = serializers.IntegerField(read_only=True)
    total_points = serializers.SerializerMethodField()
    attempts_used = serializers.SerializerMethodField()
    can_start = serializers.SerializerMethodField()

    class Meta:
        model = Test
        fields = [
            "id",
            "title",
            "description",
            "instructions",
            "duration_minutes",
            "served_question_count",
            "total_points",
            "pass_mark",
            "max_attempts",
            "allow_backtracking",
            "allow_calculator",
            "proctoring_enabled",
            "require_camera",
            "attempts_used",
            "can_start",
        ]

    def get_total_points(self, obj):
        return sum(q.points for q in obj.questions.all()[: obj.served_question_count])

    def _attempts_used(self, obj):
        user = self.context["request"].user
        return obj.attempts.filter(candidate=user).exclude(
            status=Attempt.Status.IN_PROGRESS
        ).count()

    def get_attempts_used(self, obj):
        return self._attempts_used(obj)

    def get_can_start(self, obj):
        return obj.is_live and self._attempts_used(obj) < obj.max_attempts


class AttemptSerializer(serializers.ModelSerializer):
    """The live exam payload: frozen paper, saved answers and the clock."""

    test = TestBriefSerializer(read_only=True)
    questions = serializers.SerializerMethodField()
    answers = serializers.SerializerMethodField()
    remaining_seconds = serializers.IntegerField(read_only=True)
    server_time = serializers.SerializerMethodField()

    class Meta:
        model = Attempt
        fields = [
            "id",
            "test",
            "status",
            "started_at",
            "expires_at",
            "server_time",
            "remaining_seconds",
            "questions",
            "answers",
        ]

    def get_server_time(self, obj):
        return timezone.now().isoformat()

    def get_questions(self, obj):
        context = dict(self.context, attempt=obj, question_order=obj.question_ids)
        return CandidateQuestionSerializer(
            obj.ordered_questions(), many=True, context=context
        ).data

    def get_answers(self, obj):
        return AnswerStateSerializer(obj.answers.all(), many=True).data


class AttemptResultSerializer(serializers.ModelSerializer):
    """Post-submission summary, plus an optional per-question review."""

    test_title = serializers.CharField(source="test.title", read_only=True)
    candidate_name = serializers.CharField(source="candidate.full_name", read_only=True)
    candidate_email = serializers.CharField(source="candidate.email", read_only=True)
    duration_taken = serializers.SerializerMethodField()
    review = serializers.SerializerMethodField()
    results_visible = serializers.SerializerMethodField()

    class Meta:
        model = Attempt
        fields = [
            "id",
            "test",
            "test_title",
            "candidate_name",
            "candidate_email",
            "status",
            "score",
            "max_score",
            "percentage",
            "passed",
            "started_at",
            "submitted_at",
            "duration_taken",
            "results_visible",
            "review",
        ]

    def get_duration_taken(self, obj):
        if not obj.submitted_at:
            return None
        return int((obj.submitted_at - obj.started_at).total_seconds())

    def get_results_visible(self, obj):
        request = self.context.get("request")
        if request and request.user.is_exam_admin:
            return True
        return obj.test.show_result_immediately

    def get_review(self, obj):
        if not self.get_results_visible(obj):
            return []
        answers = {a.question_id: a for a in obj.answers.prefetch_related("selected_choices")}
        review = []
        for index, question in enumerate(obj.ordered_questions(), start=1):
            answer = answers.get(question.id)
            review.append(
                {
                    "number": index,
                    "question_id": question.id,
                    "text": question.text,
                    "type": question.type,
                    "image_url": self.context["request"].build_absolute_uri(question.image.url) if question.image else None,
                    "points": question.points,
                    "points_awarded": answer.points_awarded if answer else 0,
                    "is_correct": answer.is_correct if answer else False,
                    "explanation": question.explanation,
                    "your_answer": self._describe_answer(question, answer),
                    "correct_answer": self._describe_correct(question),
                }
            )
        return review

    def _describe_answer(self, question, answer):
        if not answer:
            return None
        if question.type == Question.Type.SHORT_TEXT:
            return answer.text_answer or None
        texts = [c.text for c in answer.selected_choices.all()]
        return ", ".join(texts) if texts else None

    def _describe_correct(self, question):
        if question.type == Question.Type.SHORT_TEXT:
            return " / ".join(question.accepted_answers.splitlines())
        return ", ".join(c.text for c in question.choices.filter(is_correct=True))


class AttemptRowSerializer(serializers.ModelSerializer):
    """Row in the admin results table."""

    candidate = UserSerializer(read_only=True)
    test_title = serializers.CharField(source="test.title", read_only=True)
    duration_taken = serializers.SerializerMethodField()

    class Meta:
        model = Attempt
        fields = [
            "id",
            "test",
            "test_title",
            "candidate",
            "status",
            "score",
            "max_score",
            "percentage",
            "passed",
            "started_at",
            "submitted_at",
            "duration_taken",
        ]

    def get_duration_taken(self, obj):
        if not obj.submitted_at:
            return None
        return int((obj.submitted_at - obj.started_at).total_seconds())


class SaveAnswerSerializer(serializers.Serializer):
    question = serializers.IntegerField()
    selected_choices = serializers.ListField(
        child=serializers.IntegerField(), required=False, allow_empty=True
    )
    text_answer = serializers.CharField(required=False, allow_blank=True)
    flagged = serializers.BooleanField(required=False)
