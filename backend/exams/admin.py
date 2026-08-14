from django.contrib import admin

from .models import Answer, Attempt, Choice, Question, Test


class ChoiceInline(admin.TabularInline):
    model = Choice
    extra = 4


class QuestionInline(admin.StackedInline):
    model = Question
    extra = 0
    fields = ["order", "type", "text", "points", "accepted_answers", "explanation"]


@admin.register(Test)
class TestAdmin(admin.ModelAdmin):
    list_display = ["title", "status", "duration_minutes", "pool_size", "proctoring_enabled"]
    list_filter = ["status", "proctoring_enabled"]
    search_fields = ["title", "description"]
    inlines = [QuestionInline]


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ["__str__", "test", "type", "points"]
    list_filter = ["test", "type"]
    inlines = [ChoiceInline]


@admin.register(Attempt)
class AttemptAdmin(admin.ModelAdmin):
    list_display = ["test", "candidate", "status", "score", "max_score", "percentage", "passed"]
    list_filter = ["status", "passed", "test"]


admin.site.register(Answer)
