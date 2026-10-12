import asyncio
import urllib.request
import json
from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
from app.config import SUPPORTED_ASSETS
from app.core.data_feed import data_feed
from app.models.schemas import Candle, TickerSnapshot

router = APIRouter(prefix="/api/market", tags=["Market Data"])

@router.get("/assets")
async def get_assets(
    category: Optional[str] = Query(None, description="Filter: NSE_EQUITIES, NSE_CDS, GLOBAL_FOREX, CRYPTO_FX, GLOBAL_STOCKS"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None)
):
    """List assets with on-scroll pagination, real-time quotes, and category filtering"""
    # Category counts mapping
    category_counts = {
        "NSE_EQUITIES": 0,
        "NSE_CDS": 0,
        "GLOBAL_FOREX": 0,
        "CRYPTO_FX": 0,
        "GLOBAL_STOCKS": 0
    }
    for asset in SUPPORTED_ASSETS.values():
        if asset.market == "NSE":
            category_counts["NSE_EQUITIES"] += 1
        elif asset.market == "NSE_CDS":
            category_counts["NSE_CDS"] += 1
        elif asset.market == "GLOBAL_FOREX":
            category_counts["GLOBAL_FOREX"] += 1
        elif asset.market == "CRYPTO_FX":
            category_counts["CRYPTO_FX"] += 1
        elif asset.market == "GLOBAL_STOCKS":
            category_counts["GLOBAL_STOCKS"] += 1

    # If paginated query for a specific category is requested
    if category is not None:
        matched = []
        search_lower = search.strip().lower() if search else None

        for sym, asset in SUPPORTED_ASSETS.items():
            market_match = (
                (category == "NSE_EQUITIES" and asset.market == "NSE") or
                (category == "NSE_CDS" and asset.market == "NSE_CDS") or
                (category == "GLOBAL_FOREX" and asset.market in ["GLOBAL_FOREX", "CRYPTO_FX"]) or
                (category == "CRYPTO_FX" and asset.market == "CRYPTO_FX") or
                (category == "GLOBAL_STOCKS" and asset.market == "GLOBAL_STOCKS")
            )
            if market_match:
                if not search_lower or search_lower in asset.name.lower() or search_lower in sym.lower():
                    matched.append(asset)

        total = len(matched)
        start_idx = (page - 1) * limit
        end_idx = min(start_idx + limit, total)
        paged_assets = matched[start_idx:end_idx]

        # Targeted live quotes refresh in background threadpool (instant non-blocking response)
        target_syms = [a.symbol for a in paged_assets]
        if target_syms:
            try:
                asyncio.create_task(asyncio.to_thread(data_feed.refresh_live_quotes, target_syms))
            except Exception:
                pass

        results = []
        for asset in paged_assets:
            item = asset.dict()
            item["last_price"] = data_feed.latest_prices.get(asset.symbol, asset.last_price)
            item["change_pct"] = data_feed.change_pcts.get(asset.symbol, asset.change_pct or 0.0)
            results.append(item)

        return {
            "items": results,
            "total": total,
            "page": page,
            "limit": limit,
            "has_more": end_idx < total,
            "category_counts": category_counts
        }

    # Backward compatibility: return grouped categories
    categories = {
        "NSE_EQUITIES": [],
        "NSE_CDS": [],
        "GLOBAL_FOREX": [],
        "CRYPTO_FX": [],
        "GLOBAL_STOCKS": []
    }
    for symbol, asset in SUPPORTED_ASSETS.items():
        asset_dict = asset.dict()
        asset_dict["last_price"] = data_feed.latest_prices.get(symbol, asset.last_price)
        asset_dict["change_pct"] = data_feed.change_pcts.get(symbol, asset.change_pct or 0.0)

        if asset.market == "NSE":
            categories["NSE_EQUITIES"].append(asset_dict)
        elif asset.market == "NSE_CDS":
            categories["NSE_CDS"].append(asset_dict)
        elif asset.market == "GLOBAL_FOREX":
            categories["GLOBAL_FOREX"].append(asset_dict)
        elif asset.market == "CRYPTO_FX":
            categories["CRYPTO_FX"].append(asset_dict)
        elif asset.market == "GLOBAL_STOCKS":
            categories["GLOBAL_STOCKS"].append(asset_dict)
            
    return categories

@router.get("/search")
async def search_market(q: str = Query(..., min_length=1)):
    """Search for any real-time Indian stock (NSE/BSE), Forex pair, or Global equity"""
    try:
        encoded_q = urllib.parse.quote(q)
        req = urllib.request.Request(
            f"https://query2.finance.yahoo.com/v1/finance/search?q={encoded_q}&quotesCount=10&newsCount=0",
            headers={"User-Agent": "Mozilla/5.0"}
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            results = []
            for item in data.get("quotes", []):
                sym = item.get("symbol")
                if sym:
                    results.append({
                        "symbol": sym,
                        "name": item.get("shortname") or item.get("longname") or sym,
                        "exchange": item.get("exchange", ""),
                        "type": item.get("quoteType", "")
                    })
            return {"results": results}
    except Exception as e:
        return {"results": [], "error": str(e)}

@router.get("/sessions")
async def get_sessions():
    """Get live market trading hours for Indian NSE and Global Forex"""
    return data_feed.get_market_sessions()

@router.get("/history/{symbol}")
async def get_history(
    symbol: str, 
    interval: str = Query("5m", description="Candle interval: 1m, 5m, 15m, 1h, 1d"), 
    period: Optional[str] = Query("2d", description="Relative period: 1d, 5d, 1mo, 3mo, 6mo, 1y, max"),
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD")
) -> List[Candle]:
    """Fetch historical candlestick data date-wise via yfinance / native bar engine"""
    data_feed.get_asset_info(symbol)
    candles = await asyncio.to_thread(
        data_feed.fetch_historical_candles,
        symbol, 
        interval=interval, 
        period=period,
        start_date=start_date,
        end_date=end_date
    )
    return candles

@router.get("/snapshot/{symbol}")
async def get_snapshot(symbol: str) -> TickerSnapshot:
    """Fetch current real-time price snapshot and technical indicators"""
    data_feed.get_asset_info(symbol)
    return data_feed.get_snapshot(symbol)
