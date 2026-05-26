"""
文档知识 — 文案生成 Agent

流程:
  产品信息输入 → LLM 生成产品营销文案 → 返回结果
"""

from langgraph.graph import StateGraph, START, END
from src.agents.state import CopywritingState
from src.agents.llm import get_llm


PROMPT_TEMPLATE = """你是一名资深的电商文案专家。请根据以下产品信息，生成一份专业、吸引人的产品营销文案。

## 产品信息
- **产品名称**: {product_name}
- **产品类型**: {product_type}
- **产品特点**: {product_features}
- **产品价格**: {product_price}
- **促销信息**: {promotion_info}
- **适用人群**: {target_audience}
- **库存状况**: {stock_status}

## 文案要求
1. 风格: 专业、亲切，适合电商平台展示
2. 结构: 包含产品标题、卖点提炼、详细描述、促销引导四部分
3. 篇幅: 300-500字
4. 语言: 简体中文
5. 格式: Markdown

请直接输出文案内容，无需额外说明。"""


class CopywritingAgent:
    def __init__(self):
        self.llm = get_llm(temperature=0.7)
        self.graph = self._build_graph()

    def _build_graph(self) -> StateGraph:
        builder = StateGraph(CopywritingState)

        builder.add_node("generate", self._generate)
        builder.add_node("revise", self._revise)

        builder.add_edge(START, "generate")
        builder.add_conditional_edges(
            "generate",
            self._should_revise,
            {"revise": "revise", "done": END},
        )
        builder.add_edge("revise", "generate")

        return builder.compile()

    def _should_revise(self, state: CopywritingState) -> str:
        return "done"

    async def _generate(self, state: CopywritingState) -> dict:
        prompt = PROMPT_TEMPLATE.format(
            product_name=state.get("product_name", ""),
            product_type=state.get("product_type", ""),
            product_features=state.get("product_features", "无特别说明"),
            product_price=state.get("product_price", "未设置"),
            promotion_info=state.get("promotion_info", "暂无"),
            target_audience=state.get("target_audience", "通用"),
            stock_status=state.get("stock_status", "充足"),
        )

        response = await self.llm.ainvoke(prompt)
        return {"generated_copy": response.content}

    async def _revise(self, state: CopywritingState) -> dict:
        """Revise based on user feedback. Called when user requests modification."""
        return {}

    async def generate(
        self,
        product_name: str,
        product_type: str,
        product_features: str = "",
        product_price: str = "",
        promotion_info: str = "",
        target_audience: str = "",
        stock_status: str = "",
    ) -> str:
        initial_state: CopywritingState = {
            "product_name": product_name,
            "product_type": product_type,
            "product_features": product_features,
            "product_price": product_price,
            "promotion_info": promotion_info,
            "target_audience": target_audience,
            "stock_status": stock_status,
            "generated_copy": "",
            "revision_history": [],
        }

        result = await self.graph.ainvoke(initial_state)
        return result.get("generated_copy", "文案生成失败，请重试。")


_copy_agent: CopywritingAgent | None = None


def get_copywriting_agent() -> CopywritingAgent:
    global _copy_agent
    if _copy_agent is None:
        _copy_agent = CopywritingAgent()
    return _copy_agent
