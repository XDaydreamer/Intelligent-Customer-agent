from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.postgres import get_db
from src.services.memory_service import MemoryService
from src.schemas.conversation import ConversationListItem, ConversationDetail, MessageOut


class UpdateMessageRequest(BaseModel):
    content: str


class SaveAsDialogRequest(BaseModel):
    message_ids: list[str]
    parent_id: str | None = None


router = APIRouter(prefix="/api/conversations", tags=["会话管理"])


@router.get("", response_model=list[ConversationListItem])
async def list_conversations(db: AsyncSession = Depends(get_db)):
    svc = MemoryService(db)
    convs = await svc.list_conversations()
    return [
        {
            "id": c.id,
            "title": c.title,
            "customer_label": c.customer_label,
            "message_count": c.message_count,
            "updated_at": c.updated_at,
        }
        for c in convs
    ]


@router.get("/{conv_id}", response_model=ConversationDetail)
async def get_conversation(conv_id: str, db: AsyncSession = Depends(get_db)):
    svc = MemoryService(db)
    conv = await svc.get_conversation(conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="会话不存在")
    return conv


@router.delete("/{conv_id}", status_code=204)
async def delete_conversation(conv_id: str, db: AsyncSession = Depends(get_db)):
    svc = MemoryService(db)
    deleted = await svc.delete_conversation(conv_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="会话不存在")


@router.put("/{conv_id}/messages/{msg_id}", response_model=MessageOut)
async def update_message(
    conv_id: str,
    msg_id: str,
    body: UpdateMessageRequest,
    db: AsyncSession = Depends(get_db),
):
    svc = MemoryService(db)
    msg = await svc.update_message(msg_id, body.content)
    if not msg:
        raise HTTPException(status_code=404, detail="消息不存在")
    return msg


@router.post("/{conv_id}/save-as-dialog")
async def save_as_dialog(
    conv_id: str,
    body: SaveAsDialogRequest,
    db: AsyncSession = Depends(get_db),
):
    svc = MemoryService(db)
    conv = await svc.get_conversation(conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="会话不存在")

    # Collect messages in the order they appear
    messages = {m.id: m for m in conv.messages}
    selected = [
        messages[mid] for mid in body.message_ids
        if mid in messages
    ]
    selected.sort(key=lambda m: m.created_at)

    created = 0
    i = 0
    # Match adjacent user→assistant pairs from selected messages
    while i < len(selected) - 1:
        user_msg = selected[i]
        ai_msg = selected[i + 1]
        if user_msg.role == "user" and ai_msg.role == "assistant":
            await svc.create_preset_dialog(
                question=user_msg.content,
                answer=ai_msg.content,
                parent_id=body.parent_id,
            )
            created += 1
            i += 2
        else:
            i += 1

    return {"created": created}
