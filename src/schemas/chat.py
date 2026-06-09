from pydantic import BaseModel, Field


class SourceDetail(BaseModel):
    """单个检索来源的详细信息，供前端展示引用卡片。"""
    content: str = Field(..., description="Retrieved chunk text")
    source: str = Field(..., description="Source filename")
    score: float = Field(..., description="Relevance score from reranker (0-1)")


class ChatRequest(BaseModel):
    knowledge_base_id: str = Field(..., description="知识库ID")
    template_id: str = Field(..., description="客服模版ID")
    message: str = Field(..., min_length=1, description="用户消息")
    conversation_id: str | None = Field(None, description="会话ID")


class ChatResponse(BaseModel):
    reply: str = Field(..., description="AI回复")
    sources: list[str] = Field(default_factory=list, description="引用来源文件名")
    source_details: list[SourceDetail] = Field(default_factory=list, description="详细引用信息")
    conversation_id: str = Field(..., description="会话ID")
    retrieval_count: int = Field(0, description="检索到的文档数（调试用）")
