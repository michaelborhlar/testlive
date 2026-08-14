"""Create demo accounts and a sample graduate trainee test.

    python manage.py seed_demo
"""
import io

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction

from exams.importer import store_image
from exams.models import Choice, Question, Test

User = get_user_model()


def revenue_chart() -> str:
    """Draw a small bar chart so the demo includes a real figure question."""
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        return ""

    image = Image.new("RGB", (520, 300), "white")
    draw = ImageDraw.Draw(image)
    draw.text((16, 12), "Regional revenue, 2025 (N millions)", fill=(15, 23, 42))

    values = [("North", 42), ("South", 68), ("East", 51), ("West", 35)]
    for index, (label, value) in enumerate(values):
        x = 60 + index * 110
        height = int(value * 3)
        draw.rectangle([x, 260 - height, x + 70, 260], fill=(79, 70, 229))
        draw.text((x + 18, 266), label, fill=(51, 65, 85))
        draw.text((x + 24, 260 - height - 14), str(value), fill=(15, 23, 42))

    draw.line([40, 260, 500, 260], fill=(100, 116, 139), width=2)
    draw.line([40, 40, 40, 260], fill=(100, 116, 139), width=2)

    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return store_image(buffer.getvalue(), "png")

SAMPLE_QUESTIONS = [
    {
        "type": Question.Type.SINGLE,
        "text": "A courier charges a flat ₦1,500 plus ₦220 per kilogram. What is the cost of "
        "shipping a 7 kg parcel?",
        "points": 2,
        "explanation": "1,500 + (220 x 7) = 1,500 + 1,540 = 3,040.",
        "choices": [("₦2,540", False), ("₦3,040", True), ("₦3,540", False), ("₦1,720", False)],
    },
    {
        "type": Question.Type.SINGLE,
        "text": "Revenue grew from 4.2m to 5.25m over one year. What was the percentage growth?",
        "points": 2,
        "explanation": "(5.25 - 4.2) / 4.2 = 0.25, i.e. 25%.",
        "choices": [("20%", False), ("25%", True), ("30%", False), ("12.5%", False)],
    },
    {
        "type": Question.Type.SINGLE,
        "text": "Complete the sequence: 3, 6, 11, 18, 27, ___",
        "points": 1,
        "explanation": "Differences increase by two each step: +3, +5, +7, +9, +11.",
        "choices": [("36", False), ("38", True), ("35", False), ("40", False)],
    },
    {
        "type": Question.Type.MULTIPLE,
        "text": "Which of the following are valid conclusions from the statement: "
        "\"All members of the graduate cohort completed the onboarding module\"? "
        "Select every option that applies.",
        "points": 3,
        "explanation": "Only statements that follow necessarily from the premise are valid.",
        "choices": [
            ("Nobody in the cohort skipped onboarding", True),
            ("Everyone who completed onboarding is in the cohort", False),
            ("If Ada is in the cohort, Ada completed onboarding", True),
            ("Onboarding was compulsory for all staff", False),
        ],
    },
    {
        "type": Question.Type.TRUE_FALSE,
        "text": "A dataset's median is always one of the values present in that dataset.",
        "points": 1,
        "explanation": "With an even count the median is the mean of the two middle values, "
        "which need not appear in the set.",
        "choices": [("True", False), ("False", True)],
    },
    {
        "type": Question.Type.SHORT_TEXT,
        "text": "In project management, what does the acronym KPI stand for?",
        "points": 1,
        "accepted_answers": "key performance indicator\nkey performance indicators",
        "explanation": "KPI = Key Performance Indicator.",
    },
    {
        "type": Question.Type.SINGLE,
        "text": "A team of 6 completes a task in 10 days. Assuming equal productivity, how long "
        "would 4 people take?",
        "points": 2,
        "explanation": "6 x 10 = 60 person-days; 60 / 4 = 15 days.",
        "choices": [("12 days", False), ("15 days", True), ("18 days", False), ("14 days", False)],
    },
    {
        "type": Question.Type.SINGLE,
        "text": "Study the chart. Which two regions together account for more revenue than the "
        "other two combined?",
        "points": 2,
        "explanation": "South (68) + East (51) = 119, against North (42) + West (35) = 77.",
        "image_caption": "Regional revenue, 2025",
        "_chart": True,
        "choices": [
            ("North and West", False),
            ("South and East", True),
            ("North and East", False),
            ("South and West", False),
        ],
    },
    {
        "type": Question.Type.SINGLE,
        "text": "You notice a colleague repeatedly bypassing an approval control to hit deadlines. "
        "What is the most appropriate first step?",
        "points": 2,
        "explanation": "Raising it directly and early, then escalating if unresolved, balances "
        "collegiality with control integrity.",
        "choices": [
            ("Report them anonymously to the regulator", False),
            ("Say nothing; deadlines matter more", False),
            ("Raise the concern with the colleague and then your line manager", True),
            ("Copy the same shortcut so your work keeps pace", False),
        ],
    },
]


class Command(BaseCommand):
    help = "Seed demo users and a sample graduate trainee assessment."

    @transaction.atomic
    def handle(self, *args, **options):
        admin, created = User.objects.get_or_create(
            username="admin",
            defaults={
                "email": "admin@example.com",
                "full_name": "Assessment Admin",
                "role": User.Role.ADMIN,
                "is_staff": True,
                "is_superuser": True,
            },
        )
        if created:
            admin.set_password("admin12345")
            admin.save()
            self.stdout.write(self.style.SUCCESS("Created admin / admin12345"))

        candidate, created = User.objects.get_or_create(
            username="candidate",
            defaults={
                "email": "candidate@example.com",
                "full_name": "Ada Candidate",
                "role": User.Role.CANDIDATE,
                "cohort": "2026 Graduate Intake",
            },
        )
        if created:
            candidate.set_password("candidate12345")
            candidate.save()
            self.stdout.write(self.style.SUCCESS("Created candidate / candidate12345"))

        if Test.objects.filter(title="Graduate Trainee Aptitude Test").exists():
            self.stdout.write("Sample test already present — skipping.")
            return

        test = Test.objects.create(
            title="Graduate Trainee Aptitude Test",
            description="Numerical, logical and situational judgement screening for the "
            "2026 graduate intake.",
            instructions=(
                "This assessment has a single overall time limit shown at the top of the "
                "screen.\n\n"
                "• Answers save automatically as you go.\n"
                "• You can move between questions using the numbered list on the left.\n"
                "• Flag any question you want to revisit before submitting.\n"
                "• The test submits itself automatically when the timer reaches zero."
            ),
            status=Test.Status.PUBLISHED,
            duration_minutes=25,
            question_count=0,
            pass_mark=60,
            max_attempts=2,
            shuffle_questions=False,
            shuffle_choices=True,
            created_by=admin,
        )

        for order, data in enumerate(SAMPLE_QUESTIONS):
            data = dict(data)
            choices = data.pop("choices", [])
            if data.pop("_chart", False):
                data["image"] = revenue_chart()
            question = Question.objects.create(test=test, order=order, **data)
            for choice_order, (text, is_correct) in enumerate(choices):
                Choice.objects.create(
                    question=question, order=choice_order, text=text, is_correct=is_correct
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded '{test.title}' with {test.pool_size} questions "
                f"({test.duration_minutes} minutes)."
            )
        )
