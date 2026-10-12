import logging
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from app.core.risk_manager import risk_manager
from app.core.data_feed import data_feed
from app.models.schemas import StrategySettings, AccountSummary, Position

logger = logging.getLogger("TradingRouter")
router = APIRouter(prefix="/api/trading", tags=["Trading & Execution"])

class OrderRequest(BaseModel):
    symbol: str
    side: str  # "BUY" or "SELL"
    shares: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None

@router.get("/account")
async def get_account(currency: str = Query("INR", pattern="^(INR|USD)$")) -> AccountSummary:
    return risk_manager.get_account_summary(currency=currency)

@router.get("/strategy")
async def get_strategy() -> StrategySettings:
    return risk_manager.strategy_settings

@router.post("/strategy")
async def update_strategy(settings: StrategySettings) -> StrategySettings:
    risk_manager.strategy_settings = settings
    return risk_manager.strategy_settings

@router.get("/positions")
async def get_positions():
    from app.core.database import db
    try:
        db_closed = db.get_closed_trades(limit=50)
    except Exception:
        db_closed = []
    
    # Fallback to in-memory closed positions if db returns empty
    closed_list = db_closed if db_closed else [p.dict() if hasattr(p, "dict") else p for p in risk_manager.closed_positions[-30:]]

    return {
        "open": list(risk_manager.open_positions.values()),
        "closed": closed_list
    }

@router.get("/learning-stats")
async def get_learning_stats(symbol: Optional[str] = None):
    """Returns machine learning training stats synthesized from historical trade outcomes"""
    from app.core.database import db
    return db.get_trade_learning_stats(symbol=symbol)

@router.get("/executions")
async def get_all_executions(
    symbol: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(500, ge=1, le=2000)
):
    """Returns all executed trades from the database table for the execution history tab"""
    from app.core.database import db
    try:
        trades = db.get_all_executed_trades(symbol=symbol, status=status, limit=limit)
        stats = db.get_trade_learning_stats(symbol=symbol)
    except Exception as e:
        logger.error(f"Error fetching execution history: {e}")
        trades = []
        stats = {}
    return {
        "trades": trades,
        "stats": stats,
        "total": len(trades)
    }

@router.post("/order")
async def place_order(order: OrderRequest):
    snapshot = data_feed.get_snapshot(order.symbol)
    try:
        pos = risk_manager.open_trade(
            symbol=order.symbol,
            side=order.side,
            snapshot=snapshot,
            sl=order.stop_loss,
            tp=order.take_profit,
            shares=order.shares
        )
        return {"status": "SUCCESS", "position": pos}
    except ValueError as e:
        logger.warning(f"Order validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Order placement failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to execute order: {str(e)}")

@router.post("/order/close/{order_id}")
async def close_order(order_id: str):
    if order_id not in risk_manager.open_positions:
        raise HTTPException(status_code=404, detail="Order not found or already closed")
    pos = risk_manager.open_positions[order_id]
    closed = risk_manager._close_position(order_id, pos.current_price, "MANUAL")
    return {"status": "CLOSED", "position": closed}

@router.post("/order/close_all")
async def close_all(symbol: Optional[str] = None):
    risk_manager.close_all_positions(symbol)
    return {"status": "ALL_CLOSED"}

@router.post("/reset")
async def reset_trading_account():
    summary = risk_manager.reset_account()
    return {"status": "SUCCESS", "message": "Trading account balance and daily metrics reset.", "account": summary}

