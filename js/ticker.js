'use strict';
const TICK_SYMS = ['AAPL','MSFT','NVDA','AMZN','TSLA','META','GOOGL','JPM','GS','AMD','NFLX','V','XOM','LLY','BTC','ETH'];

function buildTicker() {
  const rail = $('tickerRail');
  if (!rail) return;
  const items = TICK_SYMS.map(sym => {
    const q = LQ[sym];
    if (!q || !q.price) return `<span class="ti"><span class="ti-sym">${sym}</span><span class="ti-price">—</span></span>`;
    const cls = clsc(q.changePct||0);
    const ar = arrow(q.changePct||0);
    return `<span class="ti" onclick="goQuote('${sym}')">
      <span class="ti-sym">${sym}</span>
      <span class="ti-price">${fp(q.price)}</span>
      <span class="ti-chg ${cls}">${ar}${Math.abs(q.changePct||0).toFixed(2)}%</span>
    </span>`;
  }).join('');
  rail.innerHTML = items + items;
}
