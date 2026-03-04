const WATCHLIST = ['AAPL','MSFT','NVDA','AMZN','TSLA','META','GOOGL','JPM','GS','AMD','NFLX','XOM','LLY','V','MA'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  if (req.method==='OPTIONS') return res.status(200).end();
  const symbol = (req.query.symbol||'').toUpperCase().trim();
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return res.status(500).json({error:'FINNHUB_API_KEY missing'});

  const syms = symbol ? [symbol] : WATCHLIST.slice(0,10);
  try {
    const results = await Promise.allSettled(
      syms.map(async sym => {
        const r = await fetch(`https://finnhub.io/api/v1/stock/insider-transactions?symbol=${encodeURIComponent(sym)}&token=${key}`,{signal:AbortSignal.timeout(8000)});
        const d = await r.json();
        return (d.data||[]).slice(0,5).map(t=>({...t,symbol:sym}));
      })
    );
    const all = results.filter(r=>r.status==='fulfilled').flatMap(r=>r.value);
    const clean = all
      .filter(t=>t.name&&t.transactionDate&&t.share&&t.change)
      .sort((a,b)=>new Date(b.transactionDate)-new Date(a.transactionDate))
      .slice(0,40)
      .map(t=>({
        symbol:   t.symbol,
        name:     t.name,
        date:     t.transactionDate,
        type:     t.transactionCode,   // P=purchase, S=sale
        shares:   Math.abs(t.share),
        price:    t.transactionPrice   || null,
        value:    t.transactionPrice   ? Math.abs(t.share)*t.transactionPrice : null,
        issuance: t.isDerivative===true,
      }));
    res.status(200).json({symbol:symbol||null,transactions:clean});
  } catch(e) { res.status(502).json({error:e.message}); }
}
