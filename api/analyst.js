export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  if (req.method==='OPTIONS') return res.status(200).end();
  const symbol = (req.query.symbol||'AAPL').toUpperCase().trim();
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return res.status(500).json({error:'FINNHUB_API_KEY missing'});
  try {
    const [recRes, targetRes, trendsRes] = await Promise.allSettled([
      fetch(`https://finnhub.io/api/v1/stock/recommendation?symbol=${encodeURIComponent(symbol)}&token=${key}`,{signal:AbortSignal.timeout(8000)}),
      fetch(`https://finnhub.io/api/v1/stock/price-target?symbol=${encodeURIComponent(symbol)}&token=${key}`,{signal:AbortSignal.timeout(8000)}),
      fetch(`https://finnhub.io/api/v1/stock/peers?symbol=${encodeURIComponent(symbol)}&token=${key}`,{signal:AbortSignal.timeout(8000)}),
    ]);
    const recs   = recRes.status==='fulfilled'    ? await recRes.value.json()    : [];
    const target = targetRes.status==='fulfilled'  ? await targetRes.value.json() : {};
    const peers  = trendsRes.status==='fulfilled'  ? await trendsRes.value.json() : [];
    res.status(200).json({
      symbol,
      recommendations: Array.isArray(recs) ? recs.slice(0,6) : [],
      priceTarget: {
        low:    target.targetLow    || null,
        high:   target.targetHigh   || null,
        mean:   target.targetMean   || null,
        median: target.targetMedian || null,
      },
      peers: Array.isArray(peers) ? peers.slice(0,8) : [],
    });
  } catch(e) { res.status(502).json({error:e.message}); }
}
