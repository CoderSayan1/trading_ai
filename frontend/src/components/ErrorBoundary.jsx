import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an unhandled component error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "rgba(19, 25, 38, 0.8)",
          borderRadius: "12px",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          color: "#fff",
          textAlign: "center",
          gap: "12px"
        }}>
          <AlertTriangle size={32} color="#EF4444" />
          <div style={{ fontSize: "14px", fontWeight: "700" }}>
            Chart Render Recovered
          </div>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", maxWidth: "340px", margin: 0 }}>
            An unexpected data format was safely caught to prevent a black screen crash.
          </p>
          <button
            onClick={this.handleReset}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(6, 182, 212, 0.2)",
              border: "1px solid var(--accent-cyan)",
              borderRadius: "6px",
              color: "var(--accent-cyan)",
              padding: "6px 14px",
              fontSize: "11px",
              fontWeight: "700",
              cursor: "pointer"
            }}
          >
            <RefreshCw size={12} />
            <span>Reload Chart View</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
