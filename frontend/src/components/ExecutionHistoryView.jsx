import React, { useState, useEffect, useMemo } from "react";
import { 
  History, Search, RefreshCw, Filter, TrendingUp, TrendingDown, 
  CheckCircle2, XCircle, AlertCircle, Sparkles, ArrowUpRight, ArrowDownRight,
  Database, ShieldCheck, Download, Calendar, Layers
} from "lucide-react";
import { api } from "../services/api";

export function ExecutionHistoryView({ currency = "INR", onSelectSymbol, onSwitchToTerminal }) {
  const [executions, setExecutions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sideFilter, setSideFilter] = useState("ALL"); // ALL, BUY, SELL
  const [outcomeFilter, setOutcomeFilter] = useState("ALL"); // ALL, WIN, LOSS, OPEN
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL, OPEN, CLOSED
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isINR = currency === "INR";
  const defaultSym = isINR ? "₹" : "$";

  const fetchHistory = async () => {
    setIsRefreshing(true);
    try {
      const data = await api.getExecutions(null, null, 1000);
      if (data) {
        setExecutions(data.trades || []);
        setStats(data.stats || null);
      }
    } catch (err) {
      console.error("Failed to load execution history:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const formatPrice = (val, symStr) => {
    if (val === null || val === undefined || isNaN(val)) return "--";
    const num = Number(val);
    const isFx = symStr?.includes("=X") || num < 50;
    return num.toFixed(isFx ? 4 : 2);
  };

  const getSym = (pos) => (pos.currency === "INR" ? "₹" : "$");

  // Filtered executions
  const filteredTrades = useMemo(() => {
    return executions.filter(t => {
      // Search
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchesSym = t.symbol.toLowerCase().includes(query);
        const matchesId = (t.order_id || "").toLowerCase().includes(query);
        if (!matchesSym && !matchesId) return false;
      }
      // Side filter
      if (sideFilter !== "ALL" && t.side !== sideFilter) {
        return false;
      }
      // Outcome filter
      if (outcomeFilter !== "ALL") {
        const actualOutcome = t.outcome || (t.status === "OPEN" ? "OPEN" : (Number(t.realized_pnl) > 0 ? "WIN" : "LOSS"));
        if (actualOutcome !== outcomeFilter) return false;
      }
      // Status filter
      if (statusFilter !== "ALL" && t.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [executions, searchTerm, sideFilter, outcomeFilter, statusFilter]);

  // Derived Metrics
  const metrics = useMemo(() => {
    const closed = executions.filter(t => t.status === "CLOSED");
    const totalClosed = closed.length;
    const wins = closed.filter(t => Number(t.realized_pnl) > 0);
    const losses = closed.filter(t => Number(t.realized_pnl) < 0);
    const winRate = totalClosed > 0 ? Math.round((wins.length / totalClosed) * 100) : 0;

    const totalRealizedPnl = closed.reduce((acc, t) => acc + (Number(t.realized_pnl) || 0), 0);
    const totalWinPnl = wins.reduce((acc, t) => acc + Number(t.realized_pnl), 0);
    const totalLossPnl = Math.abs(losses.reduce((acc, t) => acc + Number(t.realized_pnl), 0));
    const profitFactor = totalLossPnl > 0 ? (totalWinPnl / totalLossPnl).toFixed(2) : (totalWinPnl > 0 ? "∞" : "0.00");
    const avgTradePnl = totalClosed > 0 ? (totalRealizedPnl / totalClosed).toFixed(2) : "0.00";

    const buys = closed.filter(t => t.side === "BUY");
    const buyWins = buys.filter(t => Number(t.realized_pnl) > 0).length;
    const buyWinRate = buys.length > 0 ? Math.round((buyWins / buys.length) * 100) : 0;

    const sells = closed.filter(t => t.side === "SELL");
    const sellWins = sells.filter(t => Number(t.realized_pnl) > 0).length;
    const sellWinRate = sells.length > 0 ? Math.round((sellWins / sells.length) * 100) : 0;

    return {
      totalExecutions: executions.length,
      totalClosed,
      winCount: wins.length,
      lossCount: losses.length,
      winRate,
      totalRealizedPnl,
      profitFactor,
      avgTradePnl,
      buyWinRate,
      sellWinRate,
      buysCount: buys.length,
      sellsCount: sells.length,
      openCount: executions.filter(t => t.status === "OPEN").length
    };
  }, [executions]);

  const exportCSV = () => {
    if (executions.length === 0) return;
    const headers = ["Order ID", "Symbol", "Side", "Shares", "Entry Price", "Exit Price", "Stop Loss", "Take Profit", "Realized PnL", "PnL %", "Outcome", "Status", "Exit Reason", "Opened At", "Closed At"];
    const rows = executions.map(t => [
      t.order_id,
      t.symbol,
      t.side,
      t.shares,
      t.entry_price,
      t.close_price || "",
      t.stop_loss || "",
      t.take_profit || "",
      t.realized_pnl || 0,
      t.pnl_pct || 0,
      t.outcome || "",
      t.status,
      t.exit_reason || "",
      t.opened_at,
      t.closed_at || ""
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `trading_execution_history_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{
      height: "100%",
      display: "flex",
      flexDirection: "column",
      gap: "14px",
      overflowY: "auto",
      padding: "16px 20px"
    }}>
      {/* Top Banner / Breadcrumb & Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "38px",
            height: "38px",
            borderRadius: "10px",
            background: "linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%)",
            border: "1px solid rgba(6, 182, 212, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <Database size={20} color="var(--accent-cyan)" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "#fff" }}>
                TRADE EXECUTION HISTORY & DATABASE
              </h2>
              <span style={{
                background: "rgba(16, 185, 129, 0.15)",
                border: "1px solid rgba(16, 185, 129, 0.35)",
                color: "var(--accent-green)",
                fontSize: "10px",
                fontWeight: "800",
                padding: "2px 8px",
                borderRadius: "12px"
              }}>
                TABLE: executed_trades
              </span>
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
              Persistent storage of buy/sell orders, profit & loss, and adaptive AI training feedback.
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={fetchHistory}
            disabled={isRefreshing}
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "8px",
              padding: "7px 12px",
              color: "#fff",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? "pulsing-dot" : ""} />
            <span>Refresh</span>
          </button>

          <button
            onClick={exportCSV}
            style={{
              background: "rgba(6, 182, 212, 0.12)",
              border: "1px solid rgba(6, 182, 212, 0.3)",
              borderRadius: "8px",
              padding: "7px 12px",
              color: "var(--accent-cyan)",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>

          {onSwitchToTerminal && (
            <button
              onClick={onSwitchToTerminal}
              style={{
                background: "linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)",
                border: "none",
                borderRadius: "8px",
                padding: "7px 14px",
                color: "#000",
                fontSize: "12px",
                fontWeight: "800",
                cursor: "pointer"
              }}
            >
              ← Back to Live Terminal
            </button>
          )}
        </div>
      </div>

      {/* KPI Performance Cards Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "12px"
      }}>
        {/* Total Trades */}
        <div className="glass-panel" style={{ padding: "12px 14px" }}>
          <div style={{ fontSize: "11px", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Total Executed
          </div>
          <div className="mono" style={{ fontSize: "22px", fontWeight: "800", color: "#fff", marginTop: "4px" }}>
            {metrics.totalExecutions}
          </div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>
            {metrics.totalClosed} Closed | {metrics.openCount} Active Open
          </div>
        </div>

        {/* Win Rate */}
        <div className="glass-panel" style={{ padding: "12px 14px" }}>
          <div style={{ fontSize: "11px", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Historical Win Rate
          </div>
          <div className="mono" style={{ 
            fontSize: "22px", 
            fontWeight: "800", 
            color: metrics.winRate >= 50 ? "var(--accent-green)" : (metrics.totalClosed > 0 ? "var(--accent-red)" : "#fff"), 
            marginTop: "4px" 
          }}>
            {metrics.winRate}%
          </div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>
            {metrics.winCount} Wins / {metrics.lossCount} Losses
          </div>
        </div>

        {/* Total Realized PnL */}
        <div className="glass-panel" style={{ padding: "12px 14px" }}>
          <div style={{ fontSize: "11px", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Total Realized PnL (₹)
          </div>
          <div className="mono" style={{ 
            fontSize: "22px", 
            fontWeight: "800", 
            color: metrics.totalRealizedPnl >= 0 ? "var(--accent-green)" : "var(--accent-red)", 
            marginTop: "4px" 
          }}>
            {metrics.totalRealizedPnl >= 0 ? "+" : "-"}₹{Math.abs(metrics.totalRealizedPnl).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>
            Avg PnL/Trade: {Number(metrics.avgTradePnl) >= 0 ? "+" : "-"}₹{Math.abs(Number(metrics.avgTradePnl)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        {/* Profit Factor */}
        <div className="glass-panel" style={{ padding: "12px 14px" }}>
          <div style={{ fontSize: "11px", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Profit Factor
          </div>
          <div className="mono" style={{ fontSize: "22px", fontWeight: "800", color: "var(--accent-cyan)", marginTop: "4px" }}>
            {metrics.profitFactor}
          </div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>
            Gross Wins vs Gross Losses
          </div>
        </div>

        {/* Directional Edge */}
        <div className="glass-panel" style={{ padding: "12px 14px" }}>
          <div style={{ fontSize: "11px", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Directional Edge
          </div>
          <div style={{ display: "flex", gap: "10px", marginTop: "6px", alignItems: "baseline" }}>
            <span style={{ fontSize: "12px", color: "var(--accent-green)", fontWeight: "700" }}>
              BUY: {metrics.buyWinRate}%
            </span>
            <span style={{ color: "var(--border-subtle)" }}>|</span>
            <span style={{ fontSize: "12px", color: "var(--accent-red)", fontWeight: "700" }}>
              SELL: {metrics.sellWinRate}%
            </span>
          </div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>
            {metrics.buysCount} Longs / {metrics.sellsCount} Shorts
          </div>
        </div>

        {/* AI Reinforcement Weight */}
        <div className="glass-panel" style={{ 
          padding: "12px 14px",
          background: "linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)",
          border: "1px solid rgba(6, 182, 212, 0.3)"
        }}>
          <div style={{ fontSize: "11px", color: "var(--accent-cyan)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "700", display: "flex", alignItems: "center", gap: "4px" }}>
            <Sparkles size={12} />
            <span>AI Self-Trained Bias</span>
          </div>
          <div className="mono" style={{ 
            fontSize: "20px", 
            fontWeight: "800", 
            color: (stats?.confidence_bonus || 0) >= 0 ? "var(--accent-green)" : "var(--accent-red)", 
            marginTop: "4px" 
          }}>
            {(stats?.confidence_bonus || 0) >= 0 ? "+" : ""}{stats?.confidence_bonus ? (stats.confidence_bonus * 100).toFixed(0) : "0"}%
          </div>
          <div style={{ fontSize: "10px", color: "#C4B5FD", marginTop: "4px", lineHeight: "1.2" }}>
            {stats?.insights || "Database training automatically calibrates live JEV confidence."}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel" style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        {/* Search */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(0,0,0,0.3)", padding: "6px 12px", borderRadius: "8px", border: "1px solid var(--border-subtle)", width: "240px" }}>
          <Search size={14} color="var(--text-dim)" />
          <input
            type="text"
            placeholder="Filter by Symbol / ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              background: "transparent",
              border: "none",
              color: "#fff",
              fontSize: "12px",
              outline: "none",
              width: "100%"
            }}
          />
        </div>

        {/* Filter Pills */}
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          {/* Side Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px", background: "rgba(255,255,255,0.03)", padding: "3px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}>
            <span style={{ fontSize: "10px", color: "var(--text-dim)", padding: "0 6px" }}>SIDE:</span>
            {["ALL", "BUY", "SELL"].map(s => (
              <button
                key={s}
                onClick={() => setSideFilter(s)}
                style={{
                  border: "none",
                  background: sideFilter === s ? (s === "BUY" ? "rgba(16,185,129,0.3)" : s === "SELL" ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.15)") : "transparent",
                  color: sideFilter === s ? "#fff" : "var(--text-muted)",
                  fontSize: "10.5px",
                  fontWeight: "700",
                  padding: "3px 8px",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Outcome Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px", background: "rgba(255,255,255,0.03)", padding: "3px", borderRadius: "6px", border: "1px solid var(--border-subtle)" }}>
            <span style={{ fontSize: "10px", color: "var(--text-dim)", padding: "0 6px" }}>OUTCOME:</span>
            {["ALL", "WIN", "LOSS", "OPEN"].map(o => (
              <button
                key={o}
                onClick={() => setOutcomeFilter(o)}
                style={{
                  border: "none",
                  background: outcomeFilter === o ? (o === "WIN" ? "rgba(16,185,129,0.3)" : o === "LOSS" ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.15)") : "transparent",
                  color: outcomeFilter === o ? "#fff" : "var(--text-muted)",
                  fontSize: "10.5px",
                  fontWeight: "700",
                  padding: "3px 8px",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
              >
                {o}
              </button>
            ))}
          </div>

          <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>
            Showing <strong>{filteredTrades.length}</strong> of {executions.length} trades
          </span>
        </div>
      </div>

      {/* Main Execution History Table */}
      <div className="glass-panel" style={{ flex: 1, padding: "14px", overflowY: "auto" }}>
        {loading ? (
          <div style={{ height: "200px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", gap: "10px" }}>
            <RefreshCw className="pulsing-dot" size={18} />
            <span>Loading trade records from executed_trades table...</span>
          </div>
        ) : filteredTrades.length === 0 ? (
          <div style={{ height: "240px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", gap: "8px" }}>
            <History size={36} style={{ opacity: 0.4 }} />
            <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-muted)" }}>
              No execution records match your filter
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-dim)", maxWidth: "400px", textAlign: "center" }}>
              When you buy or sell stocks in the terminal, every order entry, target, exit price, and realized profit/loss is permanently logged into the database.
            </div>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", textAlign: "left" }}>
            <thead>
              <tr style={{ color: "var(--text-dim)", borderBottom: "1px solid var(--border-subtle)" }}>
                <th style={{ padding: "10px 8px" }}>Order ID</th>
                <th style={{ padding: "10px 8px" }}>Asset</th>
                <th style={{ padding: "10px 8px" }}>Side</th>
                <th style={{ padding: "10px 8px" }}>Qty</th>
                <th style={{ padding: "10px 8px" }}>Entry Price</th>
                <th style={{ padding: "10px 8px" }}>Exit Price</th>
                <th style={{ padding: "10px 8px" }}>Stop-Loss</th>
                <th style={{ padding: "10px 8px" }}>Take-Profit</th>
                <th style={{ padding: "10px 8px" }}>Outcome</th>
                <th style={{ padding: "10px 8px" }}>Exit Reason</th>
                <th style={{ padding: "10px 8px", textAlign: "right" }}>Realized PnL (₹)</th>
                <th style={{ padding: "10px 8px" }}>Opened At</th>
                <th style={{ padding: "10px 8px" }}>Closed At</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.map((trade) => {
                const pnl = Number(trade.realized_pnl || 0);
                const pnlPct = Number(trade.pnl_pct || 0);
                const isProfit = pnl > 0;
                const isLoss = pnl < 0;
                const tradeSym = getSym(trade);
                const outcome = trade.outcome || (trade.status === "OPEN" ? "OPEN" : (isProfit ? "WIN" : isLoss ? "LOSS" : "BREAKEVEN"));
                const exitReason = trade.exit_reason || (trade.status === "OPEN" ? "ACTIVE" : "MANUAL");

                return (
                  <tr 
                    key={trade.id || trade.order_id} 
                    style={{ 
                      borderBottom: "1px solid rgba(255,255,255,0.03)",
                      transition: "background 0.15s ease"
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* Order ID */}
                    <td className="mono" style={{ padding: "10px 8px", color: "var(--accent-cyan)", fontSize: "10.5px" }}>
                      {trade.order_id}
                    </td>

                    {/* Asset Symbol */}
                    <td style={{ padding: "10px 8px" }}>
                      <div 
                        onClick={() => onSelectSymbol && onSelectSymbol(trade.symbol)}
                        style={{ fontWeight: "700", color: "#fff", cursor: onSelectSymbol ? "pointer" : "default", display: "flex", alignItems: "center", gap: "6px" }}
                      >
                        <span>{trade.symbol.replace(".NS", "").replace("=X", "")}</span>
                        <span style={{ fontSize: "9px", color: "var(--text-dim)", background: "rgba(255,255,255,0.06)", padding: "1px 4px", borderRadius: "3px" }}>
                          {trade.currency}
                        </span>
                      </div>
                    </td>

                    {/* Side */}
                    <td style={{ padding: "10px 8px" }}>
                      <span style={{
                        padding: "2px 7px",
                        borderRadius: "4px",
                        fontWeight: "800",
                        fontSize: "10px",
                        background: trade.side === "BUY" ? "rgba(16, 185, 129, 0.18)" : "rgba(239, 68, 68, 0.18)",
                        color: trade.side === "BUY" ? "var(--accent-green)" : "var(--accent-red)",
                        border: `1px solid ${trade.side === "BUY" ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`
                      }}>
                        {trade.side}
                      </span>
                    </td>

                    {/* Quantity */}
                    <td className="mono" style={{ padding: "10px 8px" }}>
                      {trade.shares}
                    </td>

                    {/* Entry Price */}
                    <td className="mono" style={{ padding: "10px 8px" }}>
                      {tradeSym}{formatPrice(trade.entry_price, trade.symbol)}
                    </td>

                    {/* Exit Price */}
                    <td className="mono" style={{ padding: "10px 8px" }}>
                      {trade.close_price ? `${tradeSym}${formatPrice(trade.close_price, trade.symbol)}` : (
                        <span style={{ color: "var(--accent-cyan)", fontStyle: "italic", fontSize: "10px" }}>OPEN</span>
                      )}
                    </td>

                    {/* Stop-Loss */}
                    <td className="mono" style={{ padding: "10px 8px", color: "var(--accent-red)" }}>
                      {trade.stop_loss ? `${tradeSym}${formatPrice(trade.stop_loss, trade.symbol)}` : "--"}
                    </td>

                    {/* Take-Profit */}
                    <td className="mono" style={{ padding: "10px 8px", color: "var(--accent-green)" }}>
                      {trade.take_profit ? `${tradeSym}${formatPrice(trade.take_profit, trade.symbol)}` : "--"}
                    </td>

                    {/* Outcome Badge */}
                    <td style={{ padding: "10px 8px" }}>
                      <span style={{
                        padding: "2px 7px",
                        borderRadius: "4px",
                        fontSize: "9.5px",
                        fontWeight: "800",
                        letterSpacing: "0.5px",
                        background: outcome === "WIN" ? "rgba(16, 185, 129, 0.2)" : outcome === "LOSS" ? "rgba(239, 68, 68, 0.2)" : outcome === "OPEN" ? "rgba(56, 189, 248, 0.2)" : "rgba(245, 158, 11, 0.2)",
                        color: outcome === "WIN" ? "var(--accent-green)" : outcome === "LOSS" ? "var(--accent-red)" : outcome === "OPEN" ? "var(--accent-cyan)" : "var(--accent-amber)",
                        border: `1px solid ${outcome === "WIN" ? "rgba(16, 185, 129, 0.4)" : outcome === "LOSS" ? "rgba(239, 68, 68, 0.4)" : outcome === "OPEN" ? "rgba(56, 189, 248, 0.4)" : "rgba(245, 158, 11, 0.4)"}`
                      }}>
                        {outcome}
                      </span>
                    </td>

                    {/* Exit Reason */}
                    <td style={{ padding: "10px 8px", color: "var(--text-dim)", fontSize: "10.5px" }}>
                      {exitReason.replace(/_/g, " ")}
                    </td>

                    {/* Realized PnL */}
                    <td className="mono" style={{ padding: "10px 8px", textAlign: "right", fontWeight: "800", color: isProfit ? "var(--accent-green)" : isLoss ? "var(--accent-red)" : "var(--text-muted)" }}>
                      {trade.status === "OPEN" ? (
                        <span style={{ color: "var(--accent-cyan)", fontSize: "10px" }}>ACTIVE</span>
                      ) : (
                        <div>
                          <div style={{ fontSize: "12px", letterSpacing: "0.2px" }}>
                            {isProfit ? "+" : "-"}₹{Math.abs(pnl).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            <span style={{ fontSize: "9.5px", marginLeft: "4px", opacity: 0.85 }}>({isProfit ? "+" : ""}{pnlPct.toFixed(2)}%)</span>
                          </div>
                          {trade.currency === "USD" && (
                            <div style={{ fontSize: "9.5px", color: "var(--text-dim)", fontWeight: "500", marginTop: "1px" }}>
                              Orig: {isProfit ? "+" : ""}${Number(trade.realized_pnl_usd || (pnl / 96.07)).toFixed(2)} USD
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Opened At */}
                    <td style={{ padding: "10px 8px", color: "var(--text-dim)", fontSize: "10px" }}>
                      {trade.opened_at || "--"}
                    </td>

                    {/* Closed At */}
                    <td style={{ padding: "10px 8px", color: "var(--text-dim)", fontSize: "10px" }}>
                      {trade.closed_at || "--"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
