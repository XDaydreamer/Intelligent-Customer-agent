import uuid
import os
from pathlib import Path

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.models.knowledge_base import KnowledgeBase, KnowledgeDocument
from src.schemas.knowledge_base import KnowledgeBaseCreate, KnowledgeBaseUpdate
from src.database.chroma import get_or_create_collection
from src.utils.file_parser import FileParser
from src.config import get_settings

settings = get_settings()


class KnowledgeService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: KnowledgeBaseCreate) -> KnowledgeBase:
        kb = KnowledgeBase(name=data.name, description=data.description)
        self.db.add(kb)
        await self.db.flush()
        # Create ChromaDB collection for this knowledge base
        get_or_create_collection(f"kb_{kb.id}")
        # Reload with eager-loaded documents to avoid lazy-load MissingGreenlet error
        result = await self.db.execute(
            select(KnowledgeBase)
            .options(selectinload(KnowledgeBase.documents))
            .where(KnowledgeBase.id == kb.id)
        )
        return result.scalar_one()

    async def list_all(self) -> list[dict]:
        result = await self.db.execute(
            select(KnowledgeBase).options(selectinload(KnowledgeBase.documents)).order_by(KnowledgeBase.created_at.desc())
        )
        kbs = result.scalars().all()
        return [
            {
                "id": kb.id,
                "name": kb.name,
                "description": kb.description,
                "document_count": len(kb.documents),
                "created_at": kb.created_at,
            }
            for kb in kbs
        ]

    async def get(self, kb_id: str) -> KnowledgeBase | None:
        result = await self.db.execute(
            select(KnowledgeBase)
            .options(selectinload(KnowledgeBase.documents))
            .where(KnowledgeBase.id == kb_id)
        )
        return result.scalar_one_or_none()

    async def update(self, kb_id: str, data: KnowledgeBaseUpdate) -> KnowledgeBase | None:
        kb = await self.get(kb_id)
        if not kb:
            return None
        if data.name is not None:
            kb.name = data.name
        if data.description is not None:
            kb.description = data.description
        await self.db.flush()
        return kb

    async def delete(self, kb_id: str) -> bool:
        kb = await self.get(kb_id)
        if not kb:
            return False
        # Remove ChromaDB collection
        import chromadb
        from src.database.chroma import get_chroma_client
        client = get_chroma_client()
        try:
            client.delete_collection(f"kb_{kb_id}")
        except (ValueError, chromadb.errors.InvalidCollectionException):
            pass
        await self.db.delete(kb)
        await self.db.flush()
        return True

    async def upload_file(self, kb_id: str, filename: str, content: bytes) -> KnowledgeDocument:
        kb = await self.get(kb_id)
        if not kb:
            raise ValueError("知识库不存在")

        # Save file to disk
        os.makedirs(settings.upload_dir, exist_ok=True)
        file_id = str(uuid.uuid4())
        ext = Path(filename).suffix
        stored_name = f"{file_id}{ext}"
        filepath = Path(settings.upload_dir) / stored_name
        filepath.write_bytes(content)

        # Parse and chunk the document
        text = FileParser.parse_bytes(content, filename)
        chunks = self._chunk_text(text)

        # Store embeddings in ChromaDB
        collection = get_or_create_collection(f"kb_{kb_id}")
        chunk_ids = [f"{file_id}_chunk_{i}" for i in range(len(chunks))]
        collection.add(
            ids=chunk_ids,
            documents=chunks,
            metadatas=[{"source": filename, "kb_id": kb_id}] * len(chunks),
        )

        # Record in PostgreSQL
        doc = KnowledgeDocument(
            id=file_id,
            knowledge_base_id=kb_id,
            filename=filename,
            file_type=ext.lstrip("."),
            chunk_count=len(chunks),
        )
        self.db.add(doc)
        await self.db.flush()
        return doc

    def _chunk_text(self, text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
        """Split text into overlapping chunks."""
        if not text.strip():
            return []
        chunks = []
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunk = text[start:end]
            chunks.append(chunk)
            start = end - overlap
        return chunks

    async def add_text_to_kb(self, kb_id: str, text: str, filename: str) -> KnowledgeDocument:
        kb = await self.get(kb_id)
        if not kb:
            raise ValueError("知识库不存在")

        file_id = str(uuid.uuid4())
        chunks = self._chunk_text(text)

        collection = get_or_create_collection(f"kb_{kb_id}")
        chunk_ids = [f"{file_id}_chunk_{i}" for i in range(len(chunks))]
        collection.add(
            ids=chunk_ids,
            documents=chunks,
            metadatas=[{"source": filename, "kb_id": kb_id}] * len(chunks),
        )

        doc = KnowledgeDocument(
            id=file_id,
            knowledge_base_id=kb_id,
            filename=filename,
            file_type="md",
            chunk_count=len(chunks),
        )
        self.db.add(doc)
        await self.db.flush()
        return doc
