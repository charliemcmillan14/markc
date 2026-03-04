// Earnings calendar — shows upcoming earnings for major stocks
// Finnhub free tier: /v1/calendar/earnings

const WATCHLIST = [
  'AAPL','MSFT','NVDA','AMZN','TSLA','META','GOOGL','JPM',
  'GS','V','AMD','NFLX','XOM','LLY','COST','BRK.B','UNH',
  'JNJ','WMT','HD','MA','ABBV','BAC','INTC','CRM'
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const key = process.env.FINNHUB_API_KEY;
  if (!key) return res.status(500).json({ error: 'FINNHUB_API_KEY not configured' });

  // Look 60 days ahead
  const from = new Date().toISOString().split('T')[0];
  const to   = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0];

  try {
    const r = await fetch(
      `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${key}`,
      { signal: AbortSignal.timeout(10000) }
    );
    const data = await r.json();
    const items = data?.earningsCalendar || [];

    // Filter to our watchlist and format
    const filtered = items
      .filter(e => WATCHLIST.includes(e.symbol))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 40)
      .map(e => ({
        symbol:       e.symbol,
        date:         e.date,
        hour:         e.hour,        // bmo = before market open, amc = after market close
        epsEstimate:  e.epsEstimate  ?? null,
        epsActual:    e.epsActual    ?? null,
        revenueEst:   e.revenueEstimate ?? null,
        revenueAct:   e.revenueActual   ?? null,
        quarter:      e.quarter     ?? null,
        year:         e.year        ?? null,
      }));

    res.status(200).json({ from, to, earnings: filtered });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
