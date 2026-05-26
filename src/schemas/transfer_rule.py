from pydantic import BaseModel, Field
from datetime import datetime


class TransferRuleCreate(BaseModel):
    keyword: str = Field(..., min_length=1, max_length=512, description="触发关键词")
    reply: str = Field(..., min_length=1, max_length=1024, description="自动回复内容")
    enabled: bool = Field(True, description="是否启用")


class TransferRuleUpdate(BaseModel):
    keyword: str | None = Field(None, min_length=1, max_length=512)
    reply: str | None = Field(None, min_length=1, max_length=1024)
    enabled: bool | None = None


class TransferRuleOut(BaseModel):
    id: str
    keyword: str
    reply: str
    enabled: bool
    created_at: datetime

    class Config:
        from_attributes = True
