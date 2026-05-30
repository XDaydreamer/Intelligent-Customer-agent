from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    knowledge_base_id: str = Field(..., description="知识库ID")
    template_id: str = Field(..., description="客服模版ID")
    message: str = Field(..., min_length=1, description="用户消息")
    conversation_id: str | None = Field(None, description="会话ID")


class ChatResponse(BaseModel):
    reply: str = Field(..., description="AI回复")
    sources: list[str] = Field(default_factory=list, description="引用来源")
    conversation_id: str = Field(..., description="会话ID")
