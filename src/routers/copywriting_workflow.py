from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from langchain_core.messages import HumanMessage

from src.config import get_settings
from src.database.postgres import get_db
from src.services.copywriting_service import CopywritingService
from src.services.knowledge_service import KnowledgeService
from src.agents.copywriting_workflow_agent import get_copywriting_workflow_agent, CopywritingWorkflowState
from src.utils.file_parser import FileParser

settings = get_settings()
from src.schemas.copywriting_workflow import (
    StartSessionRequest, SendMessageRequest,
    SessionListItem, SessionDetail, SessionStartResponse, SessionSendResponse,
    ExportResponse, SaveToKbRequest, ImageOut, SessionImagesResponse,
    ComplianceRuleCreate, ComplianceRuleUpdate, ComplianceRuleOut, UploadRuleResponse,
)

router = APIRouter(prefix="/api/copywriting/workflow", tags=["文案生成工作流"])


# ── Session endpoints ──

@router.post("/start", response_model=SessionStartResponse)
async def start_session(body: StartSessionRequest, db: AsyncSession = Depends(get_db)):
    svc = CopywritingService(db)
    agent = get_copywriting_workflow_agent()

    session = await svc.create_session(title=body.title)
    await svc.add_message(session.id, "user", body.initial_message)

    rules_text = await svc.get_all_rules_text()

    initial_state: CopywritingWorkflowState = {
        "messages": [HumanMessage(content=body.initial_message)],
        "product_name": "", "product_type": "", "product_features": "",
        "product_price": "", "promotion_info": "", "target_audience": "",
        "stock_status": "", "info_complete": False, "analysis_result": "",
        "generated_copy": "", "compliance_rules": rules_text,
        "next_action": "", "manager_question": "", "image_paths": [],
    }

    result = await agent.run(initial_state)
    await svc.save_state(session.id, result)

    agent_content = result.get("manager_question") or result.get("generated_copy", "")
    agent_msg = await svc.add_message(session.id, "agent", agent_content)

    if result.get("next_action") == "done":
        await svc.update_session_status(session.id, "completed")
        if not session.title:
            session.title = result.get("product_name") or body.initial_message[:50]

    return SessionStartResponse(
        session_id=session.id,
        agent_message=agent_msg,
        next_action=result.get("next_action", "ask_user"),
    )


@router.post("/{session_id}/send", response_model=SessionSendResponse)
async def send_message(session_id: str, body: SendMessageRequest, db: AsyncSession = Depends(get_db)):
    svc = CopywritingService(db)
    agent = get_copywriting_workflow_agent()

    session = await svc.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="文案会话不存在")
    if session.status == "completed":
        raise HTTPException(status_code=400, detail="该会话已完成，请创建新会话")
    if session.status == "cancelled":
        raise HTTPException(status_code=400, detail="该会话已取消")

    await svc.add_message(session_id, "user", body.message)

    state = await svc.restore_state(session_id)
    if state is None:
        raise HTTPException(status_code=500, detail="无法恢复会话状态")

    state["messages"] = list(state.get("messages", [])) + [HumanMessage(content=body.message)]
    state["compliance_rules"] = await svc.get_all_rules_text()
    state["image_paths"] = state.get("image_paths", [])

    result = await agent.run(state)
    await svc.save_state(session_id, result)

    agent_content = result.get("manager_question") or result.get("generated_copy", "生成中...")
    agent_msg = await svc.add_message(session_id, "agent", agent_content)

    if result.get("next_action") == "done":
        await svc.update_session_status(session_id, "completed")
        if not session.title:
            session.title = result.get("product_name") or ""

    return SessionSendResponse(
        agent_message=agent_msg,
        next_action=result.get("next_action", "ask_user"),
        generated_copy=result.get("generated_copy", ""),
    )


@router.get("/{session_id}", response_model=SessionDetail)
async def get_session_detail(session_id: str, db: AsyncSession = Depends(get_db)):
    svc = CopywritingService(db)
    session = await svc.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="文案会话不存在")

    messages = await svc.get_messages(session_id)
    state = session.langgraph_state or {}

    return SessionDetail(
        id=session.id,
        title=session.title,
        status=session.status,
        generated_copy=state.get("generated_copy", ""),
        next_action=state.get("next_action", ""),
        manager_question=state.get("manager_question", ""),
        messages=messages,
        created_at=session.created_at,
        updated_at=session.updated_at,
    )


@router.get("", response_model=list[SessionListItem])
async def list_sessions(db: AsyncSession = Depends(get_db)):
    svc = CopywritingService(db)
    sessions = await svc.list_sessions()
    return [
        SessionListItem(
            id=s.id, title=s.title, status=s.status,
            message_count=len(s.messages) if s.messages else 0,
            created_at=s.created_at, updated_at=s.updated_at,
        ) for s in sessions
    ]


@router.delete("/{session_id}", status_code=204)
async def delete_session(session_id: str, db: AsyncSession = Depends(get_db)):
    svc = CopywritingService(db)
    deleted = await svc.delete_session(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="文案会话不存在")


@router.get("/{session_id}/export", response_model=ExportResponse)
async def export_copy(session_id: str, db: AsyncSession = Depends(get_db)):
    svc = CopywritingService(db)
    session = await svc.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="文案会话不存在")
    state = session.langgraph_state or {}
    copy = state.get("generated_copy", "")
    if not copy:
        raise HTTPException(status_code=400, detail="该会话尚未生成文案")
    return ExportResponse(content=copy)


@router.post("/{session_id}/save-to-kb", status_code=201)
async def save_to_kb(session_id: str, body: SaveToKbRequest, db: AsyncSession = Depends(get_db)):
    svc = CopywritingService(db)
    session = await svc.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="文案会话不存在")
    state = session.langgraph_state or {}
    copy = state.get("generated_copy", "")
    if not copy:
        raise HTTPException(status_code=400, detail="该会话尚未生成文案，无法保存")

    kb_svc = KnowledgeService(db)
    doc = await kb_svc.add_text_to_kb(
        kb_id=body.knowledge_base_id,
        text=copy,
        filename=body.filename,
    )
    return {"id": doc.id, "filename": doc.filename}


# ── Image endpoints ──

@router.post("/{session_id}/images", response_model=list[ImageOut])
async def upload_images(session_id: str, files: list[UploadFile] = File(...), db: AsyncSession = Depends(get_db)):
    """Upload product images to a copywriting session."""
    svc = CopywritingService(db)
    session = await svc.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="文案会话不存在")
    if session.status == "completed":
        raise HTTPException(status_code=400, detail="该会话已完成")

    result = []
    for file in files:
        if not file.filename:
            continue
        ext = (file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "")
        if ext not in ("jpg", "jpeg", "png", "gif", "webp", "bmp"):
            continue
        file_bytes = await file.read()
        image_id, preview_url = await svc.add_image(session_id, file.filename, file_bytes)
        result.append(ImageOut(image_id=image_id, filename=file.filename, preview_url=preview_url))

        # Add image path to session state
        state = await svc.restore_state(session_id)
        if state:
            img_dir = Path(settings.upload_dir) / "copywriting_images" / session_id
            state["image_paths"] = state.get("image_paths", [])
            state["image_paths"].append(str(img_dir / image_id))
            await svc.save_state(session_id, state)

    return result


@router.get("/{session_id}/images", response_model=SessionImagesResponse)
async def list_images(session_id: str, db: AsyncSession = Depends(get_db)):
    """List all images uploaded to this session."""
    svc = CopywritingService(db)
    session = await svc.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="文案会话不存在")
    images = await svc.list_images(session_id)
    return SessionImagesResponse(images=[ImageOut(**img) for img in images])


@router.get("/{session_id}/images/{image_id}")
async def get_image(session_id: str, image_id: str, db: AsyncSession = Depends(get_db)):
    """Serve an uploaded image for preview."""
    svc = CopywritingService(db)
    image_bytes = await svc.get_image_bytes(session_id, image_id)
    if image_bytes is None:
        raise HTTPException(status_code=404, detail="图片不存在")

    import tempfile
    ext = image_id.rsplit(".", 1)[-1].lower() if "." in image_id else "jpg"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}")
    tmp.write(image_bytes)
    tmp.close()

    import mimetypes
    media_type, _ = mimetypes.guess_type(f"image.{ext}")
    return FileResponse(tmp.name, media_type=media_type or "image/jpeg")


@router.delete("/{session_id}/images/{image_id}", status_code=204)
async def delete_image(session_id: str, image_id: str, db: AsyncSession = Depends(get_db)):
    """Delete an uploaded image from the session."""
    svc = CopywritingService(db)
    session = await svc.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="文案会话不存在")

    deleted = await svc.delete_image(session_id, image_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="图片不存在")

    # Remove from state image_paths
    state = await svc.restore_state(session_id)
    if state:
        img_dir = Path(settings.upload_dir) / "copywriting_images" / session_id
        to_remove = str(img_dir / image_id)
        state["image_paths"] = [p for p in state.get("image_paths", []) if p != to_remove]
        await svc.save_state(session_id, state)


# ── Compliance Rules endpoints ──

compliance_router = APIRouter(prefix="/api/compliance-rules", tags=["合规规则"])


@compliance_router.get("", response_model=list[ComplianceRuleOut])
async def list_rules(db: AsyncSession = Depends(get_db)):
    svc = CopywritingService(db)
    return await svc.list_rules()


@compliance_router.post("", response_model=ComplianceRuleOut, status_code=201)
async def create_rule(body: ComplianceRuleCreate, db: AsyncSession = Depends(get_db)):
    svc = CopywritingService(db)
    return await svc.create_rule(title=body.title, content=body.content, source_type=body.source_type)


@compliance_router.put("/{rule_id}", response_model=ComplianceRuleOut)
async def update_rule(rule_id: str, body: ComplianceRuleUpdate, db: AsyncSession = Depends(get_db)):
    svc = CopywritingService(db)
    rule = await svc.update_rule(rule_id, title=body.title, content=body.content)
    if not rule:
        raise HTTPException(status_code=404, detail="合规规则不存在")
    return rule


@compliance_router.delete("/{rule_id}", status_code=204)
async def delete_rule(rule_id: str, db: AsyncSession = Depends(get_db)):
    svc = CopywritingService(db)
    deleted = await svc.delete_rule(rule_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="合规规则不存在")


@compliance_router.post("/upload", response_model=UploadRuleResponse)
async def upload_rule(
    file: UploadFile = File(...),
    force: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """Upload a compliance rule file (.md, .docx, .txt)."""
    filename = file.filename or "rule.txt"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ("md", "docx", "txt"):
        raise HTTPException(status_code=400, detail=f"不支持的文件格式: .{ext}，仅支持 .md / .docx / .txt")

    file_bytes = await file.read()

    try:
        content = FileParser.parse_bytes(file_bytes, filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"文件解析失败: {str(e)}")

    title = filename.rsplit(".", 1)[0]

    svc = CopywritingService(db)
    rule, info = await svc.upload_rule(
        title=title, content=content,
        file_bytes=file_bytes, filename=filename,
        force=force,
    )

    if info["status"] == "duplicate":
        return UploadRuleResponse(
            status="duplicate",
            similarity=info.get("similarity", 0),
            similar_rule_id=info.get("similar_rule_id", ""),
            similar_rule_title=info.get("similar_rule_title", ""),
        )
    if info["status"] == "warning":
        return UploadRuleResponse(
            status="warning",
            similarity=info.get("similarity", 0),
            similar_rule_id=info.get("similar_rule_id", ""),
            similar_rule_title=info.get("similar_rule_title", ""),
        )

    return UploadRuleResponse(status="created", rule=rule)


@compliance_router.get("/{rule_id}/file")
async def get_rule_file(rule_id: str, db: AsyncSession = Depends(get_db)):
    """Download the original uploaded file for a compliance rule."""
    svc = CopywritingService(db)
    rule = await svc.get_rule(rule_id)
    if not rule or not rule.file_path:
        raise HTTPException(status_code=404, detail="该规则没有上传文件")

    file_bytes, filename = await svc.get_rule_file_bytes(rule_id)
    if file_bytes is None:
        raise HTTPException(status_code=404, detail="文件不存在")

    import tempfile
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=f"_{filename}")
    tmp.write(file_bytes)
    tmp.close()

    import mimetypes
    media_type, _ = mimetypes.guess_type(filename)
    return FileResponse(tmp.name, media_type=media_type or "application/octet-stream", filename=filename)
