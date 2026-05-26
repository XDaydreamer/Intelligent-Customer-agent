from pydantic import BaseModel
from datetime import datetime


class MessageOut(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    is_summarized: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationOut(BaseModel):
    id: str
    title: str | None
    customer_label: str | None = None
    message_count: int
    summary: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ConversationDetail(ConversationOut):
    messages: list[MessageOut] = []


class ConversationListItem(BaseModel):
    id: str
    title: str | None
    customer_label: str | None = None
    message_count: int
    updated_at: datetime
