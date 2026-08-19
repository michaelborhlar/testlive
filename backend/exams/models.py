import random
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone


class Test(models.Model):
    """A graduate trainee assessment: title, timing, question pool and rules."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"
        ARCHIVED = "archived", "Archived"

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    instructions = models.TextField(
        blank=True,
        help_text="Shown to the candidate on the briefing screen before they start.",
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)

    # Timing and sizing -----------------------------------------------------
    duration_minutes = models.PositiveIntegerField(
        default=30, help_text="Total time allowed for the whole test."
    )
    question_count = models.PositiveIntegerField(
        default=0,
        help_text="How many questions each candidate is served, drawn from the pool. "
        "0 means serve every question in the pool.",
    )
    pass_mark = models.PositiveIntegerField(default=50, help_text="Pass threshold, in percent.")
    max_attempts = models.PositiveIntegerField(default=1)

    shuffle_questions = models.BooleanField(default=False)
    shuffle_choices = models.BooleanField(default=False)
    allow_backtracking = models.BooleanField(
        default=True, help_text="Let candidates return to earlier questions."
    )
    show_result_immediately = models.BooleanField(default=True)
    allow_calculator = models.BooleanField(
        default=False, help_text="Give candidates an on-screen calculator during the test."
    )

    # Live proctoring ------------------------------------------------------
    # Settings are stored and editable now; capture/streaming is not wired up yet.
    proctoring_enabled = models.BooleanField(default=False)
    require_camera = models.BooleanField(default=False)
    require_fullscreen = models.BooleanField(default=False)
    flag_tab_switching = models.BooleanField(default=False)
    snapshot_interval_seconds = models.PositiveIntegerField(default=30)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tests_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return self.title

    @property
    def pool_size(self) -> int:
        return self.questions.count()

    @property
    def served_question_count(self) -> int:
        """How many questions a candidate actually sees."""
        pool = self.pool_size
        if not self.question_count:
            return pool
        return min(self.question_count, pool)

    @property
    def is_live(self) -> bool:
        return self.status == self.Status.PUBLISHED and self.pool_size > 0

    def build_question_set(self):
        """Pick and order the questions for one attempt."""
        questions = list(self.questions.values_list("id", flat=True))
        if self.shuffle_questions:
            random.shuffle(questions)
        if self.question_count:
            questions = questions[: self.question_count]
        return questions


class Question(models.Model):
    class Type(models.TextChoices):
        SINGLE = "single", "Single choice"
        MULTIPLE = "multiple", "Multiple choice"
        TRUE_FALSE = "true_false", "True / False"
        SHORT_TEXT = "short_text", "Short answer"
        # Interactive (SHL-style) types will be added here later.

    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name="questions")
    order = models.PositiveIntegerField(default=0)
    type = models.CharField(max_length=20, choices=Type.choices, default=Type.SINGLE)
    text = models.TextField()
    hint = models.CharField(max_length=300, blank=True)
    points = models.PositiveIntegerField(default=1)
    # Media-relative path of an accompanying graph, chart or diagram,
    # e.g. "questions/2026/chart-a1b2.png".
    image = models.CharField(max_length=300, blank=True)
    image_caption = models.CharField(max_length=200, blank=True)
    # For SHORT_TEXT: accepted answers, one per line, matched case-insensitively.
    accepted_answers = models.TextField(blank=True)
    explanation = models.TextField(
        blank=True, help_text="Shown in the review screen after grading."
    )

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return f"Q{self.order + 1}: {self.text[:60]}"

    @property
    def image_url(self):
        from django.conf import settings

        return f"{settings.MEDIA_URL}{self.image}" if self.image else ""

    @property
    def accepted_answer_list(self):
        return [a.strip().lower() for a in self.accepted_answers.splitlines() if a.strip()]

    def grade(self, answer) -> int:
        """Return the points earned by an Answer for this question."""
        if self.type == self.Type.SHORT_TEXT:
            given = (answer.text_answer or "").strip().lower()
            return self.points if given and given in self.accepted_answer_list else 0

        correct_ids = set(self.choices.filter(is_correct=True).values_list("id", flat=True))
        chosen_ids = set(answer.selected_choices.values_list("id", flat=True))
        if not correct_ids:
            return 0
        return self.points if chosen_ids == correct_ids else 0


class Choice(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="choices")
    order = models.PositiveIntegerField(default=0)
    text = models.TextField()
    is_correct = models.BooleanField(default=False)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.text[:60]


class Attempt(models.Model):
    class Status(models.TextChoices):
        IN_PROGRESS = "in_progress", "In progress"
        SUBMITTED = "submitted", "Submitted"
        EXPIRED = "expired", "Expired"

    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name="attempts")
    candidate = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="attempts"
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.IN_PROGRESS
    )
    # Frozen question ids in serve order, so reloads show the same paper.
    question_ids = models.JSONField(default=list)

    started_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    submitted_at = models.DateTimeField(null=True, blank=True)

    score = models.PositiveIntegerField(default=0)
    max_score = models.PositiveIntegerField(default=0)
    percentage = models.FloatField(default=0)
    passed = models.BooleanField(default=False)

    class Meta:
        ordering = ["-started_at"]

    def __str__(self):
        return f"{self.candidate} — {self.test}"

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(minutes=self.test.duration_minutes)
        super().save(*args, **kwargs)

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at

    @property
    def remaining_seconds(self) -> int:
        return max(0, int((self.expires_at - timezone.now()).total_seconds()))

    def ordered_questions(self):
        """Questions for this attempt, in the frozen serve order."""
        lookup = {q.id: q for q in Question.objects.filter(id__in=self.question_ids)}
        return [lookup[qid] for qid in self.question_ids if qid in lookup]

    def grade(self, expired: bool = False):
        questions = self.ordered_questions()
        answers = {a.question_id: a for a in self.answers.all()}
        total = 0
        earned = 0
        for question in questions:
            total += question.points
            answer = answers.get(question.id)
            if not answer:
                continue
            points = question.grade(answer)
            answer.points_awarded = points
            answer.is_correct = points > 0
            answer.save(update_fields=["points_awarded", "is_correct"])
            earned += points

        self.score = earned
        self.max_score = total
        self.percentage = round((earned / total) * 100, 2) if total else 0
        self.passed = self.percentage >= self.test.pass_mark
        self.status = self.Status.EXPIRED if expired else self.Status.SUBMITTED
        self.submitted_at = timezone.now()
        self.save()
        return self


class Answer(models.Model):
    attempt = models.ForeignKey(Attempt, on_delete=models.CASCADE, related_name="answers")
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="answers")
    selected_choices = models.ManyToManyField(Choice, blank=True, related_name="answers")
    text_answer = models.TextField(blank=True)
    flagged = models.BooleanField(default=False, help_text="Candidate marked it for review.")

    is_correct = models.BooleanField(default=False)
    points_awarded = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ["attempt", "question"]

    def __str__(self):
        return f"Answer to {self.question_id} in attempt {self.attempt_id}"

    @property
    def is_answered(self) -> bool:
        if self.question.type == Question.Type.SHORT_TEXT:
            return bool(self.text_answer.strip())
        return self.selected_choices.exists()
