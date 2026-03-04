'use strict';
// ── HOME PAGE ─────────────────────────────────────────────────
const HOME_TILES = [
  {id:'t-aapl',sym:'AAPL'},{id:'t-msft',sym:'MSFT'},
  {id:'t-nvda',sym:'NVDA'},{id:'t-tsla',sym:'TSLA'},
  {id:'t-meta',sym:'META'},{id:'t-amzn',sym:'AMZN'},
];

async function initHome() {
  const movers = await fetchMovers();
  buildTicker();
  renderHomeTiles();
  renderHomeMovers(movers);
  const ls = $('liveStatus');
  if (ls) ls.textContent = 'LIVE · '+new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
  toast('Market data loaded',true);
}

function renderHomeTiles() {
  HOME_TILES.forEach(({id,sym}) => {
    const el = $(id); if(!el) return;
    const q = LQ[sym]; if(!q||!q.price) return;
    const cls = clsc(q.changePct);
    el.querySelector('.st-price').textContent = fp(q.price);
    const ce = el.querySelector('.st-chg');
    ce.className='st-chg '+cls;
    ce.textContent = arrow(q.changePct)+' '+fpct(q.changePct);
  });
}

function renderHomeMovers(movers) {
  const tb = $('homeMovers'); if(!tb) return;
  if (!movers.length) {
    tb.innerHTML='<tr><td colspan="5" class="loading">No data — verify FINNHUB_API_KEY in Vercel Settings → Environment Variables</td></tr>';
    return;
  }
  tb.innerHTML = movers.slice(0,12).map(q => {
    const cls = clsc(q.changePct);
    return `<tr onclick="goQuote('${q.symbol}')">
      <td><span class="tbl-sym">${q.symbol}</span></td>
      <td>${fp(q.price)}</td>
      <td class="${cls}">${arrow(q.changePct)} ${fpct(q.changePct)}</td>
      <td class="${cls}">${fchg(q.change)}</td>
      <td style="color:var(--text3)">${fp(q.high)} / ${fp(q.low)}</td>
    </tr>`;
  }).join('');
}
