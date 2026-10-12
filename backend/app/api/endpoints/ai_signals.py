from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any
from app.core.data_feed import data_feed
from app.ai.jev_client import jev_client
from app.ai.ollama_client import ollama_client
from app.models.schemas import JevDecision, OllamaReasoning

router = APIRouter(prefix="/api/ai", tags=["Dual-AI Engine"])

class ChatRequest(BaseModel):
    query: str
    symbol: str

@router.get("/jev/{symbol}")
async def get_jev_decision(symbol: str) -> JevDecision:
    """Trigger System 1 fast quantitative decision gate (<500ms)"""
    snapshot = data_feed.get_snapshot(symbol)
    decision = await jev_client.evaluate_market(snapshot)
    return decision

@router.get("/ollama/{symbol}")
async def get_ollama_reasoning(symbol: str) -> OllamaReasoning:
    """Trigger System 2 deep contextual & macroeconomic analysis"""
    snapshot = data_feed.get_snapshot(symbol)
    reasoning = await ollama_client.analyze_snapshot(snapshot)
    return reasoning

@router.post("/chat")
async def chat_with_trading_ai(req: ChatRequest):
    """Interactive conversational assistant for trade strategy and risk analysis"""
    snapshot = data_feed.get_snapshot(req.symbol)
    response_text = await ollama_client.chat_assistant(req.query, snapshot)
    return {
        "reply": response_text,
        "symbol": req.symbol
    }

@router.get("/eod-predictions")
async def get_eod_predictions(category: str = None, limit: int = 50):
    """Retrieve active End-of-Day predictions, investment sizing, and reasoning from database"""
    from app.core.database import db
    predictions = db.get_active_predictions(category=category, limit=limit)
    last_run = db.get_last_scan_run()
    return {
        "predictions": predictions,
        "count": len(predictions),
        "last_scan": last_run
    }

@router.post("/eod-scan")
async def trigger_eod_scan():
    """Trigger the End-of-Day local Ollama & quantitative forecasting engine"""
    result = await ollama_client.run_eod_analysis()
    return result

@router.get("/eod-scan/status")
async def get_eod_scan_status():
    """Check the status and timestamp of the latest EOD prediction batch"""
    from app.core.database import db
    last_run = db.get_last_scan_run()
    return {
        "last_run": last_run,
        "status": last_run.get("status") if last_run else "IDLE"
    }

@router.get("/strategy-overlay/{symbol}")
async def get_strategy_overlay(symbol: str):
    """Returns AI-detected Trend, Range, Breakout, Scalping strategies and Chart Patterns for plotting"""
    from app.core.strategy_engine import AIStrategyAndPatternEngine
    candles = data_feed.candle_cache.get(symbol)
    if not candles or len(candles) < 15:
        candles = data_feed.fetch_historical_candles(symbol, interval="5m", period="5d")
    return AIStrategyAndPatternEngine.analyze(candles, symbol=symbol)



