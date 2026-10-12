/**
 * Client-Side AI Pattern & Strategy Detector
 * Computes pixel-precise coordinates for TradingView-style technical analysis:
 * 1. Trendlines, Channels, & Trend Angles
 * 2. Horizontal Support & Resistance Levels (Flat top / bottom)
 * 3. Chart Patterns (Triangles, Head & Shoulders, ABCD)
 * 4. Elliott Waves (1-2-3-4-5 Impulse & A-B-C Correction)
 * 5. Scalp Micro-Pivots & Triggers
 */

export function detectAIPatterns(candles) {
  if (!candles || candles.length < 15) return null;

  const times = candles.map(c => c.time);
  const closes = candles.map(c => Number(c.close));
  const highs = candles.map(c => Number(c.high));
  const lows = candles.map(c => Number(c.low));
  const n = closes.length;
  const currentPrice = closes[n - 1];

  // 1. Detect Swing Pivots (ZigZag)
  const window = 4;
  const pivots = [];
  for (let i = window; i < n - window; i++) {
    const isHigh = highs[i] === Math.max(...highs.slice(i - window, i + window + 1));
    const isLow = lows[i] === Math.min(...lows.slice(i - window, i + window + 1));
    if (isHigh) {
      pivots.push({ type: "HIGH", time: times[i], price: highs[i], index: i });
    } else if (isLow) {
      pivots.push({ type: "LOW", time: times[i], price: lows[i], index: i });
    }
  }

  // Filter consecutive duplicate pivots
  const cleanPivots = [];
  for (const p of pivots) {
    if (cleanPivots.length === 0) {
      cleanPivots.push(p);
    } else {
      const last = cleanPivots[cleanPivots.length - 1];
      if (p.type !== last.type) {
        cleanPivots.push(p);
      } else {
        if (p.type === "HIGH" && p.price > last.price) cleanPivots[cleanPivots.length - 1] = p;
        if (p.type === "LOW" && p.price < last.price) cleanPivots[cleanPivots.length - 1] = p;
      }
    }
  }

  // 2. Trendlines & Linear Regression Channel
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += closes[i];
    sumXY += i * closes[i];
    sumX2 += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  let sumResSq = 0;
  for (let i = 0; i < n; i++) {
    const regVal = slope * i + intercept;
    sumResSq += (closes[i] - regVal) ** 2;
  }
  const stdDev = Math.sqrt(sumResSq / n);

  const regStart = intercept;
  const regEnd = slope * (n - 1) + intercept;
  const bandOffset = stdDev * 1.75;

  const regressionChannel = {
    start_time: times[0],
    end_time: times[n - 1],
    mid_start: regStart,
    mid_end: regEnd,
    upper_start: regStart + bandOffset,
    upper_end: regEnd + bandOffset,
    lower_start: regStart - bandOffset,
    lower_end: regEnd - bandOffset,
    color: slope >= 0 ? "#06B6D4" : "#F59E0B"
  };

  const highPivots = cleanPivots.filter(p => p.type === "HIGH");
  const lowPivots = cleanPivots.filter(p => p.type === "LOW");

  let resistanceTrendline = null;
  if (highPivots.length >= 2) {
    const p1 = highPivots[highPivots.length - 2];
    const p2 = highPivots[highPivots.length - 1];
    resistanceTrendline = { start: p1, end: p2, label: "Resistance Trendline", color: "#EF4444" };
  }

  let supportTrendline = null;
  if (lowPivots.length >= 2) {
    const p1 = lowPivots[lowPivots.length - 2];
    const p2 = lowPivots[lowPivots.length - 1];
    supportTrendline = { start: p1, end: p2, label: "Support Trendline", color: "#10B981" };
  }

  // 3. Support & Resistance Horizontal Zones (Flat Top / Bottom)
  const sortedCloses = [...closes].sort((a, b) => a - b);
  const supPrice = sortedCloses[Math.floor(n * 0.08)];
  const resPrice = sortedCloses[Math.floor(n * 0.92)];
  const midPrice = (supPrice + resPrice) / 2;

  const horizontalLevels = [
    { price: resPrice, label: "Resistance Zone (Flat Top)", color: "#EF4444" },
    { price: midPrice, label: "Equilibrium Midline", color: "rgba(255,255,255,0.4)" },
    { price: supPrice, label: "Support Zone (Flat Bottom)", color: "#10B981" }
  ];

  // 4. Triangle Pattern Detection
  let trianglePattern = null;
  if (highPivots.length >= 2 && lowPivots.length >= 2) {
    const h1 = highPivots[highPivots.length - 2];
    const h2 = highPivots[highPivots.length - 1];
    const l1 = lowPivots[lowPivots.length - 2];
    const l2 = lowPivots[lowPivots.length - 1];

    const hDiff = h2.price - h1.price;
    const lDiff = l2.price - l1.price;

    let triName = "Symmetrical Triangle";
    if (Math.abs(hDiff) < Math.abs(lDiff) * 0.4) {
      triName = "Ascending Triangle (Bullish)";
    } else if (Math.abs(lDiff) < Math.abs(hDiff) * 0.4) {
      triName = "Descending Triangle (Bearish)";
    }

    trianglePattern = {
      name: triName,
      upper: { start: h1, end: h2 },
      lower: { start: l1, end: l2 },
      target: (h2.price + l2.price) / 2
    };
  }

  // 5. Head and Shoulders Detection
  let headAndShoulders = null;
  if (highPivots.length >= 3) {
    const s1 = highPivots[highPivots.length - 3];
    const h = highPivots[highPivots.length - 2];
    const s2 = highPivots[highPivots.length - 1];
    if (h.price > s1.price && h.price > s2.price && Math.abs(s1.price - s2.price) / s1.price < 0.05) {
      headAndShoulders = {
        name: "Head & Shoulders (Bearish)",
        leftShoulder: s1,
        head: h,
        rightShoulder: s2,
        neckline: Math.min(s1.price, s2.price) * 0.985
      };
    }
  }

  // 6. ABCD Harmonic Pattern
  let abcdPattern = null;
  if (cleanPivots.length >= 4) {
    const a = cleanPivots[cleanPivots.length - 4];
    const b = cleanPivots[cleanPivots.length - 3];
    const c = cleanPivots[cleanPivots.length - 2];
    const d = cleanPivots[cleanPivots.length - 1];
    abcdPattern = {
      name: "ABCD Pattern",
      points: [a, b, c, d]
    };
  }

  // 6b. Andrews Pitchfork
  let pitchfork = null;
  if (cleanPivots.length >= 3) {
    const p1 = cleanPivots[cleanPivots.length - 3];
    const p2 = cleanPivots[cleanPivots.length - 2];
    const p3 = cleanPivots[cleanPivots.length - 1];
    pitchfork = {
      name: "Andrews Pitchfork",
      p1, p2, p3
    };
  }

  // 7. Elliott Waves (1-2-3-4-5 & A-B-C)
  let elliottWaves = null;
  if (cleanPivots.length >= 5) {
    const recent = cleanPivots.slice(-8);
    const impulse = recent.slice(0, 5).map((p, idx) => ({
      wave: ["1", "2", "3", "4", "5"][idx],
      time: p.time,
      price: p.price
    }));

    const correction = recent.length >= 8 ? recent.slice(5, 8).map((p, idx) => ({
      wave: ["A", "B", "C"][idx],
      time: p.time,
      price: p.price
    })) : [];

    elliottWaves = {
      impulse,
      correction
    };
  }

  // 8. Scalping Micro Levels
  const isFx = currentPrice < 50;
  const scalpSlDist = currentPrice * (isFx ? 0.0025 : 0.005);
  const scalpTpDist = scalpSlDist * 1.8;

  const scalpingLevels = {
    buyTarget: currentPrice + scalpTpDist,
    buySL: currentPrice - scalpSlDist,
    sellTarget: currentPrice - scalpTpDist,
    sellSL: currentPrice + scalpSlDist,
    trigger: currentPrice
  };

  return {
    currentPrice,
    trendlines: {
      resistance: resistanceTrendline,
      support: supportTrendline,
      channel: regressionChannel,
      angle: Math.round(Math.atan(slope / (currentPrice * 0.01)) * (180 / Math.PI))
    },
    range: {
      support: supPrice,
      resistance: resPrice,
      mid: midPrice,
      levels: horizontalLevels
    },
    breakout: {
      triangle: trianglePattern,
      headAndShoulders,
      abcd: abcdPattern,
      pitchfork,
      breakoutUp: Math.max(...highs.slice(-20)),
      breakoutDown: Math.min(...lows.slice(-20))
    },
    scalping: scalpingLevels,
    elliottWaves,
    pivots: cleanPivots
  };
}
