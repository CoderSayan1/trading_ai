import React, { useState, useEffect, useRef } from "react";
import { Navbar } from "./components/Navbar";
import { Watchlist } from "./components/Watchlist";
import { CandlestickChart } from "./components/CandlestickChart";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { JevDecisionPanel } from "./components/JevDecisionPanel";
import { TradeExecutionPanel } from "./components/TradeExecutionPanel";
import { PositionsTable } from "./components/PositionsTable";
import { ExecutionHistoryView } from "./components/ExecutionHistoryView";
import { useTradingSocket } from "./hooks/useTradingSocket";
import { api } from "./services/api";
import { AlertCircle, CheckCircle } from "lucide-react";

export function App() {
  const [currentTab, setCurrentTab] = useState("TERMINAL"); // "TERMINAL" | "HISTORY"
  const [selectedSymbol, setSelectedSymbol] = useState("RELIANCE.NS");
  const [currency, setCurrency] = useState("INR");
  const [assets, setAssets] = useState(null);
  const [sessions, setSessions] = useState(null);
  const [candles, setCandles] = useState([]);
  const [strategy, setStrategy] = useState(null);
  const [positionsData, setPositionsData] = useState({ open: [], closed: [] });
  const [accountRest, setAccountRest] = useState(null);
  const [restSignal, setRestSignal] = useState(null);
  const [toast, setToast] = useState(null);

  // WebSocket Live Hook
  const {
    liveCandle,
    snapshot,
    jevSignal,
    accountInr,
    accountUsd,
    openPositions,
    latestAlert,
    connected,
  } = useTradingSocket(selectedSymbol);

  // Instant pre-fetch of JEV Decision when symbol changes so UI doesn't wait for socket tick
  useEffect(() => {
    let active = true;
    api.getJevDecision(selectedSymbol).then(res => {
      if (active && res) setRestSignal(res);
    }).catch(() => {});
    return () => { active = false; };
  }, [selectedSymbol]);

  // Initial Data & Account Summary Fetch
  const fetchAccount = async (curr = currency) => {
    try {
      const acct = await api.getAccount(curr);
      if (acct) setAccountRest(acct);
    } catch (err) {
      console.error("Error fetching account:", err);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const [assetData, sessionData, stratData, posData, acctData] = await Promise.all([
          api.getAssets(),
          api.getSessions(),
          api.getStrategy(),
          api.getPositions(),
          api.getAccount(currency)
        ]);
        setAssets(assetData);
        setSessions(sessionData);
        setStrategy(stratData);
        setPositionsData(posData);
        if (acctData) setAccountRest(acctData);
      } catch (err) {
        console.error("Initialization error:", err);
      }
    };
    init();

    // Periodic account poll to keep metrics in sync even if socket reconnects
    const acctInterval = setInterval(() => {
      fetchAccount(currency);
    }, 4000);

    return () => clearInterval(acctInterval);
  }, [currency]);

  // Client-side cache for rapid instant chart switching
  const candlesCacheRef = useRef(new Map());

  // Timeframe and Date Range State for Candlestick Chart (defaulting to latest 1D data first)
  const [timeframe, setTimeframe] = useState({
    interval: "5m",
    period: "1d",
    startDate: null,
    endDate: null
  });
  const [isLoadingChart, setIsLoadingChart] = useState(false);

  // When selected symbol or timeframe changes, load historical candles with instant client-cache hit
  useEffect(() => {
    let isCancelled = false;
    const cacheKey = `${selectedSymbol}:${timeframe.interval}:${timeframe.period || ""}:${timeframe.startDate || ""}:${timeframe.endDate || ""}`;

    // Instant render if cached in memory (3s TTL for crypto, 15s for traditional assets)
    const isCrypto = selectedSymbol.endsWith("-USD") || selectedSymbol.includes("-USD");
    const maxTtl = isCrypto ? 3000 : 15000;
    const cachedEntry = candlesCacheRef.current.get(cacheKey);
    if (cachedEntry && (Date.now() - cachedEntry.timestamp < maxTtl)) {
      setCandles(cachedEntry.data);
      setIsLoadingChart(false);
    } else if (cachedEntry) {
      setCandles(cachedEntry.data); // show immediately while fetching fresh in background
      setIsLoadingChart(false);
    } else {
      setIsLoadingChart(true);
    }

    const loadSymbolData = async (silent = false) => {
      try {
        const history = await api.getHistory(
          selectedSymbol, 
          timeframe.interval, 
          timeframe.period,
          timeframe.startDate,
          timeframe.endDate
        );
        if (!isCancelled && history && history.length > 0) {
          candlesCacheRef.current.set(cacheKey, { timestamp: Date.now(), data: history });
          setCandles(history);
        }
      } catch (err) {
        console.error("Error loading symbol data:", err);
      } finally {
        if (!isCancelled && !silent) setIsLoadingChart(false);
      }
    };

    loadSymbolData(false);

    // Continuous background refresh for active intraday symbols so completed candles form continuously
    const pollInterval = setInterval(() => {
      if (!timeframe.startDate) {
        loadSymbolData(true);
      }
    }, 12000);

    return () => { 
      isCancelled = true;
      clearInterval(pollInterval);
    };
  }, [selectedSymbol, timeframe]);


  const handleTimeframeChange = (newTf) => {
    setTimeframe(newTf);
  };

  // Handle Toast for Auto-trade alerts
  useEffect(() => {
    if (latestAlert) {
      setToast({ message: latestAlert, type: "success" });
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [latestAlert]);

  // Actions
  const handleSelectSymbol = (sym) => {
    setSelectedSymbol(sym);
  };

  const handleCurrencyChange = (newCurr) => {
    setCurrency(newCurr);
  };

  const handleUpdateStrategy = async (newStrat) => {
    try {
      const updated = await api.updateStrategy(newStrat);
      setStrategy(updated);
      setToast({ message: "Strategy configuration updated!", type: "info" });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      console.error("Failed to update strategy:", err);
    }
  };

  const handlePlaceOrder = async (side, customShares, sl, tp) => {
    try {
      const order = {
        symbol: selectedSymbol,
        side,
        shares: customShares,
        stop_loss: sl,
        take_profit: tp,
      };
      const res = await api.placeOrder(order);
      setToast({ message: `Order Executed: ${side} ${selectedSymbol}`, type: "success" });
      setTimeout(() => setToast(null), 4000);

      // Instantly inject the confirmed position into state so it appears with zero lag
      if (res && res.position) {
        setPositionsData(prev => ({
          ...prev,
          open: [res.position, ...(prev.open || []).filter(p => p.id !== res.position.id)]
        }));
      }

      const pos = await api.getPositions();
      setPositionsData(pos);
    } catch (err) {
      setToast({ message: `Order Error: ${err.message}`, type: "error" });
      setTimeout(() => setToast(null), 4000);
    }
  };

  const handleClosePosition = async (orderId) => {
    try {
      await api.closeOrder(orderId);
      const pos = await api.getPositions();
      setPositionsData(pos);
      setToast({ message: "Position closed successfully.", type: "info" });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      console.error("Failed to close order:", err);
      setToast({ message: `Close Error: ${err.message}`, type: "error" });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleCloseAll = async () => {
    try {
      await api.closeAllOrders();
      const pos = await api.getPositions();
      setPositionsData(pos);
      setToast({ message: "All positions closed.", type: "info" });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      console.error("Failed to close all:", err);
      setToast({ message: `Close All Error: ${err.message}`, type: "error" });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleResetAccount = async () => {
    try {
      await api.resetAccount();
      const pos = await api.getPositions();
      setPositionsData(pos);
      const acc = await api.getAccount(currency);
      setAccountRest(acc);
      setToast({ message: "Trading balance & daily metrics reset successfully!", type: "success" });
      setTimeout(() => setToast(null), 3500);
    } catch (err) {
      console.error("Failed to reset account:", err);
      setToast({ message: `Reset Error: ${err.message}`, type: "error" });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const socketAccount = currency === "INR" ? accountInr : accountUsd;
  const activeAccount = socketAccount || accountRest;

  // Real-time confluence merge: blends REST stored positions with live WebSocket tick updates
  const mergedOpenPositions = React.useMemo(() => {
    const map = new Map();
    (positionsData.open || []).forEach(p => { if (p && p.id) map.set(p.id, p); });
    (openPositions || []).forEach(p => { if (p && p.id) map.set(p.id, p); });
    return Array.from(map.values());
  }, [openPositions, positionsData.open]);

  return (
    <div style={{ height: "100vh", maxHeight: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Navbar Header with Tab Navigation */}
      <Navbar
        sessions={sessions}
        account={activeAccount}
        currency={currency}
        onCurrencyChange={handleCurrencyChange}
        connected={connected}
        activeTab={currentTab}
        onTabChange={setCurrentTab}
        historyCount={positionsData.closed?.length || 0}
      />

      {/* Toast Alert Banner */}
      {toast && (
        <div style={{
          position: "fixed",
          top: "80px",
          right: "24px",
          zIndex: 1000,
          background: toast.type === "error" ? "rgba(239, 68, 68, 0.9)" : "rgba(16, 185, 129, 0.9)",
          color: "#fff",
          padding: "10px 16px",
          borderRadius: "8px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "12px",
          fontWeight: "700"
        }}>
          {toast.type === "error" ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Main Content: Either Terminal or Execution History View */}
      {currentTab === "TERMINAL" ? (
        <main style={{
          flex: 1,
          padding: "0 16px 10px",
          display: "grid",
          gridTemplateColumns: "280px minmax(500px, 1fr) 340px",
          gap: "14px",
          height: "calc(100vh - 68px)",
          overflow: "hidden"
        }}>
          
          {/* Left Column: Multi-Market Watchlist & AI Predictions */}
          <section style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <Watchlist
              assets={assets}
              selectedSymbol={selectedSymbol}
              onSelectSymbol={handleSelectSymbol}
              liveSnapshot={snapshot}
              onEodScanTriggered={() => {
                setToast({ message: "EOD AI Scan Completed! New setups analyzed & saved to DB.", type: "success" });
                setTimeout(() => setToast(null), 4000);
              }}
            />
          </section>

          {/* Center Column: Candlestick Chart with Date Range & Positions Table */}
          <section style={{ height: "100%", display: "flex", flexDirection: "column", gap: "10px", overflow: "hidden", minHeight: 0 }}>
            <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "hidden" }}>
              <ErrorBoundary>
                <CandlestickChart
                  symbol={selectedSymbol}
                  candles={candles}
                  liveCandle={liveCandle}
                  liveSnapshot={snapshot}
                  onTimeframeChange={handleTimeframeChange}
                  isLoadingData={isLoadingChart}
                  activeStrategy={strategy?.active_strategy || "TREND_TRADING"}
                  onSelectStrategy={(newStrat) => {
                    if (strategy) {
                      handleUpdateStrategy({ ...strategy, active_strategy: newStrat });
                    }
                  }}
                />
              </ErrorBoundary>
            </div>
            <div style={{ flex: "0 0 190px", minHeight: "150px", maxHeight: "220px", overflow: "hidden" }}>
              <PositionsTable
                openPositions={mergedOpenPositions}
                closedPositions={positionsData.closed}
                onClosePosition={handleClosePosition}
                onCloseAll={handleCloseAll}
                currency={currency}
                onOpenFullHistory={() => setCurrentTab("HISTORY")}
              />
            </div>
          </section>

          {/* Right Column: Dual AI Decision & Risk Guardrails */}
          <section style={{ height: "100%", display: "flex", flexDirection: "column", gap: "10px", overflowY: "auto", paddingRight: "2px" }}>
            {/* Jev AI System 1 Decision Gate */}
            <div style={{ flexShrink: 0 }}>
              <JevDecisionPanel
                signal={jevSignal || restSignal}
                symbol={selectedSymbol}
                onQuickTrade={(side, sl, tp, shares) => handlePlaceOrder(side, shares, sl, tp)}
                liveSnapshot={snapshot}
              />
            </div>

            {/* Trade Execution & Risk Guardrails */}
            <div>
              <TradeExecutionPanel
                strategy={strategy}
                onUpdateStrategy={handleUpdateStrategy}
                onPlaceOrder={handlePlaceOrder}
                onResetAccount={handleResetAccount}
                symbol={selectedSymbol}
                liveSnapshot={snapshot}
                onSelectStrategy={(newStrat) => {
                  if (strategy) {
                    handleUpdateStrategy({ ...strategy, active_strategy: newStrat });
                  }
                }}
              />
            </div>
          </section>

        </main>
      ) : (
        <main style={{
          flex: 1,
          height: "calc(100vh - 68px)",
          overflow: "hidden"
        }}>
          <ExecutionHistoryView
            currency={currency}
            onSelectSymbol={(sym) => {
              setSelectedSymbol(sym);
              setCurrentTab("TERMINAL");
            }}
            onSwitchToTerminal={() => setCurrentTab("TERMINAL")}
          />
        </main>
      )}

    </div>
  );
}

export default App;
