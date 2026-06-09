from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from src.config import get_settings

settings = get_settings()


def get_llm(temperature: float = 0.3) -> ChatOpenAI:
    return ChatOpenAI(
        model=settings.llm_model,
        api_key=settings.dashscope_api_key,
        base_url=settings.dashscope_base_url,
        temperature=temperature,
    )


def get_vl_llm(temperature: float = 0.3) -> ChatOpenAI:
    """Multi-modal vision-language model for image analysis (qwen3-vl-flash)."""
    return ChatOpenAI(
        model="qwen3-vl-flash",
        api_key=settings.dashscope_api_key,
        base_url=settings.dashscope_base_url,
        temperature=temperature,
    )


def get_embeddings() -> OpenAIEmbeddings:
    return OpenAIEmbeddings(
        model=settings.embedding_model,
        api_key=settings.dashscope_api_key,
        base_url=settings.dashscope_base_url,
    )


def get_embedding_function():
    """Return a DashScope embedding function for ChromaDB.

    This is the CORRECT way to embed documents for ChromaDB — the old
    get_embeddings() returns an OpenAIEmbeddings that was never wired in.
    """
    from src.agents.embedding import DashScopeEmbeddingFunction
    return DashScopeEmbeddingFunction(
        api_key=settings.dashscope_api_key,
        base_url=settings.dashscope_base_url,
        model=settings.embedding_model,
    )


def get_reranker_client():
    """Return an async reranker client for qwen3-rerank."""
    from src.agents.reranker import DashScopeReranker
    return DashScopeReranker(api_key=settings.dashscope_api_key)
