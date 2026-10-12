import React, { useEffect, useRef, useState, useCallback } from "react";
import { createChart, ColorType, CandlestickSeries, LineSeries, HistogramSeries } from "lightweight-charts";
import { 
  Calendar, Check, Loader2, Clock, Layers, TrendingUp, ArrowLeftRight, 
  Zap, Compass, Eye, EyeOff, Sparkles, Activity, Maximize2 
} from "lucide-react";
import { detectAIPatterns } from "../utils/aiPatternDetector";
import { api } from "../services/api";

export function CandlestickChart({ 
  symbol, 
  candles, 
  liveCandle, 
  liveSnapshot, 
  onTimeframeChange,
  isLoadingData = false,
  activeStrategy = "TREND_TRADING",
  onSelectStrategy
}) {
  const chartContainerRef = useRef(null);
  const wrapperRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const ema9SeriesRef = useRef(null);
  const ema21SeriesRef = useRef(null);
  const lastBarTimeRef = useRef(0);
  const currentBarRef = useRef(null);
  const [hoveredBar, setHoveredBar] = useState(null);

  // Timeframe and Range States
  const [interval, setInterval] = useState("5m");
  const [period, setPeriod] = useState("1d");
  const [isCustomDate, setIsCustomDate] = useState(false);
  
  const todayStr = new Date().toISOString().split("T")[0];
  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(threeMonthsAgo);
  const [endDate, setEndDate] = useState(todayStr);

  // AI Strategy & Overlay Filter States
  const [activeStrategyFilter, setActiveStrategyFilter] = useState("ALL"); // "ALL", "TREND", "RANGE", "BREAKOUT", "SCALPING"
  const [showTrendlines, setShowTrendlines] = useState(true);
  const [showChannels, setShowChannels] = useState(true);
  const [showPatterns, setShowPatterns] = useState(true); // Triangles, H&S, ABCD
  const [showWaves, setShowWaves] = useState(true);       // Elliott Waves 1-2-3-4-5, A-B-C
  const [showLevels, setShowLevels] = useState(true);     // Support/Resistance & Scalp

  // Sync external activeStrategy changes
  useEffect(() => {
    if (activeStrategy) {
      if (activeStrategy === "TREND_TRADING") setActiveStrategyFilter("TREND");
      else if (activeStrategy === "RANGE_TRADING") setActiveStrategyFilter("RANGE");
      else if (activeStrategy === "BREAKOUT_TRADING") setActiveStrategyFilter("BREAKOUT");
      else if (activeStrategy === "SCALPING") setActiveStrategyFilter("SCALPING");
    }
  }, [activeStrategy]);

  // AI Structural Pattern Data
  const [aiData, setAiData] = useState(null);
  const [svgElements, setSvgElements] = useState([]);
  const [wrapperSize, setWrapperSize] = useState({ width: 800, height: 400 });

  const periods = [
    { label: "1D", value: "1d", defaultInterval: "5m" },
    { label: "5D", value: "5d", defaultInterval: "15m" },
    { label: "1M", value: "1mo", defaultInterval: "1h" },
    { label: "3M", value: "3mo", defaultInterval: "1d" },
    { label: "6M", value: "6mo", defaultInterval: "1d" },
    { label: "1Y", value: "1y", defaultInterval: "1d" },
  ];

  const intervals = [
    { label: "1m", value: "1m" },
    { label: "5m", value: "5m" },
    { label: "15m", value: "15m" },
    { label: "1h", value: "1h" },
    { label: "1D", value: "1d" },
  ];

  // Initialize Lightweight Charts
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#0B0E17" },
        textColor: "#9CA3AF",
        fontSize: 11,
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.04)" },
        horzLines: { color: "rgba(255, 255, 255, 0.04)" },
      },
      crosshair: {
        vertLine: { color: "rgba(6, 182, 212, 0.5)", width: 1, style: 2 },
        horzLine: { color: "rgba(6, 182, 212, 0.5)", width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        scaleMargins: { top: 0.05, bottom: 0.06 },
        visible: true,
        autoScale: true,
        minimumWidth: 88,
      },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.12)",
        timeVisible: true,
        secondsVisible: false,
        visible: true,
        borderVisible: true,
        rightOffset: 6,
        barSpacing: 18,
        minBarSpacing: 5,
        tickMarkFormatter: (time) => {
          const date = new Date(time * 1000);
          return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
        },
      },
      localization: {
        timeFormatter: (timestamp) => {
          const date = new Date(timestamp * 1000);
          return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
        },
        dateFormat: "yyyy-MM-dd",
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10B981",
      downColor: "#EF4444",
      borderUpColor: "#10B981",
      borderDownColor: "#EF4444",
      wickUpColor: "#10B981",
      wickDownColor: "#EF4444",
      priceFormat: {
        type: "price",
        precision: 2,
        minMove: 0.01,
      },
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    const ema9Series = chart.addSeries(LineSeries, {
      color: "#06B6D4",
      lineWidth: 1.5,
      title: "EMA 9",
    });

    const ema21Series = chart.addSeries(LineSeries, {
      color: "#F59E0B",
      lineWidth: 1.5,
      title: "EMA 21",
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    ema9SeriesRef.current = ema9Series;
    ema21SeriesRef.current = ema21Series;

    // Crosshair hover tracking for TradingView-style OHLC header
    chart.subscribeCrosshairMove((param) => {
      if (!param || !param.time || !param.seriesData) {
        setHoveredBar(null);
        return;
      }
      const bar = param.seriesData.get(candleSeries);
      if (bar && typeof bar.close === "number") {
        setHoveredBar(bar);
      } else {
        setHoveredBar(null);
      }
    });

    // Auto-size observer
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0 || !chartRef.current) return;
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        chartRef.current.applyOptions({ width, height });
        setWrapperSize({ width, height });
      }
    });

    if (wrapperRef.current) {
      resizeObserver.observe(wrapperRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, []);

  // Update Data & detect patterns
  useEffect(() => {
    if (!candleSeriesRef.current) return;
    if (!candles || !Array.isArray(candles) || candles.length === 0) {
      candleSeriesRef.current.setData([]);
      if (volumeSeriesRef.current) volumeSeriesRef.current.setData([]);
      if (ema9SeriesRef.current) ema9SeriesRef.current.setData([]);
      if (ema21SeriesRef.current) ema21SeriesRef.current.setData([]);
      setAiData(null);
      return;
    }

    try {
      const valid = candles.filter(
        (c) => c && typeof c.time === "number" && !isNaN(c.close) && !isNaN(c.open) && !isNaN(c.high) && !isNaN(c.low)
      );
      const sorted = [...valid].sort((a, b) => a.time - b.time);

      const uniqueCandles = [];
      const seenTimes = new Set();
      for (const c of sorted) {
        if (!seenTimes.has(c.time)) {
          seenTimes.add(c.time);
          uniqueCandles.push({
            time: c.time,
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
          });
        }
      }

      if (uniqueCandles.length === 0) return;

      const formattedVolume = uniqueCandles.map((c, i) => ({
        time: c.time,
        value: typeof valid[i]?.volume === "number" ? valid[i].volume : 1000,
        color: c.close >= c.open ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.25)",
      }));

      candleSeriesRef.current.setData(uniqueCandles);
      volumeSeriesRef.current.setData(formattedVolume);

      // Compute EMAs
      const ema9Data = [];
      const ema21Data = [];
      let k9 = 2 / (9 + 1);
      let k21 = 2 / (21 + 1);
      let last9 = uniqueCandles[0].close;
      let last21 = uniqueCandles[0].close;

      uniqueCandles.forEach((c) => {
        last9 = c.close * k9 + last9 * (1 - k9);
        last21 = c.close * k21 + last21 * (1 - k21);
        ema9Data.push({ time: c.time, value: last9 });
        ema21Data.push({ time: c.time, value: last21 });
      });

      ema9SeriesRef.current.setData(ema9Data);
      ema21SeriesRef.current.setData(ema21Data);

      const lastBar = uniqueCandles[uniqueCandles.length - 1];
      if (lastBar) {
        lastBarTimeRef.current = lastBar.time;
        currentBarRef.current = { ...lastBar };
      }

      // Client-side instant pattern detection
      const detected = detectAIPatterns(uniqueCandles);
      setAiData(detected);

      if (chartRef.current) {
        if (uniqueCandles.length > 25 && (interval === "1m" || interval === "5m" || interval === "15m")) {
          chartRef.current.timeScale().setVisibleLogicalRange({
            from: Math.max(0, uniqueCandles.length - 25),
            to: uniqueCandles.length + 3,
          });
        } else {
          chartRef.current.timeScale().fitContent();
        }
      }
    } catch (err) {
      console.warn("Safely handled chart dataset error:", err);
    }
  }, [candles, interval]);

  // Fetch deep backend strategy overlay in background to complement client detection
  useEffect(() => {
    if (!symbol) return;
    let isMounted = true;
    api.getStrategyOverlay(symbol).then((data) => {
      if (isMounted && data) {
        // Enhance with backend calculations if available
        setAiData((prev) => ({
          ...prev,
          backendStrategy: data
        }));
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, [symbol]);

  // Live Tick & Snapshot Real-Time Update
  useEffect(() => {
    if (!candleSeriesRef.current || isCustomDate) return;

    // Real-time price from snapshot or tick
    const tickPrice = liveSnapshot?.last_price || (liveCandle && liveCandle.symbol === symbol ? Number(liveCandle.close) : null);
    if (!tickPrice || isNaN(tickPrice)) return;

    try {
      const intervalSec = interval === "1m" ? 60
        : interval === "5m" ? 300
        : interval === "15m" ? 900
        : interval === "1h" ? 3600
        : 86400;

      const nowSec = Math.floor(Date.now() / 1000);
      const bucketTime = Math.floor(nowSec / intervalSec) * intervalSec;
      const validTime = Math.max(lastBarTimeRef.current || 0, bucketTime);
      lastBarTimeRef.current = validTime;

      let cur = currentBarRef.current;
      if (!cur || cur.time !== validTime) {
        cur = {
          time: validTime,
          open: (liveCandle?.open && liveCandle.time === validTime) ? Number(liveCandle.open) : tickPrice,
          high: Math.max(tickPrice, (liveCandle?.high && liveCandle.time === validTime) ? Number(liveCandle.high) : tickPrice),
          low: Math.min(tickPrice, (liveCandle?.low && liveCandle.time === validTime) ? Number(liveCandle.low) : tickPrice),
          close: tickPrice,
        };
      } else {
        cur = {
          time: validTime,
          open: cur.open,
          high: Math.max(cur.high, tickPrice),
          low: Math.min(cur.low, tickPrice),
          close: tickPrice,
        };
      }
      currentBarRef.current = cur;

      candleSeriesRef.current.update(cur);

      if (volumeSeriesRef.current) {
        const vol = (liveCandle?.volume && liveCandle.time === validTime) ? Number(liveCandle.volume) : 1000;
        volumeSeriesRef.current.update({
          time: validTime,
          value: vol,
          color: tickPrice >= openPrice ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 68, 68, 0.25)",
        });
      }
    } catch (err) {
      console.warn("Live tick update notice:", err);
    }
  }, [liveCandle, liveSnapshot, symbol, interval, isCustomDate]);

  // Time & Price Coordinate Mapping Function for SVG Overlay
  const toCoord = useCallback((time, price) => {
    if (!chartRef.current || !candleSeriesRef.current) return null;
    const x = chartRef.current.timeScale().timeToCoordinate(time);
    const y = candleSeriesRef.current.priceToCoordinate(price);
    if (x === null || y === null || isNaN(x) || isNaN(y)) return null;
    return { x, y };
  }, []);

  // Recalculate SVG Plot Coordinates on pan, zoom, or data change
  const renderOverlay = useCallback(() => {
    if (!aiData || !chartRef.current || !candleSeriesRef.current) {
      setSvgElements([]);
      return;
    }

    const elements = [];
    const width = wrapperSize.width;
    const isAll = activeStrategyFilter === "ALL";

    // 1. TREND TRADING: Trendlines & Regression Channel
    if (isAll || activeStrategyFilter === "TREND") {
      const { trendlines } = aiData;
      if (showChannels && trendlines?.channel) {
        const ch = trendlines.channel;
        const pUpper1 = toCoord(ch.start_time, ch.upper_start);
        const pUpper2 = toCoord(ch.end_time, ch.upper_end);
        const pLower1 = toCoord(ch.start_time, ch.lower_start);
        const pLower2 = toCoord(ch.end_time, ch.lower_end);
        const pMid1 = toCoord(ch.start_time, ch.mid_start);
        const pMid2 = toCoord(ch.end_time, ch.mid_end);

        if (pUpper1 && pUpper2 && pLower1 && pLower2) {
          elements.push({
            type: "channel",
            key: "reg-channel-fill",
            points: `${pUpper1.x},${pUpper1.y} ${pUpper2.x},${pUpper2.y} ${pLower2.x},${pLower2.y} ${pLower1.x},${pLower1.y}`,
            fill: "rgba(6, 182, 212, 0.08)",
            stroke: "rgba(6, 182, 212, 0.4)",
            strokeDasharray: "4 3"
          });
        }
        if (pMid1 && pMid2) {
          elements.push({
            type: "line",
            key: "reg-channel-mid",
            x1: pMid1.x, y1: pMid1.y,
            x2: pMid2.x, y2: pMid2.y,
            stroke: "#06B6D4",
            strokeWidth: 1.5,
            label: `Regression Trend (${trendlines.angle}°)`
          });
        }
      }

      if (showTrendlines) {
        if (trendlines?.resistance) {
          const p1 = toCoord(trendlines.resistance.start.time, trendlines.resistance.start.price);
          const p2 = toCoord(trendlines.resistance.end.time, trendlines.resistance.end.price);
          if (p1 && p2) {
            elements.push({
              type: "line",
              key: "trend-res",
              x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
              stroke: "#EF4444",
              strokeWidth: 2,
              label: "Resistance Trendline"
            });
          }
        }
        if (trendlines?.support) {
          const p1 = toCoord(trendlines.support.start.time, trendlines.support.start.price);
          const p2 = toCoord(trendlines.support.end.time, trendlines.support.end.price);
          if (p1 && p2) {
            elements.push({
              type: "line",
              key: "trend-sup",
              x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
              stroke: "#10B981",
              strokeWidth: 2,
              label: "Support Trendline"
            });
          }
        }
      }
    }

    // 2. RANGE TRADING: Horizontal Support / Resistance & Flat Bounds
    if (isAll || activeStrategyFilter === "RANGE") {
      if (showLevels && aiData.range?.levels) {
        aiData.range.levels.forEach((lvl, idx) => {
          const coord = toCoord(aiData.range.mid ? aiData.pivots[0]?.time || 0 : 0, lvl.price);
          if (coord) {
            elements.push({
              type: "horizontal-level",
              key: `range-level-${idx}`,
              y: coord.y,
              price: lvl.price,
              label: lvl.label,
              color: lvl.color
            });
          }
        });
      }
    }

    // 3. BREAKOUT TRADING: Chart Patterns (Triangles, Head & Shoulders, ABCD)
    if (isAll || activeStrategyFilter === "BREAKOUT") {
      const { breakout } = aiData;
      // Triangle Pattern
      if (showPatterns && breakout?.triangle) {
        const { upper, lower, name } = breakout.triangle;
        const u1 = toCoord(upper.start.time, upper.start.price);
        const u2 = toCoord(upper.end.time, upper.end.price);
        const l1 = toCoord(lower.start.time, lower.start.price);
        const l2 = toCoord(lower.end.time, lower.end.price);

        if (u1 && u2 && l1 && l2) {
          elements.push({
            type: "polygon",
            key: "triangle-poly",
            points: `${u1.x},${u1.y} ${u2.x},${u2.y} ${l2.x},${l2.y} ${l1.x},${l1.y}`,
            fill: "rgba(139, 92, 246, 0.15)",
            stroke: "#8B5CF6",
            strokeWidth: 2,
            label: name
          });
        }
      }

      // Head and Shoulders
      if (showPatterns && breakout?.headAndShoulders) {
        const hs = breakout.headAndShoulders;
        const pLS = toCoord(hs.leftShoulder.time, hs.leftShoulder.price);
        const pH = toCoord(hs.head.time, hs.head.price);
        const pRS = toCoord(hs.rightShoulder.time, hs.rightShoulder.price);
        const pNeck = toCoord(hs.head.time, hs.neckline);

        if (pLS && pH && pRS) {
          elements.push({
            type: "head-shoulders",
            key: "head-shoulders",
            ls: pLS, head: pH, rs: pRS,
            necklineY: pNeck?.y
          });
        }
      }

      // ABCD Harmonic Pattern
      if (showPatterns && breakout?.abcd?.points?.length === 4) {
        const [pA, pB, pC, pD] = breakout.abcd.points;
        const cA = toCoord(pA.time, pA.price);
        const cB = toCoord(pB.time, pB.price);
        const cC = toCoord(pC.time, pC.price);
        const cD = toCoord(pD.time, pD.price);
        if (cA && cB && cC && cD) {
          elements.push({
            type: "abcd-pattern",
            key: "abcd-harmonic",
            points: [
              { ...cA, label: "A" },
              { ...cB, label: "B" },
              { ...cC, label: "C" },
              { ...cD, label: "D" }
            ]
          });
        }
      }

      // Andrews Pitchfork
      if (showChannels && breakout?.pitchfork) {
        const { p1, p2, p3 } = breakout.pitchfork;
        const c1 = toCoord(p1.time, p1.price);
        const c2 = toCoord(p2.time, p2.price);
        const c3 = toCoord(p3.time, p3.price);
        if (c1 && c2 && c3) {
          const midX = (c2.x + c3.x) / 2;
          const midY = (c2.y + c3.y) / 2;
          const dx = midX - c1.x;
          const dy = midY - c1.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const ext = 220;
          const extX = (dx / dist) * ext;
          const extY = (dy / dist) * ext;

          elements.push({
            type: "pitchfork",
            key: "andrews-pitchfork",
            c1, c2, c3,
            mid: { x: midX, y: midY },
            midExt: { x: midX + extX, y: midY + extY },
            upperExt: { x: c2.x + extX, y: c2.y + extY },
            lowerExt: { x: c3.x + extX, y: c3.y + extY }
          });
        }
      }

      // Breakout Trigger Levels
      if (showLevels && breakout) {
        const cUp = toCoord(0, breakout.breakoutUp);
        const cDown = toCoord(0, breakout.breakoutDown);
        if (cUp) {
          elements.push({
            type: "horizontal-level",
            key: "breakout-up",
            y: cUp.y,
            price: breakout.breakoutUp,
            label: "Breakout Buy Trigger",
            color: "#10B981"
          });
        }
        if (cDown) {
          elements.push({
            type: "horizontal-level",
            key: "breakout-down",
            y: cDown.y,
            price: breakout.breakoutDown,
            label: "Breakout Sell Trigger",
            color: "#EF4444"
          });
        }
      }
    }

    // 4. SCALPING: Micro Pivots & Tight Targets
    if (isAll || activeStrategyFilter === "SCALPING") {
      if (showLevels && aiData.scalping) {
        const sc = aiData.scalping;
        const cTarget = toCoord(0, sc.buyTarget);
        const cSL = toCoord(0, sc.buySL);
        const cTrigger = toCoord(0, sc.trigger);

        if (cTarget) {
          elements.push({
            type: "horizontal-level",
            key: "scalp-tp",
            y: cTarget.y,
            price: sc.buyTarget,
            label: "Scalp TP (+0.9%)",
            color: "#10B981"
          });
        }
        if (cTrigger) {
          elements.push({
            type: "horizontal-level",
            key: "scalp-entry",
            y: cTrigger.y,
            price: sc.trigger,
            label: "Scalp Entry",
            color: "#06B6D4"
          });
        }
        if (cSL) {
          elements.push({
            type: "horizontal-level",
            key: "scalp-sl",
            y: cSL.y,
            price: sc.buySL,
            label: "Scalp SL (-0.5%)",
            color: "#EF4444"
          });
        }
      }
    }

    // 5. ELLIOTT WAVES: 1-2-3-4-5 & A-B-C
    if (showWaves && (isAll || activeStrategyFilter === "TREND") && aiData.elliottWaves) {
      const { impulse, correction } = aiData.elliottWaves;
      const wavePoints = [];
      impulse?.forEach(w => {
        const c = toCoord(w.time, w.price);
        if (c) wavePoints.push({ ...c, label: w.wave, color: "#38BDF8" });
      });
      correction?.forEach(w => {
        const c = toCoord(w.time, w.price);
        if (c) wavePoints.push({ ...c, label: w.wave, color: "#F43F5E" });
      });

      if (wavePoints.length >= 2) {
        elements.push({
          type: "elliott-waves",
          key: "elliott-waves",
          points: wavePoints
        });
      }
    }

    setSvgElements(elements);
  }, [aiData, activeStrategyFilter, showTrendlines, showChannels, showPatterns, showWaves, showLevels, toCoord, wrapperSize]);

  // Hook sync: update overlay when chart view changes
  useEffect(() => {
    if (!chartRef.current) return;
    const timeScale = chartRef.current.timeScale();
    const handleRangeChange = () => {
      requestAnimationFrame(renderOverlay);
    };
    timeScale.subscribeVisibleLogicalRangeChange(handleRangeChange);
    timeScale.subscribeVisibleTimeRangeChange(handleRangeChange);
    renderOverlay();

    return () => {
      timeScale.unsubscribeVisibleLogicalRangeChange(handleRangeChange);
      timeScale.unsubscribeVisibleTimeRangeChange(handleRangeChange);
    };
  }, [renderOverlay]);

  const handleSelectPeriod = (p) => {
    setIsCustomDate(false);
    setPeriod(p.value);
    const newInterval = p.defaultInterval || interval;
    setInterval(newInterval);
    if (onTimeframeChange) {
      onTimeframeChange({
        interval: newInterval,
        period: p.value,
        startDate: null,
        endDate: null
      });
    }
  };

  const handleSelectInterval = (newTf) => {
    setInterval(newTf);
    if (onTimeframeChange) {
      onTimeframeChange({
        interval: newTf,
        period: isCustomDate ? null : period,
        startDate: isCustomDate ? startDate : null,
        endDate: isCustomDate ? endDate : null
      });
    }
  };

  const handleApplyCustomRange = () => {
    if (!startDate) return;
    setIsCustomDate(true);
    const days = Math.abs((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));
    let effectiveInterval = interval;
    if (days > 58 && ["1m", "5m", "15m"].includes(effectiveInterval)) {
      effectiveInterval = "1d";
      setInterval("1d");
    }

    if (onTimeframeChange) {
      onTimeframeChange({
        interval: effectiveInterval,
        period: null,
        startDate,
        endDate: endDate || todayStr
      });
    }
  };

  const handleStrategyClick = (stratId) => {
    setActiveStrategyFilter(stratId);
    if (onSelectStrategy && stratId !== "ALL") {
      const map = {
        TREND: "TREND_TRADING",
        RANGE: "RANGE_TRADING",
        BREAKOUT: "BREAKOUT_TRADING",
        SCALPING: "SCALPING"
      };
      if (map[stratId]) onSelectStrategy(map[stratId]);
    }
  };

  return (
    <div className="glass-panel" style={{ height: "100%", display: "flex", flexDirection: "column", padding: "8px 10px", position: "relative", minHeight: 0, boxSizing: "border-box", gap: "6px" }}>
      
      {/* 1. TOP HEADER: Asset Info, Live Quote, Holiday Indicator & Intervals */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, flexWrap: "wrap", gap: "6px" }}>
        {/* Left: Asset Ticker & Price Info */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ fontSize: "14px", fontWeight: "800", color: "#fff" }}>
              {symbol.replace(".NS", "").replace("=X", "")}
            </span>
            <span style={{ fontSize: "9.5px", color: "var(--text-dim)", background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: "4px" }}>
              {symbol}
            </span>
          </div>

          {liveSnapshot && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span className="mono" style={{ fontSize: "14px", fontWeight: "800", color: "#fff" }}>
                {liveSnapshot.currency === "INR" ? "₹" : "$"}{(hoveredBar ? hoveredBar.close : (currentBarRef.current?.close || liveSnapshot.last_price))?.toFixed(2)}
              </span>

              {/* TradingView-Style OHLC Status Bar */}
              {(() => {
                const activeBar = hoveredBar || currentBarRef.current || (candles && candles.length > 0 ? candles[candles.length - 1] : null);
                if (!activeBar || activeBar.open === undefined) return null;
                const o = Number(activeBar.open);
                const h = Number(activeBar.high);
                const l = Number(activeBar.low);
                const c = Number(activeBar.close);
                const diff = c - o;
                const diffPct = o > 0 ? (diff / o) * 100 : 0;
                const isUp = diff >= 0;

                return (
                  <div style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "7px", 
                    fontSize: "11px", 
                    fontFamily: "var(--font-mono)", 
                    color: "#9CA3AF",
                    background: "rgba(255, 255, 255, 0.04)",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    border: "1px solid rgba(255, 255, 255, 0.08)"
                  }}>
                    <span>O <strong style={{ color: "#E5E7EB", fontWeight: "600" }}>{o.toFixed(2)}</strong></span>
                    <span>H <strong style={{ color: "#E5E7EB", fontWeight: "600" }}>{h.toFixed(2)}</strong></span>
                    <span>L <strong style={{ color: "#E5E7EB", fontWeight: "600" }}>{l.toFixed(2)}</strong></span>
                    <span>C <strong style={{ color: isUp ? "#10B981" : "#EF4444", fontWeight: "700" }}>{c.toFixed(2)}</strong></span>
                    <span style={{ color: isUp ? "#10B981" : "#EF4444", fontWeight: "700" }}>
                      {isUp ? "+" : ""}{diff.toFixed(2)} ({isUp ? "+" : ""}{diffPct.toFixed(2)}%)
                    </span>
                  </div>
                );
              })()}

              <span className="mono" style={{ 
                fontSize: "10.5px", 
                fontWeight: "600",
                color: liveSnapshot.change_pct >= 0 ? "var(--accent-green)" : "var(--accent-red)"
              }}>
                24h: {liveSnapshot.change_pct >= 0 ? "+" : ""}{liveSnapshot.change_pct?.toFixed(2)}%
              </span>
              {liveSnapshot.market_status?.includes("Holiday") ? (
                <span style={{ fontSize: "9px", fontWeight: "700", color: "#F59E0B", background: "rgba(245, 158, 11, 0.15)", border: "1px solid rgba(245, 158, 11, 0.3)", padding: "1px 7px", borderRadius: "10px" }}>
                  OFFICIAL CLOSE (MARKET HOLIDAY)
                </span>
              ) : (liveSnapshot.market_status === "CLOSED" || !liveSnapshot.is_market_open) ? (
                <span style={{ fontSize: "9px", fontWeight: "700", color: "#F87171", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", padding: "1px 6px", borderRadius: "10px" }}>
                  OFFICIAL CLOSE
                </span>
              ) : (
                <span style={{ fontSize: "9px", fontWeight: "700", color: "#34D399", background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", padding: "1px 6px", borderRadius: "10px" }}>
                  LIVE FEED
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: Intervals & EMA Legend */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ display: "flex", background: "rgba(0,0,0,0.35)", borderRadius: "5px", padding: "2px", border: "1px solid var(--border-subtle)" }}>
            {intervals.map((tf) => (
              <button
                key={tf.value}
                onClick={() => handleSelectInterval(tf.value)}
                style={{
                  border: "none",
                  background: interval === tf.value ? "rgba(6, 182, 212, 0.25)" : "transparent",
                  color: interval === tf.value ? "var(--accent-cyan)" : "var(--text-muted)",
                  padding: "2px 6px",
                  borderRadius: "3px",
                  fontSize: "10px",
                  fontWeight: interval === tf.value ? "700" : "500",
                  cursor: "pointer"
                }}
              >
                {tf.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "9.5px", color: "var(--text-dim)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
              <span style={{ width: "6px", height: "2px", background: "#06B6D4" }}></span> EMA 9
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
              <span style={{ width: "6px", height: "2px", background: "#F59E0B" }}></span> EMA 21
            </span>
          </div>
        </div>
      </div>

      {/* 2. DEDICATED AI STRATEGY & TRADINGVIEW-STYLE PATTERN CONTROLLER BAR */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(255, 255, 255, 0.02)",
        border: "1px solid rgba(255, 255, 255, 0.07)",
        borderRadius: "6px",
        padding: "4px 8px",
        flexShrink: 0,
        flexWrap: "wrap",
        gap: "6px"
      }}>
        {/* Left: Strategy Selector Tabs */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ fontSize: "10px", fontWeight: "700", color: "var(--accent-cyan)", display: "flex", alignItems: "center", gap: "4px", marginRight: "4px" }}>
            <Sparkles size={11} color="var(--accent-cyan)" /> AI STRATEGY:
          </span>

          {[
            { id: "ALL", label: "All Plots", icon: Layers, color: "var(--accent-cyan)" },
            { id: "TREND", label: "Trend Trading", icon: TrendingUp, color: "#10B981" },
            { id: "RANGE", label: "Range Trading", icon: ArrowLeftRight, color: "#F59E0B" },
            { id: "BREAKOUT", label: "Breakout", icon: Zap, color: "#8B5CF6" },
            { id: "SCALPING", label: "Scalping", icon: Activity, color: "#EC4899" }
          ].map(strat => {
            const isSel = activeStrategyFilter === strat.id;
            const Icon = strat.icon;
            return (
              <button
                key={strat.id}
                onClick={() => handleStrategyClick(strat.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  border: isSel ? `1px solid ${strat.color}` : "1px solid rgba(255,255,255,0.06)",
                  background: isSel ? "rgba(255, 255, 255, 0.08)" : "transparent",
                  color: isSel ? "#fff" : "var(--text-muted)",
                  padding: "2px 7px",
                  borderRadius: "4px",
                  fontSize: "10px",
                  fontWeight: isSel ? "700" : "500",
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
              >
                <Icon size={11} color={isSel ? strat.color : "var(--text-dim)"} />
                <span>{strat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Technical Drawing Overlay Layer Toggles */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <button
            onClick={() => setShowTrendlines(v => !v)}
            title="Toggle Trendlines"
            style={{
              padding: "2px 6px",
              borderRadius: "4px",
              border: "none",
              fontSize: "9.5px",
              fontWeight: "600",
              cursor: "pointer",
              background: showTrendlines ? "rgba(16, 185, 129, 0.18)" : "rgba(255,255,255,0.04)",
              color: showTrendlines ? "#34D399" : "var(--text-dim)"
            }}
          >
            📐 Lines
          </button>

          <button
            onClick={() => setShowChannels(v => !v)}
            title="Toggle Regression & Parallel Channels"
            style={{
              padding: "2px 6px",
              borderRadius: "4px",
              border: "none",
              fontSize: "9.5px",
              fontWeight: "600",
              cursor: "pointer",
              background: showChannels ? "rgba(6, 182, 212, 0.18)" : "rgba(255,255,255,0.04)",
              color: showChannels ? "var(--accent-cyan)" : "var(--text-dim)"
            }}
          >
            📏 Channels
          </button>

          <button
            onClick={() => setShowPatterns(v => !v)}
            title="Toggle Triangles, Head & Shoulders, ABCD"
            style={{
              padding: "2px 6px",
              borderRadius: "4px",
              border: "none",
              fontSize: "9.5px",
              fontWeight: "600",
              cursor: "pointer",
              background: showPatterns ? "rgba(139, 92, 246, 0.18)" : "rgba(255,255,255,0.04)",
              color: showPatterns ? "#C4B5FD" : "var(--text-dim)"
            }}
          >
            🔺 Patterns
          </button>

          <button
            onClick={() => setShowWaves(v => !v)}
            title="Toggle Elliott Waves (1-2-3-4-5 / A-B-C)"
            style={{
              padding: "2px 6px",
              borderRadius: "4px",
              border: "none",
              fontSize: "9.5px",
              fontWeight: "600",
              cursor: "pointer",
              background: showWaves ? "rgba(56, 189, 248, 0.18)" : "rgba(255,255,255,0.04)",
              color: showWaves ? "#38BDF8" : "var(--text-dim)"
            }}
          >
            🌊 Waves
          </button>

          <button
            onClick={() => setShowLevels(v => !v)}
            title="Toggle Support / Resistance & Breakout Triggers"
            style={{
              padding: "2px 6px",
              borderRadius: "4px",
              border: "none",
              fontSize: "9.5px",
              fontWeight: "600",
              cursor: "pointer",
              background: showLevels ? "rgba(245, 158, 11, 0.18)" : "rgba(255,255,255,0.04)",
              color: showLevels ? "#FBBF24" : "var(--text-dim)"
            }}
          >
            📊 S/R
          </button>
        </div>
      </div>

      {/* 3. CUSTOM DATE RANGE PICKER (Expands when Custom Range is active) */}
      {isCustomDate && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "rgba(139, 92, 246, 0.12)",
          border: "1px solid rgba(139, 92, 246, 0.35)",
          borderRadius: "6px",
          padding: "4px 8px",
          fontSize: "10.5px",
          color: "#fff",
          flexShrink: 0
        }}>
          <span>Start:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ background: "rgba(0,0,0,0.6)", border: "1px solid var(--border-subtle)", borderRadius: "4px", color: "#fff", padding: "1px 5px", fontSize: "10px" }}
          />
          <span>End:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ background: "rgba(0,0,0,0.6)", border: "1px solid var(--border-subtle)", borderRadius: "4px", color: "#fff", padding: "1px 5px", fontSize: "10px" }}
          />
          <button
            onClick={handleApplyCustomRange}
            style={{ background: "var(--accent-purple)", color: "#fff", border: "none", borderRadius: "4px", padding: "2px 7px", fontSize: "10px", fontWeight: "700", cursor: "pointer" }}
          >
            Apply
          </button>
        </div>
      )}

      {/* 4. MAIN CHART CANVAS WITH SVG AI PATTERNS OVERLAY */}
      <div 
        ref={wrapperRef} 
        style={{ 
          flex: 1, 
          width: "100%", 
          minHeight: 0, 
          position: "relative", 
          overflow: "hidden" 
        }}
      >
        {isLoadingData && (
          <div style={{
            position: "absolute",
            inset: 0,
            background: "rgba(11, 14, 23, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            color: "var(--accent-cyan)",
            fontSize: "12px",
            zIndex: 10
          }}>
            <Loader2 size={16} className="spin" />
            <span>Loading chart data & AI structures...</span>
          </div>
        )}

        {/* Lightweight Charts Canvas */}
        <div ref={chartContainerRef} style={{ width: "100%", height: "100%" }} />

        {/* TradingView-Style SVG AI Patterns Overlay */}
        <svg 
          style={{ 
            position: "absolute", 
            top: 0, 
            left: 0, 
            width: "100%", 
            height: "100%", 
            pointerEvents: "none", 
            zIndex: 4, 
            overflow: "hidden" 
          }}
        >
          <defs>
            <linearGradient id="chanGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="triGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.08" />
            </linearGradient>
          </defs>

          {svgElements.map((el) => {
            if (el.type === "channel") {
              return (
                <polygon 
                  key={el.key} 
                  points={el.points} 
                  fill="url(#chanGrad)" 
                  stroke={el.stroke} 
                  strokeDasharray={el.strokeDasharray} 
                  strokeWidth="1"
                />
              );
            }

            if (el.type === "polygon") {
              return (
                <g key={el.key}>
                  <polygon 
                    points={el.points} 
                    fill="url(#triGrad)" 
                    stroke={el.stroke} 
                    strokeWidth={el.strokeWidth || 1.5}
                  />
                  {el.label && (
                    <text 
                      x={parseInt(el.points.split(" ")[0].split(",")[0]) + 10} 
                      y={parseInt(el.points.split(" ")[0].split(",")[1]) - 8} 
                      fill="#C4B5FD" 
                      fontSize="9.5" 
                      fontWeight="700"
                    >
                      {el.label}
                    </text>
                  )}
                </g>
              );
            }

            if (el.type === "line") {
              return (
                <g key={el.key}>
                  <line 
                    x1={el.x1} y1={el.y1} 
                    x2={el.x2} y2={el.y2} 
                    stroke={el.stroke} 
                    strokeWidth={el.strokeWidth || 1.5}
                    strokeDasharray={el.strokeDasharray || "none"}
                  />
                  {el.label && (
                    <text 
                      x={el.x2 + 6} 
                      y={el.y2 + 3} 
                      fill={el.stroke} 
                      fontSize="9" 
                      fontWeight="600"
                    >
                      {el.label}
                    </text>
                  )}
                </g>
              );
            }

            if (el.type === "horizontal-level") {
              return (
                <g key={el.key}>
                  <line 
                    x1={0} y1={el.y} 
                    x2={wrapperSize.width - 55} y2={el.y} 
                    stroke={el.color} 
                    strokeWidth="1.2" 
                    strokeDasharray="4 3" 
                    opacity="0.8"
                  />
                  {/* Badge Pill */}
                  <rect 
                    x={wrapperSize.width - 150} 
                    y={el.y - 8} 
                    width="92" 
                    height="16" 
                    rx="3" 
                    fill="#111827" 
                    stroke={el.color} 
                    strokeWidth="1"
                    opacity="0.9"
                  />
                  <text 
                    x={wrapperSize.width - 104} 
                    y={el.y + 3.5} 
                    fill={el.color} 
                    fontSize="8.5" 
                    fontWeight="700" 
                    textAnchor="middle"
                  >
                    {el.label}
                  </text>
                </g>
              );
            }

            if (el.type === "head-shoulders") {
              return (
                <g key={el.key}>
                  {/* Neckline */}
                  {el.necklineY && (
                    <line 
                      x1={el.ls.x - 20} y1={el.necklineY} 
                      x2={el.rs.x + 40} y2={el.necklineY} 
                      stroke="#F43F5E" strokeWidth="1.5" strokeDasharray="3 3"
                    />
                  )}
                  {/* Left Shoulder */}
                  <circle cx={el.ls.x} cy={el.ls.y} r="5" fill="#F43F5E" stroke="#fff" strokeWidth="1.5" />
                  <text x={el.ls.x} y={el.ls.y - 8} fill="#F43F5E" fontSize="9" fontWeight="800" textAnchor="middle">LS</text>

                  {/* Head */}
                  <circle cx={el.head.x} cy={el.head.y} r="6" fill="#F43F5E" stroke="#fff" strokeWidth="1.5" />
                  <text x={el.head.x} y={el.head.y - 10} fill="#F43F5E" fontSize="10" fontWeight="900" textAnchor="middle">HEAD</text>

                  {/* Right Shoulder */}
                  <circle cx={el.rs.x} cy={el.rs.y} r="5" fill="#F43F5E" stroke="#fff" strokeWidth="1.5" />
                  <text x={el.rs.x} y={el.rs.y - 8} fill="#F43F5E" fontSize="9" fontWeight="800" textAnchor="middle">RS</text>

                  <line x1={el.ls.x} y1={el.ls.y} x2={el.head.x} y2={el.head.y} stroke="#F43F5E" strokeWidth="1.5" strokeDasharray="2 2" />
                  <line x1={el.head.x} y1={el.head.y} x2={el.rs.x} y2={el.rs.y} stroke="#F43F5E" strokeWidth="1.5" strokeDasharray="2 2" />
                </g>
              );
            }

            if (el.type === "abcd-pattern") {
              const [a, b, c, d] = el.points;
              return (
                <g key={el.key}>
                  {/* Subtle harmonic triangle shading */}
                  <polygon points={`${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y}`} fill="rgba(236, 72, 153, 0.10)" stroke="none" />
                  <polygon points={`${b.x},${b.y} ${c.x},${c.y} ${d.x},${d.y}`} fill="rgba(139, 92, 246, 0.10)" stroke="none" />
                  {/* Harmonic boundary lines */}
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#EC4899" strokeWidth="1.5" strokeDasharray="3 2" />
                  <line x1={b.x} y1={b.y} x2={c.x} y2={c.y} stroke="#EC4899" strokeWidth="1.5" strokeDasharray="3 2" />
                  <line x1={c.x} y1={c.y} x2={d.x} y2={d.y} stroke="#EC4899" strokeWidth="1.5" strokeDasharray="3 2" />
                  {/* Nodes */}
                  {el.points.map((pt, idx) => (
                    <g key={idx}>
                      <circle cx={pt.x} cy={pt.y} r="6" fill="#0B1329" stroke="#EC4899" strokeWidth="2" />
                      <text x={pt.x} y={pt.y + 3} fill="#fff" fontSize="8.5" fontWeight="900" textAnchor="middle">{pt.label}</text>
                    </g>
                  ))}
                  <text x={d.x + 8} y={d.y - 4} fill="#EC4899" fontSize="9" fontWeight="800">ABCD Pattern</text>
                </g>
              );
            }

            if (el.type === "pitchfork") {
              return (
                <g key={el.key}>
                  {/* Pitchfork handle & prongs */}
                  <line x1={el.c1.x} y1={el.c1.y} x2={el.midExt.x} y2={el.midExt.y} stroke="#38BDF8" strokeWidth="1.5" />
                  <line x1={el.c2.x} y1={el.c2.y} x2={el.upperExt.x} y2={el.upperExt.y} stroke="#38BDF8" strokeWidth="1.2" strokeDasharray="4 2" />
                  <line x1={el.c3.x} y1={el.c3.y} x2={el.lowerExt.x} y2={el.lowerExt.y} stroke="#38BDF8" strokeWidth="1.2" strokeDasharray="4 2" />
                  <line x1={el.c2.x} y1={el.c2.y} x2={el.c3.x} y2={el.c3.y} stroke="#38BDF8" strokeWidth="1" strokeDasharray="2 2" opacity="0.6" />
                  {/* Shading between prongs */}
                  <polygon points={`${el.c2.x},${el.c2.y} ${el.upperExt.x},${el.upperExt.y} ${el.lowerExt.x},${el.lowerExt.y} ${el.c3.x},${el.c3.y}`} fill="rgba(56, 189, 248, 0.05)" />
                  {/* Node points */}
                  <circle cx={el.c1.x} cy={el.c1.y} r="4" fill="#38BDF8" />
                  <circle cx={el.c2.x} cy={el.c2.y} r="4" fill="#38BDF8" />
                  <circle cx={el.c3.x} cy={el.c3.y} r="4" fill="#38BDF8" />
                  <text x={el.c1.x} y={el.c1.y - 6} fill="#38BDF8" fontSize="8.5" fontWeight="700">Pitchfork</text>
                </g>
              );
            }

            if (el.type === "elliott-waves") {
              const pts = el.points;
              const pathStr = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
              return (
                <g key={el.key}>
                  <path d={pathStr} fill="none" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.85" />
                  {pts.map((p, i) => (
                    <g key={i}>
                      <circle cx={p.x} cy={p.y} r="8" fill="#0B1329" stroke={p.color} strokeWidth="2" />
                      <text x={p.x} y={p.y + 3.5} fill="#fff" fontSize="9" fontWeight="900" textAnchor="middle">
                        {p.label}
                      </text>
                    </g>
                  ))}
                </g>
              );
            }

            return null;
          })}
        </svg>
      </div>

      {/* 5. BOTTOM TIME RANGE PRESETS BAR */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        paddingTop: "4px",
        marginTop: "2px",
        borderTop: "1px solid rgba(255, 255, 255, 0.08)",
        flexShrink: 0
      }}>
        {/* Left: Time Range Presets */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ fontSize: "9.5px", color: "var(--text-dim)", fontWeight: "600", marginRight: "4px" }}>
            RANGE:
          </span>

          <div style={{ display: "flex", background: "rgba(0,0,0,0.4)", borderRadius: "4px", padding: "1px", border: "1px solid var(--border-subtle)" }}>
            {periods.map((p) => {
              const isActive = !isCustomDate && period === p.value;
              return (
                <button
                  key={p.label}
                  onClick={() => handleSelectPeriod(p)}
                  style={{
                    border: "none",
                    background: isActive ? "rgba(6, 182, 212, 0.25)" : "transparent",
                    color: isActive ? "var(--accent-cyan)" : "var(--text-muted)",
                    padding: "2px 7px",
                    borderRadius: "3px",
                    fontSize: "10px",
                    fontWeight: isActive ? "700" : "500",
                    cursor: "pointer"
                  }}
                >
                  {p.label}
                </button>
              );
            })}

            <button
              onClick={() => setIsCustomDate(prev => !prev)}
              style={{
                border: "none",
                background: isCustomDate ? "rgba(139, 92, 246, 0.3)" : "transparent",
                color: isCustomDate ? "#C4B5FD" : "var(--text-muted)",
                padding: "2px 7px",
                borderRadius: "3px",
                fontSize: "10px",
                fontWeight: isCustomDate ? "700" : "500",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "2px"
              }}
            >
              <Calendar size={10} />
              <span>Custom</span>
            </button>
          </div>
        </div>

        {/* Right: Active View Status & Strategy Hint */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "9.5px", color: "var(--text-dim)" }}>
          <Clock size={10} />
          <span>
            {isCustomDate ? `${startDate} to ${endDate}` : `${period.toUpperCase()} • ${interval}`}
          </span>
        </div>
      </div>
    </div>
  );
}

export default CandlestickChart;
