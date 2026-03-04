'use strict';
let _quoteChart = null;

function initQuotePage() {
  const last = LS.get('lastSym','AAPL');
  const inp=$('quoteInput'); if(inp) inp.value=last;
  renderQuote(last);
}

async function searchQuote() {
  const sym=($('quoteInput')?.value||'').trim().toUpperCase();
  if(!sym) return;
  LS.set('lastSym',sym);
  await renderQuote(sym);
}

async function renderQuote(symbol) {
  const panel=$('quotePanel'); if(!panel) return;
  panel.innerHTML=`<div class="loading">Loading ${symbol}…<div class="shimmer" style="width:200px;height:40px;margin:12px auto"></div><div class="shimmer" style="width:100%;height:260px;margin-top:8px"></div></div>`;

  const [q, candles, analyst] = await Promise.all([
    fetchQuote(symbol),
    fetchCandles(symbol, 90, 'D'),
    fetchAnalyst(symbol),
  ]);

  if (!q||!q.price) {
    panel.innerHTML=`<div class="empty" style="color:var(--red2)">Symbol <strong>${symbol}</strong> not found.</div>`;
    return;
  }

  const cls=clsc(q.changePct);
  const color=candles.length?priceColor(candles):(q.changePct>=0?'#10B981':'#EF4444');

  // Analyst consensus
  let analystHtml='';
  if (analyst?.recommendations?.length) {
    const latest = analyst.recommendations[0];
    const total = (latest.strongBuy||0)+(latest.buy||0)+(latest.hold||0)+(latest.sell||0)+(latest.strongSell||0);
    const bullPct = total ? Math.round(((latest.strongBuy||0)+(latest.buy||0))/total*100) : 0;
    const target = analyst.priceTarget;
    analystHtml=`
      <div class="sec-title" style="margin-top:24px"><em>//</em> Analyst Consensus · ${latest.period||''}</div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:16px">
        ${[['Strong Buy',latest.strongBuy,'var(--green)'],['Buy',latest.buy,'var(--green2)'],['Hold',latest.hold,'var(--amber)'],['Sell',latest.sell,'var(--red2)'],['Strong Sell',latest.strongSell,'var(--red)']].map(([lbl,n,col])=>`
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:10px;text-align:center">
            <div style="font-family:var(--mono);font-size:18px;font-weight:600;color:${col}">${n||0}</div>
            <div style="font-family:var(--mono);font-size:8px;color:var(--text3);margin-top:2px">${lbl}</div>
          </div>`).join('')}
      </div>
      ${target.mean?`<div style="display:flex;gap:20px;flex-wrap:wrap;padding:12px 14px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);font-family:var(--mono);font-size:10px;margin-bottom:16px">
        <span style="color:var(--text3)">Target Low <strong style="color:var(--red2)">${fp(target.low)}</strong></span>
        <span style="color:var(--text3)">Mean <strong style="color:var(--text)">${fp(target.mean)}</strong></span>
        <span style="color:var(--text3)">High <strong style="color:var(--green2)">${fp(target.high)}</strong></span>
        <span style="color:var(--text3)">Upside <strong style="color:${target.mean>q.price?'var(--green2)':'var(--red2)'}">${((target.mean-q.price)/q.price*100).toFixed(1)}%</strong></span>
        <span style="color:var(--text3)">Bullish <strong style="color:var(--accent)">${bullPct}%</strong></span>
      </div>`:''}`; 
  }

  // Peer comparison
  let peersHtml='';
  if (analyst?.peers?.length) {
    peersHtml=`<div class="sec-title" style="margin-top:24px"><em>//</em> Peers</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">
        ${analyst.peers.map(p=>`<button class="btn btn-sm btn-ghost" onclick="goQuote('${p}')">${p}</button>`).join('')}
      </div>`;
  }

  panel.innerHTML=`
    <div class="q-hero">
      <div>
        <div class="q-sym">${q.symbol} ${q.exchange?'· '+q.exchange:''}</div>
        <div class="q-name">${q.name||q.symbol}</div>
        <div class="q-price">${fp(q.price)}</div>
        <div class="q-chg ${cls}">${arrow(q.changePct)} ${fpct(q.changePct)} &nbsp;(${fchg(q.change)})</div>
        <div class="q-meta">
          <span>Open <strong>${fp(q.open)}</strong></span>
          <span>High <strong style="color:var(--green2)">${fp(q.high)}</strong></span>
          <span>Low <strong style="color:var(--red2)">${fp(q.low)}</strong></span>
          <span>Prev Close <strong>${fp(q.prevClose)}</strong></span>
          ${q.marketCap?`<span>Mkt Cap <strong>${fmtBig(q.marketCap*1e6)}</strong></span>`:''}
        </div>
      </div>
      ${q.industry?`<div class="q-badge">
        <strong>${q.industry}</strong>
        ${q.weburl?`<a href="${q.weburl}" target="_blank" style="color:var(--accent);font-size:9px;display:block;margin-top:4px">IR Site ↗</a>`:''}
        <button class="btn btn-sm btn-ghost" onclick="addQuoteToWatch('${q.symbol}')" style="margin-top:6px;width:100%">+ Watchlist</button>
        <button class="btn btn-sm btn-ghost" onclick="go('insider')" style="margin-top:3px;width:100%">Insider Activity</button>
      </div>`:''}
    </div>

    <div class="chart-wrap" style="margin-bottom:20px">
      <div class="chart-hdr">
        <span class="chart-lbl">Price Chart · ${symbol}</span>
        <div class="chart-tabs">
          <button class="cht active" onclick="changeQChart('${symbol}',30,this)">1M</button>
          <button class="cht" onclick="changeQChart('${symbol}',90,this)">3M</button>
          <button class="cht" onclick="changeQChart('${symbol}',180,this)">6M</button>
          <button class="cht" onclick="changeQChart('${symbol}',365,this)">1Y</button>
        </div>
      </div>
      <div class="chart-box" style="height:260px">
        <canvas id="quoteCanvas" style="width:100%;height:100%"></canvas>
      </div>
    </div>

    ${analystHtml}
    ${peersHtml}

    <div class="sec-title" style="margin-top:24px"><em>//</em> Recent News · ${symbol}</div>
    <div id="quoteNews"><div class="loading">Loading news…</div></div>`;

  // Draw chart — mkChart handles the setTimeout fix
  if (candles.length) {
    _quoteChart = await mkChart('quoteCanvas','line',
      {labels:candles.map(c=>new Date(c.time*1000).toLocaleDateString('en-US',{month:'short',day:'numeric'})),datasets:[lineDs(candles.map(c=>c.close),color)]},
      chartOpts(v=>fp(v))
    );
  }

  // Load news async
  fetchAllNews(symbol).then(d => {
    const el=$('quoteNews'); if(!el) return;
    const arts=d.articles||[];
    el.innerHTML=arts.length?renderNewsItems(arts.slice(0,5)):'<div class="empty">No recent news</div>';
  });
}

async function changeQChart(symbol, days, btn) {
  $all('.chart-tabs .cht').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const candles = await fetchCandles(symbol, days, 'D');
  if (!candles.length) return;
  const color = priceColor(candles);
  _quoteChart = await mkChart('quoteCanvas','line',
    {labels:candles.map(c=>new Date(c.time*1000).toLocaleDateString('en-US',{month:'short',day:'numeric'})),datasets:[lineDs(candles.map(c=>c.close),color)]},
    chartOpts(v=>fp(v))
  );
}

function addQuoteToWatch(sym) {
  if (!_watchlist) return;
  if (!_watchlist.includes(sym)) { _watchlist.push(sym); LS.set('watchlist',_watchlist); }
  toast(sym+' added to watchlist',true);
}
