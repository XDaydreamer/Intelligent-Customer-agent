"""
文案生成工作流 Agent — LangGraph 多Agent协作

流程:
  Manager (ReAct评估信息完整度)
    ├─ 信息不足 → 追问用户 (断点保存state)
    └─ 信息充足 → Analyzer (产品分析) → Generator (生成文案)
"""

import json
from langgraph.graph import StateGraph, START, END
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

from src.agents.state import CopywritingWorkflowState
from src.agents.llm import get_llm

MANAGER_PROMPT = """你是一名电商文案项目管理专家。你的任务是从对话中提取产品信息并判断是否足够生成文案。

## 需要提取的字段
- product_name: 产品名称（必填）
- product_type: 产品类型，如美妆/服饰/数码/家居/食品/母婴/电器/厨房用品等（必填）
- product_features: 产品特点/卖点
- product_price: 产品价格
- promotion_info: 促销信息
- target_audience: 适用人群
- stock_status: 库存状况
- 若是有其它有效信息也可进行提取，比如产品颜色、型号、功能等等可以用来生成文案的信息都可以进行提取

## 判断规则
- product_name: 产品名称(追问)
- product_type: 产品类型，如美妆/服饰/数码/家居/食品/母婴/电器/厨房用品等（追问）
- product_features: 产品特点/卖点（追问）
- product_price: 产品价格（追问）
- promotion_info: 促销信息
- target_audience: 适用人群（追问）
- 需要追问的信息都有了后，就可以生成文案了


## 追问规则（信息不足时）
- 每次只问1-2个关键信息，语气友好
- 优先追问 product_name 和 product_type
- 如果用户只说了模糊的产品名称，追问产品类型

## 输出格式（严格JSON，不要有任何其他内容）
{"extracted_fields": {"product_name": "...", "product_type": "...", "product_features": "...", "product_price": "...", "promotion_info": "...", "target_audience": "...", "stock_status": "..."}, "is_complete": true/false, "next_question": "信息不足时追问的问题，信息充足时为空字符串"}"""

ANALYZER_PROMPT = """你是一名电商产品分析师。请根据产品信息，输出结构化的产品分析报告。

## 产品信息
{product_info}

## 分析要求
1. 核心卖点提炼（3-5个）
2. 目标人群画像
3. 竞品差异化优势分析
4. 情感营销切入点
5. 使用场景建议

输出为Markdown格式的结构化分析报告，300字以内。"""

GENERATOR_PROMPT = """你是一名资深的电商文案专家。请根据产品信息和分析报告，生成一份专业、吸引人的产品营销文案。

## 产品信息
{product_info}

## 产品分析报告
{analysis_result}

## 合规要求（请严格遵守，不得使用夸大或违规词汇）
{compliance_rules}

## 文案要求
1. 风格：专业、亲切，适合电商平台展示
2. 结构：产品标题 → 卖点提炼 → 详细描述 → 促销引导
3. 篇幅：300-500字
4. 语言：简体中文
5. 风格：走心共情风——特点：抓情绪、讲场景、戳痛点，弱化硬推销，用生活故事引发共鸣。例如：忙碌一天回到家，就想被柔软包裹。这款睡裙亲肤透气，卸下所有疲惫，好好宠爱自己。
6. 不得包含任何虚假宣传、绝对化用语等违规内容

请直接输出文案内容，无需额外说明。"""


class CopywritingWorkflowAgent:
    def __init__(self):
        self.manager_llm = get_llm(temperature=0.3)
        self.creative_llm = get_llm(temperature=0.7)
        self.graph = self._build_graph()

    def _build_graph(self) -> StateGraph:
        builder = StateGraph(CopywritingWorkflowState)

        builder.add_node("manager", self._manager_node)
        builder.add_node("analyzer", self._analyzer_node)
        builder.add_node("generator", self._generator_node)

        builder.add_edge(START, "manager")
        builder.add_conditional_edges(
            "manager",
            self._route_after_manager,
            {"ask_user": END, "analyze": "analyzer"},
        )
        builder.add_edge("analyzer", "generator")
        builder.add_edge("generator", END)

        return builder.compile()

    def _route_after_manager(self, state: CopywritingWorkflowState) -> str:
        if state.get("next_action") == "ask_user":
            return "ask_user"
        return "analyze"

    async def _manager_node(self, state: CopywritingWorkflowState) -> dict:
        """ReAct-style manager: extract info from conversation, decide if complete."""
        messages = state.get("messages", [])
        conversation_text = "\n".join(
            f"{'用户' if isinstance(m, HumanMessage) else '客服'}: {m.content}"
            for m in messages
        )

        response = await self.manager_llm.ainvoke([
            SystemMessage(content=MANAGER_PROMPT),
            HumanMessage(content=f"对话内容：\n{conversation_text}\n\n请分析上述对话，提取产品信息并以JSON格式输出。"),
        ])

        try:
            result = json.loads(response.content.strip())
        except json.JSONDecodeError:
            return {
                "next_action": "ask_user",
                "manager_question": "请告诉我您想推广的产品名称和类型（如：美妆、服饰、数码等），我来帮您生成营销文案。",
            }

        extracted = result.get("extracted_fields", {})
        is_complete = result.get("is_complete", False)
        next_question = result.get("next_question", "")

        update = {
            "product_name": extracted.get("product_name", ""),
            "product_type": extracted.get("product_type", ""),
            "product_features": extracted.get("product_features", "未指定"),
            "product_price": extracted.get("product_price", "未指定"),
            "promotion_info": extracted.get("promotion_info", "未指定"),
            "target_audience": extracted.get("target_audience", "未指定"),
            "stock_status": extracted.get("stock_status", "未指定"),
            "info_complete": is_complete,
        }

        if is_complete:
            update["next_action"] = "analyze"
            update["manager_question"] = ""
        else:
            update["next_action"] = "ask_user"
            update["manager_question"] = next_question or "请提供更多产品信息，我来帮您生成营销文案。"
            update["messages"] = [AIMessage(content=update["manager_question"])]

        return update

    async def _analyzer_node(self, state: CopywritingWorkflowState) -> dict:
        """Analyze product info and produce structured analysis."""
        product_info = f"""- 产品名称: {state.get("product_name", "")}
- 产品类型: {state.get("product_type", "")}
- 产品特点: {state.get("product_features", "未指定")}
- 产品价格: {state.get("product_price", "未指定")}
- 促销信息: {state.get("promotion_info", "未指定")}
- 适用人群: {state.get("target_audience", "未指定")}
- 库存状况: {state.get("stock_status", "未指定")}"""

        response = await self.creative_llm.ainvoke(
            ANALYZER_PROMPT.format(product_info=product_info)
        )
        return {"analysis_result": response.content, "next_action": "generate"}

    async def _generator_node(self, state: CopywritingWorkflowState) -> dict:
        """Generate final marketing copy, respecting compliance rules."""
        product_info = f"""- 产品名称: {state.get("product_name", "")}
- 产品类型: {state.get("product_type", "")}
- 产品特点: {state.get("product_features", "未指定")}
- 产品价格: {state.get("product_price", "未指定")}
- 促销信息: {state.get("promotion_info", "未指定")}
- 适用人群: {state.get("target_audience", "未指定")}
- 库存状况: {state.get("stock_status", "未指定")}"""

        rules = state.get("compliance_rules", "暂无特别合规要求")

        response = await self.creative_llm.ainvoke(
            GENERATOR_PROMPT.format(
                product_info=product_info,
                analysis_result=state.get("analysis_result", ""),
                compliance_rules=rules,
            )
        )
        return {
            "generated_copy": response.content,
            "next_action": "done",
            "messages": [AIMessage(content=response.content)],
        }

    async def run(self, state: CopywritingWorkflowState) -> CopywritingWorkflowState:
        result = await self.graph.ainvoke(state)
        return result


_workflow_agent: CopywritingWorkflowAgent | None = None


def get_copywriting_workflow_agent() -> CopywritingWorkflowAgent:
    global _workflow_agent
    if _workflow_agent is None:
        _workflow_agent = CopywritingWorkflowAgent()
    return _workflow_agent
