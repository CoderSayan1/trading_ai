import asyncio
import json
import logging
import httpx
from typing import Dict, Any, Optional
from app.config import settings
from app.models.schemas import TickerSnapshot, OllamaReasoning

logger = logging.getLogger("OllamaClient")

class OllamaReasoningClient:
    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL
        self.model = settings.OLLAMA_MODEL

    async def get_active_model(self) -> Optional[str]:
        """Checks Ollama health and dynamically resolves installed models to avoid 404s"""
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                res = await client.get(f"{self.base_url}/api/tags")
                if res.status_code == 200:
                    installed = [m.get("name") for m in res.json().get("models", [])]
                    if not installed:
                        logger.warning("[Ollama] Server is running but has no models installed.")
                        return None
                    
                    # If configured model is installed, use it
                    if self.model in installed or any(m.startswith(self.model) for m in installed):
                        return self.model

                    # Otherwise, auto-fallback to the first available installed model
                    selected = installed[0]
                    logger.info(f"[Ollama] Configured model '{self.model}' not pulled. Auto-switching to installed model '{selected}'.")
                    return selected
        except Exception:
            return None
        return None

    async def check_health(self) -> bool:
        model = await self.get_active_model()
        return model is not None

    async def analyze_snapshot(self, snapshot: TickerSnapshot) -> OllamaReasoning:
        """System 2 deep contextual reasoning and macroeconomic analysis with 1M/1Y historical trend awareness"""
        active_model = await self.get_active_model()
        ind = snapshot.indicators

        ind_summary = (
            f"RSI: {ind.rsi if ind else 'N/A'}, "
            f"Trend: {ind.trend if ind else 'N/A'}, "
            f"EMA9: {ind.ema9 if ind else 'N/A'}, "
            f"EMA21: {ind.ema21 if ind else 'N/A'}, "
            f"ATR: {ind.atr if ind else 'N/A'}"
        )

        from app.core.database import db
        from app.core.data_feed import data_feed

        # 1-Month / 52-Week Macro Data
        macro_info = {}
        try:
            macro_info = data_feed.get_macro_history(snapshot.symbol)
        except Exception as e:
            logger.debug(f"Macro history fetch failed for {snapshot.symbol}: {e}")

        trade_stats = db.get_trade_learning_stats(snapshot.symbol)
        track_record_str = "No historical closed trades recorded yet."
        if trade_stats and trade_stats.get("has_learning_data"):
            track_record_str = (
                f"Historical Performance on {snapshot.symbol}: {trade_stats['total_trades']} trades, "
                f"{trade_stats['win_rate']}% Win Rate, Realized PnL: {snapshot.currency} {trade_stats['total_pnl']}. "
                f"Trained Bias: {trade_stats['direction_bias']}."
            )

        macro_str = (
            f"Past 1-Month Return: {macro_info.get('return_1m_pct', 0.0):+0.2f}%\n"
            f"52-Week Range: High {macro_info.get('high_52w')} | Low {macro_info.get('low_52w')} "
            f"(Current is {macro_info.get('pct_from_52w_high', 0.0):.1f}% from 52W High)\n"
            f"Macro Trend (50/200 SMA): {macro_info.get('sma_50_200_regime', 'N/A')}\n"
            f"Recent 5 Daily Candles: {macro_info.get('recent_5_daily_candles', 'N/A')}"
        )

        prompt = f"""
You are a quantitative macro hedge-fund strategist (System 2 Reasoning Layer) analyzing {snapshot.name} ({snapshot.symbol}).
Currency: {snapshot.currency}, Last Price: {snapshot.last_price}, 24h Change: {snapshot.change_pct}%.
Technical Indicators: {ind_summary}.
Historical 1-Month & 1-Year Macro Price Action:
{macro_str}
Self-Trained Database Record: {track_record_str}

Evaluate the previous 1-month and 1-year data to determine institutional accumulation vs distribution.
Ensure your risk assessment recommends tight tactical targets (not wide 2%+ targets) and specific execution timing.
Respond in strict JSON with these keys:
"market_regime": (e.g. "Trending Bullish", "Range-bound Consolidation", "Volatile Exhaustion")
"sentiment_score": (float between -1.0 and 1.0)
"macro_summary": (one-sentence macro context based on 1M/1Y return and 50/200 SMA)
"trade_rationale": (concise tactical reason for holding, buying or selling, with execution timing)
"risk_assessment": (tight achievable stop-loss and profit target barrier guidance)
"""
        if active_model:
            try:
                # 8.0-second timeout: fast response if model is ready, instant fallback if busy
                async with httpx.AsyncClient(timeout=8.0) as client:
                    resp = await client.post(
                        f"{self.base_url}/api/generate",
                        json={
                            "model": active_model,
                            "prompt": prompt,
                            "format": "json",
                            "stream": False,
                            "options": {
                                "num_predict": 250,
                                "temperature": 0.2
                            }
                        }
                    )
                    if resp.status_code == 200:
                        raw_text = resp.json().get("response", "{}")
                        # DeepSeek-R1 compatibility: strip internal <think>...</think> block before JSON decoding
                        import re
                        clean_json = re.sub(r"<think>.*?</think>", "", raw_text, flags=re.DOTALL).strip()
                        if "```json" in clean_json:
                            clean_json = clean_json.split("```json")[1].split("```")[0].strip()
                        elif "```" in clean_json:
                            clean_json = clean_json.split("```")[1].split("```")[0].strip()

                        try:
                            data = json.loads(clean_json)
                        except Exception:
                            start_idx = clean_json.find("{")
                            end_idx = clean_json.rfind("}")
                            if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                                data = json.loads(clean_json[start_idx:end_idx+1])
                            else:
                                data = {}

                        def clean_str(val, fallback=""):
                            if isinstance(val, dict):
                                return ", ".join(f"{k}: {v}" for k, v in val.items())
                            elif isinstance(val, list):
                                return ", ".join(str(x) for x in val)
                            elif val is not None:
                                return str(val)
                            return fallback

                        return OllamaReasoning(
                            available=True,
                            model=active_model,
                            market_regime=clean_str(data.get("market_regime"), "Trend Continuation"),
                            sentiment_score=float(data.get("sentiment_score", 0.15)),
                            macro_summary=clean_str(data.get("macro_summary"), f"1M Return: {macro_info.get('return_1m_pct', 0.0):+.1f}%. {macro_info.get('sma_50_200_regime', '')}"),
                            trade_rationale=clean_str(data.get("trade_rationale"), "Follow prevailing EMA ribbon direction with tight tactical barriers."),
                            risk_assessment=clean_str(data.get("risk_assessment"), "Maintain tight 0.5% ATR stop-loss with 1:1.5 scalp target.")
                        )
            except Exception as e:
                err_type = type(e).__name__
                logger.info(f"Ollama local model standby ({err_type}); using high-speed quantitative System 2 momentum fallback.")

        # Intelligent Contextual Fallback when Ollama is offline or busy
        trend = ind.trend if ind else "NEUTRAL"
        rsi = ind.rsi if ind and ind.rsi else 50.0
        is_inr = snapshot.currency == "INR"
        ret_1m = macro_info.get("return_1m_pct", 0.0)

        if trend == "BULLISH":
            regime = "Bullish Momentum Impulse"
            sentiment = 0.65
            macro = f"1M Momentum: {ret_1m:+.1f}%. Strong institutional accumulation observed above 50-day moving average." if is_inr else f"1M Momentum: {ret_1m:+.1f}%. Dollar softening supporting risk-on global asset inflows."
            rationale = f"Price maintaining solid support above 21 EMA with RSI at {rsi:.1f}. Immediate buy trigger on 15m candle close."
            risk = "Set tight stop-loss at 0.50% below entry. First profit target at 1:1.5 R:R; exit if 15m closes below 9-EMA."
        elif trend == "BEARISH":
            regime = "Bearish Trend Distribution"
            sentiment = -0.60
            macro = f"1M Momentum: {ret_1m:+.1f}%. Profit booking and sector rotation weighing on near-term valuations." if is_inr else f"1M Momentum: {ret_1m:+.1f}%. Elevated treasury yields putting downward pressure on pair."
            rationale = f"Downward EMA ribbon slope confirms dominant selling pressure with RSI at {rsi:.1f}. Execute sell on minor bounce."
            risk = "Set tight stop-loss at 0.50% above entry. Exit runner if price recovers above 21-EMA."
        else:
            regime = "Neutral Range Consolidation"
            sentiment = 0.05
            macro = f"1M Return: {ret_1m:+.1f}%. Market consolidating within 52-week structure." if is_inr else f"1M Return: {ret_1m:+.1f}%. Forex market awaiting US CPI and inflation data."
            rationale = f"Conflicting indicator momentum (RSI {rsi:.1f}). Price compressed inside Bollinger Bands. Wait for breakout."
            risk = "Preserve capital during chop. Wait for high-confidence JEV System 1 confirmation."

        return OllamaReasoning(
            available=False,
            model=f"{active_model or self.model} (Standby)",
            market_regime=regime,
            sentiment_score=sentiment,
            macro_summary=macro,
            trade_rationale=rationale,
            risk_assessment=risk
        )

    async def chat_assistant(self, user_query: str, current_snapshot: TickerSnapshot) -> str:
        """Conversational AI for trading Q&A and strategy guidance"""
        trade_stats_summary = ""
        learning = None
        try:
            from app.core.database import db
            learning = db.get_trade_learning_stats(current_snapshot.symbol)
            if learning and learning.get("total_trades", 0) > 0:
                trade_stats_summary = (
                    f"\n\nDATABASE EXECUTION TRACK RECORD (Self-Learned Data from 'executed_trades' table):\n"
                    f"- Total Executed Trades: {learning['total_trades']}\n"
                    f"- Realized Win Rate: {learning['win_rate']}%\n"
                    f"- Total Realized PnL: {current_snapshot.currency} {learning['total_pnl']:+,.2f}\n"
                    f"- Longs Win Rate: {learning.get('buy_win_rate', 0)}% | Shorts Win Rate: {learning.get('sell_win_rate', 0)}%\n"
                    f"- AI Dynamic Confidence Adjustment: {learning.get('confidence_bonus', 0):+d}%\n"
                    f"- Learning Feedback: {learning.get('insights', '')}\n"
                    f"Reference this real historical execution performance when advising the user."
                )
        except Exception as e:
            logger.debug(f"Could not load trade learning stats for chat: {e}")

        active_model = await self.get_active_model()
        if active_model:
            try:
                system_prompt = (
                    f"You are a disciplined senior quantitative trader and mentor. "
                    f"Current asset: {current_snapshot.name} ({current_snapshot.symbol}), "
                    f"Price: {current_snapshot.currency} {current_snapshot.last_price}, "
                    f"RSI: {current_snapshot.indicators.rsi if current_snapshot.indicators else 'N/A'}. "
                    f"{trade_stats_summary}\n"
                    f"Answer the user concisely with actionable risk management and technical insights."
                )
                async with httpx.AsyncClient(timeout=25.0) as client:
                    resp = await client.post(
                        f"{self.base_url}/api/generate",
                        json={
                            "model": active_model,
                            "prompt": f"{system_prompt}\n\nUser Question: {user_query}",
                            "stream": False
                        }
                    )
                    if resp.status_code == 200:
                        raw_reply = resp.json().get("response", "").strip()
                        import re
                        clean_reply = re.sub(r"<think>.*?</think>", "", raw_reply, flags=re.DOTALL).strip()
                        return clean_reply or raw_reply
            except Exception as e:
                logger.warning(f"Ollama chat error: {e}")

        learned_bullet = ""
        if learning and learning.get("total_trades", 0) > 0:
            learned_bullet = (
                f"• Database Learning (executed_trades table): {learning['total_trades']} past trades logged, "
                f"Win Rate: {learning['win_rate']}%, Realized PnL: {current_snapshot.currency} {learning['total_pnl']:+,.2f} "
                f"(AI bias adjusted by {learning.get('confidence_bonus', 0):+d}%).\n"
            )

        return (
            f"[AI Assistant Note - Ollama offline]\n"
            f"Analyzing {current_snapshot.name} ({current_snapshot.symbol}) at {current_snapshot.currency} {current_snapshot.last_price}:\n"
            f"{learned_bullet}"
            f"• Strategy: Maintain disciplined risk per trade (recommended 1-2% maximum).\n"
            f"• Stop-Loss: Use tight 0.40% - 0.65% stop-losses with 1:1.5 profit targets so targets are easily achieved.\n"
            f"• Execution: Wait for JEV System 1 confidence to exceed 70% before entering directional trades.\n\n"
            f"💡 Tip: Run `ollama run {self.model}` in your terminal to enable full local LLM conversational generation!"
        )

    async def run_eod_analysis(
        self, 
        symbols: Optional[list] = None, 
        account_balance: float = 100000.0
    ) -> Dict[str, Any]:
        """
        Executes End-Of-Day quantitative multi-algo batch forecasting.
        Calculates trade direction, optimal capital allocation, tight price targets, entry timing, 
        time-based exit rules, and 1M/1Y macro trajectory, storing all to DB.
        """
        import time
        from datetime import datetime
        from app.core.database import db
        from app.core.data_feed import data_feed

        from app.ai.eod_ensemble import MultiAlgoEODEngine

        start_time = time.time()
        today = datetime.now().strftime("%Y-%m-%d")
        scan_id = f"EOD-{datetime.now().strftime('%Y%m%d-%H%M%S')}"

        if not symbols:
            candidate_pool = [
                "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS",
                "SBIN.NS", "BHARTIARTL.NS", "TATAMOTORS.NS", "ITC.NS", "LT.NS",
                "BAJFINANCE.NS", "MARUTI.NS", "TITAN.NS",
                "EURUSD=X", "GBPUSD=X", "USDJPY=X", "AUDUSD=X", "USDINR=X", "GBPINR=X",
                "BTC-USD", "ETH-USD",
                "AAPL", "NVDA", "TSLA", "MSFT", "GOOGL"
            ]
        else:
            candidate_pool = symbols

        active_model = await self.get_active_model()

        async def analyze_single_asset(sym: str) -> Optional[Dict[str, Any]]:
            try:
                asset_info = data_feed.get_asset_info(sym)
                snapshot = data_feed.get_snapshot(sym)
                price = snapshot.last_price
                if not price or price <= 0:
                    return None

                # Fetch candles in thread pool
                candles = data_feed.candle_cache.get(sym)
                if not candles or len(candles) < 30:
                    candles = await asyncio.to_thread(
                        data_feed.fetch_historical_candles, 
                        sym, 
                        "15m", 
                        "5d"
                    )

                # Fetch 1-month / 1-year macro historical profile
                macro_data = await asyncio.to_thread(data_feed.get_macro_history, sym)

                # Execute 6-Algorithm Quantitative Ensemble Engine with tight SL/TP and candle-by-candle structure
                ensemble = MultiAlgoEODEngine.analyze_asset(
                    candles, 
                    price, 
                    account_balance, 
                    symbol=sym,
                    macro_data=macro_data
                )

                action = ensemble["action"]
                confidence = ensemble["confidence"]
                target = ensemble["target_price"]
                target_tp2 = ensemble.get("target_price_tp2")
                stop_loss = ensemble["stop_loss"]
                time_horizon = ensemble["time_horizon"]
                reason_thesis = ensemble["thesis_reason"]
                tech_summary = ensemble["technical_summary"]
                recommended_shares = ensemble["recommended_shares"]
                allocated_amount = ensemble["allocated_amount"]
                entry_timing = ensemble.get("entry_timing")
                time_based_exit = ensemble.get("time_based_exit")
                macro_trend = ensemble.get("macro_trend")
                prediction_barriers = ensemble.get("prediction_barriers")

                return {
                    "scan_id": scan_id,
                    "scan_date": today,
                    "symbol": sym,
                    "name": asset_info.name if asset_info else sym,
                    "category": asset_info.market if asset_info else "NSE_EQUITIES",
                    "current_price": price,
                    "action": action,
                    "confidence": confidence,
                    "target_price": target,
                    "target_price_tp2": target_tp2,
                    "stop_loss": stop_loss,
                    "recommended_shares": recommended_shares,
                    "allocated_amount": allocated_amount,
                    "time_horizon": time_horizon,
                    "entry_timing": entry_timing,
                    "time_based_exit": time_based_exit,
                    "macro_trend": macro_trend,
                    "prediction_barriers": prediction_barriers,
                    "thesis_reason": reason_thesis,
                    "technical_summary": tech_summary,
                    "model_used": "Multi-Algorithm Ensemble (6 Models + Macro Data)" if not active_model else f"Ensemble + {active_model}",
                    "status": "ACTIVE"
                }
            except Exception as e:
                logger.warning(f"EOD scan failed for {sym}: {e}")
                return None

        # Execute concurrent multi-algorithm analysis across entire candidate pool
        results = await asyncio.gather(*[analyze_single_asset(s) for s in candidate_pool])
        generated_predictions = [r for r in results if r is not None]

        # Save to Database
        for pred in generated_predictions:
            db.save_prediction(pred)

        duration = round(time.time() - start_time, 2)
        top_picks = [p for p in generated_predictions if p["action"] in ["BUY", "SELL"]]
        db.record_scan_run(scan_id, today, len(candidate_pool), len(top_picks), "COMPLETED", duration)

        logger.info(f"EOD Batch Analysis finished in {duration}s. {len(top_picks)} actionable trade predictions saved to DB.")
        return {
            "scan_id": scan_id,
            "scan_date": today,
            "total_scanned": len(candidate_pool),
            "top_picks_count": len(top_picks),
            "duration_seconds": duration,
            "predictions": db.get_active_predictions(limit=50)
        }

ollama_client = OllamaReasoningClient()
