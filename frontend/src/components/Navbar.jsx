import React from "react";
import { Activity, ShieldCheck, DollarSign, Clock, RefreshCw, Zap, TrendingUp, TrendingDown, History } from "lucide-react";

export function Navbar({ 
  sessions, 
  account, 
  currency, 
  onCurrencyChange, 
  connected,
  activeTab = "TERMINAL",
  onTabChange,
  historyCount = 0
}) {
  const isINR = currency === "INR";
  const sym = isINR ? "₹" : "$";

  return (
    <header className="glass-panel" style={{ margin: "12px 16px", padding: "10px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        
        {/* Brand & Market Session */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ 
              width: "36px", 
              height: "36px", 
              borderRadius: "8px", 
              background: "linear-gradient(135deg, #06B6D4 0%, #3B82F6 50%, #8B5CF6 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 15px rgba(6,182,212,0.4)"
            }}>
              <Zap size={20} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: "16px", fontWeight: "800", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>TRADING</span>
                <span style={{ color: "var(--accent-cyan)", fontSize: "12px", background: "rgba(6,182,212,0.12)", padding: "2px 8px", borderRadius: "12px", border: "1px solid rgba(6,182,212,0.3)" }}>
                  DUAL-BRAIN
                </span>
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>NSE/BSE & Global Forex System 1 Engine</span>
              </div>
            </div>
          </div>

          {/* Market Status Pill */}
          {sessions && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.03)", padding: "4px 10px", borderRadius: "20px", border: "1px solid var(--border-subtle)", fontSize: "11px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ 
                  width: "6px", 
                  height: "6px", 
                  borderRadius: "50%", 
                  backgroundColor: sessions.nse_equity === "OPEN" ? "var(--accent-green)" : "var(--accent-amber)" 
                }}></span>
                <span style={{ color: "var(--text-muted)" }}>NSE:</span>
                <strong style={{ color: sessions.nse_equity === "OPEN" ? "var(--accent-green)" : "var(--accent-amber)" }}>
                  {sessions.is_nse_holiday ? `HOLIDAY (${sessions.nse_holiday_name})` : sessions.nse_equity}
                </strong>
              </div>
              <span style={{ color: "var(--border-subtle)" }}>|</span>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ 
                  width: "6px", 
                  height: "6px", 
                  borderRadius: "50%", 
                  backgroundColor: sessions.global_forex === "OPEN" ? "var(--accent-green)" : "var(--accent-dim)" 
                }}></span>
                <span style={{ color: "var(--text-muted)" }}>Forex:</span>
                <strong style={{ color: sessions.global_forex === "OPEN" ? "var(--accent-green)" : "var(--text-dim)" }}>
                  {sessions.global_forex}
                </strong>
              </div>
              <span style={{ color: "var(--border-subtle)" }}>|</span>
              <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--text-dim)" }}>
                <Clock size={12} />
                <span>{sessions.current_time_ist ? sessions.current_time_ist.split(" ")[1] : ""} IST</span>
              </div>
            </div>
          )}
        </div>

        {/* Central Top-Level Navigation Tabs */}
        <div style={{
          display: "flex",
          background: "rgba(0, 0, 0, 0.4)",
          borderRadius: "10px",
          padding: "3px",
          border: "1px solid var(--border-subtle)"
        }}>
          <button
            onClick={() => onTabChange && onTabChange("TERMINAL")}
            style={{
              border: "none",
              background: activeTab === "TERMINAL" ? "linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)" : "transparent",
              color: activeTab === "TERMINAL" ? "#000" : "var(--text-muted)",
              padding: "6px 14px",
              borderRadius: "8px",
              fontWeight: "800",
              fontSize: "12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.2s"
            }}
          >
            <Activity size={14} />
            <span>LIVE TERMINAL</span>
          </button>

          <button
            onClick={() => onTabChange && onTabChange("HISTORY")}
            style={{
              border: "none",
              background: activeTab === "HISTORY" ? "linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)" : "transparent",
              color: activeTab === "HISTORY" ? "#000" : "var(--text-muted)",
              padding: "6px 14px",
              borderRadius: "8px",
              fontWeight: "800",
              fontSize: "12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.2s"
            }}
          >
            <History size={14} />
            <span>EXECUTION HISTORY</span>
            {historyCount > 0 && (
              <span style={{
                background: activeTab === "HISTORY" ? "rgba(0,0,0,0.3)" : "rgba(6,182,212,0.2)",
                color: activeTab === "HISTORY" ? "#000" : "var(--accent-cyan)",
                fontSize: "10px",
                padding: "1px 6px",
                borderRadius: "10px",
                fontWeight: "800"
              }}>
                {historyCount}
              </span>
            )}
          </button>
        </div>

        {/* Currency Switcher & Account Metrics */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          
          {/* INR / USD Toggle */}
          <div style={{ display: "flex", background: "rgba(0,0,0,0.4)", borderRadius: "8px", padding: "3px", border: "1px solid var(--border-subtle)" }}>
            <button
              onClick={() => onCurrencyChange("INR")}
              style={{
                border: "none",
                background: isINR ? "var(--accent-cyan)" : "transparent",
                color: isINR ? "#000" : "var(--text-muted)",
                padding: "4px 12px",
                borderRadius: "6px",
                fontWeight: "700",
                fontSize: "12px",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              ₹ INR
            </button>
            <button
              onClick={() => onCurrencyChange("USD")}
              style={{
                border: "none",
                background: !isINR ? "var(--accent-cyan)" : "transparent",
                color: !isINR ? "#000" : "var(--text-muted)",
                padding: "4px 12px",
                borderRadius: "6px",
                fontWeight: "700",
                fontSize: "12px",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              $ USD
            </button>
          </div>

          {/* Account Metrics Bar */}
          {account && (
            <div style={{ display: "flex", alignItems: "center", gap: "16px", background: "rgba(255,255,255,0.02)", padding: "6px 14px", borderRadius: "10px", border: "1px solid var(--border-subtle)" }}>
              <div>
                <div style={{ fontSize: "10px", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Paper Capital</div>
                <div className="mono" style={{ fontSize: "13px", fontWeight: "700", color: "#fff" }}>
                  {sym}{account.balance?.toLocaleString()}
                </div>
              </div>
              <div style={{ width: "1px", height: "24px", background: "var(--border-subtle)" }}></div>
              <div>
                <div style={{ fontSize: "10px", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Equity</div>
                <div className="mono" style={{ fontSize: "13px", fontWeight: "700", color: "var(--accent-cyan)" }}>
                  {sym}{account.equity?.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div style={{ width: "1px", height: "24px", background: "var(--border-subtle)" }}></div>
              <div>
                <div style={{ fontSize: "10px", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Daily PnL</div>
                <div className="mono" style={{ 
                  fontSize: "13px", 
                  fontWeight: "700", 
                  color: account.daily_pnl >= 0 ? "var(--accent-green)" : "var(--accent-red)",
                  display: "flex",
                  alignItems: "center",
                  gap: "2px"
                }}>
                  {account.daily_pnl >= 0 ? "+" : "-"}{sym}{Math.abs(account.daily_pnl || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div style={{ width: "1px", height: "24px", background: "var(--border-subtle)" }}></div>
              <div>
                <div style={{ fontSize: "10px", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Win Rate</div>
                <div className="mono" style={{ fontSize: "13px", fontWeight: "700", color: "var(--accent-purple)" }}>
                  {account.win_rate?.toFixed(1)}%
                </div>
              </div>
            </div>
          )}

          {/* Connection Indicator */}
          {(() => {
            const allClosed = sessions && sessions.nse_equity === "CLOSED" && sessions.global_forex === "CLOSED";
            const statusColor = !connected ? "var(--accent-red)" : (allClosed ? "var(--accent-amber)" : "var(--accent-green)");
            const statusBg = !connected ? "rgba(239,68,68,0.08)" : (allClosed ? "rgba(245,158,11,0.08)" : "rgba(16,185,129,0.08)");
            const statusBorder = !connected ? "rgba(239,68,68,0.2)" : (allClosed ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.2)");
            const label = !connected ? "CONNECTING" : (allClosed ? "MARKET CLOSED (WEEKEND)" : "LIVE FEED");

            return (
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "6px", 
                fontSize: "11px",
                color: statusColor,
                background: statusBg,
                padding: "4px 8px",
                borderRadius: "6px",
                border: `1px solid ${statusBorder}`
              }}>
                <span style={{ 
                  width: "8px", 
                  height: "8px", 
                  borderRadius: "50%", 
                  backgroundColor: statusColor
                }} className={!allClosed && connected ? "pulsing-dot" : ""}></span>
                <span>{label}</span>
              </div>
            );
          })()}

        </div>

      </div>
    </header>
  );
}
