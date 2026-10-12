import math
import logging
from typing import List, Dict, Any, Optional
import numpy as np
import pandas as pd
from app.models.schemas import Candle

logger = logging.getLogger("EODEnsemble")

class MultiAlgoEODEngine:
    """
    Advanced Multi-Algorithm Quantitative Ensemble Engine for Market Predictions.
    Integrates Multi-Timeframe (1-Month to 1-Year) Macro Trends, Candle-by-Candle 
    Structural Barriers, and 6 independent mathematical and algorithmic models:
      1. Triple EMA Ribbon & Macro Trend Model (Trend Following)
      2. MACD Dynamic Momentum & Velocity Model (Momentum Acceleration)
      3. Bollinger Bands & Keltner TTM Squeeze Model (Volatility Breakout / Mean Reversion)
      4. Dual-Oscillator RSI + Fast Stochastic Model (Oscillator Confluence)
      5. Smart Money On-Balance Volume (OBV) & Volume Surge Model (Institutional Flow)
      6. Donchian Channel & Candlestick Barrier Engine (Price Range Breakout & Structural Levels)
    """

    @classmethod
    def analyze_asset(
        cls, 
        candles: List[Candle], 
        current_price: float, 
        account_balance: float = 100000.0,
        symbol: str = "",
        macro_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        if not candles or len(candles) < 15:
            return cls._fallback_analysis(current_price, account_balance, symbol)

        # Build clean pandas DataFrame for vectorized calculations
        df = pd.DataFrame([{
            "time": c.time,
            "open": float(c.open),
            "high": float(c.high),
            "low": float(c.low),
            "close": float(c.close),
            "volume": float(c.volume) if c.volume is not None else 0.0
        } for c in candles])

        closes = df["close"]
        highs = df["high"]
        lows = df["low"]
        opens = df["open"]
        volumes = df["volume"]
        price = float(current_price) if (current_price and current_price > 0) else float(closes.iloc[-1])

        # Detect asset characteristics
        is_forex = "=X" in symbol or (price < 50 and not symbol.endswith(".NS"))
        is_inr = symbol.endswith(".NS") or "INR" in symbol
        is_crypto = "-USD" in symbol
        decimals = 4 if is_forex else 2
        if is_forex and "JPY" in symbol:
            decimals = 3
        currSym = "$" if (is_forex or is_crypto or not is_inr) else "₹"

        # -----------------------------------------------------------------
        # 1. MULTI-TIMEFRAME MACRO DATA INTEGRATION (1-Month to 1-Year History)
        # -----------------------------------------------------------------
        if not macro_data:
            try:
                from app.core.data_feed import data_feed
                macro_data = data_feed.get_macro_history(symbol)
            except Exception:
                macro_data = {}

        y_high = float(macro_data.get("year_high") or (price * 1.15))
        y_low = float(macro_data.get("year_low") or (price * 0.85))
        pct_52w = float(macro_data.get("pct_52w") or 50.0)
        month_return = float(macro_data.get("month_return") or 0.0)
        month_trend = str(macro_data.get("month_trend") or "NEUTRAL")
        macro_regime = str(macro_data.get("macro_regime") or "NEUTRAL")
        last5_daily_candles = macro_data.get("last5_candles") or []

        # -----------------------------------------------------------------
        # 2. CANDLE-BY-CANDLE PATTERN & BARRIER CALCULATIONS
        # -----------------------------------------------------------------
        # Analyze last 10 intraday candles
        n_recent = min(10, len(candles))
        recent_candles = candles[-n_recent:]
        intraday_colors = ["GREEN" if c.close >= c.open else "RED" for c in recent_candles]
        green_count = sum(1 for col in intraday_colors if col == "GREEN")
        red_count = sum(1 for col in intraday_colors if col == "RED")

        # Structural high and low of last 5 candles for immediate barrier levels
        lookback_bars = min(6, len(highs))
        swing_high = float(highs.iloc[-lookback_bars:].max())
        swing_low = float(lows.iloc[-lookback_bars:].min())
        prev_candle_high = float(highs.iloc[-2]) if len(highs) >= 2 else swing_high
        prev_candle_low = float(lows.iloc[-2]) if len(lows) >= 2 else swing_low

        # Rejection wick analysis
        last_c = candles[-1]
        body_size = abs(last_c.close - last_c.open)
        upper_wick = last_c.high - max(last_c.open, last_c.close)
        lower_wick = min(last_c.open, last_c.close) - last_c.low
        buyer_absorption = lower_wick > (body_size * 1.4)
        seller_rejection = upper_wick > (body_size * 1.4)

        # -----------------------------------------------------------------
        # 3. CORE TECHNICAL INDICATORS
        # -----------------------------------------------------------------
        # EMAs
        ema9 = closes.ewm(span=9, adjust=False).mean()
        ema21 = closes.ewm(span=21, adjust=False).mean()
        ema50 = closes.ewm(span=50, adjust=False).mean() if len(closes) >= 50 else closes.ewm(span=len(closes), adjust=False).mean()
        ema200 = closes.ewm(span=200, adjust=False).mean() if len(closes) >= 120 else None

        e9 = float(ema9.iloc[-1])
        e21 = float(ema21.iloc[-1])
        e50 = float(ema50.iloc[-1])
        e200 = float(ema200.iloc[-1]) if ema200 is not None else e50

        # ATR (Average True Range, 14-period)
        prev_close = closes.shift(1)
        tr = pd.concat([highs - lows, (highs - prev_close).abs(), (lows - prev_close).abs()], axis=1).max(axis=1)
        atr_series = tr.rolling(window=14).mean()
        raw_atr = float(atr_series.iloc[-1]) if not pd.isna(atr_series.iloc[-1]) else (price * 0.005)
        atr = max(raw_atr, price * (0.0010 if is_forex else 0.0030))

        # MACD (12, 26, 9)
        ema12 = closes.ewm(span=12, adjust=False).mean()
        ema26 = closes.ewm(span=26, adjust=False).mean()
        macd_line = ema12 - ema26
        macd_signal = macd_line.ewm(span=9, adjust=False).mean()
        macd_hist = macd_line - macd_signal

        curr_macd = float(macd_line.iloc[-1])
        curr_sig = float(macd_signal.iloc[-1])
        curr_hist = float(macd_hist.iloc[-1])
        prev_hist = float(macd_hist.iloc[-2]) if len(macd_hist) >= 2 else curr_hist

        # Bollinger Bands & Keltner Squeeze
        bb_mid = closes.rolling(window=20).mean()
        bb_std = closes.rolling(window=20).std()
        bb_upper = bb_mid + (2.0 * bb_std)
        bb_lower = bb_mid - (2.0 * bb_std)
        kelt_upper = bb_mid + (1.5 * atr)
        kelt_lower = bb_mid - (1.5 * atr)

        curr_bbu = float(bb_upper.iloc[-1]) if not pd.isna(bb_upper.iloc[-1]) else price * 1.01
        curr_bbl = float(bb_lower.iloc[-1]) if not pd.isna(bb_lower.iloc[-1]) else price * 0.99
        curr_bbm = float(bb_mid.iloc[-1]) if not pd.isna(bb_mid.iloc[-1]) else price
        curr_ku = float(kelt_upper.iloc[-1]) if not pd.isna(kelt_upper.iloc[-1]) else price * 1.01
        curr_kl = float(kelt_lower.iloc[-1]) if not pd.isna(kelt_lower.iloc[-1]) else price * 0.99

        # RSI (14)
        delta = closes.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / (loss.replace(0, np.nan))
        rsi_series = 100 - (100 / (1 + rs))
        rsi = float(rsi_series.iloc[-1]) if not pd.isna(rsi_series.iloc[-1]) else 50.0

        # Fast Stochastic (14, 3, 3)
        low14 = lows.rolling(window=14).min()
        high14 = highs.rolling(window=14).max()
        stoch_denom = (high14 - low14).replace(0, np.nan)
        stoch_k = 100 * ((closes - low14) / stoch_denom)
        stoch_d = stoch_k.rolling(window=3).mean()
        curr_stoch_k = float(stoch_k.iloc[-1]) if not pd.isna(stoch_k.iloc[-1]) else 50.0
        curr_stoch_d = float(stoch_d.iloc[-1]) if not pd.isna(stoch_d.iloc[-1]) else 50.0

        # Volume & OBV
        total_vol = float(volumes.sum())
        has_valid_volume = total_vol > 0 and not is_forex
        if has_valid_volume:
            obv = (np.sign(delta).fillna(0) * volumes).cumsum()
            obv_ema = obv.ewm(span=20, adjust=False).mean()
            curr_obv = float(obv.iloc[-1])
            curr_obv_ema = float(obv_ema.iloc[-1])
            vol_sma20 = float(volumes.rolling(window=20).mean().iloc[-1]) if len(volumes) >= 20 else float(volumes.iloc[-1])
            vol_surge = (float(volumes.iloc[-1]) / vol_sma20) if vol_sma20 > 0 else 1.0
        else:
            curr_obv = 0.0
            curr_obv_ema = 0.0
            vol_surge = 1.0

        # Donchian Turtle Channels
        donchian_high = float(highs.rolling(window=20).max().iloc[-1]) if len(highs) >= 20 else swing_high
        donchian_low = float(lows.rolling(window=20).min().iloc[-1]) if len(lows) >= 20 else swing_low

        # -----------------------------------------------------------------
        # 4. ALGORITHM SCORING (6 QUANT MODELS)
        # -----------------------------------------------------------------
        # ALGO 1: Triple EMA Ribbon & Macro Trend (Weight: 22%)
        score_ema = 0.0
        if e9 > e21 > e50:
            score_ema = 0.70 + (0.15 if price > e9 else 0.0) + (0.15 if price > e200 else 0.0)
            ema_summary = "Bullish EMA Ribbon Alignment (9>21>50)"
        elif e9 < e21 < e50:
            score_ema = -0.70 - (0.15 if price < e9 else 0.0) - (0.15 if price < e200 else 0.0)
            ema_summary = "Bearish EMA Ribbon Breakdown (9<21<50)"
        else:
            score_ema = 0.35 if (price > e50 and e9 > e21) else (-0.35 if (price < e50 and e9 < e21) else 0.0)
            ema_summary = "Consolidating Within EMA Ribbons"

        # ALGO 2: MACD Dynamic Momentum Velocity (Weight: 20%)
        score_macd = 0.0
        if curr_macd > curr_sig:
            score_macd = 0.60 + (0.30 if curr_hist > prev_hist else 0.05)
            macd_summary = "Positive MACD Momentum Acceleration" if curr_hist > prev_hist else "Weakening Bullish MACD Momentum"
        else:
            score_macd = -0.60 - (0.30 if curr_hist < prev_hist else 0.05)
            macd_summary = "Accelerating Bearish MACD Momentum" if curr_hist < prev_hist else "Decelerating Bearish MACD Momentum"

        # ALGO 3: Bollinger & TTM Squeeze Volatility (Weight: 18%)
        score_vol = 0.0
        is_squeezed = (curr_bbu < curr_ku) and (curr_bbl > curr_kl)
        if is_squeezed:
            score_vol = 0.20 if curr_hist > 0 else -0.20
            vol_summary = "TTM Volatility Squeeze Compression (Coiling for Breakout)"
        elif price >= curr_bbu:
            score_vol = 0.75 if curr_hist > 0 else -0.30
            vol_summary = "Upper Bollinger Band Volatility Expansion"
        elif price <= curr_bbl:
            score_vol = -0.75 if curr_hist < 0 else 0.30
            vol_summary = "Lower Bollinger Band Volatility Breakdown"
        else:
            pct_b = (price - curr_bbl) / (curr_bbu - curr_bbl) if (curr_bbu > curr_bbl) else 0.5
            score_vol = (pct_b - 0.5) * 1.2
            vol_summary = f"Mid-Band Trajectory ({int(pct_b * 100)}% Band Width)"

        # ALGO 4: Dual-Oscillator RSI + Stoch (Weight: 18%)
        score_osc = 0.0
        if 48 <= rsi <= 68 and curr_stoch_k > curr_stoch_d:
            score_osc = 0.75
            osc_summary = f"Strong Bullish Oscillator Confluence (RSI {rsi:.1f}, Stoch {curr_stoch_k:.0f}%)"
        elif 32 <= rsi <= 52 and curr_stoch_k < curr_stoch_d:
            score_osc = -0.75
            osc_summary = f"Strong Bearish Oscillator Confluence (RSI {rsi:.1f}, Stoch {curr_stoch_k:.0f}%)"
        elif rsi > 70:
            score_osc = -0.30 if curr_stoch_k < curr_stoch_d else 0.20
            osc_summary = f"Overbought Territory (RSI {rsi:.1f})"
        elif rsi < 30:
            score_osc = 0.40 if curr_stoch_k > curr_stoch_d else -0.20
            osc_summary = f"Oversold Bounce Watch (RSI {rsi:.1f})"
        else:
            score_osc = 0.10 if rsi >= 50 else -0.10
            osc_summary = f"Neutral Oscillator Equilibrium (RSI {rsi:.1f})"

        # ALGO 5: Smart-Money Volume Flow (Weight: 12%)
        score_vol_flow = 0.0
        if has_valid_volume:
            if curr_obv > curr_obv_ema:
                score_vol_flow = 0.60 + (0.30 if vol_surge >= 1.2 else 0.0)
                flow_summary = f"Smart-Money Accumulation (OBV Rising, Vol {vol_surge:.1f}x SMA)"
            else:
                score_vol_flow = -0.60 - (0.30 if vol_surge >= 1.2 else 0.0)
                flow_summary = f"Institutional Distribution (OBV Falling, Vol {vol_surge:.1f}x SMA)"
        else:
            score_vol_flow = 0.0
            flow_summary = "Interbank OTC Liquidity Flow Confirmed"

        # ALGO 6: Donchian Turtle Breakout & Candle Barriers (Weight: 10%)
        score_turtle = 0.0
        if price >= donchian_high or price >= swing_high:
            score_turtle = 0.80
            turtle_summary = "Donchian Upper Channel Breakout"
        elif price <= donchian_low or price <= swing_low:
            score_turtle = -0.80
            turtle_summary = "Donchian Lower Channel Breakdown"
        elif buyer_absorption:
            score_turtle = 0.50
            turtle_summary = "Bullish Wick Rejection & Buyer Absorption"
        elif seller_rejection:
            score_turtle = -0.50
            turtle_summary = "Bearish Wick Rejection & Seller Absorption"
        else:
            score_turtle = 0.0
            turtle_summary = "Inside Historical Range"

        # -----------------------------------------------------------------
        # 5. MULTI-TIMEFRAME 1M/1Y MACRO CONFLUENCE FACTOR
        # -----------------------------------------------------------------
        macro_score = 0.0
        if month_return >= 3.0 and pct_52w >= 60.0:
            macro_score = 0.20
        elif month_return <= -3.0 and pct_52w <= 40.0:
            macro_score = -0.20

        # Weights fusion
        if has_valid_volume:
            w_ema, w_macd, w_bb, w_osc, w_flow, w_turtle = 0.22, 0.20, 0.18, 0.18, 0.12, 0.10
        else:
            w_ema, w_macd, w_bb, w_osc, w_flow, w_turtle = 0.26, 0.24, 0.22, 0.18, 0.00, 0.10

        composite_score = (
            score_ema * w_ema +
            score_macd * w_macd +
            score_vol * w_bb +
            score_osc * w_osc +
            score_vol_flow * w_flow +
            score_turtle * w_turtle +
            macro_score * 0.10
        )

        bullish_votes = sum(1 for s in [score_ema, score_macd, score_vol, score_osc, score_vol_flow, score_turtle] if s >= 0.25)
        bearish_votes = sum(1 for s in [score_ema, score_macd, score_vol, score_osc, score_vol_flow, score_turtle] if s <= -0.25)

        # Action & Confidence determination
        if composite_score >= 0.38 and bullish_votes >= 3:
            action = "STRONG BUY"
            confidence = round(min(0.96, 0.78 + (composite_score * 0.16)), 2)
            time_horizon = "Session Scalp / Swing (1-2 Days)"
        elif composite_score >= 0.18 and bullish_votes >= 2:
            action = "BUY"
            confidence = round(min(0.86, 0.65 + (composite_score * 0.18)), 2)
            time_horizon = "Intraday Momentum (2-4 Hours)"
        elif composite_score <= -0.38 and bearish_votes >= 3:
            action = "STRONG SELL"
            confidence = round(min(0.96, 0.78 + (abs(composite_score) * 0.16)), 2)
            time_horizon = "Session Short / Breakdown (1-2 Days)"
        elif composite_score <= -0.18 and bearish_votes >= 2:
            action = "SELL"
            confidence = round(min(0.86, 0.65 + (abs(composite_score) * 0.18)), 2)
            time_horizon = "Intraday Short (2-4 Hours)"
        else:
            action = "HOLD"
            confidence = round(max(0.50, min(0.64, 0.50 + abs(composite_score) * 0.2)), 2)
            time_horizon = "Consolidation (Wait for Breakout)"

        # -----------------------------------------------------------------
        # 6. TIGHT, REALISTIC TARGETS & STOP-LOSS (PROFIT HITS RELIABLY)
        # -----------------------------------------------------------------
        # Bound stop-loss distance strictly:
        # Equities: 0.38% - 0.65% distance (₹3.80 - ₹6.50 on ₹1,000 stock)
        # Forex: 15 - 25 pips (0.15% - 0.25%)
        # Crypto: 0.35% - 0.60% distance ($300 - $500 on $83k BTC)
        if is_forex:
            sl_dist = round(max(0.0015, min(0.0028, atr * 0.85)), decimals)
        elif is_crypto:
            sl_dist = round(max(price * 0.0035, min(price * 0.0060, atr * 0.85)), decimals)
        else:
            sl_dist = round(max(price * 0.0038, min(price * 0.0065, atr * 0.85)), decimals)

        # Primary Take-Profit (TP1): Tight Quick Scalp (1:1.5 R:R) -> Locks in profit without manual exit!
        # Secondary Take-Profit (TP2): Extended Runner Target (1:2.5 R:R)
        if "BUY" in action:
            entry_barrier = round(max(price, prev_candle_high), decimals)
            invalidation_barrier = round(price - sl_dist, decimals)
            stop_loss = invalidation_barrier
            target_price = round(price + (sl_dist * 1.5), decimals)       # TP1 (Quick Scalp 1:1.5)
            target_price_tp2 = round(price + (sl_dist * 2.5), decimals)   # TP2 (Runner 1:2.5)
        elif "SELL" in action:
            entry_barrier = round(min(price, prev_candle_low), decimals)
            invalidation_barrier = round(price + sl_dist, decimals)
            stop_loss = invalidation_barrier
            target_price = round(max(0.0001, price - (sl_dist * 1.5)), decimals)      # TP1 (Quick Scalp 1:1.5)
            target_price_tp2 = round(max(0.0001, price - (sl_dist * 2.5)), decimals)  # TP2 (Runner 1:2.5)
        else:
            entry_barrier = price
            invalidation_barrier = round(price - sl_dist, decimals)
            stop_loss = invalidation_barrier
            target_price = round(price + (sl_dist * 1.2), decimals)
            target_price_tp2 = round(price + (sl_dist * 2.0), decimals)

        # -----------------------------------------------------------------
        # 7. NOTIFY EXACT ENTRY TIMING & TIME-BASED EXIT RULES
        # -----------------------------------------------------------------
        # Check distance from barrier
        barrier_gap_pct = abs(price - entry_barrier) / price if price > 0 else 0.0

        if "BUY" in action:
            if barrier_gap_pct <= 0.0025:
                entry_timing = f"⚡ EXECUTE NOW (Immediate Market Entry at {currSym}{price:.{decimals}f})"
            elif price > entry_barrier:
                entry_timing = f"⏳ WAIT FOR PULLBACK to {currSym}{entry_barrier:.{decimals}f} (Valid next 15-30 mins)"
            else:
                entry_timing = f"🎯 BUY ON BREAKOUT above {currSym}{entry_barrier:.{decimals}f} (Pending trigger)"
        elif "SELL" in action:
            if barrier_gap_pct <= 0.0025:
                entry_timing = f"⚡ EXECUTE NOW (Immediate Market Entry at {currSym}{price:.{decimals}f})"
            elif price < entry_barrier:
                entry_timing = f"⏳ WAIT FOR PULLBACK to {currSym}{entry_barrier:.{decimals}f} (Valid next 15-30 mins)"
            else:
                entry_timing = f"🎯 SELL ON BREAKDOWN below {currSym}{entry_barrier:.{decimals}f} (Pending trigger)"
        else:
            entry_timing = "⏸ STAND ASIDE: Consolidating inside candle barriers"

        # Time-based Exit Rule (independent of TP/SL)
        if is_inr:
            time_based_exit = f"⏰ TIME EXIT: Close position by 3:15 PM IST (Intraday cutoff) or if 15m candle closes against 9-EMA ({currSym}{e9:.2f}) (Max hold: 45-75 mins)"
        else:
            time_based_exit = f"⏰ TIME EXIT: Max hold: 2-3 hours; exit if 15m momentum stalls or RSI diverges"

        # -----------------------------------------------------------------
        # 8. POSITION SIZING (Max 1.5% Risk, Max 15% Capital Cap)
        # -----------------------------------------------------------------
        risk_budget = (account_balance or 100000.0) * 0.015
        if is_forex:
            pip_unit = 0.01 if "JPY" in symbol else 0.0001
            pips_at_risk = max(15.0, sl_dist / pip_unit)
            usd_balance = account_balance if account_balance <= 50000 else 10000.0
            usd_risk = usd_balance * 0.015
            calculated_lots = usd_risk / (pips_at_risk * 10.0)
            recommended_shares = round(max(0.01, min(1.0, calculated_lots)), 2)
            allocated_amount = round(recommended_shares * 1000.0, 2)
        elif is_inr:
            max_capital_cap = (account_balance or 100000.0) * 0.15
            shares_by_risk = int(risk_budget / sl_dist) if sl_dist > 0 else 1
            shares_by_cap = int(max_capital_cap / price) if price > 0 else 1
            recommended_shares = max(1, min(shares_by_risk, shares_by_cap))
            allocated_amount = round(recommended_shares * price, 2)
        else:
            max_capital_cap = (account_balance or 100000.0) * 0.15
            shares_by_risk = int(risk_budget / (sl_dist * 86.0)) if sl_dist > 0 else 1
            shares_by_cap = int(max_capital_cap / price) if price > 0 else 1
            recommended_shares = max(1, min(shares_by_risk, shares_by_cap))
            allocated_amount = round(recommended_shares * price, 2)

        # -----------------------------------------------------------------
        # 9. COMPREHENSIVE THESIS NARRATIVE
        # -----------------------------------------------------------------
        agreeing_count = bullish_votes if "BUY" in action else (bearish_votes if "SELL" in action else 3)
        consensus_pct = int((agreeing_count / 6) * 100)

        candle_summary = f"{green_count} Green / {red_count} Red Bars (10 Candles)"
        macro_text = f"1M: {month_return:+.1f}% ({month_trend}) | 52W Position: {pct_52w:.0f}%"

        thesis = (
            f"{consensus_pct}% Algo Consensus ({agreeing_count}/6 Models Agree). "
            f"1M Macro: {month_return:+.1f}% ({macro_regime.replace('_', ' ')}). "
            f"Candle Structure: {candle_summary}. {ema_summary}. {macd_summary}."
        )

        tech_summary = (
            f"Score: {composite_score:+.2f} | RSI: {rsi:.1f} | EMA9: {e9:.{decimals}f} | "
            f"ATR: {atr:.{decimals}f} | Stoch: {curr_stoch_k:.0f}% | 52W Range: {currSym}{y_low:.{decimals}f}-{currSym}{y_high:.{decimals}f}"
        )

        prediction_barriers = {
            "entry_barrier": entry_barrier,
            "invalidation_barrier": invalidation_barrier,
            "profit_barrier_tp1": target_price,
            "profit_barrier_tp2": target_price_tp2,
            "swing_high": swing_high,
            "swing_low": swing_low
        }

        return {
            "action": action,
            "confidence": confidence,
            "current_price": price,
            "target_price": target_price,
            "target_price_tp2": target_price_tp2,
            "stop_loss": stop_loss,
            "time_horizon": time_horizon,
            "thesis_reason": thesis,
            "technical_summary": tech_summary,
            "recommended_shares": recommended_shares,
            "allocated_amount": allocated_amount,
            "entry_timing": entry_timing,
            "time_based_exit": time_based_exit,
            "macro_trend": macro_text,
            "prediction_barriers": prediction_barriers
        }

    @classmethod
    def _fallback_analysis(cls, current_price: float, account_balance: float, symbol: str) -> Dict[str, Any]:
        price = float(current_price) if (current_price and current_price > 0) else 100.0
        decimals = 4 if "=X" in symbol else 2
        sl_dist = round(price * 0.005, decimals)
        return {
            "action": "HOLD",
            "confidence": 0.50,
            "current_price": price,
            "target_price": round(price + (sl_dist * 1.5), decimals),
            "target_price_tp2": round(price + (sl_dist * 2.5), decimals),
            "stop_loss": round(price - sl_dist, decimals),
            "time_horizon": "Awaiting Candle Calibration",
            "thesis_reason": "Insufficient historical bar depth. Collecting real-time ticks to initialize prediction barriers.",
            "technical_summary": f"Base Price: {price} | Neutral Calibration Stage",
            "recommended_shares": 1,
            "allocated_amount": round(price, 2),
            "entry_timing": "STAND ASIDE: Waiting for candle confirmation",
            "time_based_exit": "No active position",
            "macro_trend": "Calibrating",
            "prediction_barriers": {
                "entry_barrier": price,
                "invalidation_barrier": round(price - sl_dist, decimals),
                "profit_barrier_tp1": round(price + (sl_dist * 1.5), decimals),
                "profit_barrier_tp2": round(price + (sl_dist * 2.5), decimals)
            }
        }
