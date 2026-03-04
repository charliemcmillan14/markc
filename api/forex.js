const PAIRS = [
  {sym:'OANDA:EUR_USD',label:'EUR/USD',base:'EUR',quote:'USD'},
  {sym:'OANDA:GBP_USD',label:'GBP/USD',base:'GBP',quote:'USD'},
  {sym:'OANDA:USD_JPY',label:'USD/JPY',base:'USD',quote:'JPY'},
  {sym:'OANDA:USD_CHF',label:'USD/CHF',base:'USD',quote:'CHF'},
  {sym:'OANDA:AUD_USD',label:'AUD/USD',base:'AUD',quote:'USD'},
  {sym:'OANDA:USD_CAD',label:'USD/CAD',base:'USD',quote:'CAD'},
  {sym:'OANDA:NZD_USD',label:'NZD/USD',base:'NZD',quote:'USD'},
  {sym:'OANDA:EUR_GBP',label:'EUR/GBP',base:'EUR',quote:'GBP'},
  {sym:'OANDA:EUR_JPY',label:'EUR/JPY',base:'EUR',quote:'JPY'},
  {sym:'OANDA:GBP_JPY',label:'GBP/JPY',base:'GBP',quote:'JPY'},
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin','*');
  if (req.method==='OPTIONS') return res.status(200).end();
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return res.status(500).json({error:'FINNHUB_API_KEY missing'});
  try {
    const results = await Promise.allSettled(
      PAIRS.map(async p => {
        const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(p.sym)}&token=${key}`,{signal:AbortSignal.timeout(8000)});
        const d = await r.json();
        if (!d.c||d.c===0) throw new Error('no data');
        return {...p,price:d.c,change:d.d,changePct:d.dp,high:d.h,low:d.l,open:d.o,prevClose:d.pc};
      })
    );
    const pairs = results.filter(r=>r.status==='fulfilled').map(r=>r.value);
    res.status(200).json({pairs});
  } catch(e) { res.status(502).json({error:e.message}); }
}
