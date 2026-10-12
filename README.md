# JEV AI & Ollama Dual-Brain Trading Platform

A modern, high-performance algorithmic and quantitative trading terminal built for **Indian Equities (NSE/BSE)**, **NSE Currency Derivatives (CDS)**, and **Global Forex**.

---

## 📸 Platform Overview

The platform unites two AI cognitive paradigms for algorithmic trading:
1. **JEV AI (System 1 - Fast Decision Gate)**: Evaluates quantitative technical indicators (RSI, EMA ribbons, ATR, MACD, Bollinger Bands) in sub-500ms to output real-time `BUY`, `SELL`, or `HOLD` signals with dynamic Stop-Loss and Take-Profit recommendations.
2. **Local Ollama LLM (System 2 - Macro Reasoning Layer)**: Analyzes macroeconomic context, RBI & Fed interest rate sentiment, classified market regimes, and acts as an interactive trading mentor.

---

## 🏛️ Regulatory & Indian Market Compatibility

- **SEBI/RBI Forex Compliance**: Direct support for Indian Currency Derivatives segment (NSE-CDS) on currency pairs paired with INR (`USDINR`, `EURINR`, `GBPINR`) avoiding unauthorized offshore broker complications.
- **Indian Equities & Indices**: Native tracking and execution for blue-chip stocks (`RELIANCE.NS`, `TCS.NS`, `INFY.NS`, `HDFCBANK.NS`, `TATAMOTORS.NS`, `ICICIBANK.NS`) and benchmark indices (`^NSEI Nifty 50`, `^NSEBANK Bank Nifty`).
- **Free Market Data Feeds**: 100% free historical candles and live quotes via `yfinance` and open currency exchange rates with zero subscription costs.
- **Dual Currency System**: Dynamic risk calculation and order execution in **Indian Rupees (₹)** and **US Dollars ($)**.

---

## 🛡️ Risk Management & Capital Preservation Guardrails

- **Dynamic ATR Stop-Loss**: Volatility-adjusted stops calculated via $SL = \text{Entry} \pm (k \times \text{ATR})$ to avoid stop-outs from noise.
- **Position Sizing Formula**:
  $$\text{Shares} = \left\lfloor \frac{\text{Account Capital (₹)} \times \text{Risk \%}}{\text{Entry Price} - \text{Stop Loss}} \right\rfloor$$
- **Circuit Breaker**: Daily loss cap (default 4% account equity) automatically pauses automated trading.
- **Auto-Trading Mode**: Automatically enters positions when JEV AI confidence exceeds your defined threshold (e.g. 70%).

---

## 🚀 Running the Platform

### 1. Backend Server (FastAPI)
```powershell
cd C:\Users\USER\.gemini\antigravity-ide\scratch\forex-trading-platform\backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- API Documentation: http://127.0.0.1:8000/docs

### 2. Frontend Terminal (React + Vite)
```powershell
cd C:\Users\USER\.gemini\antigravity-ide\scratch\forex-trading-platform\frontend
npm run dev -- --host 127.0.0.1 --port 5173
```
- Web Application: http://127.0.0.1:5173

### 3. Local Ollama LLM (Optional)
To enable local conversational reasoning on your machine:
```powershell
ollama run llama3:8b
```
*(If Ollama is not running, the system automatically falls back to the built-in technical reasoning engine without interruption).*
