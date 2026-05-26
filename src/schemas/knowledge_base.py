from pydantic import BaseModel, Field
from datetime import datetime


class KnowledgeBaseCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="知识库名称")
    description: str | None = Field(None, description="知识库介绍")


class KnowledgeBaseUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None


class KnowledgeDocumentOut(BaseModel):
    id: str
    filename: str
    file_type: str
    chunk_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class KnowledgeBaseOut(BaseModel):
    id: str
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime
    documents: list[KnowledgeDocumentOut] = []

    class Config:
        from_attributes = True


class KnowledgeBaseListItem(BaseModel):
    id: str
    name: str
    description: str | None
    document_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True
