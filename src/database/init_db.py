"""Database initialization — creates all tables."""
from src.database.postgres import engine, Base

# Import all models so they register with Base.metadata
import src.models.knowledge_base   # noqa: F401
import src.models.template         # noqa: F401
import src.models.dialog           # noqa: F401
import src.models.transfer_rule    # noqa: F401
import src.models.conversation     # noqa: F401
import src.models.copywriting_session  # noqa: F401


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def drop_all():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
