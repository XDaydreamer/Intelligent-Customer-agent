"""
智能对话 Agent — LangGraph 实现 (RAG 升级版)

流程:
  rewrite_query → hybrid_retrieve → rerank → generate → END

升级要点:
  1. Query 改写: LLM 提取核心问题，去除礼貌填充词
  2. 混合检索: 向量 (DashScope text-embedding-v2) + BM25 → RRF 融合
  3. 重排序: qwen3-rerank 精排 Top-5
  4. 来源标注: 检索文档带 source/score 传给 LLM 和前端
"""

from langgraph.graph import StateGraph, START, END
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

from src.agents.state import ChatAgentState
from src.agents.llm import get_llm, get_embedding_function, get_reranker_client
from src.agents.retrieval import get_hybrid_retriever
from src.config import get_settings

settings = get_settings()

QUERY_REWRITE_PROMPT = """你是一个检索查询优化助手。请将以下客户问题改写为一个简洁的检索查询。
去除礼貌用语和无关细节，保留核心问题和关键实体（产品名、问题类型等）。
只输出改写后的查询，不要加任何解释。

原始问题: {query}

改写查询:"""


class ChatAgent:
    def __init__(self):
        self.llm = get_llm(temperature=0.3)
        self.rewrite_llm = get_llm(temperature=0.1)  # low temp for focused rewriting
        self.retriever = get_hybrid_retriever()
        self.reranker = get_reranker_client()
        self.graph = self._build_graph()

    def _build_graph(self) -> StateGraph:
        builder = StateGraph(ChatAgentState)

        builder.add_node("rewrite_query", self._rewrite_query)
        builder.add_node("hybrid_retrieve", self._hybrid_retrieve)
        builder.add_node("rerank", self._rerank)
        builder.add_node("generate", self._generate_response)

        builder.add_edge(START, "rewrite_query")
        builder.add_edge("rewrite_query", "hybrid_retrieve")
        builder.add_edge("hybrid_retrieve", "rerank")
        builder.add_edge("rerank", "generate")
        builder.add_edge("generate", END)

        return builder.compile()

    # ── Node: Query Rewriting ────────────────────────

    async def _rewrite_query(self, state: ChatAgentState) -> dict:
        """Use LLM to extract the core question for better retrieval."""
        user_message = state["messages"][-1].content

        if not settings.query_rewrite_enabled:
            return {
                "original_query": str(user_message),
                "rewritten_query": str(user_message),
            }

        try:
            prompt = QUERY_REWRITE_PROMPT.format(query=user_message)
            response = await self.rewrite_llm.ainvoke(prompt)
            rewritten = str(response.content).strip()
            if not rewritten:
                rewritten = str(user_message)
        except Exception:
            rewritten = str(user_message)

        return {
            "original_query": str(user_message),
            "rewritten_query": rewritten,
        }

    # ── Node: Hybrid Retrieve ────────────────────────

    async def _hybrid_retrieve(self, state: ChatAgentState) -> dict:
        """Hybrid vector + BM25 search with RRF fusion."""
        query = state["rewritten_query"]
        kb_id = state["knowledge_base_id"]

        docs, metrics = await self.retriever.retrieve(query, kb_id)

        # Collect unique source filenames
        sources: list[str] = []
        seen = set()
        for d in docs:
            s = d.get("source", "")
            if s and s not in seen:
                sources.append(s)
                seen.add(s)

        return {
            "retrieved_docs": docs,
            "retrieval_sources": sources,
            "retrieval_metrics": metrics,
        }

    # ── Node: Rerank ─────────────────────────────────

    async def _rerank(self, state: ChatAgentState) -> dict:
        """Re-rank retrieved documents using qwen3-rerank."""
        docs = state.get("retrieved_docs", [])
        if not docs:
            return {
                "retrieved_docs": [],
                "retrieval_metrics": state.get("retrieval_metrics", {}),
            }

        query = state["rewritten_query"]
        doc_texts = [d["content"] for d in docs]

        try:
            results = await self.reranker.rerank(
                query=query,
                documents=doc_texts,
                top_n=settings.rerank_top_n,
                instruct=settings.rerank_instruct,
            )

            # Rebuild doc list from reranker indices with updated scores
            reranked: list[dict] = []
            for r in results:
                idx = r.get("index", 0)
                if idx < len(docs):
                    orig = docs[idx]
                    reranked.append({
                        "content": orig["content"],
                        "source": orig.get("source", ""),
                        "score": round(float(r.get("relevance_score", 0.0)), 6),
                        "id": orig.get("id", ""),
                    })

            metrics = state.get("retrieval_metrics", {})
            metrics["rerank_count"] = len(reranked)
            return {"retrieved_docs": reranked, "retrieval_metrics": metrics}

        except Exception as e:
            # Graceful degradation: keep RRF-ranked docs
            metrics = state.get("retrieval_metrics", {})
            metrics["rerank_error"] = str(e)
            return {"retrieval_metrics": metrics}

    # ── Node: Generate ───────────────────────────────

    async def _generate_response(self, state: ChatAgentState) -> dict:
        """Generate response with retrieved context and source annotations."""
        retrieved = state.get("retrieved_docs", [])
        template = state.get("template_content", "")
        user_msg = state["messages"][-1].content
        history = state["messages"][:-1]

        context_parts: list[str] = []

        if template:
            context_parts.append(f"## 客服回复模板:\n{template}")

        if retrieved:
            docs_text_parts: list[str] = []
            for i, doc in enumerate(retrieved, 1):
                source_info = f" [来源: {doc.get('source', '')}]" if doc.get("source") else ""
                score_info = f" (相关度: {doc.get('score', 0):.2f})"
                docs_text_parts.append(f"[{i}]{source_info}{score_info}\n{doc['content']}")
            docs_text = "\n\n---\n\n".join(docs_text_parts)
            context_parts.append(f"## 知识库参考资料:\n{docs_text}")

        system_prompt = (
            "你是一个专业、友好的电商客服助手。\n"
            "请根据以下参考资料和模板来回答客户的问题。回答要准确、简洁、专业。\n"
            "如果参考了知识库内容，请在回答中适当说明信息来源。\n\n"
            f"{chr(10).join(context_parts) if context_parts else '请根据你的知识库来回答客户问题。若不知道，请坦诚说明。'}"
        )

        full_messages: list = [SystemMessage(content=system_prompt)]
        if history:
            full_messages.extend(list(history))
        full_messages.append(HumanMessage(content=str(user_msg)))

        response = await self.llm.ainvoke(full_messages)
        return {
            "final_response": str(response.content),
            "messages": [AIMessage(content=str(response.content))],
        }

    # ── Public API ───────────────────────────────────

    async def chat(
        self,
        message: str,
        knowledge_base_id: str,
        template_content: str = "",
        conversation_id: str = "",
        history: list | None = None,
    ) -> dict:
        """Run the full chat pipeline and return a rich result dict.

        Returns:
            {"reply": str, "sources": list[str], "source_details": list[dict],
             "retrieval_count": int}
        """
        # Build message list from history + current message
        msg_list: list = []
        if history:
            for h in history:
                role = h.get("role", "")
                content = h.get("content", "")
                if role == "user":
                    msg_list.append(HumanMessage(content=content))
                elif role == "assistant":
                    msg_list.append(AIMessage(content=content))
                elif role == "system":
                    # System messages from history (e.g. summary) are preserved
                    msg_list.append(SystemMessage(content=content))
        msg_list.append(HumanMessage(content=message))

        initial_state: ChatAgentState = {
            "messages": msg_list,
            "knowledge_base_id": knowledge_base_id,
            "template_id": "",
            "template_content": template_content,
            "conversation_id": conversation_id,
            "original_query": message,
            "rewritten_query": message,
            "retrieved_docs": [],
            "retrieval_sources": [],
            "retrieval_metrics": {},
            "preset_matches": [],
            "final_response": "",
        }

        result = await self.graph.ainvoke(initial_state)

        return {
            "reply": result.get("final_response", "抱歉，我暂时无法处理您的请求。"),
            "sources": result.get("retrieval_sources", []),
            "source_details": result.get("retrieved_docs", []),
            "retrieval_count": len(result.get("retrieved_docs", [])),
        }


# Module-level singleton
_chat_agent: ChatAgent | None = None


def get_chat_agent() -> ChatAgent:
    global _chat_agent
    if _chat_agent is None:
        _chat_agent = ChatAgent()
    return _chat_agent
