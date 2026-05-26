from pydantic import BaseModel, Field
from datetime import datetime


class TemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="模板名称")
    content: str = Field(..., min_length=1, description="模板内容")
    intro: str | None = Field(None, max_length=512, description="简介")


class TemplateUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    content: str | None = Field(None, min_length=1)
    intro: str | None = Field(None, max_length=512)


class TemplateOut(BaseModel):
    id: str
    name: str
    content: str
    intro: str | None
    updated_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True
