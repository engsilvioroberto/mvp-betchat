"""
Vercel serverless entry point for Betchat API.
Uses Mangum to adapt FastAPI (ASGI) to Vercel's serverless format.
The frontend static files are served from the `static/` directory.
"""
import sys
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from mangum import Mangum

_api_dir = Path(__file__).resolve().parent
if str(_api_dir) not in sys.path:
    sys.path.insert(0, str(_api_dir))

from database import init_db, engine
from routers.groups import router as groups_router
from routers.players import router as players_router
from routers.bets import router as bets_router
from routers.simulate import router as simulate_router

app = FastAPI(title="Betchat", version="1.0.0")

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
    try:
        init_db()
        return {"status": "ok", "version": "1.0.0", "db": "connected"}
    except Exception as e:
        return {"status": "error", "version": "1.0.0", "db": str(e)}


# Serve frontend static files from the static/ directory
static_dir = _api_dir / "static"
if static_dir.exists():
    # Mount static files at root — SPA: any non-API path serves index.html
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")

# Vercel handler
handler = Mangum(app)