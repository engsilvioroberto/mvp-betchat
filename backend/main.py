"""
Local development entry point for Betchat.

Imports from the `api/` directory (single source of truth with Vercel).
"""
import sys
from pathlib import Path

# Add api/ to Python path so imports work for local dev
api_dir = str(Path(__file__).resolve().parent.parent / "api")
if api_dir not in sys.path:
    sys.path.insert(0, api_dir)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager

from database import init_db
from routers.groups import router as groups_router
from routers.players import router as players_router
from routers.bets import router as bets_router
from routers.simulate import router as simulate_router

frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Betchat", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(groups_router)
app.include_router(players_router)
app.include_router(bets_router)
app.include_router(simulate_router)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


# Catch-all: serve frontend SPA (only for non-API routes, local dev only)
@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    file_path = frontend_dist / (full_path or "index.html")
    if file_path.is_file():
        return FileResponse(str(file_path))
    index = frontend_dist / "index.html"
    if index.exists():
        return FileResponse(str(index))
    return FileResponse(str(index))