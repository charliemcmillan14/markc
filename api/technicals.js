// ─────────────────────────────────────────────────────────────
// TECHNICALS.JS — Compute RSI, SMA, EMA from Finnhub candles
// ─────────────────────────────────────────────────────────────

function calcSMA(prices, period) {
  return prices.map((_, i) => {
    if (i < period - 1) return null;
    const slice = prices.slice(i - period + 1, i + 1);
    return slice.reduce((s, v) => s + v, 0) / period;
  });
}

function calcEMA(prices, period) {
  const k = 2 / (period + 1);
  const result = [];
  let prev = null;
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    if (i === period - 1) {
      prev = prices.slice(0, period).reduce((s, v) => s + v, 0) / period;
      result.push(prev); continue;
    }
    prev = prices[i] * k + prev * (1 - k);
    result.push(prev);
  }
  return result;
}

function calcRSI(prices, period = 14) {
  const result = Array(period).fill(null);
  let avgGain = 0, avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) avgGain += diff; else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;

  const push = (ag, al) => {
    if (al === 0) return 100;
    const rs = ag / al;
    return 100 - 100 / (1 + rs);
  };
  result.push(push(avgGain, avgLoss));

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result.push(push(avgGain, avgLoss));
  }
  return result;
}

function calcBollinger(prices, period = 20, stdDevMult = 2) {
  const sma = calcSMA(prices, period);
  return prices.map((_, i) => {
    if (sma[i] === null) return { mid: null, upper: null, lower: null };
    const slice = prices.slice(i - period + 1, i + 1);
    const variance = slice.reduce((s, v) => s + Math.pow(v - sma[i], 2), 0) / period;
    const std = Math.sqrt(variance);
    return { mid: sma[i], upper: sma[i] + stdDevMult * std, lower: sma[i] - stdDevMult * std };
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const symbol     = (req.query.symbol || 'AAPL').toUpperCase().trim();
  const resolution = req.query.resolution || 'D';
  const days       = Math.min(parseInt(req.query.days || '90', 10), 365);
  const key        = process.env.FINNHUB_API_KEY;

  if (!key) return res.status(500).json({ error: 'FINNHUB_API_KEY not configured' });

  const now  = Math.floor(Date.now() / 1000);
  const from = now - days * 86400;

  try {
    const r = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}&from=${from}&to=${now}&token=${key}`, { signal: AbortSignal.timeout(10000) });
    const d = await r.json();

    if (d.s !== 'ok') return res.status(200).json({ symbol, candles: [], indicators: {} });

    const candles = d.t.map((t, i) => ({ time: t, open: d.o[i], high: d.h[i], low: d.l[i], close: d.c[i], volume: d.v[i] }));
    const closes  = candles.map(c => c.close);

    const indicators = {
      sma20:    calcSMA(closes, 20),
      sma50:    calcSMA(closes, 50),
      ema12:    calcEMA(closes, 12),
      ema26:    calcEMA(closes, 26),
      rsi14:    calcRSI(closes, 14),
      bollinger: calcBollinger(closes, 20, 2),
    };

    // MACD = EMA12 - EMA26
    indicators.macd = indicators.ema12.map((v, i) => {
      if (v === null || indicators.ema26[i] === null) return null;
      return v - indicators.ema26[i];
    });

    res.status(200).json({ symbol, resolution, days, candles, indicators });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
