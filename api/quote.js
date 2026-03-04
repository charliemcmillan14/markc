export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const symbol = (req.query.symbol || '').toUpperCase().trim();
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  const key = process.env.FINNHUB_API_KEY;
  if (!key) return res.status(500).json({ error: 'FINNHUB_API_KEY not configured' });

  try {
    const [quoteRes, profileRes] = await Promise.allSettled([
      fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`),
      fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${key}`)
    ]);

    const quote = quoteRes.status === 'fulfilled' ? await quoteRes.value.json() : {};
    const profile = profileRes.status === 'fulfilled' ? await profileRes.value.json() : {};

    if (!quote.c || quote.c === 0) {
      return res.status(404).json({ error: `No data found for symbol: ${symbol}` });
    }

    res.status(200).json({
      symbol,
      name:        profile.name || symbol,
      industry:    profile.finnhubIndustry || null,
      exchange:    profile.exchange || null,
      logo:        profile.logo || null,
      weburl:      profile.weburl || null,
      marketCap:   profile.marketCapitalization || null,
      price:       quote.c,
      change:      quote.d,
      changePct:   quote.dp,
      high:        quote.h,
      low:         quote.l,
      open:        quote.o,
      prevClose:   quote.pc,
      timestamp:   quote.t,
    });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
