import chromadb
from chromadb.config import Settings as ChromaSettings
from src.config import get_settings

settings = get_settings()

_chroma_client = None


def get_chroma_client():
    global _chroma_client
    if _chroma_client is None:
        _chroma_client = chromadb.PersistentClient(
            path=settings.chroma_persist_dir,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
    return _chroma_client


def get_or_create_collection(name: str):
    client = get_chroma_client()
    return client.get_or_create_collection(name=name)
