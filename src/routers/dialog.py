from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.postgres import get_db
from src.services.dialog_service import DialogService
from src.schemas.dialog import PresetDialogCreate, PresetDialogUpdate, PresetDialogOut

router = APIRouter(prefix="/api/dialogs", tags=["知能对话"])


@router.get("", response_model=list[PresetDialogOut])
async def list_dialogs(db: AsyncSession = Depends(get_db)):
    service = DialogService(db)
    return await service.list_all()


@router.get("/{dialog_id}", response_model=PresetDialogOut)
async def get_dialog(dialog_id: str, db: AsyncSession = Depends(get_db)):
    service = DialogService(db)
    dialog = await service.get(dialog_id)
    if not dialog:
        raise HTTPException(status_code=404, detail="对话不存在")
    return dialog


@router.post("", response_model=PresetDialogOut, status_code=201)
async def create_dialog(data: PresetDialogCreate, db: AsyncSession = Depends(get_db)):
    service = DialogService(db)
    return await service.create(data)


@router.put("/{dialog_id}", response_model=PresetDialogOut)
async def update_dialog(
    dialog_id: str,
    data: PresetDialogUpdate,
    db: AsyncSession = Depends(get_db),
):
    service = DialogService(db)
    dialog = await service.update(dialog_id, data)
    if not dialog:
        raise HTTPException(status_code=404, detail="对话不存在")
    return dialog


@router.delete("/{dialog_id}", status_code=204)
async def delete_dialog(dialog_id: str, db: AsyncSession = Depends(get_db)):
    service = DialogService(db)
    deleted = await service.delete(dialog_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="对话不存在")
