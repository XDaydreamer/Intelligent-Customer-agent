"""
塔塔云 — 电商智能客服系统
FastAPI 主入口
"""

import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import get_settings
from src.database.init_db import init_db
from src.database.postgres import async_session_factory
from src.services.memory_service import MemoryService
from src.routers import knowledge, template, dialog, transfer, chat, conversation
from src.routers.copywriting_workflow import router as copywriting_workflow_router, compliance_router

settings = get_settings()


async def periodic_cleanup():
    """Clean up expired conversations every 10 minutes."""
    while True:
        await asyncio.sleep(600)
        try:
            async with async_session_factory() as db:
                deleted = await MemoryService(db).cleanup_expired()
                if deleted:
                    print(f"[Cleanup] 清理了 {deleted} 个过期会话")
        except Exception as e:
            print(f"[Cleanup] 清理任务出错: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure DB tables exist, start cleanup task
    await init_db()
    cleanup_task = asyncio.create_task(periodic_cleanup())
    yield
    # Shutdown
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="基于 LangGraph 的智能客服系统",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost",       # Docker production
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(knowledge.router)
app.include_router(template.router)
app.include_router(dialog.router)
app.include_router(transfer.router)
app.include_router(chat.router)
app.include_router(conversation.router)
app.include_router(copywriting_workflow_router)
app.include_router(compliance_router)


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": settings.app_name, "version": settings.app_version}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=settings.debug)
