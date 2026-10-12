import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api.endpoints.market import router as market_router
from app.api.endpoints.trading import router as trading_router
from app.api.endpoints.ai_signals import router as ai_router
from app.api.endpoints.websocket import router as ws_router
from app.core.data_feed import data_feed

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Dual-AI (JEV AI System 1 + Ollama System 2) Forex and Indian Stock Trading Platform"
)

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(market_router)
app.include_router(trading_router)
app.include_router(ai_router)
app.include_router(ws_router)

@app.on_event("startup")
async def startup_event():
    print(f"[STARTUP] {settings.PROJECT_NAME} initialized.")
    print("[MARKET] Pre-warming initial candle feeds for Indian Equities and Forex...")
    # Pre-warm default assets in the background
    for sym in ["RELIANCE.NS", "USDINR=X", "EURUSD=X", "TCS.NS", "SBIN.NS"]:
        try:
            data_feed.fetch_historical_candles(sym)
        except Exception as e:
            print(f"[MARKET] Pre-warm skipped for {sym}: {e}")
    print("[SUCCESS] Market engine ready.")

@app.get("/")
async def root():
    return {
        "status": "ONLINE",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
        "sessions": data_feed.get_market_sessions()
    }

if __name__ == "__main__":
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)

