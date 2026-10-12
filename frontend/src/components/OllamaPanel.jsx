import React, { useState, useRef, useEffect } from "react";
import { Brain, MessageSquare, Send, Sparkles, X, ChevronDown, Trash2, Bot } from "lucide-react";
import { api } from "../services/api";

export function OllamaPanel({ reasoning, symbol, liveSnapshot }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: "ai",
      text: "System 2 Macro Engine online. Ask me about technical confluence, stop-loss strategy, or RBI/Fed macroeconomic context."
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll chat to latest message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSend = async (queryText = null) => {
    const query = queryText || input;
    if (!query.trim() || loading) return;

    setMessages((prev) => [...prev, { sender: "user", text: query }]);
    if (!queryText) setInput("");
    setLoading(true);

    try {
      const res = await api.sendChatMessage(query, symbol);
      setMessages((prev) => [...prev, { sender: "ai", text: res.reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev, 
        { sender: "ai", text: "Error contacting Ollama assistant. Check backend connection." }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        sender: "ai",
        text: "System 2 Macro Engine online. Ask me about technical confluence, stop-loss strategy, or RBI/Fed macroeconomic context."
      }
    ]);
  };

  const sentiment = reasoning?.sentiment_score || 0.0;
  const isPositive = sentiment >= 0;

  return (
    <>
      {/* Floating Dialog Window */}
      {isOpen && (
        <div
          id="ollama-floating-window"
          style={{
            position: "fixed",
            bottom: "92px",
            right: "calc(340px + 28px)",
            width: "390px",
            maxWidth: "calc(100vw - 380px)",
            height: "560px",
            maxHeight: "calc(100vh - 120px)",
            zIndex: 10000,
            display: "flex",
            flexDirection: "column",
            background: "rgba(10, 14, 23, 0.96)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(139, 92, 246, 0.4)",
            borderRadius: "16px",
            boxShadow: "0 20px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(139, 92, 246, 0.25)",
            overflow: "hidden",
            animation: "fadeSlideUp 0.22s ease-out",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "12px 16px",
              background: "rgba(19, 25, 38, 0.85)",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: "linear-gradient(135deg, rgba(139, 92, 246, 0.35), rgba(99, 102, 241, 0.25))",
                  border: "1px solid rgba(139, 92, 246, 0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Brain size={18} color="var(--accent-purple)" />
              </div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: "700", color: "#fff", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>OLLAMA // SYSTEM 2</span>
                  <span
                    style={{
                      fontSize: "9px",
                      padding: "1px 6px",
                      borderRadius: "8px",
                      background: reasoning?.available ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                      color: reasoning?.available ? "var(--accent-green)" : "var(--accent-amber)",
                      border: `1px solid ${reasoning?.available ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.3)"}`,
                      fontWeight: "600",
                    }}
                  >
                    {reasoning?.available ? "ACTIVE" : "STANDBY"}
                  </span>
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>
                  {reasoning?.model || "Llama 3 (Local LLM)"} • {symbol}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                onClick={handleClearChat}
                title="Clear conversation"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-dim)",
                  cursor: "pointer",
                  padding: "6px",
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-main)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-dim)")}
              >
                <Trash2 size={14} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Minimize chat"
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  padding: "5px",
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)";
                  e.currentTarget.style.color = "#fff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                  e.currentTarget.style.color = "var(--text-muted)";
                }}
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Market Regime & Sentiment Banner */}
          {reasoning && (
            <div
              style={{
                margin: "12px 14px 0",
                background: "rgba(255, 255, 255, 0.03)",
                padding: "10px 12px",
                borderRadius: "10px",
                border: "1px solid rgba(139, 92, 246, 0.2)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <span style={{ fontSize: "10px", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Classified Regime
                </span>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--accent-purple)" }}>
                  {reasoning.market_regime}
                </span>
              </div>

              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "6px", lineHeight: "1.4" }}>
                {reasoning.macro_summary}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10px" }}>
                <span style={{ color: "var(--text-dim)" }}>Sentiment Score:</span>
                <span className="mono" style={{ color: isPositive ? "var(--accent-green)" : "var(--accent-red)", fontWeight: "700" }}>
                  {isPositive ? "+" : ""}{sentiment.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Interactive Chat Messages Area */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {messages.map((m, idx) => (
              <div
                key={idx}
                style={{
                  alignSelf: m.sender === "user" ? "flex-end" : "flex-start",
                  maxWidth: "88%",
                  background: m.sender === "user" ? "rgba(56, 189, 248, 0.18)" : "rgba(255, 255, 255, 0.05)",
                  border: `1px solid ${m.sender === "user" ? "rgba(56, 189, 248, 0.35)" : "rgba(255, 255, 255, 0.09)"}`,
                  padding: "8px 12px",
                  borderRadius: m.sender === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                  fontSize: "12px",
                  lineHeight: "1.45",
                  color: m.sender === "user" ? "#fff" : "var(--text-main)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                }}
              >
                {m.text}
              </div>
            ))}
            {loading && (
              <div
                style={{
                  alignSelf: "flex-start",
                  fontSize: "11px",
                  color: "var(--accent-purple)",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "rgba(139, 92, 246, 0.1)",
                  padding: "6px 10px",
                  borderRadius: "8px",
                  border: "1px solid rgba(139, 92, 246, 0.2)",
                }}
              >
                <Sparkles size={13} className="pulsing-dot" />
                <span>Thinking & evaluating macro thesis...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div
            style={{
              display: "flex",
              gap: "6px",
              overflowX: "auto",
              padding: "6px 14px",
              background: "rgba(0,0,0,0.2)",
              borderTop: "1px solid rgba(255, 255, 255, 0.05)",
            }}
          >
            {[
              "Why is SL placed here?",
              "Explain technical confluence",
              "What is current risk?",
              "Macro & RBI outlook"
            ].map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSend(prompt)}
                style={{
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  background: "rgba(255, 255, 255, 0.04)",
                  color: "var(--text-muted)",
                  padding: "4px 9px",
                  borderRadius: "12px",
                  fontSize: "10px",
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent-purple)";
                  e.currentTarget.style.color = "#fff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                  e.currentTarget.style.color = "var(--text-muted)";
                }}
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input & Send Area */}
          <div
            style={{
              padding: "10px 14px 14px",
              background: "rgba(15, 20, 31, 0.95)",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              gap: "8px",
            }}
          >
            <input
              type="text"
              placeholder={`Ask Ollama about ${symbol}...`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              style={{
                flex: 1,
                background: "rgba(0, 0, 0, 0.4)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "8px",
                padding: "8px 12px",
                color: "#fff",
                fontSize: "12px",
                outline: "none",
                transition: "border-color 0.2s ease",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent-purple)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.12)")}
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              style={{
                background: loading || !input.trim() ? "rgba(139, 92, 246, 0.3)" : "var(--accent-purple)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "0 14px",
                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.2s ease",
              }}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Floating Action Button - Perfect Circle */}
      <div
        style={{
          position: "fixed",
          bottom: "28px",
          right: "calc(340px + 28px)",
          zIndex: 10000,
          display: "flex",
          alignItems: "center",
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Hover Tooltip Pill */}
        <div
          style={{
            position: "absolute",
            right: "68px",
            whiteSpace: "nowrap",
            background: "rgba(10, 14, 23, 0.95)",
            border: "1px solid rgba(139, 92, 246, 0.4)",
            color: "#fff",
            padding: "6px 12px",
            borderRadius: "8px",
            fontSize: "11px",
            fontWeight: "600",
            boxShadow: "0 4px 16px rgba(0,0,0,0.6)",
            pointerEvents: "none",
            transition: "opacity 0.2s ease, transform 0.2s ease",
            opacity: isHovered && !isOpen ? 1 : 0,
            transform: isHovered && !isOpen ? "translateX(0)" : "translateX(8px)",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span style={{ color: "var(--accent-purple)" }}>★</span>
          <span>Ollama AI Strategist (System 2)</span>
        </div>

        {/* Circular Button */}
        <button
          id="ollama-floating-fab"
          onClick={() => setIsOpen((prev) => !prev)}
          title={isOpen ? "Close Ollama AI Chat" : "Open Ollama AI Strategist"}
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: isOpen
              ? "rgba(19, 25, 38, 0.96)"
              : "linear-gradient(135deg, #8B5CF6 0%, #6366F1 50%, #3B82F6 100%)",
            border: isOpen
              ? "2px solid rgba(139, 92, 246, 0.6)"
              : "2px solid rgba(255, 255, 255, 0.35)",
            boxShadow: isOpen
              ? "0 8px 30px rgba(0, 0, 0, 0.7), 0 0 20px rgba(139, 92, 246, 0.4)"
              : "0 8px 25px rgba(124, 58, 237, 0.6), 0 0 20px rgba(99, 102, 241, 0.45)",
            color: "#fff",
            cursor: "pointer",
            transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease",
            outline: "none",
            padding: 0,
            transform: isHovered ? "scale(1.08)" : "scale(1)",
          }}
        >
          {isOpen ? (
            <X size={22} color="#fff" />
          ) : (
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Brain size={25} color="#fff" />
              {/* Active status pulse dot */}
              <span
                style={{
                  position: "absolute",
                  top: "-4px",
                  right: "-4px",
                  width: "11px",
                  height: "11px",
                  borderRadius: "50%",
                  background: reasoning?.available ? "var(--accent-green)" : "var(--accent-amber)",
                  border: "2px solid #0D111A",
                  boxShadow: `0 0 8px ${reasoning?.available ? "var(--accent-green)" : "var(--accent-amber)"}`,
                }}
              />
            </div>
          )}
        </button>
      </div>
    </>
  );
}
