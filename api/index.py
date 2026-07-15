"""
Vercel serverless entry point for Betchat API.
"""
import sys
from pathlib import Path

_api_dir = Path(__file__).resolve().parent
if str(_api_dir) not in sys.path:
    sys.path.insert(0, str(_api_dir))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db, engine
from routers.groups import router as groups_router
from routers.players import router as players_router
from routers.bets import router as bets_router
from routers.simulate import router as simulate_router

init_db()

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
    return {"status": "ok", "version": "1.0.0"}