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
from src.agents.embedding import DashScopeEmbeddingFunction

settings = get_settings()


def _get_embedding_function() -> DashScopeEmbeddingFunction:
    return DashScopeEmbeddingFunction(
        api_key=settings.dashscope_api_key,
        base_url=settings.dashscope_base_url,
        model=settings.embedding_model,
    )


def _invalidate_bm25_cache(kb_id: str):
    """Invalidate BM25 cache for the given knowledge base after document changes."""
    try:
        from src.agents.retrieval import get_hybrid_retriever
        get_hybrid_retriever().invalidate_cache(f"kb_{kb_id}")
    except ImportError:
        pass


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
        # Invalidate BM25 cache
        _invalidate_bm25_cache(kb_id)

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

        # Store embeddings in ChromaDB with DashScope embedding function
        ef = _get_embedding_function()
        collection = get_or_create_collection(f"kb_{kb_id}", embedding_function=ef)
        chunk_ids = [f"{file_id}_chunk_{i}" for i in range(len(chunks))]
        collection.add(
            ids=chunk_ids,
            documents=chunks,
            metadatas=[{"source": filename, "kb_id": kb_id}] * len(chunks),
        )

        # Invalidate BM25 cache so next retrieval picks up new docs
        _invalidate_bm25_cache(kb_id)

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

    def _chunk_text(self, text: str) -> list[str]:
        """Split text into semantically meaningful chunks using RecursiveCharacterTextSplitter.

        Uses Chinese-aware separators for better boundary detection:
        double newline → single newline → Chinese punctuation → space → char.
        """
        if not text.strip():
            return []
        from langchain_text_splitters import RecursiveCharacterTextSplitter
        splitter = RecursiveCharacterTextSplitter(
            separators=list(settings.chunk_separators),
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
            length_function=len,
            is_separator_regex=False,
        )
        return splitter.split_text(text)

    async def add_text_to_kb(self, kb_id: str, text: str, filename: str) -> KnowledgeDocument:
        kb = await self.get(kb_id)
        if not kb:
            raise ValueError("知识库不存在")

        file_id = str(uuid.uuid4())
        chunks = self._chunk_text(text)

        ef = _get_embedding_function()
        collection = get_or_create_collection(f"kb_{kb_id}", embedding_function=ef)
        chunk_ids = [f"{file_id}_chunk_{i}" for i in range(len(chunks))]
        collection.add(
            ids=chunk_ids,
            documents=chunks,
            metadatas=[{"source": filename, "kb_id": kb_id}] * len(chunks),
        )

        # Invalidate BM25 cache
        _invalidate_bm25_cache(kb_id)

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
