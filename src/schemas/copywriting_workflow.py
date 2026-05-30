from pydantic import BaseModel, Field
from datetime import datetime


# ── Request schemas ──

class StartSessionRequest(BaseModel):
    title: str | None = Field(None, max_length=255)
    initial_message: str = Field(..., min_length=1)


class SendMessageRequest(BaseModel):
    message: str = Field(..., min_length=1)


# ── Response schemas ──

class CopywritingMessageOut(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class SessionListItem(BaseModel):
    id: str
    title: str | None
    status: str
    message_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SessionDetail(BaseModel):
    id: str
    title: str | None
    status: str
    generated_copy: str
    next_action: str
    manager_question: str
    messages: list[CopywritingMessageOut]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SessionStartResponse(BaseModel):
    session_id: str
    agent_message: CopywritingMessageOut
    next_action: str


class SessionSendResponse(BaseModel):
    agent_message: CopywritingMessageOut
    next_action: str
    generated_copy: str


class ExportResponse(BaseModel):
    content: str


# ── Compliance rule schemas ──

class ComplianceRuleCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)
    source_type: str = Field("manual")


class ComplianceRuleUpdate(BaseModel):
    title: str | None = None
    content: str | None = None


class ComplianceRuleOut(BaseModel):
    id: str
    title: str
    content: str
    source_type: str
    file_path: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UploadRuleResponse(BaseModel):
    status: str  # "created" | "warning" | "duplicate"
    similarity: float = 0.0
    similar_rule_id: str | None = None
    similar_rule_title: str | None = None
    rule: ComplianceRuleOut | None = None


# ── Save to KB ──

class SaveToKbRequest(BaseModel):
    knowledge_base_id: str = Field(..., description="Target KB ID")
    filename: str = Field("product_copy.md", description="Saved filename")
