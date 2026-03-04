'use strict';

// ── NEWS ──────────────────────────────────────────────────────
let _newsArticles = [];

async function initNews() {
  const el = $('newsFeed');
  if (el) el.innerHTML = '<div class="loading">Loading from Reuters, MarketWatch, Yahoo Finance, Finnhub, SEC…</div>';
  const data = await fetchAllNews('');
  _newsArticles = data.articles || [];
  const bar = $('newsSourceBar');
  if (bar && data.sources?.length) {
    bar.textContent = 'Sources: ' + data.sources.join(' · ');
    bar.style.display = 'block';
  }
  renderNewsFeed(_newsArticles);
}

async function searchNews() {
  const sym = ($('newsInput')?.value || '').trim().toUpperCase();
  if (!sym) return;
  const el = $('newsFeed');
  if (el) el.innerHTML = '<div class="loading">Searching ' + sym + '…</div>';
  const data = await fetchAllNews(sym);
  _newsArticles = data.articles || [];
  renderNewsFeed(_newsArticles);
}

function setNewsFilter(cat, btn) {
  $all('.pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const filtered = cat === 'all' ? _newsArticles
    : _newsArticles.filter(a => a.category === cat);
  renderNewsFeed(filtered);
}

function renderNewsFeed(articles) {
  const el = $('newsFeed'); if (!el) return;
  if (!articles.length) {
    el.innerHTML = '<div class="empty">No articles found.</div>'; return;
  }
  el.innerHTML = '<div class="news-grid">' + renderNewsItems(articles.slice(0, 24)) + '</div>';
}

function renderNewsItems(articles) {
  return articles.map(a => {
    const d = new Date(a.datetime * 1000);
    const ds = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const ts = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const catMap = { merger: 'M&A', forex: 'FX', general: 'Market', company: a.related || 'Co', reuters: 'Reuters', marketwatch: 'MW', yahoo: 'Yahoo', sec: 'SEC', crypto: 'Crypto' };
    const tag = catMap[a.category] || a.category || 'News';
    return `<div class="ni" onclick="window.open('${a.url}','_blank')">
      ${a.image ? `<img class="ni-img" src="${a.image}" alt="" loading="lazy" onerror="this.style.display='none'"/>` : '<div class="ni-img"></div>'}
      <div>
        <div class="ni-meta"><span class="ni-src">${a.source}</span> · ${ds} ${ts} <span class="ni-tag">${tag}</span></div>
        <a class="ni-hl" href="${a.url}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${a.headline}</a>
        ${a.summary ? `<div class="ni-sum">${a.summary.slice(0, 160)}…</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ── CRYPTO ────────────────────────────────────────────────────
async function initCrypto() {
  const el = $('cryptoGrid');
  if (el) el.innerHTML = '<div class="loading">Loading from CoinGecko…</div>';
  const coins = await fetchCrypto();
  renderCrypto(coins);
}

function renderCrypto(coins) {
  const el = $('cryptoGrid'); if (!el) return;
  if (!coins.length) {
    el.innerHTML = '<div class="empty">CoinGecko rate limited — try again in 60s</div>'; return;
  }
  el.innerHTML = '<div class="crypto-grid">' + coins.map(c => {
    const c24 = c.price_change_percentage_24h || 0;
    const c7d = c.price_change_percentage_7d_in_currency || 0;
    return `<div class="cc">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <img class="cc-icon" src="${c.image}" alt="" loading="lazy"/>
        <div><div class="cc-name">${c.name}</div><div class="cc-sym">${c.symbol.toUpperCase()}</div></div>
      </div>
      <div class="cc-price">${fp(c.current_price)}</div>
      <div class="${clsc(c24)}" style="font-family:var(--mono);font-size:11px;margin-bottom:8px">${arrow(c24)} ${Math.abs(c24).toFixed(2)}% (24h)</div>
      <div class="cc-stats">
        <div class="cc-stat"><span>7d</span><div class="${clsc(c7d)}">${fpct(c7d)}</div></div>
        <div class="cc-stat"><span>Mkt Cap</span><div>${fmtBig(c.market_cap)}</div></div>
        <div class="cc-stat"><span>24h Vol</span><div>${fmtBig(c.total_volume)}</div></div>
        <div class="cc-stat"><span>Rank</span><div>#${c.market_cap_rank}</div></div>
      </div>
    </div>`;
  }).join('') + '</div>';
}

// ── FOREX ─────────────────────────────────────────────────────
async function initForex() {
  const el = $('forexContent');
  if (el) el.innerHTML = '<div class="loading">Loading currency pairs…</div>';
  const data = await fetchForex();
  renderForex(data?.pairs || []);
}

function renderForex(pairs) {
  const el = $('forexContent'); if (!el) return;
  if (!pairs.length) {
    el.innerHTML = '<div class="empty">Forex data unavailable</div>'; return;
  }
  el.innerHTML = `
    <div class="fx-grid" style="margin-bottom:32px">
      ${pairs.map(p => {
        const cls = clsc(p.changePct);
        return `<div class="fx-card">
          <div class="fx-pair">${p.label}</div>
          <div class="fx-rate">${p.price?.toFixed(4) || '—'}</div>
          <div class="${cls}" style="font-family:var(--mono);font-size:11px">${arrow(p.changePct)} ${fpct(p.changePct)}</div>
          <div style="font-family:var(--mono);font-size:9px;color:var(--text3);margin-top:6px">H: ${p.high?.toFixed(4)} · L: ${p.low?.toFixed(4)}</div>
        </div>`;
      }).join('')}
    </div>
    <div style="padding:14px 16px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r2);font-family:var(--mono);font-size:10px;color:var(--text3)">
      Currency data via Finnhub (OANDA feed) · Updates on page refresh · All pairs vs USD unless noted
    </div>`;
}

// ── IPO CALENDAR ──────────────────────────────────────────────
async function initIPO() {
  const el = $('ipoContent');
  if (el) el.innerHTML = '<div class="loading">Loading IPO calendar…</div>';
  const data = await fetchIPO();
  renderIPO(data?.ipos || []);
}

function renderIPO(ipos) {
  const el = $('ipoContent'); if (!el) return;
  if (!ipos.length) {
    el.innerHTML = '<div class="empty">No upcoming IPOs in the next 60 days (Finnhub free tier may have limited data)</div>'; return;
  }
  const today = new Date().toISOString().split('T')[0];
  el.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r3);overflow:hidden">
      <table class="tbl">
        <thead><tr><th>Symbol</th><th>Company</th><th>Date</th><th>Price Range</th><th>Shares</th><th>Exchange</th><th>Status</th></tr></thead>
        <tbody>
          ${ipos.map(i => {
            const isPast = i.date < today;
            const isSoon = !isPast && new Date(i.date) - new Date() < 7 * 86400000;
            return `<tr onclick="goQuote('${i.symbol||''}')">
              <td><span class="tbl-sym">${i.symbol || '—'}</span></td>
              <td style="color:var(--text)">${i.name || '—'}</td>
              <td style="font-family:var(--mono);font-size:10px;${isSoon?'color:var(--accent)':''}">${fdatestr(i.date)}</td>
              <td style="font-family:var(--mono);font-size:10px">${i.price || '—'}</td>
              <td style="font-family:var(--mono);font-size:10px;color:var(--text3)">${i.shares ? fmtBig(i.shares) : '—'}</td>
              <td style="font-family:var(--mono);font-size:10px;color:var(--text3)">${i.exchange || '—'}</td>
              <td>
                <span style="font-family:var(--mono);font-size:8px;padding:2px 8px;border-radius:2px;
                  background:${i.status==='expected'?'rgba(0,212,255,.1)':'rgba(16,185,129,.1)'};
                  color:${i.status==='expected'?'var(--accent)':'var(--green2)'}">
                  ${i.status || 'upcoming'}
                </span>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

// ── INSIDER TRADING ───────────────────────────────────────────
async function initInsider() {
  const el = $('insiderContent');
  if (el) el.innerHTML = '<div class="loading">Loading insider transactions…</div>';
  const data = await fetchInsider('');
  renderInsider(data?.transactions || []);
}

async function searchInsider() {
  const sym = ($('insiderInput')?.value || '').trim().toUpperCase();
  if (!sym) return;
  const el = $('insiderContent');
  if (el) el.innerHTML = '<div class="loading">Loading insider data for ' + sym + '…</div>';
  const data = await fetchInsider(sym);
  renderInsider(data?.transactions || []);
}

function renderInsider(txns) {
  const el = $('insiderContent'); if (!el) return;
  if (!txns.length) {
    el.innerHTML = '<div class="empty">No insider transactions found</div>'; return;
  }
  const buys  = txns.filter(t => t.type === 'P');
  const sells = txns.filter(t => t.type === 'S');
  const buyVal  = buys.reduce((s, t) => s + (t.value || 0), 0);
  const sellVal = sells.reduce((s, t) => s + (t.value || 0), 0);

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px">
      <div class="card card-sm">
        <div style="font-family:var(--mono);font-size:8px;color:var(--text3);margin-bottom:4px">BUY TRANSACTIONS</div>
        <div style="font-family:var(--mono);font-size:20px;color:var(--green2)">${buys.length}</div>
      </div>
      <div class="card card-sm">
        <div style="font-family:var(--mono);font-size:8px;color:var(--text3);margin-bottom:4px">SELL TRANSACTIONS</div>
        <div style="font-family:var(--mono);font-size:20px;color:var(--red2)">${sells.length}</div>
      </div>
      <div class="card card-sm">
        <div style="font-family:var(--mono);font-size:8px;color:var(--text3);margin-bottom:4px">TOTAL BUY VALUE</div>
        <div style="font-family:var(--mono);font-size:20px;color:var(--green2)">${fmtBig(buyVal)}</div>
      </div>
      <div class="card card-sm">
        <div style="font-family:var(--mono);font-size:8px;color:var(--text3);margin-bottom:4px">TOTAL SELL VALUE</div>
        <div style="font-family:var(--mono);font-size:20px;color:var(--red2)">${fmtBig(sellVal)}</div>
      </div>
    </div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r3);overflow:hidden">
      <table class="tbl">
        <thead><tr><th>Symbol</th><th>Insider</th><th>Type</th><th>Shares</th><th>Price</th><th>Value</th><th>Date</th></tr></thead>
        <tbody>
          ${txns.map(t => `<tr onclick="goQuote('${t.symbol}')">
            <td><span class="tbl-sym">${t.symbol}</span></td>
            <td style="font-size:11px">${t.name}</td>
            <td class="${t.type==='P'?'ins-buy':'ins-sell'}" style="font-family:var(--mono);font-size:10px;font-weight:600">
              ${t.type==='P'?'BUY':'SELL'}
            </td>
            <td style="font-family:var(--mono);font-size:10px">${fvol(t.shares)}</td>
            <td style="font-family:var(--mono);font-size:10px">${t.price?fp(t.price):'—'}</td>
            <td style="font-family:var(--mono);font-size:10px;color:${t.type==='P'?'var(--green2)':'var(--red2)'}">${t.value?fmtBig(t.value):'—'}</td>
            <td style="font-family:var(--mono);font-size:9px;color:var(--text3)">${t.date}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

// ── ANALYST RATINGS ───────────────────────────────────────────
async function initAnalyst() {
  const el = $('analystContent');
  if (el) el.innerHTML = '<div class="loading">Loading analyst ratings…</div>';
  // Default: show AAPL
  const inp = $('analystInput');
  const sym = inp?.value?.toUpperCase().trim() || 'AAPL';
  await renderAnalystPage(sym);
}

async function searchAnalyst() {
  const sym = ($('analystInput')?.value || '').trim().toUpperCase();
  if (!sym) return;
  await renderAnalystPage(sym);
}

async function renderAnalystPage(symbol) {
  const el = $('analystContent');
  if (el) el.innerHTML = '<div class="loading">Loading ' + symbol + ' analyst data…</div>';
  const [data, q] = await Promise.all([fetchAnalyst(symbol), fetchQuote(symbol)]);
  if (!data) { if (el) el.innerHTML = '<div class="empty">No data</div>'; return; }

  const recs = data.recommendations || [];
  const target = data.priceTarget;
  const peers = data.peers || [];

  el.innerHTML = `
    ${q ? `<div style="display:flex;align-items:center;gap:20px;margin-bottom:24px;padding:16px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r2)">
      <div>
        <div style="font-family:var(--mono);font-size:9px;color:var(--accent);margin-bottom:3px">${symbol}</div>
        <div style="font-family:var(--mono);font-size:28px;font-weight:600">${fp(q.price)}</div>
      </div>
      <div class="${clsc(q.changePct)}" style="font-family:var(--mono);font-size:14px">${arrow(q.changePct)} ${fpct(q.changePct)}</div>
      ${target.mean ? `<div style="font-family:var(--mono);font-size:12px;margin-left:auto">
        Target: <span style="color:var(--accent)">${fp(target.mean)}</span>
        <span class="${clsc(target.mean-q.price)}" style="font-size:10px;margin-left:6px">${((target.mean-q.price)/q.price*100).toFixed(1)}% upside</span>
      </div>` : ''}
    </div>` : ''}

    ${target.mean ? `
    <div class="sec-title"><em>//</em> Price Target</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px">
      <div class="card card-sm"><div style="font-family:var(--mono);font-size:8px;color:var(--red2);margin-bottom:4px">LOW</div><div style="font-family:var(--mono);font-size:18px">${fp(target.low)}</div></div>
      <div class="card card-sm"><div style="font-family:var(--mono);font-size:8px;color:var(--text3);margin-bottom:4px">MEDIAN</div><div style="font-family:var(--mono);font-size:18px">${fp(target.median)}</div></div>
      <div class="card card-sm card-accent"><div style="font-family:var(--mono);font-size:8px;color:var(--accent);margin-bottom:4px">MEAN TARGET</div><div style="font-family:var(--mono);font-size:18px">${fp(target.mean)}</div></div>
      <div class="card card-sm"><div style="font-family:var(--mono);font-size:8px;color:var(--green2);margin-bottom:4px">HIGH</div><div style="font-family:var(--mono);font-size:18px">${fp(target.high)}</div></div>
    </div>` : ''}

    ${recs.length ? `
    <div class="sec-title"><em>//</em> Recommendation History</div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r3);overflow:hidden;margin-bottom:24px">
      <table class="tbl">
        <thead><tr><th>Period</th><th style="color:var(--green)">Strong Buy</th><th style="color:var(--green2)">Buy</th><th style="color:var(--amber)">Hold</th><th style="color:var(--red2)">Sell</th><th style="color:var(--red)">Strong Sell</th><th>Signal</th></tr></thead>
        <tbody>
          ${recs.slice(0,6).map(r => {
            const total = (r.strongBuy||0)+(r.buy||0)+(r.hold||0)+(r.sell||0)+(r.strongSell||0);
            const bullPct = total ? Math.round(((r.strongBuy||0)+(r.buy||0))/total*100) : 0;
            const signal = bullPct>=60?'BUY':bullPct>=40?'HOLD':'SELL';
            const scls = signal==='BUY'?'var(--green2)':signal==='SELL'?'var(--red2)':'var(--amber)';
            return `<tr>
              <td style="font-family:var(--mono);font-size:10px;color:var(--text2)">${r.period}</td>
              <td style="color:var(--green);font-family:var(--mono)">${r.strongBuy||0}</td>
              <td style="color:var(--green2);font-family:var(--mono)">${r.buy||0}</td>
              <td style="color:var(--amber);font-family:var(--mono)">${r.hold||0}</td>
              <td style="color:var(--red2);font-family:var(--mono)">${r.sell||0}</td>
              <td style="color:var(--red);font-family:var(--mono)">${r.strongSell||0}</td>
              <td><span style="font-family:var(--mono);font-size:9px;color:${scls};font-weight:700">${signal}</span></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>` : ''}

    ${peers.length ? `
    <div class="sec-title"><em>//</em> Peer Companies</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      ${peers.map(p=>`<button class="btn btn-sm btn-ghost" onclick="renderAnalystPage('${p}');document.getElementById('analystInput').value='${p}'">${p}</button>`).join('')}
    </div>` : ''}`;
}
