import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import { Search, TrendingUp, TrendingDown, Globe, Compass, Landmark, Loader2, Sparkles, RefreshCw, Target, Shield, Coins } from "lucide-react";
import { api } from "../services/api";

// Memoized Asset Row for 60fps smooth scrolling during live WebSocket updates
const AssetItemRow = memo(({ item, isSelected, livePrice, liveChangePct, onSelect }) => {
  const price = livePrice !== undefined && livePrice !== null ? livePrice : (item.last_price ?? null);
  const changePct = liveChangePct !== undefined && liveChangePct !== null ? liveChangePct : (item.change_pct ?? null);
  const isPositive = (changePct ?? 0) >= 0;

  return (
    <div
      onClick={() => onSelect(item.symbol)}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "7px 10px",
        borderRadius: "7px",
        cursor: "pointer",
        background: isSelected ? "rgba(6, 182, 212, 0.16)" : "rgba(255, 255, 255, 0.02)",
        border: isSelected ? "1px solid rgba(6, 182, 212, 0.45)" : "1px solid transparent",
        transition: "background 0.1s ease",
        flexShrink: 0
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.05)";
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)";
      }}
    >
      <div style={{ minWidth: 0, flex: 1, paddingRight: "8px" }}>
        <div style={{ fontSize: "12px", fontWeight: "700", color: isSelected ? "var(--accent-cyan)" : "#fff" }}>
          {item.symbol.replace(".NS", "").replace("=X", "")}
        </div>
        <div style={{ fontSize: "10px", color: "var(--text-dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "125px" }}>
          {item.name}
        </div>
      </div>

      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div className="mono" style={{ fontSize: "12px", fontWeight: "600" }}>
          {price !== null ? (item.currency === "INR" ? "₹" : "$") + Number(price).toFixed(item.pip_decimal || 2) : "---"}
        </div>
        {changePct !== null && (
          <div className="mono" style={{ 
            fontSize: "10px", 
            fontWeight: "600",
            color: isPositive ? "var(--accent-green)" : "var(--accent-red)",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "2px"
          }}>
            {isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            <span>{isPositive ? "+" : ""}{Number(changePct).toFixed(2)}%</span>
          </div>
        )}
      </div>
    </div>
  );
});

// Memoized Prediction Row
const PredictionItemRow = memo(({ pred, isSelected, livePrice, onSelect }) => {
  const isStrongBuy = pred.action.includes("STRONG BUY");
  const isBuy = pred.action.includes("BUY");
  const isStrongSell = pred.action.includes("STRONG SELL");
  const isSell = pred.action.includes("SELL");
  const currentPrice = livePrice !== undefined && livePrice !== null ? livePrice : pred.current_price;

  // Currency & Precision Detection
  const isCds = pred.symbol?.endsWith("INR=X");
  const isForex = !isCds && (pred.symbol?.includes("=X") || Number(currentPrice) < 50 || pred.category === "GLOBAL_FOREX");
  const isUsd = !isCds && (isForex || pred.category === "GLOBAL_STOCKS" || pred.symbol?.endsWith("-USD"));
  const currSym = isUsd ? "$" : "₹";
  const decimals = isForex ? (pred.symbol?.includes("JPY") ? 3 : 4) : (isCds ? 4 : 2);

  const numPrice = Number(currentPrice);
  const formattedPrice = !isNaN(numPrice) ? numPrice.toFixed(decimals) : "--";
  const formattedTarget = pred.target_price !== undefined && !isNaN(Number(pred.target_price)) ? Number(pred.target_price).toFixed(decimals) : "--";
  const formattedSL = pred.stop_loss !== undefined && !isNaN(Number(pred.stop_loss)) ? Number(pred.stop_loss).toFixed(decimals) : "--";
  const unitLabel = isForex ? "Lots" : "Shares";

  return (
    <div
      onClick={() => onSelect(pred.symbol)}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        padding: "8px 9px",
        borderRadius: "8px",
        cursor: "pointer",
        background: isSelected 
          ? "rgba(139, 92, 246, 0.16)" 
          : isBuy 
            ? "rgba(16, 185, 129, 0.04)" 
            : "rgba(239, 68, 68, 0.04)",
        border: isSelected 
          ? "1px solid rgba(139, 92, 246, 0.5)" 
          : isStrongBuy 
            ? "1px solid rgba(16, 185, 129, 0.45)" 
            : isBuy 
              ? "1px solid rgba(16, 185, 129, 0.2)" 
              : isStrongSell
                ? "1px solid rgba(239, 68, 68, 0.45)"
                : "1px solid rgba(239, 68, 68, 0.2)",
        transition: "background 0.1s ease",
        flexShrink: 0
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.06)";
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = isBuy ? "rgba(16, 185, 129, 0.04)" : "rgba(239, 68, 68, 0.04)";
        }
      }}
    >
      {/* Top Line: Symbol, Action Tag & Confidence */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "12px", fontWeight: "800", color: isSelected ? "var(--accent-cyan)" : "#fff" }}>
            {pred.symbol.replace(".NS", "").replace("=X", "")}
          </span>
          <span style={{
            fontSize: "9px",
            fontWeight: "800",
            padding: "1px 5px",
            borderRadius: "4px",
            background: isBuy ? "rgba(16, 185, 129, 0.2)" : isSell ? "rgba(239, 68, 68, 0.2)" : "rgba(245, 158, 11, 0.2)",
            color: isBuy ? "var(--accent-green)" : isSell ? "var(--accent-red)" : "var(--accent-amber)",
            border: `1px solid ${isBuy ? "rgba(16, 185, 129, 0.4)" : isSell ? "rgba(239, 68, 68, 0.4)" : "rgba(245, 158, 11, 0.4)"}`
          }}>
            {pred.action}
          </span>
          <span style={{
            fontSize: "8.5px",
            fontWeight: "700",
            color: "#A78BFA",
            background: "rgba(139, 92, 246, 0.15)",
            padding: "1px 5px",
            borderRadius: "4px",
            border: "1px solid rgba(139, 92, 246, 0.3)"
          }}>
            6-ALGO
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span className="mono" style={{ fontSize: "10.5px", fontWeight: "700", color: "#A78BFA" }}>
            {Math.round(pred.confidence * 100)}%
          </span>
          <span style={{ fontSize: "8.5px", color: "var(--text-dim)" }}>Conf</span>
        </div>
      </div>

      {/* Mid Line: Investment Sizing Recommendation with Disciplined Capital Cap */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--accent-cyan)", fontWeight: "600" }}>
          <Coins size={11} />
          <span>
            Invest: {pred.recommended_shares} {unitLabel}
          </span>
          <span style={{ color: "var(--text-dim)", fontSize: "9px" }}>
            ({currSym}{pred.allocated_amount ? Number(pred.allocated_amount).toLocaleString() : "0"})
          </span>
        </div>

        <div className="mono" style={{ fontSize: "10px", color: "var(--text-muted)" }}>
          Now: {currSym}{formattedPrice}
        </div>
      </div>

      {/* Timing Notification Pill */}
      {pred.entry_timing && (
        <div style={{
          fontSize: "9px",
          fontWeight: "700",
          color: isBuy ? "var(--accent-green)" : isSell ? "var(--accent-red)" : "var(--accent-amber)",
          background: isBuy ? "rgba(16, 185, 129, 0.12)" : isSell ? "rgba(239, 68, 68, 0.12)" : "rgba(255,255,255,0.05)",
          border: `1px solid ${isBuy ? "rgba(16, 185, 129, 0.25)" : isSell ? "rgba(239, 68, 68, 0.25)" : "rgba(255,255,255,0.1)"}`,
          padding: "2px 6px",
          borderRadius: "4px",
          display: "flex",
          alignItems: "center",
          gap: "4px"
        }}>
          <span>{pred.entry_timing}</span>
        </div>
      )}

      {/* Target & Stop Loss Pills (Tight 1:1.5 Scalp TP1 + 1:2.5 Runner TP2) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "9px", background: "rgba(0,0,0,0.25)", padding: "3px 6px", borderRadius: "4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "3px", color: "var(--accent-green)", fontWeight: "700" }}>
          <Target size={9} />
          <span>TP1: {currSym}{formattedTarget}</span>
          {pred.target_price_tp2 && (
            <span style={{ color: "#A78BFA", marginLeft: "4px" }}>
              TP2: {currSym}{Number(pred.target_price_tp2).toFixed(decimals)}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "3px", color: "var(--accent-red)", fontWeight: "700" }}>
          <Shield size={9} />
          <span>SL: {currSym}{formattedSL}</span>
        </div>
      </div>

      {/* Exit Rule & Macro Line */}
      {(pred.time_based_exit || pred.macro_trend) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "8.5px", color: "var(--text-dim)" }}>
          {pred.time_based_exit && (
            <span style={{ color: "#FBBF24" }}>{pred.time_based_exit}</span>
          )}
          {pred.macro_trend && (
            <span style={{ color: "var(--accent-cyan)", marginLeft: "auto" }}>{pred.macro_trend}</span>
          )}
        </div>
      )}

      {/* Bottom Line: Multi-Algorithm Consensus Thesis */}
      <div style={{ fontSize: "9.5px", color: "var(--text-dim)", lineHeight: "1.3", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
        {pred.thesis_reason}
      </div>
    </div>
  );
});

export function Watchlist({ assets, selectedSymbol, onSelectSymbol, liveSnapshot, onEodScanTriggered }) {
  // First tab is AI Predictions by default as requested
  const [activeTab, setActiveTab] = useState("AI_PREDICTIONS");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // EOD Predictions State
  const [predictions, setPredictions] = useState([]);
  const [lastScanInfo, setLastScanInfo] = useState(null);
  const [isScanningEod, setIsScanningEod] = useState(false);
  const [isLoadingPredictions, setIsLoadingPredictions] = useState(false);

  // On-Scroll Pagination State for Standard Markets
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingTab, setIsLoadingTab] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [tabCounts, setTabCounts] = useState(null);
  const listContainerRef = useRef(null);
  const scrollRafRef = useRef(null);

  // Load EOD Predictions from Database
  const fetchPredictions = useCallback(async () => {
    setIsLoadingPredictions(true);
    try {
      const res = await api.getEodPredictions();
      setPredictions(res.predictions || []);
      setLastScanInfo(res.last_scan || null);
    } catch (err) {
      console.error("Failed to load EOD predictions:", err);
    } finally {
      setIsLoadingPredictions(false);
    }
  }, []);

  useEffect(() => {
    fetchPredictions();
  }, [fetchPredictions]);

  // Handle Manual Trigger for EOD Scan
  const handleTriggerEodScan = async () => {
    if (isScanningEod) return;
    setIsScanningEod(true);
    try {
      const res = await api.triggerEodScan();
      if (res && res.predictions) {
        setPredictions(res.predictions);
        setLastScanInfo({
          scan_date: res.scan_date,
          top_picks_count: res.top_picks_count,
          total_scanned: res.total_scanned
        });
      } else {
        await fetchPredictions();
      }
      if (onEodScanTriggered) onEodScanTriggered();
    } catch (err) {
      console.error("Failed to trigger EOD scan:", err);
    } finally {
      setIsScanningEod(false);
    }
  };

  const tabs = [
    { id: "AI_PREDICTIONS", label: "AI Top Picks", icon: Sparkles, count: predictions.length || 0, isAi: true },
    { id: "NSE_EQUITIES", label: "Indian Stocks", icon: Landmark, count: tabCounts?.NSE_EQUITIES || assets?.NSE_EQUITIES?.length || 0 },
    { id: "GLOBAL_FOREX", label: "Forex & Crypto", icon: Globe, count: (tabCounts?.GLOBAL_FOREX || assets?.GLOBAL_FOREX?.length || 0) + (tabCounts?.CRYPTO_FX || assets?.CRYPTO_FX?.length || 0) },
    { id: "NSE_CDS", label: "NSE Currency", icon: Compass, count: tabCounts?.NSE_CDS || assets?.NSE_CDS?.length || 0 },
    { id: "GLOBAL_STOCKS", label: "US Equities", icon: TrendingUp, count: tabCounts?.GLOBAL_STOCKS || assets?.GLOBAL_STOCKS?.length || 0 },
  ];

  // Fetch Page 1 whenever activeTab or search changes (for standard asset tabs)
  useEffect(() => {
    if (activeTab === "AI_PREDICTIONS") return;

    let isCancelled = false;
    const fetchFirstPage = async () => {
      setIsLoadingTab(true);
      setPage(1);
      try {
        const res = await api.getAssets(activeTab, 1, 20, search);
        if (!isCancelled) {
          setItems(res.items || []);
          setHasMore(res.has_more ?? false);
          if (res.category_counts) {
            setTabCounts(res.category_counts);
          }
        }
      } catch (err) {
        console.error("Failed to load assets:", err);
      } finally {
        if (!isCancelled) setIsLoadingTab(false);
      }
    };

    fetchFirstPage();
    return () => { isCancelled = true; };
  }, [activeTab, search]);

  // Load next page on scroll
  const loadNextPage = useCallback(async () => {
    if (activeTab === "AI_PREDICTIONS") return;
    if (isLoadingMore || !hasMore || isLoadingTab) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;
    try {
      const res = await api.getAssets(activeTab, nextPage, 20, search);
      const newItems = res.items || [];
      if (newItems.length > 0) {
        setItems(prev => {
          const seen = new Set(prev.map(i => i.symbol));
          const unique = newItems.filter(i => !seen.has(i.symbol));
          return [...prev, ...unique];
        });
        setPage(nextPage);
        setHasMore(res.has_more ?? false);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error("Pagination error:", err);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [activeTab, page, hasMore, isLoadingMore, isLoadingTab, search]);

  // Throttled 60fps Scroll Handler via requestAnimationFrame
  const handleScroll = useCallback((e) => {
    if (activeTab === "AI_PREDICTIONS") return;
    const target = e.currentTarget;
    if (scrollRafRef.current) return;

    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      if (!target) return;
      const { scrollTop, clientHeight, scrollHeight } = target;
      if (scrollHeight - (scrollTop + clientHeight) < 90 && hasMore && !isLoadingMore && !isLoadingTab) {
        loadNextPage();
      }
    });
  }, [activeTab, hasMore, isLoadingMore, isLoadingTab, loadNextPage]);

  // Debounced online search dropdown
  useEffect(() => {
    if (!search.trim() || search.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await api.searchMarket(search);
        setSearchResults(data.results || []);
      } catch (e) {
        console.error("Search error:", e);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const handleSelectSymbol = useCallback((sym) => {
    onSelectSymbol(sym);
    setSearch("");
    setSearchResults([]);
  }, [onSelectSymbol]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && search.trim()) {
      handleSelectSymbol(search.trim().toUpperCase());
    }
  };

  // Filter predictions if user types in search
  const filteredPredictions = search.trim()
    ? predictions.filter(p => 
        p.symbol.toLowerCase().includes(search.toLowerCase()) || 
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.action.toLowerCase().includes(search.toLowerCase())
      )
    : predictions;

  return (
    <div className="glass-panel" style={{ height: "100%", display: "flex", flexDirection: "column", padding: "12px 14px", position: "relative", overflow: "hidden" }}>
      {/* Search Bar */}
      <div style={{ position: "relative", marginBottom: "8px", flexShrink: 0 }}>
        <Search size={14} color="var(--text-dim)" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }} />
        <input
          type="text"
          placeholder="Search Indian stocks, Forex, AI Predictions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            width: "100%",
            background: "rgba(0,0,0,0.35)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "8px",
            padding: "8px 10px 8px 32px",
            color: "#fff",
            fontSize: "12px",
            outline: "none",
            boxSizing: "border-box"
          }}
        />
        {isSearching && (
          <div style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center" }}>
            <Loader2 size={13} className="spin" color="var(--accent-cyan)" />
          </div>
        )}
      </div>

      {/* Online Search Dropdown Overlay */}
      {searchResults.length > 0 && search.trim().length >= 2 && (
        <div style={{
          position: "absolute",
          top: "50px",
          left: "14px",
          right: "14px",
          zIndex: 50,
          background: "rgba(15, 23, 42, 0.98)",
          backdropFilter: "blur(12px)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "8px",
          maxHeight: "220px",
          overflowY: "auto",
          boxShadow: "0 10px 25px rgba(0,0,0,0.5)"
        }}>
          {searchResults.map((item) => (
            <div
              key={item.symbol}
              onClick={() => handleSelectSymbol(item.symbol)}
              style={{
                padding: "8px 12px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                transition: "background 0.15s ease"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(56, 189, 248, 0.15)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <div>
                <div style={{ fontSize: "12px", fontWeight: "700", color: "#fff" }}>{item.symbol}</div>
                <div style={{ fontSize: "10px", color: "var(--text-dim)", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.name}
                </div>
              </div>
              <span style={{ fontSize: "9px", color: "var(--accent-cyan)", background: "rgba(6, 182, 212, 0.1)", padding: "2px 6px", borderRadius: "4px" }}>
                {item.exchange || item.type || "GLOBAL"}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Category Tabs: Row 1 = AI Predictions Banner, Row 2 & 3 = Grid of Markets */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "8px", flexShrink: 0 }}>
        {/* Row 1: AI Top Picks Tab (Full Width Hero) */}
        {(() => {
          const aiTab = tabs[0];
          const isAiActive = activeTab === "AI_PREDICTIONS";
          return (
            <button
              onClick={() => {
                setActiveTab(aiTab.id);
                if (listContainerRef.current) listContainerRef.current.scrollTop = 0;
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 10px",
                borderRadius: "7px",
                border: "none",
                background: isAiActive 
                  ? "linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(59, 130, 246, 0.25) 100%)" 
                  : "rgba(139, 92, 246, 0.08)",
                color: isAiActive ? "#E0E7FF" : "var(--text-muted)",
                fontSize: "11px",
                fontWeight: isAiActive ? "800" : "600",
                cursor: "pointer",
                transition: "all 0.15s ease",
                borderBottom: isAiActive ? "2px solid #8B5CF6" : "1px solid rgba(139, 92, 246, 0.2)",
                boxShadow: isAiActive ? "0 2px 10px rgba(139, 92, 246, 0.2)" : "none"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Sparkles size={13} color={isAiActive ? "#C4B5FD" : "#8B5CF6"} />
                <span>{aiTab.label}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{
                  fontSize: "9.5px",
                  background: isAiActive ? "rgba(139, 92, 246, 0.45)" : "rgba(255,255,255,0.08)",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  color: "#fff",
                  fontWeight: "700"
                }}>
                  {aiTab.count} SETUPS
                </span>
              </div>
            </button>
          );
        })()}

        {/* Row 2 & 3: Standard Market Tabs in 2-Column Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px" }}>
          {tabs.slice(1).map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (activeTab !== tab.id) {
                    setActiveTab(tab.id);
                    if (listContainerRef.current) listContainerRef.current.scrollTop = 0;
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "5px 7px",
                  borderRadius: "6px",
                  border: "none",
                  background: isActive ? "rgba(56, 189, 248, 0.15)" : "rgba(255,255,255,0.03)",
                  color: isActive ? "var(--accent-cyan)" : "var(--text-muted)",
                  fontSize: "10.5px",
                  fontWeight: isActive ? "700" : "500",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  borderBottom: isActive ? "2px solid var(--accent-cyan)" : "1px solid transparent",
                  minWidth: 0,
                  overflow: "hidden",
                  boxSizing: "border-box"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "4px", minWidth: 0, flex: 1, overflow: "hidden" }}>
                  <Icon size={11} style={{ flexShrink: 0 }} />
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {tab.label}
                  </span>
                </div>
                {tab.count > 0 && (
                  <span style={{ 
                    fontSize: "8.5px", 
                    background: isActive ? "rgba(6, 182, 212, 0.28)" : "rgba(255,255,255,0.07)",
                    padding: "1px 4px", 
                    borderRadius: "10px", 
                    color: isActive ? "#fff" : "var(--text-dim)",
                    fontWeight: "700",
                    marginLeft: "4px",
                    flexShrink: 0,
                    minWidth: "15px",
                    textAlign: "center"
                  }}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* When on AI Predictions Tab: End-Of-Day Trigger Button Banner */}
      {activeTab === "AI_PREDICTIONS" && (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 8px",
          background: "rgba(139, 92, 246, 0.09)",
          border: "1px dashed rgba(139, 92, 246, 0.3)",
          borderRadius: "7px",
          marginBottom: "6px",
          flexShrink: 0
        }}>
          <div>
            <div style={{ fontSize: "10.5px", fontWeight: "800", color: "#DDD6FE", display: "flex", alignItems: "center", gap: "5px" }}>
              <span>Multi-Algorithm EOD Engine</span>
              <span style={{ fontSize: "8.5px", background: "rgba(139, 92, 246, 0.3)", padding: "1px 4px", borderRadius: "3px", color: "#C4B5FD" }}>6 Models</span>
            </div>
            <div style={{ fontSize: "8.5px", color: "var(--text-dim)" }}>
              {lastScanInfo ? `Last Scan: ${lastScanInfo.scan_date} • ${lastScanInfo.top_picks_count} High-Consensus Setups` : "Triple EMA + MACD + Squeeze + OBV + Turtle"}
            </div>
          </div>

          <button
            onClick={handleTriggerEodScan}
            disabled={isScanningEod}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              background: isScanningEod ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)",
              color: "#fff",
              border: "none",
              borderRadius: "5px",
              padding: "4px 8px",
              fontSize: "10px",
              fontWeight: "700",
              cursor: isScanningEod ? "not-allowed" : "pointer",
              boxShadow: "0 2px 6px rgba(139, 92, 246, 0.3)"
            }}
          >
            {isScanningEod ? (
              <>
                <Loader2 size={11} className="spin" />
                <span>Running 6 Algos...</span>
              </>
            ) : (
              <>
                <RefreshCw size={10} />
                <span>Run Multi-Algo Scan</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Subheader / Column Labels */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "3px 2px 5px 2px",
        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        marginBottom: "5px",
        flexShrink: 0,
        fontSize: "9.5px",
        fontWeight: "600",
        color: "var(--text-dim)",
        textTransform: "uppercase",
        letterSpacing: "0.04em"
      }}>
        <span>{activeTab === "AI_PREDICTIONS" ? "Predicted Asset / Sizing" : "Symbol / Name"}</span>
        <span>{activeTab === "AI_PREDICTIONS" ? "Signal / Target" : "Price / 24h Chg"}</span>
      </div>

      {/* 60fps GPU Hardware-Accelerated Scrollable Container */}
      <div 
        ref={listContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          display: "flex",
          flexDirection: "column",
          gap: "5px",
          paddingRight: "4px",
          paddingTop: "2px",
          paddingBottom: "8px",
          willChange: "scroll-position",
          contain: "content"
        }}
      >
        {/* VIEW 1: AI PREDICTIONS LIST */}
        {activeTab === "AI_PREDICTIONS" ? (
          isLoadingPredictions ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "160px", gap: "10px", color: "var(--text-dim)", fontSize: "11px" }}>
              <Loader2 size={20} className="spin" color="var(--accent-purple)" />
              <span>Loading AI Predictions...</span>
            </div>
          ) : filteredPredictions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 10px", color: "var(--text-dim)", fontSize: "11px" }}>
              <div>No EOD predictions found.</div>
              <button 
                onClick={handleTriggerEodScan}
                style={{ marginTop: "10px", background: "rgba(139, 92, 246, 0.2)", border: "1px solid rgba(139, 92, 246, 0.4)", color: "#fff", padding: "4px 10px", borderRadius: "6px", fontSize: "11px", cursor: "pointer" }}
              >
                Trigger First EOD Scan
              </button>
            </div>
          ) : (
            filteredPredictions.map(pred => {
              const isSelected = selectedSymbol === pred.symbol;
              const isLiveItem = liveSnapshot && liveSnapshot.symbol === pred.symbol;
              const livePrice = isLiveItem ? liveSnapshot.last_price : undefined;

              return (
                <PredictionItemRow
                  key={pred.symbol}
                  pred={pred}
                  isSelected={isSelected}
                  livePrice={livePrice}
                  onSelect={handleSelectSymbol}
                />
              );
            })
          )
        ) : (
          /* VIEW 2: STANDARD MARKET ASSET LIST (WITH PAGINATION) */
          isLoadingTab ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "160px", gap: "10px", color: "var(--text-dim)", fontSize: "11px" }}>
              <Loader2 size={20} className="spin" color="var(--accent-cyan)" />
              <span>Loading {activeTab.replace("_", " ")}...</span>
            </div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 10px", color: "var(--text-dim)", fontSize: "12px" }}>
              No assets found matching your query.
            </div>
          ) : (
            items.map(item => {
              const isSelected = selectedSymbol === item.symbol;
              const isLiveItem = liveSnapshot && liveSnapshot.symbol === item.symbol;
              const livePrice = isLiveItem ? liveSnapshot.last_price : undefined;
              const liveChangePct = isLiveItem ? liveSnapshot.change_pct : undefined;

              return (
                <AssetItemRow
                  key={item.symbol}
                  item={item}
                  isSelected={isSelected}
                  livePrice={livePrice}
                  liveChangePct={liveChangePct}
                  onSelect={handleSelectSymbol}
                />
              );
            })
          )
        )}

        {/* Loading More Indicator during on-scroll pagination */}
        {activeTab !== "AI_PREDICTIONS" && isLoadingMore && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", padding: "10px 0", color: "var(--accent-cyan)", fontSize: "11px", flexShrink: 0 }}>
            <Loader2 size={14} className="spin" color="var(--accent-cyan)" />
            <span>Loading more assets...</span>
          </div>
        )}

        {/* End of list banner */}
        {activeTab !== "AI_PREDICTIONS" && !hasMore && items.length > 20 && !isLoadingTab && (
          <div style={{ textAlign: "center", padding: "10px 0 4px", color: "var(--text-dim)", fontSize: "10px", flexShrink: 0 }}>
            All {items.length} assets loaded
          </div>
        )}
      </div>
    </div>
  );
}

export default Watchlist;
