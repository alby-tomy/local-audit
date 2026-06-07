"""
User ORM model.

Each User owns their own set of Leads and stores their personal API
credentials (Anthropic key, Gmail) so the system can operate on their
behalf without sharing credentials across accounts.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Per-user credentials stored so each account uses their own quotas.
    # In production these should be encrypted at the DB level.
    anthropic_api_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    gmail_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    gmail_app_password: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # One user → many leads
    leads: Mapped[list["Lead"]] = relationship(  # noqa: F821
        "Lead", back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email}>"
