from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "智能客服系统"
    app_version: str = "0.1.0"
    debug: bool = True

    # PostgreSQL
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str = "postgres"
    postgres_password: str = "postgres"
    postgres_db: str = "customer_agent"

    # ChromaDB
    chroma_host: str = "localhost"
    chroma_port: int = 8001
    chroma_persist_dir: str = "./chroma_data"

    # Redis
    redis_host: str = "localhost"
    redis_port: int = 6379

    # DashScope (阿里云百炼) / Qwen
    dashscope_api_key: str = ""
    dashscope_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    llm_model: str = "qwen-plus"
    embedding_model: str = "text-embedding-v2"
    embedding_dim: int = 1536

    # Memory / Conversation
    max_messages_per_session: int = 40
    recent_messages_keep: int = 20
    session_ttl_days: int = 10

    # File upload
    upload_dir: str = "./uploads"
    max_upload_size_mb: int = 200

    # ── RAG settings ────────────────────────────────
    # Chunking
    chunk_size: int = 500
    chunk_overlap: int = 50
    chunk_separators: list[str] = ["\n\n", "\n", "。", "？", "！", "，", "；", "：", " ", ""]

    # Retrieval
    retrieval_top_k: int = 15          # candidates before rerank
    retrieval_final_k: int = 10        # candidates after RRF fusion → passed to reranker
    rrf_k: int = 60                    # RRF smoothing constant
    rrf_alpha: float = 0.7             # vector weight in RRF (BM25 = 1 - alpha)
    bm25_cache_ttl: int = 300          # seconds before BM25 index rebuild

    # Re-ranking (qwen3-rerank via DashScope compatible API)
    rerank_model: str = "qwen3-rerank"
    rerank_top_n: int = 5              # final docs after rerank
    rerank_instruct: str = "Given a web search query, retrieve relevant passages that answer the query."

    # Query rewriting
    query_rewrite_enabled: bool = True

    # ChromaDB embedding
    chroma_distance_metric: str = "cosine"

    @property
    def postgres_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def postgres_sync_url(self) -> str:
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
