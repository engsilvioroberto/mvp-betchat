"""
Vercel serverless entry point for Betchat API.
"""
from fastapi import FastAPI

app = FastAPI(title="Betchat", version="1.0.0")


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}