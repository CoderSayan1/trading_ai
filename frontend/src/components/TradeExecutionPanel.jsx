import React, { useState, useEffect } from "react";
import { 
  Sliders, Shield, Target, Play, Pause, ArrowUp, ArrowDown, RotateCcw,
  TrendingUp, ArrowLeftRight, Zap, Activity, Sparkles
} from "lucide-react";

export function TradeExecutionPanel({ 
  strategy, 
  onUpdateStrategy, 
  onPlaceOrder, 
  onResetAccount, 
  symbol, 
  liveSnapshot,
  onSelectStrategy
}) {
  const [sharesInput, setSharesInput] = useState("");
  const [customSL, setCustomSL] = useState("");
  const [customTP, setCustomTP] = useState("");
  const [orderSide, setOrderSide] = useState("BUY");

  const isINR = liveSnapshot?.currency === "INR";
  const sym = isINR ? "₹" : "$";
  const price = liveSnapshot?.last_price || 0.0;
  const isForex = symbol?.includes("=X") || (price > 0 && price < 50);
  const decimals = isForex ? 4 : 2;

  const currentStratId = strategy?.active_strategy || "TREND_TRADING";

  const STRATEGIES = [
    {
      id: "TREND_TRADING",
      name: "Trend Trading",
      shortLabel: "Trend",
      icon: TrendingUp,
      color: "#10B981",
      slPct: isForex ? 0.0030 : 0.0588, // ~5.8% (e.g. 30 pts on 510 stock)
      tpRatios: [1.5, 2.0, 2.5, 3.0],
      defaultTpRatio: 2.5,
      riskPct: 1.0,
      badge: "TREND MOMENTUM",
      tip: "Riding directional trend along EMA9/21 & trendline channels. ATR trailing stop."
    },
    {
      id: "RANGE_TRADING",
      name: "Range Trading",
      shortLabel: "Range",
      icon: ArrowLeftRight,
      color: "#F59E0B",
      slPct: isForex ? 0.0018 : 0.030, // ~3.0%
      tpRatios: [1.2, 1.5, 2.0],
      defaultTpRatio: 1.5,
      riskPct: 1.0,
      badge: "MEAN REVERSION",
      tip: "Oscillating between support floor and resistance ceiling. Buy low, sell high."
    },
    {
      id: "BREAKOUT_TRADING",
      name: "Breakout",
      shortLabel: "Breakout",
      icon: Zap,
      color: "#8B5CF6",
      slPct: isForex ? 0.0025 : 0.038, // ~3.8%
      tpRatios: [2.0, 2.5, 3.0, 4.0],
      defaultTpRatio: 3.0,
      riskPct: 1.5,
      badge: "VOLATILITY BURST",
      tip: "Explosive volume expansion past chart patterns (Triangles, H&S, ABCD)."
    },
    {
      id: "SCALPING",
      name: "Scalping",
      shortLabel: "Scalp",
      icon: Activity,
      color: "#EC4899",
      slPct: isForex ? 0.0010 : 0.008, // ~0.8% tight
      tpRatios: [1.2, 1.5, 1.8],
      defaultTpRatio: 1.5,
      riskPct: 0.5,
      badge: "RAPID SCALP",
      tip: "Ultra-fast micro-momentum targeting quick micro-pivot levels."
    }
  ];

  const activeStratObj = STRATEGIES.find(s => s.id === currentStratId) || STRATEGIES[0];

  // Dynamic Stop Loss distance tailored to the active strategy
  const defaultSLDistance = isForex 
    ? activeStratObj.slPct 
    : (price > 0 ? (price * activeStratObj.slPct) : 0);

  const tpMultiplier = strategy?.tp_multiplier || activeStratObj.defaultTpRatio;
  const defaultTPDistance = defaultSLDistance * tpMultiplier;

  const buySL = price > 0 ? (price - defaultSLDistance).toFixed(decimals) : "0";
  const buyTP = price > 0 ? (price + defaultTPDistance).toFixed(decimals) : "0";
  const sellSL = price > 0 ? (price + defaultSLDistance).toFixed(decimals) : "0";
  const sellTP = price > 0 ? Math.max(price * 0.001, price - defaultTPDistance).toFixed(decimals) : "0";

  // Active SL & TP based on current side and user custom inputs
  const currentDefaultSL = orderSide === "BUY" ? buySL : sellSL;
  const currentDefaultTP = orderSide === "BUY" ? buyTP : sellTP;

  // Clear or sync custom inputs when symbol changes
  useEffect(() => {
    setCustomSL("");
    setCustomTP("");
  }, [symbol]);

  const handleSelectStrategyTab = (strat) => {
    onUpdateStrategy({
      ...strategy,
      active_strategy: strat.id,
      tp_multiplier: strat.defaultTpRatio,
      risk_per_trade_pct: strat.riskPct,
      symbol: symbol
    });
    setCustomSL("");
    setCustomTP("");
    if (onSelectStrategy) {
      onSelectStrategy(strat.id);
    }
  };

  const handleExecute = (side) => {
    const isBuy = side === "BUY";
    const defaultSL = isBuy ? buySL : sellSL;
    const defaultTP = isBuy ? buyTP : sellTP;

    const slVal = customSL !== "" ? parseFloat(customSL) : (price > 0 ? parseFloat(defaultSL) : null);
    const tpVal = customTP !== "" ? parseFloat(customTP) : (price > 0 ? parseFloat(defaultTP) : null);
    const qty = sharesInput ? parseFloat(sharesInput) : null;

    onPlaceOrder(side, qty, slVal, tpVal);
  };

  const toggleAutoTrade = () => {
    onUpdateStrategy({
      ...strategy,
      auto_trade_enabled: !strategy.auto_trade_enabled,
      symbol: symbol,
    });
  };

  const handleRiskChange = (val) => {
    onUpdateStrategy({
      ...strategy,
      risk_per_trade_pct: parseFloat(val),
    });
  };

  const handleTPChange = (val) => {
    onUpdateStrategy({
      ...strategy,
      tp_multiplier: parseFloat(val),
    });
    // If user hasn't typed custom TP, recalculate
    if (customTP === "") {
      const newTPDist = defaultSLDistance * val;
      const newTP = orderSide === "BUY" ? (price + newTPDist) : (price - newTPDist);
      setCustomTP(newTP.toFixed(decimals));
    }
  };

  return (
    <div className="glass-panel" style={{ padding: "10px 12px", height: "100%", display: "flex", flexDirection: "column", gap: "8px" }}>
      {/* Header & Auto-Trade Toggle */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Sliders size={15} color="var(--accent-cyan)" />
          <span style={{ fontSize: "12.5px", fontWeight: "800", color: "#fff", letterSpacing: "0.4px" }}>
            EXECUTION ENGINE
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {onResetAccount && (
            <button
              onClick={onResetAccount}
              title="Reset Paper Account Balance & Clear Daily Drawdown"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "5px",
                padding: "3px 7px",
                fontSize: "10px",
                fontWeight: "600",
                cursor: "pointer",
                background: "rgba(255,255,255,0.05)",
                color: "var(--text-muted)",
                transition: "all 0.2s"
              }}
            >
              <RotateCcw size={10} />
              <span>Reset</span>
            </button>
          )}

          <button
            onClick={toggleAutoTrade}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              border: "none",
              borderRadius: "5px",
              padding: "4px 9px",
              fontSize: "10.5px",
              fontWeight: "700",
              cursor: "pointer",
              background: strategy?.auto_trade_enabled ? "var(--accent-green)" : "rgba(255,255,255,0.08)",
              color: strategy?.auto_trade_enabled ? "#000" : "var(--text-muted)",
              transition: "all 0.2s"
            }}
          >
            {strategy?.auto_trade_enabled ? <Play size={11} fill="#000" /> : <Pause size={11} />}
            <span>{strategy?.auto_trade_enabled ? "AUTO ON" : "MANUAL"}</span>
          </button>
        </div>
      </div>

      {/* 4 AI Strategy Selector Tabs */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
          <span style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-dim)", textTransform: "uppercase" }}>
            Active AI Strategy
          </span>
          <span style={{ 
            fontSize: "9px", 
            fontWeight: "800", 
            color: activeStratObj.color,
            background: `${activeStratObj.color}1A`,
            padding: "1px 6px",
            borderRadius: "4px"
          }}>
            {activeStratObj.badge}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4px" }}>
          {STRATEGIES.map((strat) => {
            const isSel = currentStratId === strat.id;
            const Icon = strat.icon;
            return (
              <button
                key={strat.id}
                onClick={() => handleSelectStrategyTab(strat)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "2px",
                  padding: "5px 2px",
                  borderRadius: "5px",
                  border: isSel ? `1px solid ${strat.color}` : "1px solid rgba(255,255,255,0.07)",
                  background: isSel ? `${strat.color}22` : "rgba(255,255,255,0.03)",
                  color: isSel ? "#fff" : "var(--text-dim)",
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
              >
                <Icon size={12} color={isSel ? strat.color : "var(--text-dim)"} />
                <span style={{ fontSize: "9.5px", fontWeight: isSel ? "700" : "500" }}>
                  {strat.shortLabel}
                </span>
              </button>
            );
          })}
        </div>

        {/* Strategy Tip Box */}
        <div style={{
          marginTop: "4px",
          padding: "4px 7px",
          borderRadius: "4px",
          background: "rgba(0,0,0,0.25)",
          border: `1px solid ${activeStratObj.color}33`,
          fontSize: "9.5px",
          color: "var(--text-muted)",
          lineHeight: "1.3"
        }}>
          💡 <strong style={{ color: activeStratObj.color }}>{activeStratObj.name}:</strong> {activeStratObj.tip}
        </div>
      </div>

      {/* Side Selector Tabs (BUY vs SELL preview) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
        <button
          onClick={() => {
            setOrderSide("BUY");
            if (customSL !== "" || customTP !== "") {
              setCustomSL(buySL);
              setCustomTP(buyTP);
            }
          }}
          style={{
            padding: "5px 0",
            borderRadius: "5px",
            border: "none",
            background: orderSide === "BUY" ? "rgba(16, 185, 129, 0.2)" : "rgba(255,255,255,0.03)",
            color: orderSide === "BUY" ? "var(--accent-green)" : "var(--text-dim)",
            fontSize: "11px",
            fontWeight: "700",
            cursor: "pointer",
            borderBottom: orderSide === "BUY" ? "2px solid var(--accent-green)" : "2px solid transparent"
          }}
        >
          BUY / LONG SETUP
        </button>
        <button
          onClick={() => {
            setOrderSide("SELL");
            if (customSL !== "" || customTP !== "") {
              setCustomSL(sellSL);
              setCustomTP(sellTP);
            }
          }}
          style={{
            padding: "5px 0",
            borderRadius: "5px",
            border: "none",
            background: orderSide === "SELL" ? "rgba(239, 68, 68, 0.2)" : "rgba(255,255,255,0.03)",
            color: orderSide === "SELL" ? "var(--accent-red)" : "var(--text-dim)",
            fontSize: "11px",
            fontWeight: "700",
            cursor: "pointer",
            borderBottom: orderSide === "SELL" ? "2px solid var(--accent-red)" : "2px solid transparent"
          }}
        >
          SELL / SHORT SETUP
        </button>
      </div>

      {/* Editable Stop Loss & Target Fields */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px", marginBottom: "3px" }}>
            <span style={{ color: "var(--accent-red)", fontWeight: "600" }}>Stop-Loss (SL)</span>
            <span style={{ color: "var(--text-dim)", fontSize: "9.5px" }}>Default: {sym}{currentDefaultSL}</span>
          </div>
          <input
            type="number"
            step="any"
            placeholder={currentDefaultSL}
            value={customSL}
            onChange={(e) => setCustomSL(e.target.value)}
            style={{
              width: "100%",
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "6px",
              padding: "5px 8px",
              color: "#fff",
              fontSize: "11.5px",
              outline: "none"
            }}
          />
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px", marginBottom: "3px" }}>
            <span style={{ color: "var(--accent-green)", fontWeight: "600" }}>Target (TP)</span>
            <span style={{ color: "var(--text-dim)", fontSize: "9.5px" }}>Default: {sym}{currentDefaultTP}</span>
          </div>
          <input
            type="number"
            step="any"
            placeholder={currentDefaultTP}
            value={customTP}
            onChange={(e) => setCustomTP(e.target.value)}
            style={{
              width: "100%",
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              borderRadius: "6px",
              padding: "5px 8px",
              color: "#fff",
              fontSize: "11.5px",
              outline: "none"
            }}
          />
        </div>
      </div>

      {/* Risk-Reward Quick Ratio Presets */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", marginBottom: "3px" }}>
          <span style={{ color: "var(--text-muted)" }}>Target Ratio (Risk-Reward)</span>
          <span className="mono" style={{ color: "var(--accent-cyan)", fontSize: "10px" }}>1:{tpMultiplier}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${activeStratObj.tpRatios.length}, 1fr)`, gap: "5px" }}>
          {activeStratObj.tpRatios.map((ratio) => (
            <button
              key={ratio}
              onClick={() => handleTPChange(ratio)}
              style={{
                padding: "3px 0",
                borderRadius: "4px",
                border: "none",
                background: tpMultiplier === ratio ? "rgba(16, 185, 129, 0.22)" : "rgba(255,255,255,0.03)",
                color: tpMultiplier === ratio ? "var(--accent-green)" : "var(--text-dim)",
                fontSize: "10px",
                fontWeight: "600",
                cursor: "pointer"
              }}
            >
              1:{ratio}
            </button>
          ))}
        </div>
      </div>

      {/* Risk % Selector */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", marginBottom: "3px" }}>
          <span style={{ color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
            <Shield size={11} color="var(--accent-cyan)" /> Risk Per Trade
          </span>
          <span className="mono" style={{ fontWeight: "700", color: "var(--accent-cyan)", fontSize: "10px" }}>
            {strategy?.risk_per_trade_pct || activeStratObj.riskPct}% Capital
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "5px" }}>
          {[0.5, 1.0, 1.5, 2.0].map((r) => (
            <button
              key={r}
              onClick={() => handleRiskChange(r)}
              style={{
                padding: "3px 0",
                borderRadius: "4px",
                border: "none",
                background: (strategy?.risk_per_trade_pct || activeStratObj.riskPct) === r ? "rgba(6, 182, 212, 0.2)" : "rgba(255,255,255,0.03)",
                color: (strategy?.risk_per_trade_pct || activeStratObj.riskPct) === r ? "var(--accent-cyan)" : "var(--text-dim)",
                fontSize: "10px",
                fontWeight: "600",
                cursor: "pointer",
                borderBottom: (strategy?.risk_per_trade_pct || activeStratObj.riskPct) === r ? "2px solid var(--accent-cyan)" : "1px solid transparent"
              }}
            >
              {r}%
            </button>
          ))}
        </div>
      </div>

      {/* Manual Quantity Input */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", marginBottom: "2px" }}>
          <span style={{ color: "var(--text-muted)" }}>Position Size ({isINR ? "Shares" : "Lots"})</span>
          <span style={{ color: "var(--text-dim)", fontSize: "9px" }}>Auto-sized if blank</span>
        </div>
        <input
          type="number"
          placeholder="Calculated automatically by risk %"
          value={sharesInput}
          onChange={(e) => setSharesInput(e.target.value)}
          style={{
            width: "100%",
            background: "rgba(0,0,0,0.3)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "5px",
            padding: "5px 8px",
            color: "#fff",
            fontSize: "11px",
            outline: "none"
          }}
        />
      </div>

      {/* Order Execution Buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "auto" }}>
        {/* BUY Button */}
        <button
          onClick={() => handleExecute("BUY")}
          style={{
            background: "linear-gradient(180deg, #10B981 0%, #059669 100%)",
            border: "none",
            borderRadius: "7px",
            padding: "7px 6px",
            color: "#fff",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "2px",
            boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
            transition: "transform 0.1s ease"
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontWeight: "800", fontSize: "12px" }}>
            <ArrowUp size={13} /> BUY / LONG
          </div>
          <div style={{ fontSize: "9px", opacity: 0.9 }}>
            SL: {sym}{customSL || buySL} | TP: {sym}{customTP || buyTP}
          </div>
        </button>

        {/* SELL Button */}
        <button
          onClick={() => handleExecute("SELL")}
          style={{
            background: "linear-gradient(180deg, #EF4444 0%, #DC2626 100%)",
            border: "none",
            borderRadius: "7px",
            padding: "7px 6px",
            color: "#fff",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "2px",
            boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)",
            transition: "transform 0.1s ease"
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontWeight: "800", fontSize: "12px" }}>
            <ArrowDown size={13} /> SELL / SHORT
          </div>
          <div style={{ fontSize: "9px", opacity: 0.9 }}>
            SL: {sym}{customSL || sellSL} | TP: {sym}{customTP || sellTP}
          </div>
        </button>
      </div>
    </div>
  );
}

export default TradeExecutionPanel;
