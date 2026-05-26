from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.postgres import get_db
from src.services.template_service import TemplateService
from src.schemas.template import TemplateCreate, TemplateUpdate, TemplateOut

router = APIRouter(prefix="/api/templates", tags=["客服模版"])


@router.get("", response_model=list[TemplateOut])
async def list_templates(db: AsyncSession = Depends(get_db)):
    service = TemplateService(db)
    return await service.list_all()


@router.get("/{template_id}", response_model=TemplateOut)
async def get_template(template_id: str, db: AsyncSession = Depends(get_db)):
    service = TemplateService(db)
    template = await service.get(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    return template


@router.post("", response_model=TemplateOut, status_code=201)
async def create_template(data: TemplateCreate, db: AsyncSession = Depends(get_db)):
    service = TemplateService(db)
    return await service.create(data)


@router.put("/{template_id}", response_model=TemplateOut)
async def update_template(
    template_id: str,
    data: TemplateUpdate,
    db: AsyncSession = Depends(get_db),
):
    service = TemplateService(db)
    template = await service.update(template_id, data)
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    return template


@router.delete("/{template_id}", status_code=204)
async def delete_template(template_id: str, db: AsyncSession = Depends(get_db)):
    service = TemplateService(db)
    deleted = await service.delete(template_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="模板不存在")
