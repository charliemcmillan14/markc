// ─────────────────────────────────────────────────────────────
// MACRO.JS — Macro economic indicators
// Fed funds rate proxy, economic events, bond yield proxies
// All from Finnhub free tier
// ─────────────────────────────────────────────────────────────

const MACRO_SYMBOLS = {
  // These ETFs/bonds proxy macro indicators
  'SPY':  'S&P 500 ETF',
  'QQQ':  'NASDAQ 100 ETF',
  'TLT':  'Long Treasury Bond ETF (20yr)',
  'SHY':  'Short Treasury Bond ETF (1-3yr)',
  'GLD':  'Gold ETF',
  'UUP':  'US Dollar Index',
  'VXX':  'Volatility Index ETF',
  'IWM':  'Russell 2000 Small Cap',
  'XLF':  'Financial Sector',
  'XLE':  'Energy Sector',
  'XLK':  'Technology Sector',
  'XLV':  'Healthcare Sector',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const key = process.env.FINNHUB_API_KEY;
  if (!key) return res.status(500).json({ error: 'FINNHUB_API_KEY not configured' });

  try {
    // Fetch all macro proxies in parallel
    const results = await Promise.allSettled(
      Object.keys(MACRO_SYMBOLS).map(async sym => {
        const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${key}`, { signal: AbortSignal.timeout(8000) });
        const d = await r.json();
        if (!d.c || d.c === 0) throw new Error('no data');
        return {
          symbol:    sym,
          name:      MACRO_SYMBOLS[sym],
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

    const indicators = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);

    // Derive yield curve signal from TLT vs SHY
    const tlt = indicators.find(i => i.symbol === 'TLT');
    const shy = indicators.find(i => i.symbol === 'SHY');
    let yieldCurveSignal = null;
    if (tlt && shy) {
      const spread = tlt.changePct - shy.changePct;
      yieldCurveSignal = {
        spread: +spread.toFixed(2),
        signal: spread > 0.2 ? 'Steepening — bonds pricing in growth' :
                spread < -0.2 ? 'Flattening — recession risk elevated' :
                'Neutral',
      };
    }

    // Group by category
    const sectors = indicators.filter(i => i.symbol.startsWith('XL'));
    const bonds   = indicators.filter(i => ['TLT','SHY'].includes(i.symbol));
    const indices = indicators.filter(i => ['SPY','QQQ','IWM'].includes(i.symbol));
    const other   = indicators.filter(i => ['GLD','UUP','VXX'].includes(i.symbol));

    res.status(200).json({
      indicators,
      sectors,
      bonds,
      indices,
      other,
      yieldCurveSignal,
      timestamp: Date.now(),
    });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
}
