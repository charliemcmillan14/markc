const SYMBOLS = [
  'AAPL','MSFT','NVDA','AMZN','TSLA','META','GOOGL','JPM',
  'GS','V','AMD','NFLX','XOM','LLY','COST','BRK.B','UNH',
  'JNJ','WMT','HD','MA','ABBV','PG','KO','BAC'
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const key = process.env.FINNHUB_API_KEY;
  if (!key) return res.status(500).json({ error: 'FINNHUB_API_KEY not configured' });

  try {
    const results = await Promise.allSettled(
      SYMBOLS.map(async symbol => {
        const r = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`,
          { signal: AbortSignal.timeout(8000) }
        );
        const d = await r.json();
        if (!d.c || d.c === 0) throw new Error('no data');
        return {
          symbol,
          price:     d.c,
          change:    d.d,
          changePct: d.dp,
          high:      d.h,
          low:       d.l,
          open:      d.o,
          prevClose: d.pc,
        };
      })
    );

    const data = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value)
      .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));

    res.status(200).json(data);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
