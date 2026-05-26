from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.template import Template
from src.schemas.template import TemplateCreate, TemplateUpdate


class TemplateService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_all(self) -> list[Template]:
        result = await self.db.execute(
            select(Template).order_by(Template.updated_at.desc())
        )
        return list(result.scalars().all())

    async def get(self, template_id: str) -> Template | None:
        result = await self.db.execute(
            select(Template).where(Template.id == template_id)
        )
        return result.scalar_one_or_none()

    async def create(self, data: TemplateCreate) -> Template:
        template = Template(name=data.name, content=data.content, intro=data.intro)
        self.db.add(template)
        await self.db.flush()
        return template

    async def update(self, template_id: str, data: TemplateUpdate) -> Template | None:
        template = await self.get(template_id)
        if not template:
            return None
        if data.name is not None:
            template.name = data.name
        if data.content is not None:
            template.content = data.content
        if data.intro is not None:
            template.intro = data.intro
        await self.db.flush()
        return template

    async def delete(self, template_id: str) -> bool:
        template = await self.get(template_id)
        if not template:
            return False
        await self.db.delete(template)
        await self.db.flush()
        return True
