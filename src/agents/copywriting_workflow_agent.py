"""
文案生成工作流 Agent — LangGraph 多Agent协作 (支持多模态图片识别)

流程:
  Manager (ReAct评估信息完整度, qwen3-vl-flash 如有图片)
    ├─ 信息不足 → 追问用户 (断点保存state)
    └─ 信息充足 → Analyzer (产品分析, qwen3-vl-flash 如有图片) → Generator (生成文案, qwen-plus)
"""

import json
import base64
from pathlib import Path
from langgraph.graph import StateGraph, START, END
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

from src.agents.state import CopywritingWorkflowState
from src.agents.llm import get_llm, get_vl_llm

MANAGER_PROMPT = """你是一名电商文案项目管理专家。你的任务是从对话和产品图片中提取产品信息并判断是否足够生成文案。

## 需要提取的字段
- product_name: 产品名称（必填）
- product_type: 产品类型，如美妆/服饰/数码/家居/食品/母婴/电器/厨房用品等（必填）
- product_features: 产品特点/卖点
- product_price: 产品价格
- promotion_info: 促销信息
- target_audience: 适用人群
- stock_status: 库存状况
- 若是有其它有效信息也可进行提取，比如产品颜色、型号、功能等等可以用来生成文案的信息都可以进行提取

## 图片分析（如有产品图片）
- 仔细观察图片中的产品外观、颜色、包装设计、材质质感、品牌调性
- 提取图片中的文字/标签信息（品牌名、规格参数、成分表等）
- 将视觉信息与文字描述合并，形成完整的产品画像
- 如果用户同时提供了图片和文字，以文字为准，图片作为补充

## 判断规则
- product_name 和 product_type 为必填项
- 图片可以辅助判断 product_features 和产品外观信息
- 需要的信息都有了后，就可以生成文案了

## 追问规则（信息不足时）
- 每次只问1-2个关键信息，语气友好
- 优先追问 product_name 和 product_type
- 如果用户只说了模糊的产品名称，追问产品类型

## 输出格式（严格JSON，不要有任何其他内容）
{"extracted_fields": {"product_name": "...", "product_type": "...", "product_features": "...", "product_price": "...", "promotion_info": "...", "target_audience": "...", "stock_status": "..."}, "is_complete": true/false, "next_question": "信息不足时追问的问题，信息充足时为空字符串"}"""

ANALYZER_PROMPT = """你是一名电商产品分析师。请根据产品信息和图片，输出结构化的产品分析报告。

## 产品信息
{product_info}

## 分析要求
1. 核心卖点提炼（3-5个）— 结合图片中看到的产品外观、材质、包装来提炼
2. 目标人群画像
3. 竞品差异化优势分析 — 从视觉呈现中找出差异化亮点
4. 情感营销切入点
5. 使用场景建议

如果提供了产品图片，请特别关注：
- 产品的外观设计风格（简约/奢华/清新/科技感等）
- 配色方案和视觉调性
- 包装质感（高端/实用/环保等）
- 产品的实际形态和细节

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
7. 如果产品信息中包含图片分析的结果，请在文案中自然地融入视觉描述（如外观、颜色、质感等）

请直接输出文案内容，无需额外说明。"""


def _image_to_base64_data_url(image_path: str) -> str:
    """Read an image file and return a base64 data URL for OpenAI multimodal API."""
    path = Path(image_path)
    if not path.exists():
        raise FileNotFoundError(f"Image not found: {image_path}")
    ext = path.suffix.lower()
    mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
                ".gif": "image/gif", ".webp": "image/webp", ".bmp": "image/bmp"}
    mime = mime_map.get(ext, "image/jpeg")
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")
    return f"data:{mime};base64,{b64}"


def _build_multimodal_content(text: str, image_paths: list[str]) -> list[dict]:
    """Build OpenAI-compatible multimodal message content with text + images."""
    content = [{"type": "text", "text": text}]
    for img_path in image_paths:
        try:
            data_url = _image_to_base64_data_url(img_path)
            content.append({"type": "image_url", "image_url": {"url": data_url}})
        except Exception as e:
            content.append({"type": "text", "text": f"[图片加载失败: {img_path}]"})
    return content


class CopywritingWorkflowAgent:
    def __init__(self):
        self.manager_llm = get_llm(temperature=0.3)
        self.vl_llm = get_vl_llm(temperature=0.3)
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

    def _has_images(self, state: CopywritingWorkflowState) -> bool:
        paths = state.get("image_paths", [])
        if not paths:
            return False
        return any(Path(p).exists() for p in paths)

    def _get_valid_image_paths(self, state: CopywritingWorkflowState) -> list[str]:
        return [p for p in state.get("image_paths", []) if Path(p).exists()]

    async def _manager_node(self, state: CopywritingWorkflowState) -> dict:
        """ReAct-style manager: extract info from conversation + images, decide if complete."""
        messages = state.get("messages", [])
        conversation_text = "\n".join(
            f"{'用户' if isinstance(m, HumanMessage) else '客服'}: {m.content if isinstance(m.content, str) else '[含图片消息]'}"
            for m in messages
        )
        image_paths = self._get_valid_image_paths(state)
        has_images = len(image_paths) > 0

        # Choose LLM: VL model if images present, else text model
        llm = self.vl_llm if has_images else self.manager_llm

        system_msg = SystemMessage(content=MANAGER_PROMPT)
        user_text = f"对话内容：\n{conversation_text}\n\n请分析上述对话{'和产品图片' if has_images else ''}，提取产品信息并以JSON格式输出。"

        if has_images:
            user_content = _build_multimodal_content(user_text, image_paths)
            human_msg = HumanMessage(content=user_content)
        else:
            human_msg = HumanMessage(content=user_text)

        response = await llm.ainvoke([system_msg, human_msg])

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
        """Analyze product info + images and produce structured analysis."""
        product_info = f"""- 产品名称: {state.get("product_name", "")}
- 产品类型: {state.get("product_type", "")}
- 产品特点: {state.get("product_features", "未指定")}
- 产品价格: {state.get("product_price", "未指定")}
- 促销信息: {state.get("promotion_info", "未指定")}
- 适用人群: {state.get("target_audience", "未指定")}
- 库存状况: {state.get("stock_status", "未指定")}"""

        image_paths = self._get_valid_image_paths(state)
        has_images = len(image_paths) > 0
        llm = self.vl_llm if has_images else self.creative_llm

        user_text = f"{product_info}\n\n请基于以上产品信息{'和产品图片' if has_images else ''}进行深度分析。"

        if has_images:
            user_content = _build_multimodal_content(user_text, image_paths)
            human_msg = HumanMessage(content=user_content)
            response = await llm.ainvoke([SystemMessage(content=ANALYZER_PROMPT), human_msg])
        else:
            response = await llm.ainvoke(ANALYZER_PROMPT.format(product_info=product_info))

        return {"analysis_result": response.content, "next_action": "generate"}

    async def _generator_node(self, state: CopywritingWorkflowState) -> dict:
        """Generate final marketing copy, respecting compliance rules. Text-only model."""
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
