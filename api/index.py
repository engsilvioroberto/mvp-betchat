"""Minimal Vercel test function"""
try:
    from fastapi import FastAPI
    app = FastAPI()

    @app.get("/api/health")
    def health():
        return {"status": "ok", "version": "test"}
except Exception as e:
    # If anything fails, report it clearly
    import json
    from fastapi import FastAPI
    app = FastAPI()

    @app.get("/api/health")
    def health_error():
        return {"error": str(e), "type": type(e).__name__}