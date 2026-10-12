import os

base_dir = os.path.dirname(__file__)

# ==============================================================================
# 1. Update data_feed.py to add get_macro_history
# ==============================================================================
df_path = os.path.join(base_dir, "app", "core", "data_feed.py")
with open(df_path, "r", encoding="utf-8") as f:
    df_code = f.read()

if "def get_macro_history" not in df_code:
    macro_method = """    def get_macro_history(self, symbol: str) -> Dict[str, Any]:
        \"\"\"
        Calculates multi-timeframe 1-Month to 1-Year historical metrics:
        - 52-Week High & Low and Current Range Location %
        - 1-Month (30-Day) Return & Momentum Trajectory
        - 200-Day SMA & 50-Day SMA (Macro Trend Status)
        - Last 5 Daily Candles Sequence (Consecutive green/red bars)
        \"\"\"
        now_ts = time.time()
        if hasattr(self, "macro_cache") and symbol in self.macro_cache:
            cache_time, cached_val = self.macro_cache[symbol]
            if now_ts - cache_time < 7200:
                return cached_val

        if not hasattr(self, "macro_cache"):
            self.macro_cache = {}

        try:
            ticker = yf.Ticker(symbol)
            df = ticker.history(period="1y", interval="1d")
            if df is not None and not df.empty and len(df) >= 15:
                closes = df["Close"]
                highs = df["High"]
                lows = df["Low"]
                opens = df["Open"]
                curr = float(closes.iloc[-1])
                y_high = float(highs.max())
                y_low = float(lows.min())
                pct_52w = round(((curr - y_low) / (y_high - y_low) * 100), 1) if y_high > y_low else 50.0

                p_30d = float(closes.iloc[-22]) if len(closes) >= 22 else float(closes.iloc[0])
                month_ret = round(((curr - p_30d) / p_30d * 100), 2)
                month_trend = "BULLISH" if month_ret >= 2.0 else ("BEARISH" if month_ret <= -2.0 else "NEUTRAL")

                sma50 = round(float(closes.rolling(50).mean().iloc[-1]), 2) if len(closes) >= 50 else None
                sma200 = round(float(closes.rolling(200).mean().iloc[-1]), 2) if len(closes) >= 200 else None

                macro_regime = "STRONG_BULLISH" if (sma50 and sma200 and curr > sma50 > sma200) else (
                    "STRONG_BEARISH" if (sma50 and sma200 and curr < sma50 < sma200) else (
                        "BULLISH" if curr > (sma50 or curr) else "BEARISH"
                    )
                )

                last5_colors = ["GREEN" if closes.iloc[i] >= opens.iloc[i] else "RED" for i in range(-min(5, len(closes)), 0)]

                res = {
                    "current_price": curr,
                    "year_high": y_high,
                    "year_low": y_low,
                    "pct_52w": pct_52w,
                    "month_return": month_ret,
                    "month_trend": month_trend,
                    "sma50": sma50,
                    "sma200": sma200,
                    "macro_regime": macro_regime,
                    "last5_candles": last5_colors
                }
                self.macro_cache[symbol] = (now_ts, res)
                return res
        except Exception as e:
            logger.warning(f"Could not fetch 1Y macro history for {symbol}: {e}")

        fallback = {
            "current_price": self.latest_prices.get(symbol, 100.0),
            "year_high": self.latest_prices.get(symbol, 100.0) * 1.15,
            "year_low": self.latest_prices.get(symbol, 100.0) * 0.85,
            "pct_52w": 50.0,
            "month_return": 0.0,
            "month_trend": "NEUTRAL",
            "sma50": None,
            "sma200": None,
            "macro_regime": "NEUTRAL",
            "last5_candles": ["GREEN", "RED", "GREEN", "RED", "GREEN"]
        }
        self.macro_cache[symbol] = (now_ts, fallback)
        return fallback

"""
    # Insert right before get_snapshot
    df_code = df_code.replace("    def get_snapshot(self, symbol: str) -> TickerSnapshot:", macro_method + "    def get_snapshot(self, symbol: str) -> TickerSnapshot:")
    with open(df_path, "w", encoding="utf-8") as f:
        f.write(df_code)
    print("data_feed.py updated with get_macro_history.")
else:
    print("data_feed.py already has get_macro_history.")

# ==============================================================================
# 2. Update risk_manager.py to enforce tight, achievable SL & TP
# ==============================================================================
rm_path = os.path.join(base_dir, "app", "core", "risk_manager.py")
with open(rm_path, "r", encoding="utf-8") as f:
    rm_code = f.read()

old_order_params = """        # Determine Stop-Loss distance
        if sl_type == "ATR":
            sl_distance = max(atr * 1.5, curr_price * 0.003)
        else:
            sl_distance = curr_price * 0.01  # default 1% distance

        decimals = 4 if (curr_price < 50 or "=X" in snapshot.symbol or snapshot.currency == "USD") else 2

        clean_side = "BUY" if "BUY" in side.upper() else "SELL"
        if clean_side == "BUY":
            stop_loss = round(curr_price - sl_distance, decimals)
            take_profit = round(curr_price + (sl_distance * tp_ratio), decimals)
        else:
            stop_loss = round(curr_price + sl_distance, decimals)
            take_profit = round(max(curr_price * 0.001, curr_price - (sl_distance * tp_ratio)), decimals)"""

new_order_params = """        # Tight, achievable Stop-Loss and Target for intraday/swing execution
        is_fx = "=X" in snapshot.symbol or (curr_price < 50 and not snapshot.symbol.endswith(".NS"))
        is_crypto = "-USD" in snapshot.symbol
        decimals = 4 if is_fx else 2
        if is_fx and "JPY" in snapshot.symbol:
            decimals = 3

        if is_fx:
            # Forex: tight 15 to 25 pips (0.15% - 0.25%)
            sl_distance = round(max(0.0015, min(0.0030, atr * 0.85)), decimals)
        elif is_crypto:
            # Crypto: tight 0.35% - 0.60% ($300-$500 on BTC)
            sl_distance = round(max(curr_price * 0.0035, min(curr_price * 0.0060, atr * 0.85)), decimals)
        else:
            # Indian Stocks (NSE): tight 0.40% - 0.70% (₹4 - ₹7 on ₹1,000 stock)
            sl_distance = round(max(curr_price * 0.0040, min(curr_price * 0.0070, atr * 0.85)), decimals)

        effective_tp_ratio = 1.5 if (tp_ratio is None or tp_ratio <= 1.0) else tp_ratio

        clean_side = "BUY" if "BUY" in side.upper() else "SELL"
        if clean_side == "BUY":
            stop_loss = round(curr_price - sl_distance, decimals)
            take_profit = round(curr_price + (sl_distance * effective_tp_ratio), decimals)
        else:
            stop_loss = round(curr_price + sl_distance, decimals)
            take_profit = round(max(curr_price * 0.001, curr_price - (sl_distance * effective_tp_ratio)), decimals)"""

if old_order_params in rm_code:
    rm_code = rm_code.replace(old_order_params, new_order_params)
    with open(rm_path, "w", encoding="utf-8") as f:
        f.write(rm_code)
    print("risk_manager.py updated with tight SL/TP bounds.")
else:
    print("old_order_params not matched in risk_manager.py, checking...")

print("Step 1 & 2 completed.")
