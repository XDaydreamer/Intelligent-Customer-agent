from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.postgres import get_db
from src.services.template_service import TemplateService
from src.services.dialog_service import DialogService
from src.services.memory_service import MemoryService
from src.agents.chat_agent import get_chat_agent
from src.agents.copywriting_agent import get_copywriting_agent
from src.services.knowledge_service import KnowledgeService
from src.schemas.chat import (
    ChatRequest,
    ChatResponse,
    CopywritingGenerateRequest,
    CopywritingResponse,
    CopywritingSaveRequest,
)

router = APIRouter(prefix="/api", tags=["智能对话"])


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    """智能对话：多轮对话，带会话记忆。"""
    mem_svc = MemoryService(db)
    template_svc = TemplateService(db)

    # Load template
    template = await template_svc.get(request.template_id)
    if not template:
        raise HTTPException(status_code=404, detail="客服模版不存在")

    # Get or create conversation
    conv_id = request.conversation_id
    if not conv_id:
        conv = await mem_svc.create_conversation()
        conv_id = conv.id
    else:
        conv = await mem_svc.get_conversation(conv_id)
        if not conv:
            # Stale conversation_id, create new one
            conv = await mem_svc.create_conversation()
            conv_id = conv.id

    # Match preset dialogs for quick reply
    dialog_svc = DialogService(db)
    matches = await dialog_svc.search(request.message)

    if matches:
        best_match = matches[0]
        # Save both user message and preset reply
        await mem_svc.add_message(conv_id, "user", request.message)
        await mem_svc.add_message(conv_id, "assistant", best_match.answer)
        return ChatResponse(
            reply=best_match.answer,
            sources=["[预设对话] " + best_match.question],
            conversation_id=conv_id,
        )

    # Load history for multi-turn context
    summary, history_messages = await mem_svc.load_history(conv_id)
    history = [
        {"role": m.role, "content": m.content}
        for m in history_messages
    ]

    # Prepend summary as system context if available
    if summary and history:
        history.insert(0, {"role": "system", "content": f"[对话历史摘要]: {summary}"})

    # Use LangGraph agent with history
    agent = get_chat_agent()
    reply = await agent.chat(
        message=request.message,
        knowledge_base_id=request.knowledge_base_id,
        template_content=template.content,
        conversation_id=conv_id,
        history=history,
    )

    # Save both messages
    await mem_svc.add_message(conv_id, "user", request.message)
    await mem_svc.add_message(conv_id, "assistant", reply)

    # Compress if needed
    await mem_svc.maybe_compress(conv_id)

    return ChatResponse(reply=reply, conversation_id=conv_id)


@router.post("/copywriting/generate", response_model=CopywritingResponse)
async def generate_copywriting(request: CopywritingGenerateRequest):
    """文档知识：根据产品信息生成营销文案。"""
    agent = get_copywriting_agent()
    content = await agent.generate(
        product_name=request.product_name,
        product_type=request.product_type,
        product_features=request.product_features or "",
        product_price=request.product_price or "",
        promotion_info=request.promotion_info or "",
        target_audience=request.target_audience or "",
        stock_status=request.stock_status or "",
    )
    return CopywritingResponse(content=content)


@router.post("/copywriting/save", status_code=201)
async def save_copywriting(request: CopywritingSaveRequest, db: AsyncSession = Depends(get_db)):
    """将生成的文案保存到指定知识库。"""
    service = KnowledgeService(db)
    doc = await service.add_text_to_kb(
        kb_id=request.knowledge_base_id,
        text=request.content,
        filename=request.filename,
    )
    return {"id": doc.id, "filename": doc.filename}
