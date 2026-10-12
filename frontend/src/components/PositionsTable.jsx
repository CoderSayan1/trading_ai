import React, { useState } from "react";
import { XCircle, CheckCircle, TrendingUp, TrendingDown, History, ShieldAlert } from "lucide-react";

export function PositionsTable({ openPositions = [], closedPositions = [], onClosePosition, onCloseAll, currency, onOpenFullHistory }) {
  const [activeTab, setActiveTab] = useState("OPEN");
  const isINR = currency === "INR";
  const defaultSym = isINR ? "₹" : "$";

  const formatPrice = (val, symStr) => {
    if (val === null || val === undefined || isNaN(val)) return "--";
    const num = Number(val);
    const isFx = symStr?.includes("=X") || num < 50;
    return num.toFixed(isFx ? 4 : 2);
  };

  const getSym = (pos) => (pos.currency === "INR" ? "₹" : "$");

  const activePositions = Array.isArray(openPositions) ? openPositions : [];
  const historyPositions = Array.isArray(closedPositions) ? closedPositions : [];

  // Compute overall historical stats for self-training display
  const totalHistory = historyPositions.length;
  const winCount = historyPositions.filter(p => Number(p.realized_pnl) > 0).length;
  const lossCount = historyPositions.filter(p => Number(p.realized_pnl) < 0).length;
  const historyWinRate = totalHistory > 0 ? Math.round((winCount / totalHistory) * 100) : 0;
  const totalRealizedPnl = historyPositions.reduce((acc, p) => acc + (Number(p.realized_pnl) || 0), 0);

  return (
    <div className="glass-panel" style={{ padding: "14px", height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header & Tabs */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => setActiveTab("OPEN")}
            style={{
              border: "none",
              background: "transparent",
              color: activeTab === "OPEN" ? "var(--accent-cyan)" : "var(--text-muted)",
              fontSize: "12px",
              fontWeight: "700",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              paddingBottom: "4px",
              borderBottom: activeTab === "OPEN" ? "2px solid var(--accent-cyan)" : "2px solid transparent"
            }}
          >
            <span>ACTIVE POSITIONS</span>
            <span style={{ 
              background: "rgba(56, 189, 248, 0.2)", 
              padding: "1px 6px", 
              borderRadius: "10px", 
              fontSize: "10px",
              color: "#fff"
            }}>
              {activePositions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("HISTORY")}
            style={{
              border: "none",
              background: "transparent",
              color: activeTab === "HISTORY" ? "var(--accent-cyan)" : "var(--text-muted)",
              fontSize: "12px",
              fontWeight: "700",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              paddingBottom: "4px",
              borderBottom: activeTab === "HISTORY" ? "2px solid var(--accent-cyan)" : "2px solid transparent"
            }}
          >
            <span>TRADE HISTORY & AI TRAINING</span>
            <span style={{ 
              background: "rgba(255, 255, 255, 0.1)", 
              padding: "1px 6px", 
              borderRadius: "10px", 
              fontSize: "10px",
              color: "var(--text-muted)"
            }}>
              {historyPositions.length}
            </span>
          </button>
        </div>

        {activeTab === "OPEN" && activePositions.length > 0 && (
          <button
            onClick={onCloseAll}
            style={{
              background: "rgba(239, 68, 68, 0.15)",
              color: "var(--accent-red)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "6px",
              padding: "4px 10px",
              fontSize: "11px",
              fontWeight: "700",
              cursor: "pointer"
            }}
          >
            CLOSE ALL POSITIONS
          </button>
        )}

        {activeTab === "HISTORY" && onOpenFullHistory && (
          <button
            onClick={onOpenFullHistory}
            style={{
              background: "rgba(6, 182, 212, 0.15)",
              color: "var(--accent-cyan)",
              border: "1px solid rgba(6, 182, 212, 0.35)",
              borderRadius: "6px",
              padding: "4px 10px",
              fontSize: "11px",
              fontWeight: "700",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px"
            }}
          >
            <span>Open Full Execution History Tab</span>
            <span>↗</span>
          </button>
        )}
      </div>

      {/* AI Self-Training Banner on Trade History Tab */}
      {activeTab === "HISTORY" && totalHistory > 0 && (
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
          background: "linear-gradient(90deg, rgba(6, 182, 212, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%)",
          border: "1px solid rgba(6, 182, 212, 0.25)",
          borderRadius: "8px",
          padding: "8px 12px",
          marginBottom: "10px",
          fontSize: "11px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{
              background: "rgba(6, 182, 212, 0.2)",
              color: "var(--accent-cyan)",
              padding: "2px 6px",
              borderRadius: "4px",
              fontSize: "9px",
              fontWeight: "800",
              letterSpacing: "0.5px"
            }}>
              🤖 AI REINFORCEMENT TRAINING
            </span>
            <span style={{ color: "var(--text-muted)" }}>
              Data saved in <code style={{ color: "#38bdf8" }}>executed_trades</code> table feeds directly into prediction weights.
            </span>
          </div>
          <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
            <div>
              <span style={{ color: "var(--text-dim)", fontSize: "10px" }}>Total: </span>
              <span style={{ fontWeight: "700", color: "#fff" }}>{totalHistory}</span>
            </div>
            <div>
              <span style={{ color: "var(--text-dim)", fontSize: "10px" }}>Win Rate: </span>
              <span style={{ fontWeight: "700", color: historyWinRate >= 50 ? "var(--accent-green)" : "var(--accent-red)" }}>
                {historyWinRate}% ({winCount}W / {lossCount}L)
              </span>
            </div>
            <div>
              <span style={{ color: "var(--text-dim)", fontSize: "10px" }}>Realized PnL: </span>
              <span style={{ fontWeight: "700", color: totalRealizedPnl >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>
                {totalRealizedPnl >= 0 ? "+" : "-"}₹{Math.abs(totalRealizedPnl).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Table Content */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {activeTab === "OPEN" ? (
          activePositions.length === 0 ? (
            <div style={{ height: "140px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", fontSize: "12px" }}>
              <History size={24} style={{ marginBottom: "8px", opacity: 0.5 }} />
              <span>No open positions. Use JEV AI signals or place manual orders above.</span>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", textAlign: "left" }}>
              <thead>
                <tr style={{ color: "var(--text-dim)", borderBottom: "1px solid var(--border-subtle)" }}>
                  <th style={{ padding: "8px 6px" }}>Asset</th>
                  <th style={{ padding: "8px 6px" }}>Side</th>
                  <th style={{ padding: "8px 6px" }}>Qty</th>
                  <th style={{ padding: "8px 6px" }}>Entry</th>
                  <th style={{ padding: "8px 6px" }}>Current</th>
                  <th style={{ padding: "8px 6px" }}>Stop-Loss</th>
                  <th style={{ padding: "8px 6px" }}>Take-Profit</th>
                  <th style={{ padding: "8px 6px", textAlign: "right" }}>Unrealized PnL</th>
                  <th style={{ padding: "8px 6px", textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {activePositions.map((pos) => {
                  const pnl = Number(pos.unrealized_pnl || 0);
                  const isProfit = pnl >= 0;
                  const posSym = getSym(pos);
                  return (
                    <tr key={pos.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <td style={{ padding: "8px 6px", fontWeight: "700", color: "#fff" }}>
                        {pos.symbol.replace(".NS", "").replace("=X", "")}
                      </td>
                      <td style={{ padding: "8px 6px" }}>
                        <span style={{ 
                          padding: "2px 6px", 
                          borderRadius: "4px", 
                          fontWeight: "700", 
                          fontSize: "10px",
                          background: pos.side === "BUY" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                          color: pos.side === "BUY" ? "var(--accent-green)" : "var(--accent-red)"
                        }}>
                          {pos.side}
                        </span>
                      </td>
                      <td className="mono" style={{ padding: "8px 6px" }}>{pos.shares}</td>
                      <td className="mono" style={{ padding: "8px 6px" }}>{posSym}{formatPrice(pos.entry_price, pos.symbol)}</td>
                      <td className="mono" style={{ padding: "8px 6px" }}>{posSym}{formatPrice(pos.current_price, pos.symbol)}</td>
                      <td className="mono" style={{ padding: "8px 6px", color: "var(--accent-red)" }}>{posSym}{formatPrice(pos.stop_loss, pos.symbol)}</td>
                      <td className="mono" style={{ padding: "8px 6px", color: "var(--accent-green)" }}>{posSym}{formatPrice(pos.take_profit, pos.symbol)}</td>
                      <td className="mono" style={{ padding: "8px 6px", textAlign: "right", fontWeight: "700", color: isProfit ? "var(--accent-green)" : "var(--accent-red)" }}>
                        {isProfit ? "+" : ""}{posSym}{pnl.toFixed(2)} ({isProfit ? "+" : ""}{pos.pnl_pct || 0}%)
                      </td>
                      <td style={{ padding: "8px 6px", textAlign: "right" }}>
                        <button
                          onClick={() => onClosePosition(pos.id)}
                          style={{
                            background: "rgba(255,255,255,0.06)",
                            border: "none",
                            color: "var(--text-muted)",
                            padding: "3px 8px",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "10px",
                            fontWeight: "600"
                          }}
                        >
                          Exit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        ) : (
          /* Closed Positions History (Persisted in executed_trades DB table) */
          historyPositions && historyPositions.length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", textAlign: "left" }}>
              <thead>
                <tr style={{ color: "var(--text-dim)", borderBottom: "1px solid var(--border-subtle)" }}>
                  <th style={{ padding: "8px 6px" }}>Asset</th>
                  <th style={{ padding: "8px 6px" }}>Side</th>
                  <th style={{ padding: "8px 6px" }}>Qty</th>
                  <th style={{ padding: "8px 6px" }}>Entry</th>
                  <th style={{ padding: "8px 6px" }}>Exit</th>
                  <th style={{ padding: "8px 6px" }}>Outcome</th>
                  <th style={{ padding: "8px 6px" }}>Reason</th>
                  <th style={{ padding: "8px 6px", textAlign: "right" }}>Realized PnL (₹)</th>
                  <th style={{ padding: "8px 6px", textAlign: "right" }}>Closed At</th>
                </tr>
              </thead>
              <tbody>
                {historyPositions.slice().reverse().map((pos) => {
                  const pnl = Number(pos.realized_pnl || 0);
                  const pnlPct = Number(pos.pnl_pct || 0);
                  const isProfit = pnl > 0;
                  const isLoss = pnl < 0;
                  const posSym = getSym(pos);
                  const outcome = pos.outcome || (isProfit ? "WIN" : isLoss ? "LOSS" : "BREAKEVEN");
                  const exitReason = pos.exit_reason || "MANUAL_CLOSE";

                  return (
                    <tr key={pos.id || pos.order_id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <td style={{ padding: "8px 6px", fontWeight: "700", color: "#fff" }}>
                        {pos.symbol.replace(".NS", "").replace("=X", "")}
                      </td>
                      <td style={{ padding: "8px 6px" }}>
                        <span style={{ 
                          padding: "2px 6px", 
                          borderRadius: "4px", 
                          fontWeight: "700", 
                          fontSize: "10px",
                          background: pos.side === "BUY" ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                          color: pos.side === "BUY" ? "var(--accent-green)" : "var(--accent-red)"
                        }}>
                          {pos.side}
                        </span>
                      </td>
                      <td className="mono" style={{ padding: "8px 6px" }}>{pos.shares || 1}</td>
                      <td className="mono" style={{ padding: "8px 6px" }}>{posSym}{formatPrice(pos.entry_price, pos.symbol)}</td>
                      <td className="mono" style={{ padding: "8px 6px" }}>{posSym}{formatPrice(pos.close_price, pos.symbol)}</td>
                      <td style={{ padding: "8px 6px" }}>
                        <span style={{
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontSize: "9px",
                          fontWeight: "800",
                          letterSpacing: "0.5px",
                          background: outcome === "WIN" ? "rgba(16, 185, 129, 0.2)" : outcome === "LOSS" ? "rgba(239, 68, 68, 0.2)" : "rgba(245, 158, 11, 0.2)",
                          color: outcome === "WIN" ? "var(--accent-green)" : outcome === "LOSS" ? "var(--accent-red)" : "var(--accent-amber)",
                          border: `1px solid ${outcome === "WIN" ? "rgba(16, 185, 129, 0.4)" : outcome === "LOSS" ? "rgba(239, 68, 68, 0.4)" : "rgba(245, 158, 11, 0.4)"}`
                        }}>
                          {outcome}
                        </span>
                      </td>
                      <td style={{ padding: "8px 6px", color: "var(--text-dim)", fontSize: "10px" }}>
                        {exitReason.replace("_", " ")}
                      </td>
                      <td className="mono" style={{ padding: "8px 6px", textAlign: "right", fontWeight: "700", color: isProfit ? "var(--accent-green)" : isLoss ? "var(--accent-red)" : "var(--text-muted)" }}>
                        <div>
                          <span>{isProfit ? "+" : "-"}₹{Math.abs(pnl).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          <span style={{ fontSize: "9px", marginLeft: "3px", opacity: 0.8 }}>({isProfit ? "+" : ""}{pnlPct.toFixed(2)}%)</span>
                        </div>
                        {pos.currency === "USD" && (
                          <div style={{ fontSize: "9px", color: "var(--text-dim)", fontWeight: "400" }}>
                            Orig: {isProfit ? "+" : ""}${Number(pos.realized_pnl_usd || (pnl / 96.07)).toFixed(2)}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "8px 6px", textAlign: "right", color: "var(--text-dim)", fontSize: "10px" }}>
                        {pos.closed_at || "--"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div style={{ height: "140px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", fontSize: "12px", gap: "6px" }}>
              <History size={24} style={{ opacity: 0.4 }} />
              <span>No closed trades in database table yet.</span>
              <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>When you buy/sell and close positions, trade PnL is stored and trains the AI model.</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
