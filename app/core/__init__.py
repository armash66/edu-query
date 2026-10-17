"""Core domain, ingestion, database, and validation engine for EduQuery V3."""
from app.core.models import Course, IngestionReport, Score, Student

__all__ = ["Student", "Course", "Score", "IngestionReport"]
