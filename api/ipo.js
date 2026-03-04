export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  if (req.method==='OPTIONS') return res.status(200).end();
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return res.status(500).json({error:'FINNHUB_API_KEY missing'});
  const from = new Date().toISOString().split('T')[0];
  const to   = new Date(Date.now()+60*86400000).toISOString().split('T')[0];
  try {
    const r = await fetch(`https://finnhub.io/api/v1/calendar/ipo?from=${from}&to=${to}&token=${key}`,{signal:AbortSignal.timeout(8000)});
    const d = await r.json();
    const ipos = (d.ipoCalendar||[]).slice(0,30).map(i=>({
      symbol:      i.symbol,
      name:        i.name,
      date:        i.date,
      price:       i.price,
      shares:      i.numberOfShares,
      totalShares: i.totalSharesValue,
      status:      i.status,
      exchange:    i.exchange,
    }));
    res.status(200).json({from,to,ipos});
  } catch(e) { res.status(502).json({error:e.message}); }
}
