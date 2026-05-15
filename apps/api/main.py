from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import get_settings
from core.database import close_db, init_db
from routers import audits, billing, gdpr, health, tenants

settings = get_settings()
app = FastAPI(title="LocalAudit API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup() -> None:
    await init_db()


@app.on_event("shutdown")
async def on_shutdown() -> None:
    await close_db()


app.include_router(health.router)
app.include_router(audits.router)
app.include_router(tenants.router)
app.include_router(billing.router)
app.include_router(gdpr.router)
