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
