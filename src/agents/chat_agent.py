"""
智能对话 Agent — LangGraph 实现

流程:
  Load History → Retrieve (ChromaDB) → Match presets → Generate → Done
"""

from langgraph.graph import StateGraph, START, END
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

from src.agents.state import ChatAgentState
from src.agents.llm import get_llm, get_embeddings
from src.database.chroma import get_or_create_collection
from src.config import get_settings

settings = get_settings()


class ChatAgent:
    def __init__(self):
        self.llm = get_llm(temperature=0.3)
        self.graph = self._build_graph()

    def _build_graph(self) -> StateGraph:
        builder = StateGraph(ChatAgentState)

        builder.add_node("retrieve", self._retrieve_docs)
        builder.add_node("match_presets", self._match_presets)
        builder.add_node("generate", self._generate_response)

        builder.add_edge(START, "retrieve")
        builder.add_edge("retrieve", "match_presets")
        builder.add_edge("match_presets", "generate")
        builder.add_edge("generate", END)

        return builder.compile()

    async def _retrieve_docs(self, state: ChatAgentState) -> dict:
        user_message = state["messages"][-1].content
        try:
            collection = get_or_create_collection(f"kb_{state['knowledge_base_id']}")
            results = collection.query(query_texts=[user_message], n_results=5)
            docs = results.get("documents", [[]])[0] if results.get("documents") else []
        except Exception:
            docs = []
        return {"retrieved_docs": docs}

    async def _match_presets(self, state: ChatAgentState) -> dict:
        return {}

    async def _generate_response(self, state: ChatAgentState) -> dict:
        retrieved = state.get("retrieved_docs", [])
        template = state.get("template_content", "")
        user_msg = state["messages"][-1].content
        history = state["messages"][:-1]  # All messages except the latest

        context_parts = []

        if template:
            context_parts.append(f"## 客服回复模板:\n{template}")

        if retrieved:
            docs_text = "\n---\n".join(retrieved)
            context_parts.append(f"## 知识库参考资料:\n{docs_text}")

        system_prompt = f"""你是一个专业、友好的电商客服助手。
请根据以下参考资料和模板来回答客户的问题。回答要准确、简洁、专业。

{chr(10).join(context_parts) if context_parts else '请根据你的知识库来回答客户问题。若不知道，请坦诚说明。'}"""

        full_messages = [SystemMessage(content=system_prompt)]
        if history:
            full_messages.extend(list(history))
        full_messages.append(HumanMessage(content=user_msg))

        response = await self.llm.ainvoke(full_messages)
        return {"final_response": response.content, "messages": [AIMessage(content=response.content)]}

    async def chat(
        self,
        message: str,
        knowledge_base_id: str,
        template_content: str = "",
        conversation_id: str = "",
        history: list | None = None,
    ) -> str:
        """Run the full chat pipeline and return the response."""
        # Build message list from history + current message
        msg_list = []
        if history:
            for h in history:
                if h.get("role") == "user":
                    msg_list.append(HumanMessage(content=h["content"]))
                elif h.get("role") == "assistant":
                    msg_list.append(AIMessage(content=h["content"]))
        msg_list.append(HumanMessage(content=message))

        initial_state: ChatAgentState = {
            "messages": msg_list,
            "knowledge_base_id": knowledge_base_id,
            "template_id": "",
            "template_content": template_content,
            "conversation_id": conversation_id,
            "retrieved_docs": [],
            "preset_matches": [],
            "final_response": "",
        }

        result = await self.graph.ainvoke(initial_state)
        return result.get("final_response", "抱歉，我暂时无法处理您的请求。")


_chat_agent: ChatAgent | None = None


def get_chat_agent() -> ChatAgent:
    global _chat_agent
    if _chat_agent is None:
        _chat_agent = ChatAgent()
    return _chat_agent
