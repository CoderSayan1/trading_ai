const API_BASE = "http://127.0.0.1:8000";

export const api = {
  async getAssets(category = null, page = 1, limit = 20, search = "") {
    const params = new URLSearchParams();
    if (category) params.append("category", category);
    params.append("page", page);
    params.append("limit", limit);
    if (search) params.append("search", search);
    const res = await fetch(`${API_BASE}/api/market/assets?${params.toString()}`);
    return res.json();
  },

  async getSessions() {
    const res = await fetch(`${API_BASE}/api/market/sessions`);
    return res.json();
  },

  async searchMarket(query) {
    const res = await fetch(`${API_BASE}/api/market/search?q=${encodeURIComponent(query)}`);
    return res.json();
  },

  async getHistory(symbol, interval = "5m", period = "2d", startDate = null, endDate = null) {
    const params = new URLSearchParams();
    params.append("interval", interval);
    if (period && !startDate) params.append("period", period);
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);
    const res = await fetch(`${API_BASE}/api/market/history/${encodeURIComponent(symbol)}?${params.toString()}`);
    return res.json();
  },

  async getEodPredictions(category = null) {
    const url = category ? `${API_BASE}/api/ai/eod-predictions?category=${category}` : `${API_BASE}/api/ai/eod-predictions`;
    const res = await fetch(url);
    return res.json();
  },

  async triggerEodScan() {
    const res = await fetch(`${API_BASE}/api/ai/eod-scan`, { method: "POST" });
    return res.json();
  },

  async getEodScanStatus() {
    const res = await fetch(`${API_BASE}/api/ai/eod-scan/status`);
    return res.json();
  },

  async getSnapshot(symbol) {
    const res = await fetch(`${API_BASE}/api/market/snapshot/${encodeURIComponent(symbol)}`);
    return res.json();
  },

  async getAccount(currency = "INR") {
    const res = await fetch(`${API_BASE}/api/trading/account?currency=${currency}`);
    return res.json();
  },

  async getStrategy() {
    const res = await fetch(`${API_BASE}/api/trading/strategy`);
    return res.json();
  },

  async updateStrategy(settings) {
    const res = await fetch(`${API_BASE}/api/trading/strategy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    return res.json();
  },

  async getPositions() {
    const res = await fetch(`${API_BASE}/api/trading/positions`);
    if (!res.ok) {
      throw new Error(`Failed to fetch positions (${res.status})`);
    }
    return res.json();
  },

  async placeOrder(order) {
    const res = await fetch(`${API_BASE}/api/trading/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || `Order failed (${res.status})`);
    }
    return data;
  },

  async closeOrder(orderId) {
    const res = await fetch(`${API_BASE}/api/trading/order/close/${orderId}`, {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || `Close failed (${res.status})`);
    }
    return data;
  },

  async closeAllOrders(symbol = null) {
    const url = symbol ? `${API_BASE}/api/trading/order/close_all?symbol=${encodeURIComponent(symbol)}` : `${API_BASE}/api/trading/order/close_all`;
    const res = await fetch(url, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || `Close all failed (${res.status})`);
    }
    return data;
  },

  async resetAccount() {
    const res = await fetch(`${API_BASE}/api/trading/reset`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || `Reset failed (${res.status})`);
    }
    return data;
  },

  async getJevDecision(symbol) {
    const res = await fetch(`${API_BASE}/api/ai/jev/${encodeURIComponent(symbol)}`);
    return res.json();
  },

  async getOllamaReasoning(symbol) {
    const res = await fetch(`${API_BASE}/api/ai/ollama/${encodeURIComponent(symbol)}`);
    return res.json();
  },

  async getStrategyOverlay(symbol) {
    const res = await fetch(`${API_BASE}/api/ai/strategy-overlay/${encodeURIComponent(symbol)}`);
    return res.json();
  },

  async getLearningStats(symbol = null) {
    const url = symbol ? `${API_BASE}/api/trading/learning-stats?symbol=${encodeURIComponent(symbol)}` : `${API_BASE}/api/trading/learning-stats`;
    const res = await fetch(url);
    return res.json();
  },

  async getExecutions(symbol = null, status = null, limit = 500) {
    const params = new URLSearchParams();
    if (symbol) params.append("symbol", symbol);
    if (status) params.append("status", status);
    params.append("limit", limit);
    const res = await fetch(`${API_BASE}/api/trading/executions?${params.toString()}`);
    return res.json();
  },

  async sendChatMessage(query, symbol) {
    const res = await fetch(`${API_BASE}/api/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, symbol }),
    });
    return res.json();
  }
};
