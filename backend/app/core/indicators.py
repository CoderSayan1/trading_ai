import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional
from app.models.schemas import TechnicalIndicators, Candle

class IndicatorEngine:
    @staticmethod
    def calculate_all(candles: List[Candle]) -> TechnicalIndicators:
        if not candles or len(candles) < 20:
            return TechnicalIndicators()

        # Convert to pandas DataFrame for vectorized calculations
        df = pd.DataFrame([{
            "time": c.time,
            "open": c.open,
            "high": c.high,
            "low": c.low,
            "close": c.close,
            "volume": c.volume
        } for c in candles])

        closes = df["close"]
        highs = df["high"]
        lows = df["low"]

        # 1. EMAs (9, 21, 50, 200)
        ema9 = closes.ewm(span=9, adjust=False).mean()
        ema21 = closes.ewm(span=21, adjust=False).mean()
        ema50 = closes.ewm(span=50, adjust=False).mean() if len(closes) >= 50 else closes.ewm(span=len(closes), adjust=False).mean()
        ema200 = closes.ewm(span=200, adjust=False).mean() if len(closes) >= 200 else None

        # 2. RSI (14 period)
        delta = closes.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / (loss.replace(0, np.nan))
        rsi_series = 100 - (100 / (1 + rs))
        rsi_val = float(rsi_series.iloc[-1]) if not pd.isna(rsi_series.iloc[-1]) else 50.0

        # 3. ATR (Average True Range, 14 period)
        prev_close = closes.shift(1)
        tr1 = highs - lows
        tr2 = (highs - prev_close).abs()
        tr3 = (lows - prev_close).abs()
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        atr_series = tr.rolling(window=14).mean()
        atr_val = float(atr_series.iloc[-1]) if not pd.isna(atr_series.iloc[-1]) else float((highs.iloc[-1] - lows.iloc[-1]))

        # 4. MACD (12, 26, 9)
        ema12 = closes.ewm(span=12, adjust=False).mean()
        ema26 = closes.ewm(span=26, adjust=False).mean()
        macd_line = ema12 - ema26
        macd_signal = macd_line.ewm(span=9, adjust=False).mean()
        macd_hist = macd_line - macd_signal

        # 5. Bollinger Bands (20, 2 std)
        bb_middle = closes.rolling(window=20).mean()
        bb_std = closes.rolling(window=20).std()
        bb_upper = bb_middle + (2 * bb_std)
        bb_lower = bb_middle - (2 * bb_std)

        # 6. Trend Determination
        e9_val = float(ema9.iloc[-1])
        e21_val = float(ema21.iloc[-1])
        e50_val = float(ema50.iloc[-1])
        
        if e9_val > e21_val > e50_val:
            trend = "BULLISH"
        elif e9_val < e21_val < e50_val:
            trend = "BEARISH"
        else:
            trend = "NEUTRAL"

        return TechnicalIndicators(
            rsi=round(rsi_val, 2),
            ema9=round(e9_val, 4),
            ema21=round(e21_val, 4),
            ema50=round(e50_val, 4),
            ema200=round(float(ema200.iloc[-1]), 4) if ema200 is not None and not pd.isna(ema200.iloc[-1]) else None,
            atr=round(atr_val, 4),
            macd=round(float(macd_line.iloc[-1]), 4),
            macd_signal=round(float(macd_signal.iloc[-1]), 4),
            macd_hist=round(float(macd_hist.iloc[-1]), 4),
            bb_upper=round(float(bb_upper.iloc[-1]), 4) if not pd.isna(bb_upper.iloc[-1]) else None,
            bb_middle=round(float(bb_middle.iloc[-1]), 4) if not pd.isna(bb_middle.iloc[-1]) else None,
            bb_lower=round(float(bb_lower.iloc[-1]), 4) if not pd.isna(bb_lower.iloc[-1]) else None,
            trend=trend
        )
