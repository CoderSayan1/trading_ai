from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Union
from datetime import datetime

class Candle(BaseModel):
    time: int  # Unix timestamp in seconds
    open: float
    high: float
    low: float
    close: float
    volume: float = 0.0

class TechnicalIndicators(BaseModel):
    rsi: Optional[float] = None
    ema9: Optional[float] = None
    ema21: Optional[float] = None
    ema50: Optional[float] = None
    ema200: Optional[float] = None
    atr: Optional[float] = None
    macd: Optional[float] = None
    macd_signal: Optional[float] = None
    macd_hist: Optional[float] = None
    bb_upper: Optional[float] = None
    bb_middle: Optional[float] = None
    bb_lower: Optional[float] = None
    trend: str = "NEUTRAL"  # "BULLISH", "BEARISH", "NEUTRAL"

class TickerSnapshot(BaseModel):
    symbol: str
    name: str
    currency: str
    last_price: float
    bid: float
    ask: float
    spread: float
    change: float
    change_pct: float
    high_24h: float
    low_24h: float
    volume_24h: float
    timestamp: float
    is_market_open: bool = True
    market_status: str = "OPEN"  # "OPEN", "CLOSED", "WEEKEND"
    indicators: Optional[TechnicalIndicators] = None

class JevDecision(BaseModel):
    action: str = "HOLD"  # "BUY", "SELL", "HOLD", "STRONG BUY", "STRONG SELL"
    confidence: float = 0.50
    latency_ms: float = 120.0
    urgency: str = "LOW"  # "LOW", "MEDIUM", "HIGH"
    reason: str = "Market oscillating within EMA ribbons. Awaiting confluence."
    recommended_sl: Optional[float] = None
    recommended_tp: Optional[float] = None
    recommended_shares: Optional[int] = None
    allocated_amount: Optional[float] = None
    target_price: Optional[float] = None
    confluence_status: str = "SYSTEM1_NATIVE"  # "DUAL_CONFLUENCE", "DIVERGENCE", "SYSTEM1_NATIVE"
    eod_prediction: Optional[Dict[str, Any]] = None
    learning_stats: Optional[Dict[str, Any]] = None
    learning_bonus: Optional[float] = 0.0
    entry_timing: Optional[str] = None
    time_based_exit: Optional[str] = None
    target_price_tp2: Optional[float] = None
    prediction_barriers: Optional[Union[Dict[str, Any], str]] = None
    macro_trend: Optional[str] = None
    model_version: str = "JEV-DualConfluence-Kernel-v3.0"


class OllamaReasoning(BaseModel):
    available: bool = False
    model: str = "llama3:8b"
    market_regime: str = "Ranging / Accumulation"
    sentiment_score: float = 0.0  # -1.0 to 1.0
    macro_summary: str = "Monitoring RBI liquidity operations and global dollar strength."
    trade_rationale: str = "Technical breakout requires confirmation above key pivot level."
    risk_assessment: str = "Manage position size strictly due to anticipated volatility."

class Position(BaseModel):
    id: str
    symbol: str
    currency: str
    side: str  # "BUY" or "SELL"
    shares: float
    entry_price: float
    current_price: float
    stop_loss: float
    take_profit: float
    unrealized_pnl: float
    pnl_pct: float
    status: str = "OPEN"  # "OPEN" or "CLOSED"
    opened_at: str
    closed_at: Optional[str] = None
    close_price: Optional[float] = None
    realized_pnl: Optional[float] = None
    realized_pnl_usd: Optional[float] = None

class StrategySettings(BaseModel):
    symbol: str = "RELIANCE.NS"
    risk_per_trade_pct: float = 1.0
    sl_type: str = "ATR"  # "ATR" or "POINTS"
    sl_multiplier: float = 1.5
    tp_multiplier: float = 2.0  # 1:2 R:R
    auto_trade_enabled: bool = False
    min_jev_confidence: float = 0.65
    currency_mode: str = "INR"  # "INR" or "USD"
    active_strategy: str = "TREND_TRADING"  # "TREND_TRADING", "RANGE_TRADING", "BREAKOUT_TRADING", "SCALPING"

class AccountSummary(BaseModel):
    currency: str
    balance: float
    equity: float
    margin_used: float
    free_margin: float
    daily_pnl: float
    win_rate: float
    total_trades: int
