import os
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import Dict, List, Optional

# Load .env file from project root
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
load_dotenv(env_path)

class MarketAsset(BaseModel):
    symbol: str
    name: str
    market: str  # "NSE", "NSE_CDS", "GLOBAL_FOREX", "GLOBAL_STOCKS"
    currency: str  # "INR" or "USD"
    tick_size: float
    lot_size: int
    pip_decimal: int
    last_price: Optional[float] = None
    change_pct: Optional[float] = None

# Dynamic registry populated automatically at runtime by live exchange feeds
SUPPORTED_ASSETS: Dict[str, MarketAsset] = {}

class Settings:
    PROJECT_NAME: str = "JEV AI & Ollama Dual-Brain Forex & Stock Trading Engine"
    VERSION: str = "1.0.0"
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    
    # Local LLM Config (Dedicated DeepSeek Docker Container)
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11435")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "deepseek-r1:8b")
    
    # Jev AI Config
    JEV_AI_API_URL: str = os.getenv("JEV_AI_API_URL", "https://api.jev.ai/v1/decide")
    JEV_AI_API_KEY: str = os.getenv("JEV_AI_API_KEY", "")
    JEV_CONFIDENCE_THRESHOLD: float = float(os.getenv("JEV_CONFIDENCE_THRESHOLD", "0.68"))
    
    # Database Config (PostgreSQL Default)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:sayan@localhost:5432/trading_db")


    # Trading Defaults
    DEFAULT_SYMBOL: str = "RELIANCE.NS"
    DEFAULT_BALANCE_INR: float = 100000.0  # ₹1 Lakh paper balance
    DEFAULT_BALANCE_USD: float = 10000.0   # $10k paper balance
    MAX_RISK_PER_TRADE_PCT: float = 2.0     # 2% max risk per trade
    DAILY_DRAWDOWN_LIMIT_PCT: float = 4.0  # 4% daily kill-switch

settings = Settings()
