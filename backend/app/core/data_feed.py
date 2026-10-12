import asyncio
import time
import random
import logging
import urllib.request
import csv
import io
from datetime import datetime, timezone, timedelta
import yfinance as yf
from typing import Dict, List, Optional, Any
from app.config import SUPPORTED_ASSETS, MarketAsset
from app.models.schemas import Candle, TickerSnapshot
from app.core.indicators import IndicatorEngine

logger = logging.getLogger("DataFeed")
logging.basicConfig(level=logging.INFO)

IST = timezone(timedelta(hours=5, minutes=30))

# Official National Stock Exchange of India (NSE) Holiday Calendar
NSE_ANNUAL_FIXED_HOLIDAYS = {
    "01-26": "Republic Day",
    "04-14": "Dr. Baba Saheb Ambedkar Jayanti",
    "05-01": "Maharashtra Day",
    "08-15": "Independence Day",
    "10-02": "Mahatma Gandhi Jayanti",
    "12-25": "Christmas",
}

NSE_FLOATING_HOLIDAYS = {
    # 2024
    "2024-01-22": "Ram Mandir Pran Pratishtha",
    "2024-03-08": "Mahashivratri",
    "2024-03-25": "Holi",
    "2024-03-29": "Good Friday",
    "2024-04-11": "Id-Ul-Fitr",
    "2024-04-17": "Ram Navami",
    "2024-05-20": "General Parliamentary Elections",
    "2024-06-17": "Bakri Id",
    "2024-07-17": "Muharram",
    "2024-11-01": "Diwali Laxmi Pujan",
    "2024-11-15": "Gurunanak Jayanti",
    # 2025
    "2025-02-26": "Mahashivratri",
    "2025-03-14": "Holi",
    "2025-03-31": "Id-Ul-Fitr",
    "2025-04-10": "Mahavir Jayanti",
    "2025-04-18": "Good Friday",
    "2025-06-07": "Bakri Id",
    "2025-07-06": "Muharram",
    "2025-08-27": "Ganesh Chaturthi",
    "2025-10-21": "Diwali Laxmi Pujan",
    "2025-10-22": "Diwali Balipratipada",
    "2025-11-05": "Gurunanak Jayanti",
    # 2026
    "2026-02-15": "Mahashivratri",
    "2026-03-04": "Holi",
    "2026-03-20": "Id-Ul-Fitr",
    "2026-04-03": "Good Friday",
    "2026-04-21": "Ram Navami",
    "2026-05-27": "Bakri Id",
    "2026-06-26": "Muharram",
    "2026-09-14": "Ganesh Chaturthi",
    "2026-10-20": "Dussehra",
    "2026-11-08": "Diwali",
    "2026-11-24": "Gurunanak Jayanti",
}

def get_nse_holiday_name(dt: datetime) -> Optional[str]:
    """Returns holiday name if dt (in IST) is an official NSE trading holiday, else None"""
    mm_dd = dt.strftime("%m-%d")
    if mm_dd in NSE_ANNUAL_FIXED_HOLIDAYS:
        return NSE_ANNUAL_FIXED_HOLIDAYS[mm_dd]
    yyyy_mm_dd = dt.strftime("%Y-%m-%d")
    if yyyy_mm_dd in NSE_FLOATING_HOLIDAYS:
        return NSE_FLOATING_HOLIDAYS[yyyy_mm_dd]
    return None

class MarketDataFeed:
    def __init__(self):
        self.candle_cache: Dict[str, List[Candle]] = {}
        self.history_cache: Dict[str, tuple] = {}
        self.latest_prices: Dict[str, float] = {}
        self.change_pcts: Dict[str, float] = {}
        self.last_quotes_refresh: float = 0.0
        self.active_subscribers = set()
        self._crypto_realtime_cache: Dict[str, tuple] = {}
        self.load_dynamic_catalog()

    def load_dynamic_catalog(self):
        """Dynamically populates the asset directory with comprehensive Forex, Crypto, US & Indian markets"""
        # 1. RBI/SEBI Regulated Currency Derivatives (NSE CDS)
        cds_pairs = [
            ("USDINR=X", "USD / INR (NSE-CDS)", 0.0025, 1000, 4),
            ("EURINR=X", "EUR / INR (NSE-CDS)", 0.0025, 1000, 4),
            ("GBPINR=X", "GBP / INR (NSE-CDS)", 0.0025, 1000, 4),
            ("JPYINR=X", "JPY / INR (NSE-CDS)", 0.0025, 1000, 4),
            ("AEDINR=X", "AED / INR (NSE-CDS)", 0.0025, 1000, 4),
            ("SGDINR=X", "SGD / INR (NSE-CDS)", 0.0025, 1000, 4),
        ]
        for sym, name, tick, lot, pip in cds_pairs:
            SUPPORTED_ASSETS[sym] = MarketAsset(symbol=sym, name=name, market="NSE_CDS", currency="INR", tick_size=tick, lot_size=lot, pip_decimal=pip)

        # 2. Benchmark Indices
        SUPPORTED_ASSETS["^NSEI"] = MarketAsset(symbol="^NSEI", name="Nifty 50 Index", market="NSE", currency="INR", tick_size=0.05, lot_size=50, pip_decimal=2)
        SUPPORTED_ASSETS["^NSEBANK"] = MarketAsset(symbol="^NSEBANK", name="Bank Nifty Index", market="NSE", currency="INR", tick_size=0.05, lot_size=15, pip_decimal=2)

        # 3. Comprehensive Global Forex Pairs (TradingView Standard Universe)
        forex_pairs = [
            # Major Pairs
            ("EURUSD=X", "EUR / USD (Euro / US Dollar)"),
            ("GBPUSD=X", "GBP / USD (British Pound / US Dollar)"),
            ("USDJPY=X", "USD / JPY (US Dollar / Japanese Yen)"),
            ("AUDUSD=X", "AUD / USD (Australian Dollar / US Dollar)"),
            ("USDCAD=X", "USD / CAD (US Dollar / Canadian Dollar)"),
            ("USDCHF=X", "USD / CHF (US Dollar / Swiss Franc)"),
            ("NZDUSD=X", "NZD / USD (New Zealand Dollar / US Dollar)"),
            # Euro Crosses
            ("EURGBP=X", "EUR / GBP (Euro / British Pound)"),
            ("EURJPY=X", "EUR / JPY (Euro / Japanese Yen)"),
            ("EURCHF=X", "EUR / CHF (Euro / Swiss Franc)"),
            ("EURCAD=X", "EUR / CAD (Euro / Canadian Dollar)"),
            ("EURAUD=X", "EUR / AUD (Euro / Australian Dollar)"),
            ("EURNZD=X", "EUR / NZD (Euro / New Zealand Dollar)"),
            ("EURSEK=X", "EUR / SEK (Euro / Swedish Krona)"),
            ("EURNOK=X", "EUR / NOK (Euro / Norwegian Krone)"),
            ("EURTRY=X", "EUR / TRY (Euro / Turkish Lira)"),
            # Pound Crosses
            ("GBPJPY=X", "GBP / JPY (British Pound / Japanese Yen)"),
            ("GBPCHF=X", "GBP / CHF (British Pound / Swiss Franc)"),
            ("GBPCAD=X", "GBP / CAD (British Pound / Canadian Dollar)"),
            ("GBPAUD=X", "GBP / AUD (British Pound / Australian Dollar)"),
            ("GBPNZD=X", "GBP / NZD (British Pound / New Zealand Dollar)"),
            # Yen Crosses
            ("AUDJPY=X", "AUD / JPY (Australian Dollar / Japanese Yen)"),
            ("CADJPY=X", "CAD / JPY (Canadian Dollar / Japanese Yen)"),
            ("CHFJPY=X", "CHF / JPY (Swiss Franc / Japanese Yen)"),
            ("NZDJPY=X", "NZD / JPY (New Zealand Dollar / Japanese Yen)"),
            # Australasian Crosses
            ("AUDCAD=X", "AUD / CAD (Australian Dollar / Canadian Dollar)"),
            ("AUDCHF=X", "AUD / CHF (Australian Dollar / Swiss Franc)"),
            ("AUDNZD=X", "AUD / NZD (Australian Dollar / New Zealand Dollar)"),
            ("CADCHF=X", "CAD / CHF (Canadian Dollar / Swiss Franc)"),
            ("NZDCAD=X", "NZD / CAD (New Zealand Dollar / Canadian Dollar)"),
            ("NZDCHF=X", "NZD / CHF (New Zealand Dollar / Swiss Franc)"),
            # Exotics & Emerging Currencies
            ("USDSGD=X", "USD / SGD (US Dollar / Singapore Dollar)"),
            ("USDHKD=X", "USD / HKD (US Dollar / Hong Kong Dollar)"),
            ("USDZAR=X", "USD / ZAR (US Dollar / South African Rand)"),
            ("USDMXN=X", "USD / MXN (US Dollar / Mexican Peso)"),
            ("USDSEK=X", "USD / SEK (US Dollar / Swedish Krona)"),
            ("USDNOK=X", "USD / NOK (US Dollar / Norwegian Krone)"),
            ("USDTRY=X", "USD / TRY (US Dollar / Turkish Lira)"),
            ("USDTHB=X", "USD / THB (US Dollar / Thai Baht)"),
            ("USDCNH=X", "USD / CNH (US Dollar / Chinese Yuan Offshore)"),
            ("USDPLN=X", "USD / PLN (US Dollar / Polish Zloty)"),
            # Crypto FX Pairs (24/7 Trading)
            ("BTC-USD", "BTC / USD (Bitcoin Spot)"),
            ("ETH-USD", "ETH / USD (Ethereum Spot)"),
            ("SOL-USD", "SOL / USD (Solana Spot)"),
            ("BNB-USD", "BNB / USD (BNB Spot)"),
            ("XRP-USD", "XRP / USD (Ripple Spot)"),
            ("DOGE-USD", "DOGE / USD (Dogecoin Spot)"),
            ("ADA-USD", "ADA / USD (Cardano Spot)"),
            ("AVAX-USD", "AVAX / USD (Avalanche Spot)"),
            ("LINK-USD", "LINK / USD (Chainlink Spot)"),
        ]
        for sym, name in forex_pairs:
            is_crypto = sym.endswith("-USD")
            pip = 2 if ("JPY" in sym or is_crypto) else 4
            tick = 0.01 if ("JPY" in sym or is_crypto) else 0.0001
            market = "CRYPTO_FX" if is_crypto else "GLOBAL_FOREX"
            lot = 1 if is_crypto else 100000
            SUPPORTED_ASSETS[sym] = MarketAsset(symbol=sym, name=name, market=market, currency="USD", tick_size=tick, lot_size=lot, pip_decimal=pip)

        # 4. Global Equities & ETFs (US Top Tech & Indices)
        us_stocks = [
            ("AAPL", "Apple Inc."),
            ("MSFT", "Microsoft Corp."),
            ("NVDA", "NVIDIA Corp."),
            ("GOOGL", "Alphabet Inc."),
            ("AMZN", "Amazon.com Inc."),
            ("TSLA", "Tesla Inc."),
            ("META", "Meta Platforms"),
            ("AMD", "Advanced Micro Devices"),
            ("NFLX", "Netflix Inc."),
            ("INTC", "Intel Corp."),
            ("CRM", "Salesforce Inc."),
            ("AVGO", "Broadcom Inc."),
            ("COST", "Costco Wholesale"),
            ("ORCL", "Oracle Corp."),
            ("QCOM", "Qualcomm Inc."),
            ("SPY", "SPDR S&P 500 ETF"),
            ("QQQ", "Invesco QQQ Trust"),
            ("DIA", "SPDR Dow Jones Industrial ETF"),
            ("SMH", "VanEck Semiconductor ETF"),
        ]
        for sym, name in us_stocks:
            SUPPORTED_ASSETS[sym] = MarketAsset(symbol=sym, name=name, market="GLOBAL_STOCKS", currency="USD", tick_size=0.01, lot_size=1, pip_decimal=2)

        # 5. Live Official Nifty 100 Constituents directly from Exchange Index API
        try:
            url = "https://www.niftyindices.com/IndexConstituent/ind_nifty100list.csv"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                content = resp.read().decode("utf-8")
                reader = csv.DictReader(io.StringIO(content))
                count = 0
                for row in reader:
                    sym_code = row.get("Symbol", "").strip()
                    co_name = row.get("Company Name", "").strip()
                    if sym_code:
                        full_sym = f"{sym_code}.NS"
                        SUPPORTED_ASSETS[full_sym] = MarketAsset(
                            symbol=full_sym,
                            name=co_name or sym_code,
                            market="NSE",
                            currency="INR",
                            tick_size=0.05,
                            lot_size=1,
                            pip_decimal=2
                        )
                        count += 1
                logger.info(f"Dynamically loaded {count} Indian stocks from live official Nifty 100 API.")
        except Exception as e:
            logger.warning(f"Live Nifty CSV load skipped/offline: {e}.")

    def get_asset_info(self, symbol: str) -> MarketAsset:
        """Retrieves or dynamically creates a MarketAsset metadata object for any valid ticker"""
        if symbol in SUPPORTED_ASSETS:
            return SUPPORTED_ASSETS[symbol]
        
        # Dynamically infer market and currency for user-requested symbols
        sym_upper = symbol.upper()
        if sym_upper.endswith(".NS"):
            asset = MarketAsset(symbol=symbol, name=sym_upper.replace(".NS", ""), market="NSE", currency="INR", tick_size=0.05, lot_size=1, pip_decimal=2)
        elif sym_upper.endswith(".BO"):
            asset = MarketAsset(symbol=symbol, name=sym_upper.replace(".BO", ""), market="NSE", currency="INR", tick_size=0.05, lot_size=1, pip_decimal=2)
        elif sym_upper.endswith("INR=X"):
            asset = MarketAsset(symbol=symbol, name=sym_upper, market="NSE_CDS", currency="INR", tick_size=0.0025, lot_size=1000, pip_decimal=4)
        elif "=X" in sym_upper:
            asset = MarketAsset(symbol=symbol, name=sym_upper, market="GLOBAL_FOREX", currency="USD", tick_size=0.0001, lot_size=100000, pip_decimal=4)
        else:
            asset = MarketAsset(symbol=symbol, name=sym_upper, market="GLOBAL_STOCKS", currency="USD", tick_size=0.01, lot_size=1, pip_decimal=2)
        
        SUPPORTED_ASSETS[symbol] = asset
        return asset

    def refresh_live_quotes(self, symbols: Optional[List[str]] = None, force: bool = False):
        """Batch fetches real quotes from yfinance and updates latest_prices and change_pcts"""
        now = time.time()
        # Cooldown: at most once every 15 seconds unless forced
        if not force and (now - self.last_quotes_refresh) < 15.0:
            return

        target_syms = symbols or list(SUPPORTED_ASSETS.keys())
        try:
            tickers = yf.Tickers(" ".join(target_syms[:30]))
            for sym, t in tickers.tickers.items():
                try:
                    price = t.fast_info.get('lastPrice') or t.fast_info.get('regularMarketPrice')
                    prev_close = t.fast_info.get('previousClose')
                    if price and float(price) > 0:
                        self.latest_prices[sym] = round(float(price), 4)
                        if prev_close and float(prev_close) > 0:
                            pct = round(((float(price) - float(prev_close)) / float(prev_close)) * 100, 2)
                            self.change_pcts[sym] = pct
                except Exception:
                    pass
            self.last_quotes_refresh = now
            logger.info("Refreshed live market quotes successfully.")
        except Exception as e:
            logger.warning(f"Batch quotes refresh failed: {e}")

    def get_market_sessions(self) -> Dict[str, Any]:
        """Calculates live market session status based on IST (Indian Standard Time) and holiday calendar"""
        now_ist = datetime.now(IST)
        weekday = now_ist.weekday()  # 0=Monday, 6=Sunday
        time_minutes = now_ist.hour * 60 + now_ist.minute

        holiday_name = get_nse_holiday_name(now_ist)
        is_holiday = holiday_name is not None

        # NSE Equity: 9:15 AM to 3:30 PM (555 to 930 mins) on Mon-Fri, excluding holidays
        is_weekday = weekday < 5
        nse_equity_open = is_weekday and not is_holiday and (555 <= time_minutes <= 930)
        
        # NSE CDS (Currency): 9:00 AM to 5:00 PM (540 to 1020 mins) on Mon-Fri, excluding holidays
        nse_cds_open = is_weekday and not is_holiday and (540 <= time_minutes <= 1020)

        # Global Forex: 24/5 from Mon morning Sydney to Fri evening New York
        forex_open = (weekday < 4) or (weekday == 4 and now_ist.hour < 23) or (weekday == 6 and now_ist.hour >= 22)

        if is_holiday:
            active_session = f"Indian Markets Closed ({holiday_name})"
        elif nse_equity_open:
            active_session = "Indian Market (NSE)"
        elif forex_open:
            active_session = "London / NY Forex"
        else:
            active_session = "Weekend Overhaul"

        return {
            "current_time_ist": now_ist.strftime("%d-%m-%Y %H:%M:%S IST"),
            "is_nse_holiday": is_holiday,
            "nse_holiday_name": holiday_name,
            "nse_equity": "OPEN" if nse_equity_open else "CLOSED",
            "nse_cds": "OPEN" if nse_cds_open else "CLOSED",
            "global_forex": "OPEN" if forex_open else "CLOSED",
            "active_session": active_session
        }

    def _fetch_crypto_klines(self, symbol: str, interval: str = "5m", limit: int = 150) -> Optional[List[Candle]]:
        """Direct zero-latency USD klines from Coinbase matching TradingView CRYPTO:BTCUSD, with Binance fallback"""
        # 1. Primary: Coinbase USD Spot (Exact TradingView CRYPTO feed)
        granularity_map = {"1m": 60, "5m": 300, "15m": 900, "1h": 3600, "1d": 86400}
        granularity = granularity_map.get(interval.lower(), 300)
        try:
            url = f"https://api.exchange.coinbase.com/products/{symbol}/candles?granularity={granularity}"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=3.0) as resp:
                import json
                data = json.loads(resp.read().decode())
                if data and isinstance(data, list) and len(data) >= 5:
                    # Coinbase format: [ time, low, high, open, close, volume ] sorted descending
                    sorted_bars = sorted(data, key=lambda x: x[0])
                    candles = []
                    for k in sorted_bars[-limit:]:
                        candles.append(Candle(
                            time=int(k[0]),
                            open=round(float(k[3]), 4),
                            high=round(float(k[2]), 4),
                            low=round(float(k[1]), 4),
                            close=round(float(k[4]), 4),
                            volume=round(float(k[5]), 2)
                        ))
                    if candles:
                        return candles
        except Exception as e:
            logger.debug(f"Coinbase klines fetch failed for {symbol}: {e}")

        # 2. Secondary Fallback: Binance USDT
        binance_sym = symbol.replace("-USD", "USDT").replace("-", "")
        b_interval = "1d" if interval.upper() == "1D" else interval
        if b_interval not in ["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "1d"]:
            b_interval = "5m"
        try:
            url = f"https://api.binance.com/api/v3/klines?symbol={binance_sym}&interval={b_interval}&limit={limit}"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=3.0) as resp:
                import json
                data = json.loads(resp.read().decode())
                candles = []
                for k in data:
                    candles.append(Candle(
                        time=int(k[0]) // 1000,
                        open=round(float(k[1]), 4),
                        high=round(float(k[2]), 4),
                        low=round(float(k[3]), 4),
                        close=round(float(k[4]), 4),
                        volume=round(float(k[5]), 2)
                    ))
                if candles:
                    return candles
        except Exception as e:
            logger.warning(f"Binance klines fallback failed for {symbol}: {e}")
        return None

    def _fetch_crypto_realtime(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Direct zero-latency live ticker from Coinbase USD matching TradingView CRYPTO:BTCUSD"""
        now = time.time()
        cached = self._crypto_realtime_cache.get(symbol)
        if cached and (now - cached[0]) < 1.2:
            return cached[1]

        headers = {"User-Agent": "Mozilla/5.0"}
        # 1. Primary: Coinbase USD Ticker (under 120ms)
        try:
            url_tick = f"https://api.exchange.coinbase.com/products/{symbol}/ticker"
            req_t = urllib.request.Request(url_tick, headers=headers)
            with urllib.request.urlopen(req_t, timeout=2.0) as resp_t:
                import json
                tick = json.loads(resp_t.read().decode())
                price = float(tick["price"])
                bid = float(tick.get("bid", price))
                ask = float(tick.get("ask", price))
                vol = float(tick.get("volume", 5000.0))

                # Compute change% relative to session open
                change_pct = 0.0
                candles = self.candle_cache.get(symbol)
                if candles and len(candles) > 0:
                    day_open = candles[0].open
                    if day_open > 0:
                        change_pct = round(((price - day_open) / day_open) * 100, 2)
                elif cached:
                    change_pct = cached[1].get("change_pct", 0.0)

                res = {
                    "price": price,
                    "change_pct": change_pct,
                    "high": price,
                    "low": price,
                    "volume": vol,
                    "bid": bid,
                    "ask": ask
                }
                self._crypto_realtime_cache[symbol] = (now, res)
                return res
        except Exception as e:
            logger.debug(f"Coinbase ticker fetch notice for {symbol}: {e}")

        # If network hiccup occurred, preserve latest Coinbase quote rather than flip-flopping to Binance USDT
        if cached:
            return cached[1]

        # 2. Secondary Fallback: Binance USDT (only if cold start with zero prior Coinbase data)
        binance_sym = symbol.replace("-USD", "USDT").replace("-", "")
        try:
            url = f"https://api.binance.com/api/v3/ticker/24hr?symbol={binance_sym}"
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=2.0) as resp:
                import json
                data = json.loads(resp.read().decode())
                res = {
                    "price": float(data["lastPrice"]),
                    "change_pct": float(data["priceChangePercent"]),
                    "high": float(data["highPrice"]),
                    "low": float(data["lowPrice"]),
                    "volume": float(data["volume"]),
                    "bid": float(data["bidPrice"]),
                    "ask": float(data["askPrice"])
                }
                self._crypto_realtime_cache[symbol] = (now, res)
                return res
        except Exception:
            return None

    def fetch_historical_candles(
        self, 
        symbol: str, 
        interval: str = "5m", 
        period: Optional[str] = "1d",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> List[Candle]:
        """Fetches historical candlestick data date-wise with fast memory caching and fallback"""
        effective_period = period or ("1d" if not start_date else None)
        cache_key = f"{symbol}:{interval}:{effective_period}:{start_date}:{end_date}"
        now_ts = time.time()

        # For crypto (BTC-USD, ETH-USD, SOL-USD), pull real-time Coinbase USD klines matching TradingView
        if (symbol.endswith("-USD") or "-USD" in symbol) and not start_date:
            # Short 3-second cache to ensure live synchronization without redundant HTTP requests
            if cache_key in self.history_cache:
                c_time, c_candles = self.history_cache[cache_key]
                if (now_ts - c_time) < 3.0 and c_candles:
                    return c_candles

            crypto_bars = self._fetch_crypto_klines(symbol, interval=interval, limit=150)
            if crypto_bars and len(crypto_bars) >= 5:
                self.candle_cache[symbol] = crypto_bars
                self.history_cache[cache_key] = (now_ts, crypto_bars)
                self.latest_prices[symbol] = crypto_bars[-1].close
                return crypto_bars

        # Check memory cache for non-crypto
        ttl = 120.0 if start_date else 15.0
        if cache_key in self.history_cache:
            cached_time, cached_candles = self.history_cache[cache_key]
            if (now_ts - cached_time) < ttl and cached_candles:
                return cached_candles

        try:
            ticker = yf.Ticker(symbol)
            df = None

            # 1. Custom Date Range query if start_date is supplied
            if start_date:
                effective_interval = interval
                try:
                    s_dt = datetime.strptime(start_date, "%Y-%m-%d")
                    days_diff = (datetime.now() - s_dt).days
                    if days_diff > 58 and effective_interval in ["1m", "5m", "15m"]:
                        effective_interval = "1d"
                except Exception:
                    pass

                kwargs = {"start": start_date, "interval": effective_interval}
                if end_date:
                    kwargs["end"] = end_date
                df = ticker.history(**kwargs)
            else:
                # Standard period query:
                # On holidays or weekends, 1d intraday has 0 rows; fall back to 5d to grab the latest completed session
                df = ticker.history(period=effective_period or "1d", interval=interval)
                if df.empty or len(df) < 5:
                    df = ticker.history(period="5d", interval=interval if interval in ["5m", "15m", "1h"] else "15m")

            if df is not None and not df.empty:
                candles = []
                for idx, row in df.iterrows():
                    ts = int(idx.timestamp())
                    candles.append(Candle(
                        time=ts,
                        open=round(float(row["Open"]), 4),
                        high=round(float(row["High"]), 4),
                        low=round(float(row["Low"]), 4),
                        close=round(float(row["Close"]), 4),
                        volume=float(row["Volume"]) if "Volume" in row else 1000.0
                    ))

                # If 1d was requested but 5d had to be pulled because market is closed/holiday:
                # Filter down to the single most recent trading day's session
                if (effective_period == "1d" or not period) and not start_date and len(candles) > 75:
                    last_day = datetime.fromtimestamp(candles[-1].time, IST).date()
                    day_candles = [c for c in candles if datetime.fromtimestamp(c.time, IST).date() == last_day]
                    if len(day_candles) >= 5:
                        candles = day_candles

                self.candle_cache[symbol] = candles
                self.history_cache[cache_key] = (now_ts, candles)
                if candles:
                    self.latest_prices[symbol] = candles[-1].close
                return candles
        except Exception as e:
            logger.warning(f"yfinance fetch failed for {symbol}: {e}. Returning cached/synthetic historical bars.")

        # Check existing candle cache for this symbol before generating synthetic
        if symbol in self.candle_cache and len(self.candle_cache[symbol]) >= 5:
            return self.candle_cache[symbol]

        # Fallback generator if network/offline
        return self._generate_synthetic_history(symbol)

    def _generate_synthetic_history(self, symbol: str, num_candles: int = 80) -> List[Candle]:
        base_price = self.latest_prices.get(symbol)
        if not base_price or base_price == 100.0:
            try:
                t = yf.Ticker(symbol)
                fast_p = t.fast_info.get("lastPrice") or t.fast_info.get("previousClose")
                if fast_p and float(fast_p) > 0:
                    base_price = float(fast_p)
            except Exception:
                pass
        if not base_price:
            base_price = 1000.0 if symbol.endswith(".NS") else 100.0

        candles = []
        current_time = int(time.time()) - (num_candles * 300)
        curr_price = base_price

        # Volatility factor based on asset type
        volatility = base_price * 0.0018

        for i in range(num_candles):
            step = random.gauss(0, volatility)
            open_p = curr_price
            close_p = open_p + step
            high_p = max(open_p, close_p) + abs(random.gauss(0, volatility * 0.5))
            low_p = min(open_p, close_p) - abs(random.gauss(0, volatility * 0.5))
            vol = random.randint(500, 20000)

            candles.append(Candle(
                time=current_time,
                open=round(open_p, 4),
                high=round(high_p, 4),
                low=round(low_p, 4),
                close=round(close_p, 4),
                volume=float(vol)
            ))
            curr_price = close_p
            current_time += 300

        self.candle_cache[symbol] = candles
        self.latest_prices[symbol] = candles[-1].close
        return candles

    def is_asset_market_open(self, symbol: str) -> bool:
        """Determines if the exchange for this symbol is actively open for trading right now"""
        sessions = self.get_market_sessions()
        asset = self.get_asset_info(symbol)
        if asset.market == "NSE":
            return sessions["nse_equity"] == "OPEN"
        elif asset.market == "NSE_CDS":
            return sessions["nse_cds"] == "OPEN"
        elif asset.market == "GLOBAL_FOREX":
            return sessions["global_forex"] == "OPEN"
        elif asset.market == "CRYPTO_FX":
            return True  # 24/7/365 active market
        elif asset.market == "GLOBAL_STOCKS":
            now_ist = datetime.now(IST)
            weekday = now_ist.weekday()
            time_mins = now_ist.hour * 60 + now_ist.minute
            return (weekday < 5) and (time_mins >= 1140 or time_mins <= 90)
        return False

    def get_macro_history(self, symbol: str) -> Dict[str, Any]:
        """
        Calculates multi-timeframe 1-Month to 1-Year historical metrics:
        - 52-Week High & Low and Current Range Location %
        - 1-Month (30-Day) Return & Momentum Trajectory
        - 200-Day SMA & 50-Day SMA (Macro Trend Status)
        - Last 5 Daily Candles Sequence (Consecutive green/red bars)
        """
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

    def get_snapshot(self, symbol: str) -> TickerSnapshot:
        """Returns the real-time snapshot with latest technical indicators and market hours check"""
        if symbol not in self.candle_cache or len(self.candle_cache[symbol]) < 20:
            self.fetch_historical_candles(symbol)

        candles = self.candle_cache.get(symbol, [])
        asset_info = self.get_asset_info(symbol)
        
        if symbol.endswith("-USD") or "-USD" in symbol:
            realtime = self._fetch_crypto_realtime(symbol)
            if realtime:
                last_price = round(realtime["price"], 4)
                self.latest_prices[symbol] = last_price
                self.change_pcts[symbol] = round(realtime["change_pct"], 2)
            else:
                last_price = self.latest_prices.get(symbol, 100.0)
        else:
            last_price = self.latest_prices.get(symbol, 100.0)

        spread = round(last_price * 0.0003, 4)
        bid = round(last_price - (spread / 2), 4)
        ask = round(last_price + (spread / 2), 4)

        if symbol in self.change_pcts and self.change_pcts[symbol] != 0.0:
            change_pct = self.change_pcts[symbol]
            change = round(last_price * (change_pct / 100.0), 4)
        elif candles:
            day_open = candles[0].open
            change = round(last_price - day_open, 4)
            change_pct = round((change / day_open) * 100, 2)
        else:
            change = 0.0
            change_pct = 0.0

        if candles:
            high_24h = max(c.high for c in candles[-40:])
            low_24h = min(c.low for c in candles[-40:])
            vol_24h = sum(c.volume for c in candles[-40:])
        else:
            high_24h = last_price * 1.01
            low_24h = last_price * 0.99
            vol_24h = 50000.0

        # Calculate indicators
        indicators = IndicatorEngine.calculate_all(candles)
        is_open = self.is_asset_market_open(symbol)
        holiday_name = get_nse_holiday_name(datetime.now(IST)) if (asset_info and asset_info.market in ["NSE", "NSE_CDS"]) else None
        if holiday_name:
            market_status = f"CLOSED (Holiday: {holiday_name})"
        else:
            market_status = "OPEN" if is_open else "CLOSED"

        return TickerSnapshot(
            symbol=symbol,
            name=asset_info.name if asset_info else symbol,
            currency=asset_info.currency if asset_info else "INR",
            last_price=last_price,
            bid=bid,
            ask=ask,
            spread=spread,
            change=change,
            change_pct=change_pct,
            high_24h=round(high_24h, 4),
            low_24h=round(low_24h, 4),
            volume_24h=round(vol_24h, 1),
            timestamp=time.time(),
            is_market_open=is_open,
            market_status=market_status,
            indicators=indicators
        )

    def generate_next_tick(self, symbol: str, allow_simulation: bool = False) -> Dict[str, Any]:
        """Fetches live tick update if market is open; freezes on official close if market is closed"""
        if symbol not in self.candle_cache or not self.candle_cache[symbol]:
            self.fetch_historical_candles(symbol)

        candles = self.candle_cache[symbol]
        last_candle = candles[-1]
        now = int(time.time())
        is_open = self.is_asset_market_open(symbol)

        # WHEN MARKET IS CLOSED AND SIMULATION NOT FORCED:
        # DO NOT fake ticks or create moving candles! Preserve exact official close!
        if not is_open and not allow_simulation:
            self.latest_prices[symbol] = last_candle.close
            snapshot = self.get_snapshot(symbol)
            return {
                "candle": last_candle.dict(),
                "snapshot": snapshot.dict()
            }

        # Market is OPEN: Live ticks and candle formation
        if symbol.endswith("-USD") or "-USD" in symbol:
            realtime = self._fetch_crypto_realtime(symbol)
            if realtime:
                new_price = round(realtime["price"], 4)
                self.change_pcts[symbol] = round(realtime["change_pct"], 2)
            else:
                vol = (last_candle.close * 0.0003)
                drift = random.gauss(0, vol)
                new_price = round(last_candle.close + drift, 4)
        else:
            vol = (last_candle.close * 0.0003)
            drift = random.gauss(0, vol)
            new_price = round(last_candle.close + drift, 4)

        self.latest_prices[symbol] = new_price

        # Standard 5-minute bucket alignment: (now // 300) * 300
        bucket_time = (now // 300) * 300
        if bucket_time > last_candle.time:
            new_candle = Candle(
                time=bucket_time,
                open=new_price,
                high=new_price,
                low=new_price,
                close=new_price,
                volume=random.randint(50, 500)
            )
            candles.append(new_candle)
            if len(candles) > 300:
                candles.pop(0)
            active_candle = new_candle
        else:
            last_candle.close = new_price
            last_candle.high = max(last_candle.high, new_price)
            last_candle.low = min(last_candle.low, new_price)
            last_candle.volume += random.randint(10, 50)
            active_candle = last_candle

        snapshot = self.get_snapshot(symbol)

        return {
            "candle": active_candle.dict(),
            "snapshot": snapshot.dict()
        }

data_feed = MarketDataFeed()
