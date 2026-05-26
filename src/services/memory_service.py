from datetime import datetime, timedelta, timezone
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.models.conversation import Conversation, Message
from src.config import get_settings

settings = get_settings()


class MemoryService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Conversation CRUD ──────────────────────────────

    async def create_conversation(self, title: str | None = None) -> Conversation:
        # Auto-assign customer label by counting existing conversations
        count_result = await self.db.execute(
            select(func.count(Conversation.id))
        )
        total = count_result.scalar() or 0
        conv = Conversation(title=title, customer_label=f"客户{total + 1}")
        self.db.add(conv)
        await self.db.flush()
        return conv

    async def get_conversation(self, conv_id: str) -> Conversation | None:
        result = await self.db.execute(
            select(Conversation)
            .options(selectinload(Conversation.messages))
            .where(Conversation.id == conv_id)
        )
        return result.scalar_one_or_none()

    async def list_conversations(self, limit: int = 50) -> list[Conversation]:
        result = await self.db.execute(
            select(Conversation)
            .where(Conversation.is_active.is_(True))
            .order_by(Conversation.updated_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def delete_conversation(self, conv_id: str) -> bool:
        conv = await self.get_conversation(conv_id)
        if not conv:
            return False
        await self.db.delete(conv)
        await self.db.flush()
        return True

    # ── Message operations ─────────────────────────────

    async def add_message(self, conv_id: str, role: str, content: str) -> Message:
        """Add a message and update conversation counters."""
        conv = await self.get_conversation(conv_id)
        if not conv:
            raise ValueError("会话不存在")

        token_count = self._estimate_tokens(content)

        msg = Message(
            conversation_id=conv_id,
            role=role,
            content=content,
            token_count=token_count,
        )
        self.db.add(msg)

        conv.message_count += 1
        conv.updated_at = datetime.now(timezone.utc)

        if not conv.title and role == "user":
            conv.title = content[:80]

        await self.db.flush()
        return msg

    async def load_history(self, conv_id: str) -> tuple[str | None, list[Message]]:
        """Return (summary, list of recent non-summarized messages) for agent context."""
        result = await self.db.execute(
            select(Message)
            .where(
                Message.conversation_id == conv_id,
                Message.is_summarized.is_(False),
            )
            .order_by(Message.created_at.asc())
            .limit(settings.max_messages_per_session)
        )
        recent = list(result.scalars().all())

        conv_result = await self.db.execute(
            select(Conversation.summary).where(Conversation.id == conv_id)
        )
        summary = conv_result.scalar_one_or_none()

        return (summary, recent)

    # ── Compression ────────────────────────────────────

    async def maybe_compress(self, conv_id: str) -> bool:
        """Compress old messages into a summary if over the limit."""
        conv = await self.get_conversation(conv_id)
        if not conv:
            return False

        # Count non-summarized messages
        count_result = await self.db.execute(
            select(func.count(Message.id)).where(
                Message.conversation_id == conv_id,
                Message.is_summarized.is_(False),
            )
        )
        non_summarized = count_result.scalar() or 0

        if non_summarized <= settings.max_messages_per_session:
            return False

        # Get oldest messages that need compression
        excess = non_summarized - settings.recent_messages_keep
        result = await self.db.execute(
            select(Message)
            .where(
                Message.conversation_id == conv_id,
                Message.is_summarized.is_(False),
            )
            .order_by(Message.created_at.asc())
            .limit(excess)
        )
        old_messages = list(result.scalars().all())

        if not old_messages:
            return False

        # Generate summary of old messages
        new_summary = await self._summarize_messages(old_messages, conv.summary)

        # Mark messages as summarized
        for msg in old_messages:
            msg.is_summarized = True

        # Update conversation summary
        conv.summary = new_summary

        await self.db.flush()
        return True

    async def _summarize_messages(self, messages: list[Message], existing_summary: str | None) -> str:
        """Use LLM to compress old messages into a summary preserving key facts."""
        from src.agents.llm import get_llm
        llm = get_llm(temperature=0.1)

        dialog_text = "\n".join(
            f"{'客户' if m.role == 'user' else '客服'}: {m.content}" for m in messages
        )

        prompt = f"""请将以下客服对话中客户提到的关键信息提炼为简短摘要。
只保留客户身份、需求、偏好、问题等关键事实，不超过200字。

已有摘要：{existing_summary or '(无)'}

对话内容：
{dialog_text}

请输出更新后的完整摘要："""

        response = await llm.ainvoke(prompt)
        return response.content.strip()

    # ── Cleanup ────────────────────────────────────────

    async def cleanup_expired(self) -> int:
        """Delete conversations older than TTL. Returns count deleted."""
        cutoff = datetime.now(timezone.utc) - timedelta(days=settings.session_ttl_days)
        result = await self.db.execute(
            select(Conversation.id).where(Conversation.updated_at < cutoff)
        )
        expired_ids = [row[0] for row in result.all()]

        if expired_ids:
            await self.db.execute(
                delete(Conversation).where(Conversation.id.in_(expired_ids))
            )
            await self.db.flush()

        return len(expired_ids)

    # ── Message update ─────────────────────────────────

    async def update_message(self, msg_id: str, content: str):
        result = await self.db.execute(
            select(Message).where(Message.id == msg_id)
        )
        msg = result.scalar_one_or_none()
        if not msg:
            return None
        msg.content = content
        msg.token_count = self._estimate_tokens(content)
        await self.db.flush()
        return msg

    # ── Save as preset dialog ─────────────────────────

    async def create_preset_dialog(
        self, question: str, answer: str, parent_id: str | None = None
    ):
        """Save a Q&A pair as a preset dialog (知能对话), with dedup."""
        from src.models.dialog import PresetDialog

        # Check for existing identical pair
        existing = await self.db.execute(
            select(PresetDialog).where(
                PresetDialog.question == question,
                PresetDialog.answer == answer,
            )
        )
        if existing.scalar_one_or_none():
            return None  # Already exists, skip

        dialog = PresetDialog(
            question=question,
            answer=answer,
            parent_id=parent_id,
        )
        self.db.add(dialog)
        await self.db.flush()
        return dialog

    # ── Helpers ────────────────────────────────────────

    def _estimate_tokens(self, text: str) -> int:
        """Rough token estimation for Chinese text (~1.5 chars per token)."""
        return max(1, len(text) // 2)
