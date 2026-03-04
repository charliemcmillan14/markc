'use strict';
// ── MARKETS ───────────────────────────────────────────────────
let _mktChart = null;
let _mktSym = 'AAPL';

async function initMarkets() {
  const movers = Object.values(LQ).length > 5 ? Object.values(LQ) : await fetchMovers();
  renderMarketsList(movers);
  // Load chart for default symbol after list renders
  setTimeout(() => loadMktChart(_mktSym), 50);
}

function renderMarketsList(movers) {
  const tb = $('mktList'); if(!tb) return;
  tb.innerHTML = movers.map(q => {
    const cls = clsc(q.changePct);
    const sel = q.symbol===_mktSym ? 'style="background:rgba(0,212,255,.04)"' : '';
    return `<tr onclick="selectMktChart('${q.symbol}')" id="mr-${q.symbol}" ${sel}>
      <td><span class="tbl-sym">${q.symbol}</span></td>
      <td>${fp(q.price)}</td>
      <td class="${cls}">${arrow(q.changePct)} ${fpct(q.changePct)}</td>
      <td class="${cls}">${fchg(q.change)}</td>
    </tr>`;
  }).join('');
}

async function selectMktChart(sym) {
  _mktSym = sym;
  $all('#mktList tr').forEach(r=>r.style.background='');
  const row = $('mr-'+sym);
  if (row) row.style.background='rgba(0,212,255,.04)';
  await loadMktChart(sym);
}

async function loadMktChart(sym) {
  const lbl = $('mktChartLbl');
  if (lbl) lbl.innerHTML = `<span style="color:var(--text2)">${sym}</span> — loading…`;

  const candles = await fetchCandles(sym, 90, 'D');
  if (!candles.length) {
    if (lbl) lbl.textContent = sym+' — no data';
    return;
  }

  const color = priceColor(candles);
  const labels = candles.map(c=>new Date(c.time*1000).toLocaleDateString('en-US',{month:'short',day:'numeric'}));
  const prices = candles.map(c=>c.close);
  const pct = ((prices[prices.length-1]-prices[0])/prices[0]*100).toFixed(2);

  if (lbl) {
    lbl.innerHTML = `<span onclick="goQuote('${sym}')" style="cursor:pointer;color:var(--accent)">${sym}</span>
      &nbsp;<span class="${clsc(prices[prices.length-1]-prices[0])}">${arrow(prices[prices.length-1]-prices[0])} ${pct}% (90d)</span>`;
  }

  // THE FIX: mkChart uses setTimeout internally — canvas must be visible first
  _mktChart = await mkChart('mktChart','line',
    { labels, datasets:[lineDs(prices,color)] },
    chartOpts(v=>'$'+v.toFixed(2))
  );
}

// ── HEATMAP ───────────────────────────────────────────────────
const HEAT = {
  Technology:    ['AAPL','MSFT','NVDA','AMD','GOOGL','META','INTC','CRM','ADBE','ORCL','QCOM','AVGO'],
  Financials:    ['JPM','GS','BAC','V','MA','BLK','MS','C','WFC','AXP'],
  Healthcare:    ['LLY','UNH','JNJ','ABBV','MRK','PFE','TMO','ABT','BMY','AMGN'],
  ConsumerDisc:  ['AMZN','TSLA','HD','MCD','NKE','SBUX','TGT','LOW','BKNG'],
  Energy:        ['XOM','CVX','COP','SLB','PSX','VLO','OXY','MPC'],
  Industrials:   ['CAT','DE','BA','HON','UPS','GE','LMT','RTX'],
  Materials:     ['LIN','APD','SHW','ECL','NEM','FCX'],
};

async function initHeatmap() {
  const el=$('heatmapContent'); if(el) el.innerHTML='<div class="loading">Loading heatmap…</div>';
  const missing = [...new Set(Object.values(HEAT).flat())].filter(s=>!LQ[s]||!LQ[s].price);
  if (missing.length) await Promise.allSettled(missing.map(s=>fetchQuote(s)));
  renderHeatmap();
}

function renderHeatmap() {
  const el=$('heatmapContent'); if(!el) return;
  const all = Object.values(LQ).filter(q=>q.price&&q.changePct!=null);
  const up = all.filter(q=>q.changePct>=0).length;
  el.innerHTML = `
    <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:20px;padding:12px 16px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r2);font-family:var(--mono);font-size:10px">
      <span class="up">▲ ${up} up</span>
      <span class="dn">▼ ${all.length-up} down</span>
      <span style="color:var(--text3);margin-left:auto">Hover for details · Click to view quote</span>
    </div>
    ${Object.entries(HEAT).map(([sector,syms])=>{
      const qs=syms.map(s=>LQ[s]).filter(q=>q&&q.price);
      if(!qs.length)return'';
      const avg=qs.reduce((s,q)=>s+(q.changePct||0),0)/qs.length;
      return`<div style="margin-bottom:20px">
        <div class="sec-title"><em>//</em> ${sector} <span class="${clsc(avg)}" style="font-size:9px">${arrow(avg)} ${avg.toFixed(2)}%</span></div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">${qs.map(q=>heatCell(q)).join('')}</div>
      </div>`;
    }).join('')}`;
}

function heatCell(q) {
  const pct=q.changePct||0, abs=Math.abs(pct);
  const intensity=Math.min(abs/4,1);
  const bg=pct>=0?`rgba(16,185,129,${.06+intensity*.4})`:`rgba(239,68,68,${.06+intensity*.4})`;
  const bc=pct>=0?`rgba(16,185,129,.25)`:`rgba(239,68,68,.25)`;
  const tc=pct>=0?(abs>1?'var(--green2)':'var(--text2)'):(abs>1?'var(--red2)':'var(--text2)');
  return`<div onclick="goQuote('${q.symbol}')" title="${q.symbol}: ${fp(q.price)} (${fpct(pct)})"
    style="background:${bg};border:1px solid ${bc};border-radius:3px;padding:10px 12px;cursor:pointer;
      transition:transform .1s;min-width:70px;text-align:center"
    onmouseover="this.style.transform='scale(1.08)'" onmouseout="this.style.transform=''">
    <div style="font-family:var(--mono);font-size:9px;font-weight:600;color:var(--accent);margin-bottom:2px">${q.symbol}</div>
    <div style="font-family:var(--mono);font-size:10px;color:${tc}">${arrow(pct)}${abs.toFixed(1)}%</div>
  </div>`;
}

// ── SECTOR ────────────────────────────────────────────────────
const SECTORS = {
  tech:       {label:'Technology',   etf:'XLK', syms:['AAPL','MSFT','NVDA','AMD','GOOGL','META','INTC','CRM','ADBE','ORCL']},
  finance:    {label:'Financials',   etf:'XLF', syms:['JPM','GS','BAC','V','MA','BLK','MS','C','WFC','AXP']},
  energy:     {label:'Energy',       etf:'XLE', syms:['XOM','CVX','COP','SLB','PSX','VLO','OXY','MPC','EOG']},
  healthcare: {label:'Healthcare',   etf:'XLV', syms:['LLY','UNH','JNJ','ABBV','MRK','PFE','TMO','ABT','BMY','AMGN']},
  consumer:   {label:'Consumer',     etf:'XLY', syms:['AMZN','TSLA','HD','MCD','NKE','SBUX','TGT','LOW']},
  industrial: {label:'Industrials',  etf:'XLI', syms:['CAT','DE','BA','HON','UPS','GE','LMT','RTX']},
};

let _currentSector = 'tech';
let _sectorChart = null;

async function initSector() {
  await renderSectorPage(_currentSector);
}

async function renderSectorPage(key) {
  const s = SECTORS[key]; if(!s) return;
  const el=$('sectorContent'); if(!el) return;
  el.innerHTML=`
    <div class="pills" style="margin-bottom:20px">
      ${Object.entries(SECTORS).map(([k,v])=>`<button class="pill ${k===key?'active':''}" onclick="goSector('${k}')">${v.label}</button>`).join('')}
    </div>
    <div id="secEtf" class="card card-accent" style="margin-bottom:20px"><div class="loading">Loading ETF…</div></div>
    <div class="sec-title"><em>//</em> ${s.label} Stocks</div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r3);overflow:hidden;margin-bottom:20px">
      <table class="tbl">
        <thead><tr><th>Symbol</th><th>Price</th><th>Chg%</th><th>High</th><th>Low</th></tr></thead>
        <tbody id="secList"><tr><td colspan="5" class="loading">Loading…</td></tr></tbody>
      </table>
    </div>
    <div class="sec-title"><em>//</em> ${s.etf} — 90-Day Chart</div>
    <div class="chart-wrap"><div class="chart-box" style="height:260px"><canvas id="secChart" style="width:100%;height:100%"></canvas></div></div>`;

  const etfQ = await fetchQuote(s.etf);
  const etfEl=$('secEtf');
  if (etfEl&&etfQ) {
    const cls=clsc(etfQ.changePct);
    etfEl.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
      <div>
        <div style="font-family:var(--mono);font-size:9px;color:var(--accent);letter-spacing:.12em;margin-bottom:4px">${s.etf} · ${s.label} ETF</div>
        <div style="font-family:var(--mono);font-size:28px;font-weight:600">${fp(etfQ.price)}</div>
      </div>
      <div class="${cls}" style="font-family:var(--mono);font-size:16px">${arrow(etfQ.changePct)} ${fpct(etfQ.changePct)}</div>
      <div style="font-family:var(--mono);font-size:10px;color:var(--text3)">O: ${fp(etfQ.open)} · H: ${fp(etfQ.high)} · L: ${fp(etfQ.low)}</div>
    </div>`;
  }

  const results = await Promise.allSettled(s.syms.map(sym=>fetchQuote(sym)));
  const quotes = results.filter(r=>r.status==='fulfilled'&&r.value?.price).map(r=>r.value);
  const tb=$('secList');
  if(tb) tb.innerHTML=quotes.map(q=>{
    const cls=clsc(q.changePct);
    return`<tr onclick="goQuote('${q.symbol}')">
      <td><span class="tbl-sym">${q.symbol}</span></td>
      <td>${fp(q.price)}</td>
      <td class="${cls}">${arrow(q.changePct)} ${fpct(q.changePct)}</td>
      <td style="color:var(--green2)">${fp(q.high)}</td>
      <td style="color:var(--red2)">${fp(q.low)}</td>
    </tr>`;
  }).join('')||'<tr><td colspan="5" class="empty">No data</td></tr>';

  const candles=await fetchCandles(s.etf,90,'D');
  if(candles.length) {
    const color=priceColor(candles);
    _sectorChart = await mkChart('secChart','line',
      {labels:candles.map(c=>new Date(c.time*1000).toLocaleDateString('en-US',{month:'short',day:'numeric'})),datasets:[lineDs(candles.map(c=>c.close),color)]},
      chartOpts(v=>'$'+v.toFixed(2))
    );
  }
}
