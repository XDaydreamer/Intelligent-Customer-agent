from typing import TypedDict, Annotated
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage


class ChatAgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    knowledge_base_id: str
    template_id: str
    template_content: str
    conversation_id: str
    # ── Upgraded retrieval fields ──
    original_query: str               # raw user message (set before rewrite)
    rewritten_query: str              # LLM-optimized query for retrieval
    retrieved_docs: list[dict]        # [{content, source, score}, ...]
    retrieval_sources: list[str]      # deduplicated source filenames
    retrieval_metrics: dict           # {vector_count, bm25_count, fused_count, rerank_count, timings}
    # ── Legacy fields ──
    preset_matches: list[dict]        # kept for backward compat, not populated by new flow
    final_response: str


class CopywritingWorkflowState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    product_name: str
    product_type: str
    product_features: str
    product_price: str
    promotion_info: str
    target_audience: str
    stock_status: str
    info_complete: bool
    analysis_result: str
    generated_copy: str
    compliance_rules: str
    next_action: str
    manager_question: str
    image_paths: list[str]
