// ─────────────────────────────────────────────────────────────
// NEWS-ALL.JS — Multi-source news aggregator
// Sources: Finnhub (general/forex/merger/company) + SEC EDGAR RSS
//          + Reuters RSS + MarketWatch RSS + Yahoo Finance RSS
// ─────────────────────────────────────────────────────────────

const RSS_SOURCES = [
  {
    name: 'Reuters',
    url: 'https://feeds.reuters.com/reuters/businessNews',
    category: 'reuters',
  },
  {
    name: 'MarketWatch',
    url: 'https://feeds.content.dowjones.io/public/rss/mw_realtimeheadlines',
    category: 'marketwatch',
  },
  {
    name: 'Yahoo Finance',
    url: 'https://finance.yahoo.com/news/rssindex',
    category: 'yahoo',
  },
  {
    name: 'SEC EDGAR',
    url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&dateb=&owner=include&count=20&search_text=&output=atom',
    category: 'sec',
  },
];

// Parse an RSS/Atom XML string into article objects
function parseRSS(xml, sourceName, category) {
  const articles = [];
  try {
    // Handle both RSS <item> and Atom <entry>
    const itemRe = /<(?:item|entry)[^>]*>([\s\S]*?)<\/(?:item|entry)>/gi;
    let match;
    while ((match = itemRe.exec(xml)) !== null) {
      const block = match[1];
      const title   = stripTags(getTag(block, 'title'));
      const link    = getTag(block, 'link') || getTag(block, 'id') || '';
      const pubDate = getTag(block, 'pubDate') || getTag(block, 'updated') || getTag(block, 'published') || '';
      const summary = stripTags(getTag(block, 'description') || getTag(block, 'summary') || getTag(block, 'content') || '');

      if (!title || !link) continue;

      const ts = pubDate ? Math.floor(new Date(pubDate).getTime() / 1000) : Math.floor(Date.now() / 1000);

      articles.push({
        headline: title.trim().slice(0, 200),
        summary:  summary.trim().slice(0, 400),
        url:      link.trim(),
        source:   sourceName,
        category,
        datetime: ts,
        image:    null,
      });
    }
  } catch (e) { /* skip malformed */ }
  return articles;
}

function getTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>|<${tag}[^>]*/?>`, 'i');
  const m = xml.match(re);
  if (!m) return '';
  return (m[1] || m[2] || '').trim();
}

function stripTags(str) {
  return str.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const symbol   = (req.query.symbol || '').toUpperCase().trim();
  const category = req.query.category || 'all';
  const days     = Math.min(parseInt(req.query.days || '3', 10), 14);
  const key      = process.env.FINNHUB_API_KEY;

  let allArticles = [];

  // ── 1. FINNHUB ──────────────────────────────────────────────
  if (key) {
    try {
      if (symbol) {
        // Company-specific news
        const to   = new Date().toISOString().split('T')[0];
        const from = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
        const r = await fetch(`https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&token=${key}`, { signal: AbortSignal.timeout(8000) });
        const data = await r.json();
        if (Array.isArray(data)) {
          allArticles.push(...data.map(a => ({ headline: a.headline, summary: a.summary || '', url: a.url, source: a.source || 'Finnhub', category: 'company', datetime: a.datetime, image: a.image || null, related: symbol })));
        }
      } else {
        // General market news — all categories
        const cats = ['general', 'forex', 'merger', 'crypto'];
        const results = await Promise.allSettled(
          cats.map(cat =>
            fetch(`https://finnhub.io/api/v1/news?category=${cat}&token=${key}`, { signal: AbortSignal.timeout(8000) })
              .then(r => r.json())
              .then(d => Array.isArray(d) ? d.map(a => ({ headline: a.headline, summary: a.summary || '', url: a.url, source: a.source || 'Finnhub', category: cat, datetime: a.datetime, image: a.image || null })) : [])
          )
        );
        for (const r of results) if (r.status === 'fulfilled') allArticles.push(...r.value);
      }
    } catch (e) { console.warn('Finnhub news:', e.message); }
  }

  // ── 2. RSS FEEDS ─────────────────────────────────────────────
  if (!symbol) {
    const rssResults = await Promise.allSettled(
      RSS_SOURCES.map(async src => {
        const r = await fetch(src.url, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'MarketCat/1.0' } });
        const xml = await r.text();
        return parseRSS(xml, src.name, src.category);
      })
    );
    for (const r of rssResults) if (r.status === 'fulfilled') allArticles.push(...r.value);
  }

  // ── DEDUPLICATE + SORT + LIMIT ────────────────────────────────
  const seen = new Set();
  const cutoff = Date.now() / 1000 - days * 86400;

  const cleaned = allArticles
    .filter(a => a.headline && a.url && a.datetime > cutoff && !seen.has(a.headline) && seen.add(a.headline))
    .sort((a, b) => b.datetime - a.datetime)
    .slice(0, 60)
    .map(a => ({
      headline: a.headline,
      summary:  a.summary || '',
      url:      a.url,
      source:   a.source,
      category: a.category,
      datetime: a.datetime,
      image:    a.image || null,
      related:  a.related || '',
    }));

  const sources = [...new Set(cleaned.map(a => a.source))];

  res.status(200).json({
    symbol:   symbol || null,
    count:    cleaned.length,
    sources,
    articles: cleaned,
  });
}
