import React from "react";
import { Zap, ShieldAlert, Target, Cpu, Clock, CheckCircle2, AlertTriangle, ArrowUpRight, ArrowDownRight, Sparkles, Coins, BrainCircuit, Activity } from "lucide-react";

export function JevDecisionPanel({ signal, symbol, onQuickTrade, liveSnapshot }) {
  if (!signal) {
    return (
      <div className="glass-panel" style={{ padding: "16px", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "var(--text-dim)", fontSize: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Cpu className="pulsing-dot" size={16} />
          <span>Calibrating JEV AI System 1 Decision Gate...</span>
        </div>
      </div>
    );
  }

  const isBuy = signal.action?.includes("BUY");
  const isSell = signal.action?.includes("SELL");
  const isHold = signal.action?.includes("HOLD") || signal.action?.includes("CAUTION");

  const actionBg = isBuy ? "rgba(16, 185, 129, 0.15)" : isSell ? "rgba(239, 68, 68, 0.15)" : "rgba(245, 158, 11, 0.15)";
  const actionBorder = isBuy ? "var(--accent-green)" : isSell ? "var(--accent-red)" : "var(--accent-amber)";
  const actionColor = isBuy ? "var(--accent-green)" : isSell ? "var(--accent-red)" : "var(--accent-amber)";

  const confidencePct = Math.round((signal.confidence || 0.5) * 100);
  const isDualConfluence = signal.confluence_status === "DUAL_CONFLUENCE";
  const isDivergence = signal.confluence_status === "DIVERGENCE";
  const eod = signal.eod_prediction;
  const isFx = symbol?.includes("=X") || (liveSnapshot?.last_price > 0 && liveSnapshot?.last_price < 50);
  const fxDecimals = isFx ? (symbol?.includes("JPY") ? 3 : 4) : 2;
  const currSym = liveSnapshot?.currency === "INR" ? "₹" : "$";
  const formatPrice = (v) => {
    if (v === null || v === undefined || isNaN(v)) return null;
    return Number(v).toFixed(fxDecimals);
  };

  return (
    <div className="glass-panel" style={{ padding: "10px 12px", height: "100%", display: "flex", flexDirection: "column", gap: "8px", overflowY: "auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ 
            width: "28px", 
            height: "28px", 
            borderRadius: "6px", 
            background: "rgba(6, 182, 212, 0.15)",
            border: "1px solid rgba(6, 182, 212, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <Zap size={16} color="var(--accent-cyan)" />
          </div>
          <div>
            <div style={{ fontSize: "13px", fontWeight: "800", color: "#fff", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>LOCAL DECISION AI</span>
              <span style={{ fontSize: "9px", color: "var(--accent-cyan)", background: "rgba(6, 182, 212, 0.1)", border: "1px solid rgba(6, 182, 212, 0.25)", padding: "1px 5px", borderRadius: "3px" }}>
                DUAL-BRAIN
              </span>
            </div>
            <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>Tight Barriers + 1M/1Y Macro Timing</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "9px", fontWeight: "800", color: "var(--accent-green)", background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", padding: "2px 7px", borderRadius: "4px" }}>
            ⚡ LOCAL QUANT
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "var(--accent-cyan)", background: "rgba(6,182,212,0.08)", padding: "2px 7px", borderRadius: "10px", border: "1px solid rgba(6,182,212,0.2)" }}>
            <Clock size={10} />
            <span>{signal.latency_ms || 4}ms</span>
          </div>
        </div>
      </div>

      {/* Dual Confluence Badge */}
      {isDualConfluence && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          background: "linear-gradient(90deg, rgba(16, 185, 129, 0.18) 0%, rgba(6, 182, 212, 0.18) 100%)",
          border: "1px solid rgba(16, 185, 129, 0.4)",
          borderRadius: "6px",
          padding: "5px 8px",
          fontSize: "10px",
          fontWeight: "700",
          color: "#34D399",
          boxShadow: "0 0 10px rgba(16, 185, 129, 0.15)"
        }}>
          <Sparkles size={12} color="#10B981" />
          <span>DUAL-BRAIN CONFLUENCE: OLLAMA EOD + LIVE QUANT ALIGNED</span>
        </div>
      )}

      {isDivergence && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          background: "rgba(245, 158, 11, 0.15)",
          border: "1px solid rgba(245, 158, 11, 0.4)",
          borderRadius: "6px",
          padding: "5px 8px",
          fontSize: "10px",
          fontWeight: "700",
          color: "#FBBF24"
        }}>
          <AlertTriangle size={12} color="#F59E0B" />
          <span>DIVERGENCE WARNING: INTRADAY MOMENTUM OPPOSES EOD THESIS</span>
        </div>
      )}

      {/* Main Signal Display */}
      <div style={{ 
        background: actionBg, 
        border: `1px solid ${actionBorder}`,
        borderRadius: "10px", 
        padding: "10px 12px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {isBuy && <ArrowUpRight size={26} color="var(--accent-green)" />}
          {isSell && <ArrowDownRight size={26} color="var(--accent-red)" />}
          {isHold && <Cpu size={22} color="var(--accent-amber)" />}
          <div>
            <div style={{ fontSize: "10.5px", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Synthesized Decision
            </div>
            <div style={{ fontSize: "18px", fontWeight: "900", color: actionColor, letterSpacing: "0.5px" }}>
              {signal.action}
            </div>
          </div>
        </div>

        {/* Quick Execute Button */}
        {(isBuy || isSell) && (
          <button
            onClick={() => onQuickTrade(
              isBuy ? "BUY" : "SELL", 
              signal.recommended_sl, 
              signal.recommended_tp,
              signal.recommended_shares
            )}
            style={{
              background: actionColor,
              color: "#000",
              border: "none",
              borderRadius: "6px",
              padding: "6px 12px",
              fontSize: "11px",
              fontWeight: "800",
              cursor: "pointer",
              transition: "transform 0.1s ease",
            }}
            onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.96)")}
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            EXECUTE {isBuy ? "BUY" : "SELL"}
          </button>
        )}
      </div>

      {/* Exact Entry Timing Notification Banner */}
      {signal.entry_timing && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: isBuy ? "rgba(16, 185, 129, 0.12)" : isSell ? "rgba(239, 68, 68, 0.12)" : "rgba(255, 255, 255, 0.04)",
          border: `1px solid ${isBuy ? "rgba(16, 185, 129, 0.35)" : isSell ? "rgba(239, 68, 68, 0.35)" : "rgba(255, 255, 255, 0.1)"}`,
          borderRadius: "7px",
          padding: "7px 10px",
          fontSize: "11px",
          fontWeight: "700"
        }}>
          <span style={{ fontSize: "13px" }}>⚡</span>
          <span style={{ color: isBuy ? "var(--accent-green)" : isSell ? "var(--accent-red)" : "var(--accent-amber)" }}>
            {signal.entry_timing}
          </span>
        </div>
      )}

      {/* Prediction Barriers Visual Strip (Candle-by-Candle Structural Levels) */}
      <div style={{
        background: "rgba(0, 0, 0, 0.35)",
        border: "1px solid rgba(255, 255, 255, 0.06)",
        borderRadius: "8px",
        padding: "8px 10px",
        display: "flex",
        flexDirection: "column",
        gap: "6px"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10px" }}>
          <span style={{ color: "var(--text-dim)", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}>
            <Activity size={11} color="var(--accent-cyan)" />
            <span>ALGO PREDICTION BARRIERS</span>
          </span>
          <span style={{ 
            fontSize: "9px", 
            fontWeight: "700",
            color: isBuy ? "var(--accent-green)" : isSell ? "var(--accent-red)" : "var(--text-muted)",
            background: isBuy ? "rgba(16, 185, 129, 0.15)" : isSell ? "rgba(239, 68, 68, 0.15)" : "rgba(255,255,255,0.05)",
            padding: "1px 6px",
            borderRadius: "3px"
          }}>
            {isBuy ? "🟢 GREEN CANDLE MOMENTUM" : isSell ? "🔴 RED CANDLE MOMENTUM" : "⚪ CONSOLIDATION"}
          </span>
        </div>

        {/* 4 Barriers: Invalidation, Entry, Scalp TP1, Runner TP2 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "5px", textAlign: "center" }}>
          <div style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.25)", borderRadius: "6px", padding: "4px 2px" }}>
            <div style={{ fontSize: "8.5px", color: "var(--accent-red)", fontWeight: "700" }}>STOP LOSS</div>
            <div className="mono" style={{ fontSize: "11px", fontWeight: "800", color: "#fff", marginTop: "1px" }}>
              {signal.recommended_sl ? `${currSym}${formatPrice(signal.recommended_sl)}` : "-"}
            </div>
          </div>

          <div style={{ background: "rgba(6, 182, 212, 0.08)", border: "1px solid rgba(6, 182, 212, 0.25)", borderRadius: "6px", padding: "4px 2px" }}>
            <div style={{ fontSize: "8.5px", color: "var(--accent-cyan)", fontWeight: "700" }}>ENTRY NOW</div>
            <div className="mono" style={{ fontSize: "11px", fontWeight: "800", color: "#fff", marginTop: "1px" }}>
              {liveSnapshot?.last_price ? `${currSym}${formatPrice(liveSnapshot.last_price)}` : "-"}
            </div>
          </div>

          <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.25)", borderRadius: "6px", padding: "4px 2px" }}>
            <div style={{ fontSize: "8.5px", color: "var(--accent-green)", fontWeight: "700" }}>SCALP TP1</div>
            <div className="mono" style={{ fontSize: "11px", fontWeight: "800", color: "var(--accent-green)", marginTop: "1px" }}>
              {signal.target_price ? `${currSym}${formatPrice(signal.target_price)}` : "-"}
            </div>
          </div>

          <div style={{ background: "rgba(139, 92, 246, 0.08)", border: "1px solid rgba(139, 92, 246, 0.25)", borderRadius: "6px", padding: "4px 2px" }}>
            <div style={{ fontSize: "8.5px", color: "#A78BFA", fontWeight: "700" }}>RUNNER TP2</div>
            <div className="mono" style={{ fontSize: "11px", fontWeight: "800", color: "#C4B5FD", marginTop: "1px" }}>
              {signal.target_price_tp2 ? `${currSym}${formatPrice(signal.target_price_tp2)}` : "-"}
            </div>
          </div>
        </div>
      </div>

      {/* Time-Based Exit Condition */}
      {signal.time_based_exit && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          background: "rgba(245, 158, 11, 0.08)",
          border: "1px solid rgba(245, 158, 11, 0.25)",
          borderRadius: "6px",
          padding: "6px 9px",
          fontSize: "10.5px",
          color: "#FBBF24"
        }}>
          <Clock size={13} color="#F59E0B" />
          <span><strong>Exit Rule:</strong> {signal.time_based_exit}</span>
        </div>
      )}

      {/* Recommended Sizing */}
      {signal.recommended_shares && (
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "rgba(139, 92, 246, 0.1)",
          border: "1px solid rgba(139, 92, 246, 0.25)",
          borderRadius: "7px",
          padding: "7px 10px",
          fontSize: "11px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Coins size={14} color="#A78BFA" />
            <span style={{ color: "#DDD6FE", fontWeight: "700" }}>Recommended Sizing:</span>
            <span style={{ color: "#fff", fontWeight: "800" }}>
              {signal.recommended_shares} {symbol?.includes("=X") ? "Lots" : "Shares"}
            </span>
          </div>

          {signal.allocated_amount && (
            <div className="mono" style={{ fontSize: "11px", fontWeight: "700", color: "var(--accent-cyan)" }}>
              {symbol?.includes("=X") ? "$" : "₹"}{signal.allocated_amount.toLocaleString()}
            </div>
          )}
        </div>
      )}

      {/* Confidence Meter */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px", marginBottom: "4px" }}>
          <span style={{ color: "var(--text-muted)" }}>Confidence Probability</span>
          <span className="mono" style={{ fontWeight: "700", color: "#fff" }}>{confidencePct}%</span>
        </div>
        <div style={{ width: "100%", height: "5px", background: "rgba(255,255,255,0.06)", borderRadius: "4px", overflow: "hidden" }}>
          <div style={{ 
            width: `${confidencePct}%`, 
            height: "100%", 
            background: isBuy ? "var(--accent-green)" : isSell ? "var(--accent-red)" : "var(--accent-cyan)",
            transition: "width 0.4s ease"
          }} />
        </div>
      </div>

      {/* Macro Trend Strip if available */}
      {signal.macro_trend && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "10px",
          color: "var(--accent-cyan)",
          background: "rgba(6, 182, 212, 0.06)",
          border: "1px solid rgba(6, 182, 212, 0.2)",
          borderRadius: "6px",
          padding: "5px 8px"
        }}>
          <Sparkles size={11} color="var(--accent-cyan)" />
          <span><strong>1M/1Y Macro:</strong> {signal.macro_trend}</span>
        </div>
      )}

      {/* Synthesized Reason Rationale */}
      <div style={{ fontSize: "10.5px", color: "var(--text-muted)", background: "rgba(0,0,0,0.25)", padding: "7px 9px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.04)", lineHeight: "1.35" }}>
        <span style={{ color: "var(--accent-cyan)", fontWeight: "600" }}>Confluence Rationale: </span>
        {signal.reason}
      </div>

      {/* AI Self-Trained Reinforcement Learning Card */}
      {signal.learning_stats && signal.learning_stats.total_trades > 0 && (
        <div style={{
          background: "linear-gradient(90deg, rgba(6, 182, 212, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)",
          border: "1px solid rgba(6, 182, 212, 0.3)",
          borderRadius: "7px",
          padding: "7px 10px",
          fontSize: "10.5px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "var(--accent-cyan)", fontWeight: "700" }}>
              <Sparkles size={12} color="var(--accent-cyan)" />
              <span>AI Self-Trained Track Record</span>
            </div>
            <span style={{
              fontSize: "9px",
              padding: "1px 5px",
              borderRadius: "4px",
              fontWeight: "700",
              background: (signal.learning_bonus || 0) >= 0 ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
              color: (signal.learning_bonus || 0) >= 0 ? "var(--accent-green)" : "var(--accent-red)"
            }}>
              {(signal.learning_bonus || 0) >= 0 ? "+" : ""}{signal.learning_bonus || 0}% Conf. Boost
            </span>
          </div>
          <div style={{ display: "flex", gap: "10px", fontSize: "10px", color: "var(--text-muted)", marginBottom: "3px" }}>
            <span>Trades: <strong style={{ color: "#fff" }}>{signal.learning_stats.total_trades}</strong></span>
            <span>Win Rate: <strong style={{ color: signal.learning_stats.win_rate >= 50 ? "var(--accent-green)" : "var(--accent-red)" }}>{signal.learning_stats.win_rate}%</strong></span>
            <span>Realized: <strong style={{ color: signal.learning_stats.total_pnl >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>
              {signal.learning_stats.total_pnl >= 0 ? "+" : ""}{liveSnapshot?.currency === "INR" ? "₹" : "$"}{signal.learning_stats.total_pnl.toFixed(2)}
            </strong></span>
          </div>
          {signal.learning_stats.insights && (
            <div style={{ fontSize: "9.5px", color: "var(--text-dim)", fontStyle: "italic" }}>
              {signal.learning_stats.insights}
            </div>
          )}
        </div>
      )}

      {/* Stored Ollama EOD Thesis Card if available */}
      {eod && (
        <div style={{
          background: "rgba(139, 92, 246, 0.06)",
          border: "1px solid rgba(139, 92, 246, 0.2)",
          borderRadius: "6px",
          padding: "7px 9px",
          fontSize: "10px",
          lineHeight: "1.3"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "#C4B5FD", fontWeight: "700" }}>
              <BrainCircuit size={11} />
              <span>Ollama EOD Macro Thesis ({eod.scan_date})</span>
            </div>
            <span style={{ fontSize: "8.5px", color: "var(--text-dim)" }}>{eod.time_horizon}</span>
          </div>
          <div style={{ color: "var(--text-muted)" }}>
            {eod.thesis_reason}
          </div>
        </div>
      )}
    </div>
  );
}
