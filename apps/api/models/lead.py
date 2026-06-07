"""
Lead ORM model — the core entity of the LocalAudit AI system.

A Lead represents one local business that has been discovered, analyzed,
and (optionally) contacted.  The lifecycle moves through:
  discovered → analyzed → contacted → replied → converted / ignored

The `issues` column stores the structured analysis result as JSON so that
the frontend can render individual problem cards without a separate table.
"""

import json
import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base


class LeadStatus(str, PyEnum):
    DISCOVERED = "discovered"
    ANALYZED = "analyzed"
    CONTACTED = "contacted"
    REPLIED = "replied"
    CONVERTED = "converted"
    IGNORED = "ignored"


class LeadPriority(str, PyEnum):
    HIGH = "high"       # score < 40
    MEDIUM = "medium"   # score 40–70
    LOW = "low"         # score > 70 (usually ignored)


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Business identity ─────────────────────────────────────────────────
    business_name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    website: Mapped[str | None] = mapped_column(String(500), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # ── Audit results ─────────────────────────────────────────────────────
    # Stored as a JSON string: list of {code, title, impact, severity}
    issues_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Full AI-generated narrative report for the business owner
    report_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    # URL of a screenshot taken during analysis (optional)
    screenshot_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # Raw page load time in seconds (used for personalised email copy)
    load_time_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)

    # ── Outreach tracking ─────────────────────────────────────────────────
    email_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    email_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    follow_up_1_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    follow_up_1_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    follow_up_2_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    follow_up_2_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── Pipeline outcome ──────────────────────────────────────────────────
    replied: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    converted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    deal_value: Mapped[float | None] = mapped_column(Float, nullable=True)

    status: Mapped[str] = mapped_column(
        String(20), default=LeadStatus.DISCOVERED, nullable=False, index=True
    )
    priority: Mapped[str | None] = mapped_column(String(10), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user: Mapped["User"] = relationship("User", back_populates="leads")  # noqa: F821

    # ── Convenience helpers ───────────────────────────────────────────────

    @property
    def issues(self) -> list[dict]:
        """Deserialise the JSON issues column into a Python list."""
        if not self.issues_json:
            return []
        try:
            return json.loads(self.issues_json)
        except (json.JSONDecodeError, TypeError):
            return []

    @issues.setter
    def issues(self, value: list[dict]) -> None:
        self.issues_json = json.dumps(value)

    @property
    def computed_priority(self) -> str:
        """Derive priority from score so lead scoring rules are in one place."""
        if self.score is None:
            return LeadPriority.MEDIUM
        if self.score < 40:
            return LeadPriority.HIGH
        if self.score <= 70:
            return LeadPriority.MEDIUM
        return LeadPriority.LOW

    def __repr__(self) -> str:
        return f"<Lead id={self.id} name={self.business_name} score={self.score}>"
