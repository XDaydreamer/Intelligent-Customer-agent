from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.postgres import get_db
from src.services.knowledge_service import KnowledgeService
from src.schemas.knowledge_base import (
    KnowledgeBaseCreate,
    KnowledgeBaseUpdate,
    KnowledgeBaseOut,
    KnowledgeBaseListItem,
)

router = APIRouter(prefix="/api/knowledge-bases", tags=["知识库管理"])


@router.post("", response_model=KnowledgeBaseOut, status_code=201)
async def create_knowledge_base(
    data: KnowledgeBaseCreate,
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeService(db)
    kb = await service.create(data)
    return kb


@router.get("", response_model=list[KnowledgeBaseListItem])
async def list_knowledge_bases(db: AsyncSession = Depends(get_db)):
    service = KnowledgeService(db)
    return await service.list_all()


@router.get("/{kb_id}", response_model=KnowledgeBaseOut)
async def get_knowledge_base(kb_id: str, db: AsyncSession = Depends(get_db)):
    service = KnowledgeService(db)
    kb = await service.get(kb_id)
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")
    return kb


@router.put("/{kb_id}", response_model=KnowledgeBaseOut)
async def update_knowledge_base(
    kb_id: str,
    data: KnowledgeBaseUpdate,
    db: AsyncSession = Depends(get_db),
):
    service = KnowledgeService(db)
    kb = await service.update(kb_id, data)
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")
    return kb


@router.delete("/{kb_id}", status_code=204)
async def delete_knowledge_base(kb_id: str, db: AsyncSession = Depends(get_db)):
    service = KnowledgeService(db)
    deleted = await service.delete(kb_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="知识库不存在")


@router.post("/{kb_id}/upload", status_code=201)
async def upload_file(
    kb_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="文件名为空")

    content = await file.read()
    service = KnowledgeService(db)
    try:
        doc = await service.upload_file(kb_id, file.filename, content)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "id": doc.id,
        "filename": doc.filename,
        "chunk_count": doc.chunk_count,
    }


from pydantic import BaseModel

class AddTextRequest(BaseModel):
    text: str
    filename: str = "manual_entry.md"


@router.post("/{kb_id}/add-text", status_code=201)
async def add_text_to_kb(
    kb_id: str,
    body: AddTextRequest,
    db: AsyncSession = Depends(get_db),
):
    """Add raw text (e.g. generated copy) to a knowledge base."""
    service = KnowledgeService(db)
    doc = await service.add_text_to_kb(kb_id, body.text, body.filename)
    return {"id": doc.id, "filename": doc.filename, "chunk_count": doc.chunk_count}
