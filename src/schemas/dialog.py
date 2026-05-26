from pydantic import BaseModel, Field
from datetime import datetime


class PresetDialogCreate(BaseModel):
    question: str = Field(..., min_length=1, max_length=1024, description="问题")
    answer: str = Field(..., min_length=1, description="答案")
    shop: str | None = Field(None, max_length=255, description="店铺")
    parent_id: str | None = Field(None, description="父级ID（分组）")


class PresetDialogUpdate(BaseModel):
    question: str | None = Field(None, min_length=1, max_length=1024)
    answer: str | None = Field(None, min_length=1)
    shop: str | None = Field(None, max_length=255)


class PresetDialogOut(BaseModel):
    id: str
    question: str
    answer: str
    shop: str | None
    parent_id: str | None
    children: list["PresetDialogOut"] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
