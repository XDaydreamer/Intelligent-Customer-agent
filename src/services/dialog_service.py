from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.models.dialog import PresetDialog
from src.schemas.dialog import PresetDialogCreate, PresetDialogUpdate


class DialogService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_all(self) -> list[PresetDialog]:
        """Return root-level dialogs with children eagerly loaded."""
        result = await self.db.execute(
            select(PresetDialog)
            .where(PresetDialog.parent_id.is_(None))
            .options(selectinload(PresetDialog.children))
            .order_by(PresetDialog.created_at.desc())
        )
        return list(result.scalars().all())

    async def get(self, dialog_id: str) -> PresetDialog | None:
        result = await self.db.execute(
            select(PresetDialog)
            .where(PresetDialog.id == dialog_id)
            .options(selectinload(PresetDialog.children))
        )
        return result.scalar_one_or_none()

    async def create(self, data: PresetDialogCreate) -> PresetDialog:
        dialog = PresetDialog(
            question=data.question,
            answer=data.answer,
            shop=data.shop,
            parent_id=data.parent_id,
        )
        self.db.add(dialog)
        await self.db.flush()
        return dialog

    async def update(self, dialog_id: str, data: PresetDialogUpdate) -> PresetDialog | None:
        dialog = await self.get(dialog_id)
        if not dialog:
            return None
        if data.question is not None:
            dialog.question = data.question
        if data.answer is not None:
            dialog.answer = data.answer
        if data.shop is not None:
            dialog.shop = data.shop
        await self.db.flush()
        return dialog

    async def delete(self, dialog_id: str) -> bool:
        dialog = await self.get(dialog_id)
        if not dialog:
            return False
        await self.db.delete(dialog)
        await self.db.flush()
        return True

    async def search(self, query: str) -> list[PresetDialog]:
        """Search dialogs that match the query (for quick-reply matching)."""
        result = await self.db.execute(
            select(PresetDialog).where(
                PresetDialog.question.ilike(f"%{query}%")
            )
        )
        return list(result.scalars().all())
