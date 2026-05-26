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


class CopywritingGenerateRequest(BaseModel):
    product_name: str = Field(..., min_length=1, description="产品名称")
    product_type: str = Field(..., min_length=1, description="产品类型")
    product_features: str | None = Field(None, description="产品特点")
    product_price: str | None = Field(None, description="产品价格")
    promotion_info: str | None = Field(None, description="促销信息")
    target_audience: str | None = Field(None, description="适用人群")
    stock_status: str | None = Field(None, description="库存状况")


class CopywritingResponse(BaseModel):
    content: str = Field(..., description="生成的文案内容")


class CopywritingSaveRequest(BaseModel):
    content: str = Field(..., description="最终文案内容")
    knowledge_base_id: str = Field(..., description="目标知识库ID")
    filename: str = Field("product_copy.md", description="保存文件名")
