"""
Vercel serverless entry point for Betchat API.
Uses Mangum to adapt FastAPI (ASGI) to Vercel's serverless format.
Frontend is served via explicit routes for static files + SPA fallback.
"""
import sys
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
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


# --- Frontend static file serving ---
STATIC_DIR = _api_dir / "static"

if STATIC_DIR.exists():
    import mimetypes
    mimetypes.init()

    @app.get("/assets/{filepath:path}")
    async def serve_asset(filepath: str):
        file = STATIC_DIR / "assets" / filepath
        if file.is_file():
            return FileResponse(str(file))
        return JSONResponse(status_code=404, content={"error": "Not found"})

    @app.get("/favicon.svg")
    async def serve_favicon():
        file = STATIC_DIR / "favicon.svg"
        if file.is_file():
            return FileResponse(str(file))
        return JSONResponse(status_code=404, content={"error": "Not found"})

    @app.get("/icons.svg")
    async def serve_icons():
        file = STATIC_DIR / "icons.svg"
        if file.is_file():
            return FileResponse(str(file))
        return JSONResponse(status_code=404, content={"error": "Not found"})

    # SPA catch-all — serve index.html for any non-API path
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        index = STATIC_DIR / "index.html"
        if index.exists():
            return FileResponse(str(index))
        return JSONResponse(status_code=404, content={"error": "Frontend not built"})
else:
    @app.get("/{full_path:path}")
    async def not_built(full_path: str):
        return JSONResponse(status_code=404, content={"error": "Frontend not built. Run build command first."})


# Vercel handler
handler = Mangum(app)