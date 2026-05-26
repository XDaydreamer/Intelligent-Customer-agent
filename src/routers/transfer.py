from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.postgres import get_db
from src.models.transfer_rule import TransferRule
from src.schemas.transfer_rule import (
    TransferRuleCreate,
    TransferRuleUpdate,
    TransferRuleOut,
)

router = APIRouter(prefix="/api/transfer-rules", tags=["转人工设置"])


@router.get("", response_model=list[TransferRuleOut])
async def list_rules(
    enabled_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(TransferRule).order_by(TransferRule.created_at.desc())
    if enabled_only:
        stmt = stmt.where(TransferRule.enabled.is_(True))
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("", response_model=TransferRuleOut, status_code=201)
async def create_rule(data: TransferRuleCreate, db: AsyncSession = Depends(get_db)):
    rule = TransferRule(keyword=data.keyword, reply=data.reply, enabled=data.enabled)
    db.add(rule)
    await db.flush()
    return rule


@router.put("/{rule_id}", response_model=TransferRuleOut)
async def update_rule(
    rule_id: str,
    data: TransferRuleUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(TransferRule).where(TransferRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")
    if data.keyword is not None:
        rule.keyword = data.keyword
    if data.reply is not None:
        rule.reply = data.reply
    if data.enabled is not None:
        rule.enabled = data.enabled
    await db.flush()
    return rule


@router.delete("/{rule_id}", status_code=204)
async def delete_rule(rule_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TransferRule).where(TransferRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")
    await db.delete(rule)
    await db.flush()
