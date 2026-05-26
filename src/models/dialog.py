import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database.postgres import Base


class PresetDialog(Base):
    """预设问答 — 知能对话"""

    __tablename__ = "preset_dialogs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    question: Mapped[str] = mapped_column(String(1024), nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    shop: Mapped[str | None] = mapped_column(String(255), nullable=True)
    parent_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("preset_dialogs.id", ondelete="CASCADE"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    children: Mapped[list["PresetDialog"]] = relationship(
        "PresetDialog", back_populates="parent", cascade="all, delete-orphan"
    )
    parent: Mapped["PresetDialog | None"] = relationship(
        "PresetDialog", back_populates="children", remote_side=[id]
    )
