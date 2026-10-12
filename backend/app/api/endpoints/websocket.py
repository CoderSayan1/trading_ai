import asyncio
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.encoders import jsonable_encoder
from app.core.data_feed import data_feed
from app.core.risk_manager import risk_manager
from app.ai.jev_client import jev_client

logger = logging.getLogger("WebSocketStream")
router = APIRouter(tags=["WebSocket Stream"])

@router.websocket("/ws/live/{symbol}")
async def websocket_live_stream(websocket: WebSocket, symbol: str, simulation: bool = False):
    """
    Real-time high frequency WebSocket channel:
    - Streams live candle updates when exchange is open
    - When market is closed, freezes on genuine official close without synthetic ticks
    - Streams Jev AI real-time confidence & signals
    """
    await websocket.accept()
    logger.info(f"WebSocket client connected for symbol: {symbol} (simulation={simulation})")
    
    try:
        while True:
            # 1. Fetch live tick update (or static close if closed)
            is_open = data_feed.is_asset_market_open(symbol)
            tick_data = data_feed.generate_next_tick(symbol, allow_simulation=simulation)
            current_price = tick_data["snapshot"]["last_price"]

            # 2. Check and update Stop-Loss / Take-Profit on open positions
            closed_positions = []
            if is_open or simulation:
                closed_positions = risk_manager.update_positions_on_tick(symbol, current_price)

            # 3. Evaluate Jev AI Decision periodically
            snapshot_obj = data_feed.get_snapshot(symbol)
            jev_decision = await jev_client.evaluate_market(snapshot_obj)

            # 4. If Auto-Trade is enabled and confidence threshold is met
            strat = risk_manager.strategy_settings
            auto_trade_alert = None
            if (is_open or simulation) and strat.auto_trade_enabled and strat.symbol == symbol:
                clean_action = "BUY" if "BUY" in jev_decision.action else ("SELL" if "SELL" in jev_decision.action else "HOLD")
                if jev_decision.confidence >= strat.min_jev_confidence and clean_action in ["BUY", "SELL"]:
                    has_open = any(p.symbol == symbol and p.side == clean_action for p in risk_manager.open_positions.values())
                    if not has_open:
                        try:
                            new_pos = risk_manager.open_trade(
                                symbol=symbol,
                                side=clean_action,
                                snapshot=snapshot_obj,
                                sl=jev_decision.recommended_sl,
                                tp=jev_decision.recommended_tp
                            )
                            auto_trade_alert = f"Auto-Trade Executed: {clean_action} {symbol} at {current_price} (JEV Confidence: {int(jev_decision.confidence*100)}%)"
                        except Exception as e:
                            logger.error(f"Auto-trade execution failed: {e}")

            # 5. Pack live packet
            account_inr = risk_manager.get_account_summary(currency="INR").dict()
            account_usd = risk_manager.get_account_summary(currency="USD").dict()
            open_positions = [p.dict() for p in risk_manager.open_positions.values()]

            payload = {
                "type": "TICK_UPDATE",
                "symbol": symbol,
                "is_market_open": is_open,
                "market_status": "OPEN" if is_open else "CLOSED",
                "candle": tick_data["candle"],
                "snapshot": tick_data["snapshot"],
                "jev_signal": jev_decision.dict(),
                "account_inr": account_inr,
                "account_usd": account_usd,
                "open_positions": open_positions,
                "closed_triggers": [p.dict() for p in closed_positions],
                "auto_trade_alert": auto_trade_alert
            }

            encoded_payload = jsonable_encoder(payload)
            await websocket.send_text(json.dumps(encoded_payload, default=str))
            await asyncio.sleep(1.0 if (is_open or simulation) else 2.5)

    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected for symbol: {symbol}")
    except Exception as e:
        logger.error(f"WebSocket streaming error: {e}")
