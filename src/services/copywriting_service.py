from datetime import datetime, timezone
from pathlib import Path
import os
import difflib
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.models.copywriting_session import CopywritingSession, CopywritingMessage, ComplianceRule
from src.config import get_settings
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

settings = get_settings()


class CopywritingService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Session CRUD ──

    async def create_session(self, title: str | None = None) -> CopywritingSession:
        session = CopywritingSession(title=title, status="active")
        self.db.add(session)
        await self.db.flush()
        return session

    async def get_session(self, session_id: str) -> CopywritingSession | None:
        result = await self.db.execute(
            select(CopywritingSession)
            .options(selectinload(CopywritingSession.messages))
            .where(CopywritingSession.id == session_id)
        )
        return result.scalar_one_or_none()

    async def list_sessions(self, limit: int = 50) -> list[CopywritingSession]:
        result = await self.db.execute(
            select(CopywritingSession)
            .options(selectinload(CopywritingSession.messages))
            .order_by(CopywritingSession.updated_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def delete_session(self, session_id: str) -> bool:
        session = await self.get_session(session_id)
        if not session:
            return False
        await self.db.delete(session)
        await self.db.flush()
        return True

    async def update_session_status(self, session_id: str, status: str) -> bool:
        session = await self.get_session(session_id)
        if not session:
            return False
        session.status = status
        session.updated_at = datetime.now(timezone.utc)
        await self.db.flush()
        return True

    # ── State serialization ──

    @staticmethod
    def serialize_state(state: dict) -> dict:
        """Convert LangGraph state (with BaseMessage objects) to JSON-serializable dict."""
        serializable = {}
        for key, value in state.items():
            if key == "messages":
                serializable[key] = [
                    {"type": msg.__class__.__name__, "content": msg.content}
                    for msg in value
                ]
            elif isinstance(value, bool):
                serializable[key] = value
            else:
                serializable[key] = value if value is not None else ""
        return serializable

    @staticmethod
    def deserialize_state(stored: dict) -> dict:
        """Convert stored JSONB dict back to LangGraph state with BaseMessage objects."""
        state = {}
        for key, value in stored.items():
            if key == "messages":
                msgs = []
                for m in value:
                    msg_type = m.get("type", "")
                    content = m.get("content", "")
                    if msg_type == "HumanMessage":
                        msgs.append(HumanMessage(content=content))
                    elif msg_type == "AIMessage":
                        msgs.append(AIMessage(content=content))
                    elif msg_type == "SystemMessage":
                        msgs.append(SystemMessage(content=content))
                state[key] = msgs
            elif key == "info_complete":
                state[key] = bool(value)
            else:
                state[key] = value if value is not None else ""
        return state

    async def save_state(self, session_id: str, state: dict) -> None:
        session = await self.get_session(session_id)
        if not session:
            raise ValueError("Session not found")
        session.langgraph_state = self.serialize_state(state)
        session.updated_at = datetime.now(timezone.utc)
        await self.db.flush()

    async def restore_state(self, session_id: str) -> dict | None:
        session = await self.get_session(session_id)
        if not session or not session.langgraph_state:
            return None
        return self.deserialize_state(session.langgraph_state)

    # ── Message CRUD ──

    async def add_message(self, session_id: str, role: str, content: str) -> CopywritingMessage:
        msg = CopywritingMessage(session_id=session_id, role=role, content=content)
        self.db.add(msg)

        session = await self.get_session(session_id)
        if session:
            session.updated_at = datetime.now(timezone.utc)
            if role == "user" and not session.title:
                session.title = content[:80]

        await self.db.flush()
        return msg

    async def get_messages(self, session_id: str) -> list[CopywritingMessage]:
        result = await self.db.execute(
            select(CopywritingMessage)
            .where(CopywritingMessage.session_id == session_id)
            .order_by(CopywritingMessage.created_at.asc())
        )
        return list(result.scalars().all())

    # ── Compliance Rules CRUD ──

    async def create_rule(
        self, title: str, content: str, source_type: str = "manual", file_path: str | None = None
    ) -> ComplianceRule:
        rule = ComplianceRule(title=title, content=content, source_type=source_type, file_path=file_path)
        self.db.add(rule)
        await self.db.flush()
        await self.db.refresh(rule)
        return rule

    async def list_rules(self) -> list[ComplianceRule]:
        result = await self.db.execute(
            select(ComplianceRule).order_by(ComplianceRule.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_rule(self, rule_id: str) -> ComplianceRule | None:
        result = await self.db.execute(
            select(ComplianceRule).where(ComplianceRule.id == rule_id)
        )
        return result.scalar_one_or_none()

    async def update_rule(self, rule_id: str, title: str | None, content: str | None) -> ComplianceRule | None:
        rule = await self.get_rule(rule_id)
        if not rule:
            return None
        if title is not None:
            rule.title = title
        if content is not None:
            rule.content = content
        rule.updated_at = datetime.now(timezone.utc)
        await self.db.flush()
        return rule

    async def delete_rule(self, rule_id: str) -> bool:
        rule = await self.get_rule(rule_id)
        if not rule:
            return False
        # Clean up uploaded file if exists
        if rule.file_path:
            try:
                file_path = Path(rule.file_path)
                if file_path.exists():
                    file_path.unlink()
                # Remove parent directory if empty
                parent = file_path.parent
                if parent.exists() and not any(parent.iterdir()):
                    parent.rmdir()
            except OSError:
                pass
        await self.db.delete(rule)
        await self.db.flush()
        return True

    async def get_all_rules_text(self) -> str:
        rules = await self.list_rules()
        if not rules:
            return "暂无特别合规要求"
        parts = []
        for r in rules:
            parts.append(f"## {r.title}\n{r.content}")
        return "\n\n".join(parts)

    # ── Compliance Rules: File upload ──

    @staticmethod
    def _compute_similarity(text1: str, text2: str) -> float:
        """Compute similarity ratio between two texts using difflib."""
        return difflib.SequenceMatcher(None, text1, text2).ratio()

    async def check_similarity(self, content: str) -> tuple[str | None, float]:
        """Check if new content is similar to any existing rule.
        Returns (rule_id, max_similarity) or (None, 0)."""
        rules = await self.list_rules()
        max_ratio = 0.0
        similar_id = None
        for rule in rules:
            ratio = self._compute_similarity(content, rule.content)
            if ratio > max_ratio:
                max_ratio = ratio
                similar_id = rule.id
        return (similar_id, max_ratio)

    async def upload_rule(
        self, title: str, content: str, file_bytes: bytes, filename: str, force: bool = False
    ) -> tuple[ComplianceRule | None, dict]:
        """Upload a compliance rule from file content.
        If force=False, checks similarity and returns warning if needed.
        Returns (rule, info_dict)."""
        if not force:
            similar_id, ratio = await self.check_similarity(content)
            if ratio > 0.8:
                similar_rule = await self.get_rule(similar_id)
                return (None, {
                    "status": "duplicate",
                    "similarity": ratio,
                    "similar_rule_id": similar_id,
                    "similar_rule_title": similar_rule.title if similar_rule else "",
                })
            if ratio > 0.6:
                similar_rule = await self.get_rule(similar_id)
                return (None, {
                    "status": "warning",
                    "similarity": ratio,
                    "similar_rule_id": similar_id,
                    "similar_rule_title": similar_rule.title if similar_rule else "",
                })

        # Create rule first to get an ID
        rule = ComplianceRule(title=title, content=content, source_type="document")
        self.db.add(rule)
        await self.db.flush()

        # Save uploaded file to disk
        upload_dir = Path(settings.upload_dir) / "compliance_rules" / rule.id
        upload_dir.mkdir(parents=True, exist_ok=True)
        file_path = upload_dir / filename
        file_path.write_bytes(file_bytes)

        rule.file_path = str(file_path.absolute())
        await self.db.flush()
        await self.db.refresh(rule)

        return (rule, {"status": "created"})

    async def get_rule_file_bytes(self, rule_id: str) -> tuple[bytes | None, str | None]:
        """Get uploaded file bytes and filename for download."""
        rule = await self.get_rule(rule_id)
        if not rule or not rule.file_path:
            return (None, None)
        file_path = Path(rule.file_path)
        if not file_path.exists():
            return (None, None)
        return (file_path.read_bytes(), file_path.name)
