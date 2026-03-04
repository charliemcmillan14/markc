// Market Sentiment — builds a Fear/Greed-style score
// Uses: price momentum of S&P proxy stocks, % of stocks up vs down
// All from Finnhub free tier, no extra keys

const SENTIMENT_SYMS = [
  'AAPL','MSFT','NVDA','AMZN','TSLA','META','GOOGL','JPM',
  'GS','V','AMD','XOM','LLY','COST','UNH','JNJ','WMT','BAC'
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const key = process.env.FINNHUB_API_KEY;
  if (!key) return res.status(500).json({ error: 'FINNHUB_API_KEY not configured' });

  try {
    // Fetch all quotes in parallel
    const results = await Promise.allSettled(
      SENTIMENT_SYMS.map(sym =>
        fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${key}`, { signal: AbortSignal.timeout(8000) })
          .then(r => r.json())
          .then(d => ({ symbol: sym, changePct: d.dp || 0, price: d.c || 0 }))
      )
    );

    const quotes = results
      .filter(r => r.status === 'fulfilled' && r.value.price > 0)
      .map(r => r.value);

    if (!quotes.length) throw new Error('no quotes');

    const up      = quotes.filter(q => q.changePct >= 0).length;
    const down    = quotes.filter(q => q.changePct < 0).length;
    const total   = quotes.length;
    const avgChg  = quotes.reduce((s, q) => s + q.changePct, 0) / total;
    const pctUp   = (up / total) * 100;

    // Score 0–100: 50 = neutral, >70 = greed, <30 = fear
    // Weighted: 60% breadth (% stocks up), 40% avg momentum
    const breadthScore   = pctUp;                               // 0–100
    const momentumScore  = Math.min(100, Math.max(0, 50 + avgChg * 8)); // normalized
    const score = Math.round(breadthScore * 0.6 + momentumScore * 0.4);

    let label, color;
    if      (score >= 75) { label = 'Extreme Greed'; color = '#1FD47A'; }
    else if (score >= 60) { label = 'Greed';          color = '#5DD67A'; }
    else if (score >= 45) { label = 'Neutral';        color = '#FFBB33'; }
    else if (score >= 30) { label = 'Fear';            color = '#FF8C42'; }
    else                  { label = 'Extreme Fear';   color = '#FF3D5A'; }

    res.status(200).json({
      score,
      label,
      color,
      breadth:    { up, down, total, pctUp: +pctUp.toFixed(1) },
      avgChangePct: +avgChg.toFixed(2),
      stocks: quotes.sort((a, b) => b.changePct - a.changePct),
      timestamp: Date.now(),
    });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
