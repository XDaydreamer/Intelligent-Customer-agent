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


def get_embeddings() -> OpenAIEmbeddings:
    return OpenAIEmbeddings(
        model=settings.embedding_model,
        api_key=settings.dashscope_api_key,
        base_url=settings.dashscope_base_url,
    )
