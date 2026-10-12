import { useState, useEffect, useRef } from "react";

export function useTradingSocket(symbol) {
  const [liveCandle, setLiveCandle] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [jevSignal, setJevSignal] = useState(null);
  const [accountInr, setAccountInr] = useState(null);
  const [accountUsd, setAccountUsd] = useState(null);
  const [openPositions, setOpenPositions] = useState([]);
  const [latestAlert, setLatestAlert] = useState(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  useEffect(() => {
    if (!symbol) return;

    let isMounted = true;
    setLiveCandle(null);
    setSnapshot(null);

    const connect = () => {
      if (!isMounted) return;
      const wsHost = typeof window !== "undefined" && window.location.hostname ? window.location.hostname : "127.0.0.1";
      const wsUrl = `ws://${wsHost}:8000/ws/live/${encodeURIComponent(symbol)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (isMounted) setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "TICK_UPDATE") {
            if (data.symbol && data.symbol !== symbol) return;

            if (data.candle) setLiveCandle({ ...data.candle, symbol: data.symbol });
            if (data.snapshot) setSnapshot(data.snapshot);
            if (data.jev_signal) setJevSignal(data.jev_signal);
            if (data.account_inr) setAccountInr(data.account_inr);
            if (data.account_usd) setAccountUsd(data.account_usd);
            if (data.open_positions) setOpenPositions(data.open_positions);
            if (data.auto_trade_alert) setLatestAlert(data.auto_trade_alert);
          }
        } catch (err) {
          console.error("WS Parse error", err);
        }
      };

      ws.onclose = () => {
        if (isMounted) {
          setConnected(false);
          // Auto-reconnect after 1.5s
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(connect, 1500);
        }
      };

      ws.onerror = (err) => {
        console.warn("WebSocket error:", err);
        if (isMounted) setConnected(false);
      };
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        wsRef.current.close();
      }
    };
  }, [symbol]);

  return {
    liveCandle,
    snapshot,
    jevSignal,
    accountInr,
    accountUsd,
    openPositions,
    latestAlert,
    connected,
  };
}
