from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Platform user. Admins author tests; candidates sit them."""

    class Role(models.TextChoices):
        ADMIN = "admin", "Administrator"
        CANDIDATE = "candidate", "Candidate"

    email = models.EmailField("email address", unique=True)
    full_name = models.CharField(max_length=150, blank=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.CANDIDATE)
    # Free-form label used to group candidates, e.g. "2026 Graduate Intake".
    cohort = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    REQUIRED_FIELDS = ["email"]

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.full_name or self.username

    def save(self, *args, **kwargs):
        if not self.full_name:
            self.full_name = f"{self.first_name} {self.last_name}".strip()
        super().save(*args, **kwargs)

    @property
    def is_exam_admin(self) -> bool:
        return self.role == self.Role.ADMIN or self.is_superuser
