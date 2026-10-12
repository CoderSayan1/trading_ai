import time
import json
import httpx
import logging
from typing import Dict, Any, Optional
from app.config import settings
from app.models.schemas import TickerSnapshot, JevDecision

logger = logging.getLogger("JevClient")

class JevAIClient:
    def __init__(self):
        self.api_url = settings.JEV_AI_API_URL
        self.api_key = settings.JEV_AI_API_KEY

    async def evaluate_market(self, snapshot: TickerSnapshot) -> JevDecision:
        """
        Sub-5ms Local Decision Gate (Zero External API Keys Needed).
        Evaluates technical indicator snapshot and synthesizes live decisions with 
        local Ollama multi-algo EOD predictions for Dual-Brain confluence.
        """
        start_time = time.time()

        # If user configured external JEV AI key, attempt cloud call
        if self.api_key:
            try:
                async with httpx.AsyncClient(timeout=0.6) as client:
                    resp = await client.post(
                        self.api_url,
                        headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                        json=snapshot.dict()
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        remote_latency = round((time.time() - start_time) * 1000, 1)
                        return self._synthesize_with_eod(
                            snapshot=snapshot,
                            live_action=data.get("action", "HOLD"),
                            live_confidence=round(float(data.get("confidence", 0.5)), 2),
                            live_sl=data.get("recommended_sl"),
                            live_tp=data.get("recommended_tp"),
                            base_reason=data.get("reason", "JEV AI Remote Cloud Decision"),
                            latency_ms=remote_latency,
                            model_name="JEV-Cloud-Enterprise-v1"
                        )
            except Exception:
                pass

        # High-Speed Native In-Process Local Quantitative Decision Engine
        return self._evaluate_native_system1(snapshot, start_time)

    def _synthesize_with_eod(
        self,
        snapshot: TickerSnapshot,
        live_action: str,
        live_confidence: float,
        live_sl: Optional[float],
        live_tp: Optional[float],
        base_reason: str,
        latency_ms: float,
        model_name: str
    ) -> JevDecision:
        from app.core.database import db
        eod_pred = db.get_prediction_by_symbol(snapshot.symbol)

        final_action = live_action
        final_confidence = live_confidence
        urgency = "HIGH" if live_confidence >= 0.80 else ("MEDIUM" if live_confidence >= 0.65 else "LOW")
        confluence_status = "SYSTEM1_NATIVE"
        recommended_shares = None
        allocated_amount = None
        target_price = live_tp
        target_price_tp2 = None
        entry_timing = None
        time_based_exit = None
        macro_trend = None
        prediction_barriers = None
        sl = live_sl
        tp = live_tp
        reason = base_reason

        if eod_pred:
            eod_action = eod_pred.get("action", "").upper()
            eod_conf = float(eod_pred.get("confidence", 0.80))
            eod_shares = eod_pred.get("recommended_shares")
            eod_alloc = eod_pred.get("allocated_amount")
            eod_target = eod_pred.get("target_price")
            eod_tp2 = eod_pred.get("target_price_tp2")
            eod_sl = eod_pred.get("stop_loss")
            eod_thesis = eod_pred.get("thesis_reason", "")
            entry_timing = eod_pred.get("entry_timing")
            time_based_exit = eod_pred.get("time_based_exit")
            macro_trend = eod_pred.get("macro_trend")
            prediction_barriers = eod_pred.get("prediction_barriers")
            if isinstance(prediction_barriers, str):
                try:
                    prediction_barriers = json.loads(prediction_barriers)
                except Exception:
                    pass

            clean_live = "BUY" if "BUY" in live_action else ("SELL" if "SELL" in live_action else "HOLD")
            clean_eod = "BUY" if "BUY" in eod_action else ("SELL" if "SELL" in eod_action else "HOLD")

            if clean_live in ["BUY", "SELL"] and clean_live == clean_eod:
                final_action = f"STRONG {clean_live}"
                final_confidence = min(0.98, round(max(live_confidence, eod_conf) + 0.08, 2))
                urgency = "HIGH"
                confluence_status = "DUAL_CONFLUENCE"
                sl = eod_sl or sl
                tp = eod_target or tp
                target_price = eod_target or tp
                target_price_tp2 = eod_tp2
                recommended_shares = eod_shares
                allocated_amount = eod_alloc
                reason = (
                    f"★ DUAL CONFLUENCE: Stored Ollama EOD Thesis ({eod_thesis[:75]}...) "
                    f"reinforced by {model_name}. TP1: {target_price}, TP2: {target_price_tp2 or 'N/A'}, Size: {recommended_shares}."
                )
            elif clean_live in ["BUY", "SELL"] and clean_eod in ["BUY", "SELL"] and clean_live != clean_eod:
                final_action = "HOLD / CAUTION"
                final_confidence = 0.52
                urgency = "MEDIUM"
                confluence_status = "DIVERGENCE"
                recommended_shares = eod_shares
                allocated_amount = eod_alloc
                target_price = eod_target
                target_price_tp2 = eod_tp2
                sl = eod_sl
                reason = (
                    f"⚠ DIVERGENCE: Live {live_action} momentum opposes Ollama EOD {eod_action} bias. "
                    f"Intraday trap risk. Monitor support/resistance at {eod_sl}."
                )
            elif clean_eod in ["BUY", "SELL"] and clean_live == "HOLD":
                final_action = f"SETUP {clean_eod}"
                final_confidence = round(eod_conf * 0.9, 2)
                urgency = "MEDIUM"
                confluence_status = "EOD_PENDING_LIVE"
                sl = eod_sl
                tp = eod_target
                target_price = eod_target
                target_price_tp2 = eod_tp2
                recommended_shares = eod_shares
                allocated_amount = eod_alloc
                reason = (
                    f"Ollama EOD predicts {eod_action} (TP1: {target_price}, TP2: {target_price_tp2 or 'N/A'}). "
                    f"Live price compressing. Prepare entry on breakout."
                )

        # Dynamic sanity validation: SL/TP MUST be strictly on the correct side of current live price
        curr_price = float(snapshot.last_price)
        ind = snapshot.indicators
        is_forex = "=X" in snapshot.symbol or (curr_price < 50 and not snapshot.symbol.endswith(".NS"))
        is_crypto = "-USD" in snapshot.symbol
        is_inr = snapshot.currency == "INR" or snapshot.symbol.endswith(".NS")
        decimals = 4 if is_forex else 2
        if is_forex and "JPY" in snapshot.symbol:
            decimals = 3
        currSym = "$" if (is_forex or is_crypto or not is_inr) else "₹"
        atr = ind.atr if (ind and ind.atr) else (curr_price * 0.005)

        # Tight, achievable Stop-Loss (0.35% - 0.65% distance) and 1:1.5 Scalp Target
        if is_forex:
            sl_dist = round(max(0.0015, min(0.0028, atr * 0.85)), decimals)
        elif is_crypto:
            sl_dist = round(max(curr_price * 0.0035, min(curr_price * 0.0060, atr * 0.85)), decimals)
        else:
            sl_dist = round(max(curr_price * 0.0038, min(curr_price * 0.0065, atr * 0.85)), decimals)

        if "BUY" in final_action:
            if sl is None or sl <= 0 or sl >= curr_price:
                sl = round(curr_price - sl_dist, decimals)
            if tp is None or tp <= 0 or tp <= curr_price:
                tp = round(curr_price + (sl_dist * 1.5), decimals) # TP1 (Quick Scalp 1:1.5)
            target_price = tp
            if not target_price_tp2:
                target_price_tp2 = round(curr_price + (sl_dist * 2.5), decimals) # TP2 (Runner 1:2.5)
            if not entry_timing:
                entry_timing = f"⚡ EXECUTE NOW (Market BUY at {currSym}{curr_price})"
            if not time_based_exit:
                time_based_exit = "⏰ Exit by 3:15 PM IST or if 15m candle closes below 9-EMA"
            if not prediction_barriers:
                prediction_barriers = {
                    "entry_barrier": curr_price,
                    "invalidation_barrier": sl,
                    "target_tp1_barrier": tp,
                    "target_tp2_barrier": target_price_tp2,
                    "candle_color_bias": "GREEN_CANDLE_MOMENTUM"
                }
        elif "SELL" in final_action:
            if sl is None or sl <= 0 or sl <= curr_price:
                sl = round(curr_price + sl_dist, decimals)
            if tp is None or tp <= 0 or tp >= curr_price:
                tp = round(max(curr_price * 0.001, curr_price - (sl_dist * 1.5)), decimals) # TP1 (Quick Scalp 1:1.5)
            target_price = tp
            if not target_price_tp2:
                target_price_tp2 = round(max(curr_price * 0.001, curr_price - (sl_dist * 2.5)), decimals) # TP2 (Runner 1:2.5)
            if not entry_timing:
                entry_timing = f"⚡ EXECUTE NOW (Market SELL at {currSym}{curr_price})"
            if not time_based_exit:
                time_based_exit = "⏰ Exit by 3:15 PM IST or if 15m candle closes above 9-EMA"
            if not prediction_barriers:
                prediction_barriers = {
                    "entry_barrier": curr_price,
                    "invalidation_barrier": sl,
                    "target_tp1_barrier": tp,
                    "target_tp2_barrier": target_price_tp2,
                    "candle_color_bias": "RED_CANDLE_MOMENTUM"
                }
        else:
            sl = round(curr_price - sl_dist, decimals)
            tp = round(curr_price + sl_dist, decimals)
            target_price = tp
            if not entry_timing:
                entry_timing = "⏳ WAIT FOR CONFIRMATION (Consolidation - No active trigger)"
            if not time_based_exit:
                time_based_exit = "⏰ Re-scan on 15m candle close"

        # Disciplined portfolio sizing: Max 1.5% capital risked, Max 15% account allocation
        if not recommended_shares or recommended_shares <= 0 or (snapshot.currency == "INR" and allocated_amount and allocated_amount > 20000):
            if is_forex:
                pip_unit = 0.01 if "JPY" in snapshot.symbol else 0.0001
                pips = max(15.0, sl_dist / pip_unit)
                recommended_shares = round(max(0.01, min(1.0, 150.0 / (pips * 10.0))), 2)
                allocated_amount = round(recommended_shares * 1000.0, 2)
            elif snapshot.currency == "INR":
                max_cap = 100000.0 * 0.15 # Max ₹15,000 on ₹100,000 balance
                risk_amt = 100000.0 * 0.015 # Max ₹1,500 risk
                s_risk = int(risk_amt / sl_dist) if sl_dist > 0 else 1
                s_cap = int(max_cap / curr_price) if curr_price > 0 else 1
                recommended_shares = max(1, min(s_risk, s_cap))
                allocated_amount = round(recommended_shares * curr_price, 2)
            else:
                max_cap = 10000.0 * 0.15
                recommended_shares = max(1, int(max_cap / curr_price))
                allocated_amount = round(recommended_shares * curr_price, 2)

        # Incorporate Adaptive Machine Learning from historical executed trades
        learning_stats = None
        learning_bonus = 0.0
        try:
            learning_stats = db.get_trade_learning_stats(snapshot.symbol)
            if learning_stats and learning_stats.get("has_learning_data"):
                total_trades = learning_stats["total_trades"]
                buy_win_rate = learning_stats["buy_win_rate"]
                sell_win_rate = learning_stats["sell_win_rate"]

                if "BUY" in final_action:
                    if buy_win_rate >= 60.0 and total_trades >= 1:
                        learning_bonus = round(min(0.12, (buy_win_rate - 50.0) * 0.003), 2)
                        final_confidence = min(0.98, round(final_confidence + learning_bonus, 2))
                        reason += f" ★ [Self-Trained Model: Historical BUY Win Rate is {buy_win_rate}% ({learning_stats['wins']}/{total_trades} wins). Confidence boosted by +{int(learning_bonus*100)}%]."
                    elif buy_win_rate <= 40.0 and total_trades >= 2:
                        learning_bonus = -0.10
                        final_confidence = max(0.48, round(final_confidence + learning_bonus, 2))
                        reason += f" ⚠ [Self-Trained Caution: Historical BUY Win Rate is {buy_win_rate}%. Lowered confidence to guard capital]."
                elif "SELL" in final_action:
                    if sell_win_rate >= 60.0 and total_trades >= 1:
                        learning_bonus = round(min(0.12, (sell_win_rate - 50.0) * 0.003), 2)
                        final_confidence = min(0.98, round(final_confidence + learning_bonus, 2))
                        reason += f" ★ [Self-Trained Model: Historical SELL Win Rate is {sell_win_rate}% ({learning_stats['wins']}/{total_trades} wins). Confidence boosted by +{int(learning_bonus*100)}%]."
                    elif sell_win_rate <= 40.0 and total_trades >= 2:
                        learning_bonus = -0.10
                        final_confidence = max(0.48, round(final_confidence + learning_bonus, 2))
                        reason += f" ⚠ [Self-Trained Caution: Historical SELL Win Rate is {sell_win_rate}%. Lowered confidence to guard capital]."
        except Exception as e:
            logger.warning(f"Could not calculate learning bonus: {e}")

        return JevDecision(
            action=final_action,
            confidence=final_confidence,
            latency_ms=latency_ms,
            urgency=urgency,
            reason=reason,
            recommended_sl=sl,
            recommended_tp=tp,
            recommended_shares=recommended_shares,
            allocated_amount=allocated_amount,
            target_price=target_price,
            target_price_tp2=target_price_tp2,
            entry_timing=entry_timing,
            time_based_exit=time_based_exit,
            macro_trend=macro_trend,
            prediction_barriers=prediction_barriers,
            confluence_status=confluence_status,
            eod_prediction=eod_pred,
            learning_stats=learning_stats,
            learning_bonus=learning_bonus,
            model_version=model_name
        )

    def _evaluate_native_system1(self, snapshot: TickerSnapshot, start_time: float) -> JevDecision:
        ind = snapshot.indicators
        price = snapshot.last_price

        if not ind or ind.rsi is None or ind.ema9 is None or ind.ema21 is None:
            latency = round((time.time() - start_time) * 1000, 1)
            learning_stats = None
            try:
                from app.core.database import db
                learning_stats = db.get_trade_learning_stats(snapshot.symbol)
            except Exception:
                pass
            return JevDecision(
                action="HOLD",
                confidence=0.50,
                latency_ms=latency,
                urgency="LOW",
                reason="Collecting candle history to calibrate indicators.",
                learning_stats=learning_stats,
                learning_bonus=0.0,
                model_version="Local-Quantitative-Engine-v2.0"
            )

        rsi = ind.rsi
        ema9 = ind.ema9
        ema21 = ind.ema21
        ema50 = ind.ema50 or ema21
        macd = ind.macd or 0.0
        macd_sig = ind.macd_signal or 0.0
        atr = ind.atr or (price * 0.005)

        bullish_score = 0.0
        bearish_score = 0.0

        if ema9 > ema21 > ema50:
            bullish_score += 0.35
        elif ema9 < ema21 < ema50:
            bearish_score += 0.35

        if price > ema9:
            bullish_score += 0.15
        else:
            bearish_score += 0.15

        if 48 <= rsi <= 68:
            bullish_score += 0.25
        elif 32 <= rsi <= 52:
            bearish_score += 0.25
        elif rsi > 72:
            bearish_score += 0.10
        elif rsi < 28:
            bullish_score += 0.10

        if macd > macd_sig:
            bullish_score += 0.25
        else:
            bearish_score += 0.25

        latency = round((time.time() - start_time) * 1000, 1)

        is_forex = "=X" in snapshot.symbol or (price < 50 and not snapshot.symbol.endswith(".NS"))
        is_crypto = "-USD" in snapshot.symbol
        decimals = 4 if is_forex else 2
        if is_forex and "JPY" in snapshot.symbol:
            decimals = 3

        # Tight SL distance:
        if is_forex:
            sl_dist = round(max(0.0015, min(0.0028, atr * 0.85)), decimals)
        elif is_crypto:
            sl_dist = round(max(price * 0.0035, min(price * 0.0060, atr * 0.85)), decimals)
        else:
            sl_dist = round(max(price * 0.0038, min(price * 0.0065, atr * 0.85)), decimals)

        if bullish_score >= 0.65 and bullish_score > (bearish_score + 0.15):
            live_action = "BUY"
            live_confidence = min(0.92, round(bullish_score, 2))
            sl = round(price - sl_dist, decimals)
            tp = round(price + (sl_dist * 1.5), decimals) # Tight 1:1.5 Scalp Target
            base_reason = f"Bullish EMA alignment (9>21>50) with RSI {rsi:.1f} and positive MACD crossover."
        elif bearish_score >= 0.65 and bearish_score > (bullish_score + 0.15):
            live_action = "SELL"
            live_confidence = min(0.92, round(bearish_score, 2))
            sl = round(price + sl_dist, decimals)
            tp = round(max(price * 0.001, price - (sl_dist * 1.5)), decimals) # Tight 1:1.5 Scalp Target
            base_reason = f"Bearish breakdown below EMAs with RSI {rsi:.1f} and negative MACD pressure."
        else:
            live_action = "HOLD"
            live_confidence = round(max(bullish_score, bearish_score), 2)
            sl = None
            tp = None
            base_reason = f"Market in consolidation (RSI {rsi:.1f}). Awaiting clear breakout."

        return self._synthesize_with_eod(
            snapshot=snapshot,
            live_action=live_action,
            live_confidence=live_confidence,
            live_sl=sl,
            live_tp=tp,
            base_reason=base_reason,
            latency_ms=latency,
            model_name="Local-Quantitative-Engine-v2.0"
        )

jev_client = JevAIClient()
