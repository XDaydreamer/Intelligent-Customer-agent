from typing import TypedDict, Annotated
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage


class ChatAgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    knowledge_base_id: str
    template_id: str
    template_content: str
    conversation_id: str
    retrieved_docs: list[str]
    preset_matches: list[dict]
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
