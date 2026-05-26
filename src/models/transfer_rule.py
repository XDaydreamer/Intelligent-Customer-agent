import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from src.database.postgres import Base


class TransferRule(Base):
    __tablename__ = "transfer_rules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    keyword: Mapped[str] = mapped_column(String(512), nullable=False)
    reply: Mapped[str] = mapped_column(String(1024), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
