'use strict';
// ════════════════════════════════════════════════════════════
// CATS EXCHANGE — Simulated crypto trading
// Price moves realistically. Orders, wallet, full P&L tracking.
// ════════════════════════════════════════════════════════════

const CX = {
  price:    0.00842,
  history:  [],       // {time,o,h,l,c,v}
  wallet:   {usd:10000, cats:0},
  orders:   [],       // open limit/stop orders
  trades:   [],       // filled trades
  stats:    {high24:0, low24:Infinity, vol24:0},
  _tick:    null,
  _cOpen:   0, _cHigh: 0, _cLow: Infinity, _cStart: 0,
};

// ── INIT ──────────────────────────────────────────────────────
function initCats() {
  const sw = LS.get('cx_wallet'); if (sw) CX.wallet = sw;
  const st = LS.get('cx_trades', []); CX.trades = st;
  const so = LS.get('cx_orders', []); CX.orders = so;
  if (!CX.history.length) _seedHistory();
  _updateStats();
  _startSim();
  _renderCats();
}

function _seedHistory() {
  let p = 0.0062 + Math.random() * 0.004;
  const now = Math.floor(Date.now() / 1000);
  for (let i = 288; i >= 0; i--) {
    const t = now - i * 300;
    const o = p, move = (Math.random() - 0.481) * 0.0005;
    const c = Math.max(0.0001, p + move);
    const h = Math.max(o, c) * (1 + Math.random() * 0.003);
    const l = Math.min(o, c) * (1 - Math.random() * 0.003);
    const v = 8000 + Math.random() * 60000;
    CX.history.push({time:t,o,h,l,c,v});
    p = c;
  }
  CX.price = p;
}

function _updateStats() {
  const day = CX.history.slice(-288);
  CX.stats.high24 = day.reduce((m, c) => Math.max(m, c.h), 0);
  CX.stats.low24  = day.reduce((m, c) => Math.min(m, c.l), Infinity);
  CX.stats.vol24  = day.reduce((s, c) => s + c.v, 0);
}

function _startSim() {
  if (CX._tick) clearInterval(CX._tick);
  CX._cStart = Math.floor(Date.now()/1000);
  CX._cOpen = CX._cHigh = CX._cLow = CX.price;

  CX._tick = setInterval(() => {
    // Realistic GBM-style price movement
    const vol = 0.00015, drift = 0.000000015;
    const move = (Math.random() - 0.499) * vol + drift;
    CX.price = Math.max(0.00001, CX.price + move);
    CX._cHigh = Math.max(CX._cHigh, CX.price);
    CX._cLow  = Math.min(CX._cLow,  CX.price);

    // Close candle every 5 min
    if (Math.floor(Date.now()/1000) - CX._cStart >= 300) {
      CX.history.push({time:CX._cStart, o:CX._cOpen, h:CX._cHigh, l:CX._cLow, c:CX.price, v:5000+Math.random()*50000});
      if (CX.history.length > 600) CX.history.shift();
      CX._cStart = Math.floor(Date.now()/1000);
      CX._cOpen = CX._cHigh = CX._cLow = CX.price;
    }

    _checkOrders();
    _updateLiveUI();
  }, 1500);
}

// ── RENDER FULL PAGE ──────────────────────────────────────────
let _catsChartInst = null;
let _catsTab = 'buy';

function _renderCats() {
  const el = $('catsPage'); if (!el) return;
  const prev24 = CX.history.length >= 288 ? CX.history[CX.history.length - 288].c : CX.history[0]?.c || CX.price;
  const chg = CX.price - prev24;
  const chgPct = (chg / prev24) * 100;
  const cls = clsc(chgPct);

  el.innerHTML = `
  <!-- Stats bar -->
  <div class="cats-ticker-header">
    <div class="cats-stat">
      <div class="cs-lbl">CATS/USDT</div>
      <div class="cats-price cs-val" id="cxPrice" style="color:var(--accent)">${CX.price.toFixed(6)}</div>
    </div>
    <div class="cats-stat">
      <div class="cs-lbl">24h Change</div>
      <div class="cs-val ${cls}" id="cxChg">${arrow(chgPct)} ${fpct(chgPct)}</div>
    </div>
    <div class="cats-stat">
      <div class="cs-lbl">24h High</div>
      <div class="cs-val" style="color:var(--green2)" id="cxHigh">${CX.stats.high24.toFixed(6)}</div>
    </div>
    <div class="cats-stat">
      <div class="cs-lbl">24h Low</div>
      <div class="cs-val" style="color:var(--red2)" id="cxLow">${CX.stats.low24.toFixed(6)}</div>
    </div>
    <div class="cats-stat">
      <div class="cs-lbl">24h Volume</div>
      <div class="cs-val" id="cxVol">${fvol(CX.stats.vol24)}</div>
    </div>
    <div class="cats-stat" style="cursor:pointer" onclick="go('portfolio')">
      <div class="cs-lbl">Portfolio Value</div>
      <div class="cs-val" id="cxPortVal" style="color:var(--accent)">${fp(CX.wallet.usd + CX.wallet.cats * CX.price)}</div>
    </div>
  </div>

  <div class="cats-layout">
    <!-- Chart -->
    <div>
      <div class="chart-wrap" style="margin-bottom:12px">
        <div class="chart-hdr">
          <span class="chart-lbl">CATS/USDT · 5m · <span id="cxChartStats" style="color:var(--text2)"></span></span>
          <div class="chart-tabs">
            <button class="cht active" onclick="cxChartPeriod(50,this)">4H</button>
            <button class="cht" onclick="cxChartPeriod(100,this)">8H</button>
            <button class="cht" onclick="cxChartPeriod(288,this)">24H</button>
          </div>
        </div>
        <div class="chart-box" style="height:260px">
          <canvas id="catsChart" style="width:100%;height:100%"></canvas>
        </div>
      </div>

      <!-- Order Book -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="ob-wrap">
          <div class="ob-hdr">
            <span style="color:var(--red2)">Ask (Sell)</span><span style="color:var(--text3)">Size</span>
          </div>
          <div id="cxAsks"></div>
        </div>
        <div class="ob-wrap">
          <div class="ob-hdr">
            <span style="color:var(--green2)">Bid (Buy)</span><span style="color:var(--text3)">Size</span>
          </div>
          <div id="cxBids"></div>
        </div>
      </div>
    </div>

    <!-- Trade Panel -->
    <div>
      <div class="trade-panel" style="margin-bottom:12px">
        <div class="trade-tabs">
          <button id="cxBuyTab" class="trade-tab buy-active" onclick="cxSetTab('buy')">Buy CATS</button>
          <button id="cxSellTab" class="trade-tab inactive" onclick="cxSetTab('sell')">Sell CATS</button>
        </div>
        <div class="trade-body">
          <!-- Wallet -->
          <div style="display:flex;justify-content:space-between;padding:8px 0;margin-bottom:10px;border-bottom:1px solid var(--border);font-family:var(--mono);font-size:10px">
            <span style="color:var(--text3)">USD Balance</span><span id="cxUsdBal" style="color:var(--text)">${fp(CX.wallet.usd)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;margin-bottom:14px;border-bottom:1px solid var(--border);font-family:var(--mono);font-size:10px">
            <span style="color:var(--text3)">CATS Balance</span><span id="cxCatsBal" style="color:var(--text)">${CX.wallet.cats.toFixed(0)} CATS</span>
          </div>

          <!-- Order type -->
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-bottom:12px">
            <button id="ot-market" class="pct-btn" style="border-color:var(--accent);color:var(--accent)" onclick="cxSetOrderType('market')">Market</button>
            <button id="ot-limit" class="pct-btn" onclick="cxSetOrderType('limit')">Limit</button>
            <button id="ot-stop" class="pct-btn" onclick="cxSetOrderType('stop')">Stop</button>
          </div>

          <!-- Limit/Stop price (hidden for market) -->
          <div id="cxLimitRow" style="display:none;margin-bottom:10px">
            <div style="font-family:var(--mono);font-size:8px;color:var(--text3);margin-bottom:4px;letter-spacing:.1em;text-transform:uppercase">Limit Price ($)</div>
            <input id="cxLimitPrice" class="tinput" type="number" placeholder="${CX.price.toFixed(6)}" step="0.000001" oninput="cxUpdateEst()"/>
          </div>

          <!-- Amount -->
          <div style="font-family:var(--mono);font-size:8px;color:var(--text3);margin-bottom:4px;letter-spacing:.1em;text-transform:uppercase" id="cxAmtLabel">Amount (USD)</div>
          <input id="cxAmt" class="tinput" type="number" placeholder="100" min="0.01" step="any" oninput="cxUpdateEst()"/>
          <div class="pct-row">
            <button class="pct-btn" onclick="cxSetPct(25)">25%</button>
            <button class="pct-btn" onclick="cxSetPct(50)">50%</button>
            <button class="pct-btn" onclick="cxSetPct(75)">75%</button>
            <button class="pct-btn" onclick="cxSetPct(100)">MAX</button>
          </div>
          <div class="trade-est" id="cxEst">Enter amount above</div>
          <button id="cxExecBtn" class="exec-btn buy" onclick="cxExecute()">BUY CATS</button>
        </div>
      </div>

      <!-- Open Orders -->
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r2);padding:12px;margin-bottom:12px">
        <div style="font-family:var(--mono);font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:var(--text3);margin-bottom:8px">Open Orders</div>
        <div id="cxOpenOrders"><div style="font-family:var(--mono);font-size:10px;color:var(--text3)">No open orders</div></div>
      </div>
    </div>

    <!-- Trade History + P&L -->
    <div>
      <!-- Wallet card -->
      <div class="card card-accent" style="margin-bottom:12px">
        <div style="font-family:var(--mono);font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin-bottom:8px">Wallet</div>
        <div style="font-family:var(--mono);font-size:24px;font-weight:600" id="cxWalletTotal">${fp(CX.wallet.usd + CX.wallet.cats * CX.price)}</div>
        <div style="font-family:var(--mono);font-size:10px;color:var(--text3);margin-top:4px">Total value</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
          <div style="background:var(--bg3);padding:10px;border-radius:var(--r)">
            <div style="font-family:var(--mono);font-size:8px;color:var(--text3);margin-bottom:3px">USD</div>
            <div id="cxWalUsd" style="font-family:var(--mono);font-size:12px">${fp(CX.wallet.usd)}</div>
          </div>
          <div style="background:var(--bg3);padding:10px;border-radius:var(--r)">
            <div style="font-family:var(--mono);font-size:8px;color:var(--text3);margin-bottom:3px">CATS</div>
            <div id="cxWalCats" style="font-family:var(--mono);font-size:12px">${CX.wallet.cats.toFixed(0)}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px">
          <button class="btn btn-sm btn-ghost" style="width:100%" onclick="cxResetWallet()">Reset ($10K)</button>
          <button class="btn btn-sm btn-ghost" style="width:100%" onclick="go('portfolio')">Portfolio →</button>
        </div>
      </div>

      <!-- P&L from trades -->
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r2);padding:12px">
        <div style="font-family:var(--mono);font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:var(--text3);margin-bottom:8px">Trade History</div>
        <div id="cxTradeHistory" style="max-height:300px;overflow-y:auto"></div>
      </div>
    </div>
  </div>`;

  _cxOrderType = 'market';
  _renderCatsChart(50);
  _renderOrderBook();
  _renderTradeHistory();
  _renderOpenOrders();
}

// ── ORDER TYPE ────────────────────────────────────────────────
let _cxOrderType = 'market';
function cxSetOrderType(type) {
  _cxOrderType = type;
  ['market','limit','stop'].forEach(t => {
    const btn = $('ot-'+t); if (!btn) return;
    btn.style.borderColor = t===type ? 'var(--accent)' : 'var(--border)';
    btn.style.color = t===type ? 'var(--accent)' : 'var(--text3)';
  });
  const lr = $('cxLimitRow');
  if (lr) lr.style.display = (type==='limit'||type==='stop') ? 'block' : 'none';
  const lp = $('cxLimitPrice');
  if (lp) lp.placeholder = type==='stop' ? 'Stop price' : 'Limit price';
  cxUpdateEst();
}

// ── TABS ──────────────────────────────────────────────────────
function cxSetTab(tab) {
  _catsTab = tab;
  const bt=$('cxBuyTab'), st=$('cxSellTab'), btn=$('cxExecBtn'), lbl=$('cxAmtLabel');
  if (bt) { bt.className='trade-tab '+(tab==='buy'?'buy-active':'inactive'); }
  if (st) { st.className='trade-tab '+(tab==='sell'?'sell-active':'inactive'); }
  if (btn) { btn.className='exec-btn '+(tab==='buy'?'buy':'sell'); btn.textContent=(tab==='buy'?'BUY':'SELL')+' CATS'; }
  if (lbl) lbl.textContent = tab==='buy' ? 'Amount (USD)' : 'Amount (CATS)';
  cxUpdateEst();
}

// ── PCT BUTTONS ───────────────────────────────────────────────
function cxSetPct(pct) {
  const inp = $('cxAmt'); if (!inp) return;
  if (_catsTab==='buy') {
    inp.value = (CX.wallet.usd * pct/100).toFixed(2);
  } else {
    inp.value = (CX.wallet.cats * pct/100).toFixed(0);
  }
  cxUpdateEst();
}

// ── ESTIMATE ──────────────────────────────────────────────────
function cxUpdateEst() {
  const inp=$('cxAmt'), el=$('cxEst'); if(!el) return;
  const amt = parseFloat(inp?.value)||0;
  const limitP = parseFloat($('cxLimitPrice')?.value)||0;
  const execPrice = (_cxOrderType==='limit'||_cxOrderType==='stop') && limitP > 0 ? limitP : CX.price;
  const fee = amt * 0.001;
  if (_catsTab==='buy') {
    const cats = (amt - fee) / execPrice;
    el.innerHTML = `Get: <strong style="color:var(--green2)">${cats.toFixed(0)} CATS</strong> · Fee: $${fee.toFixed(4)} · @ $${execPrice.toFixed(6)}`;
  } else {
    const usd = (amt * execPrice) * (1-0.001);
    el.innerHTML = `Get: <strong style="color:var(--green2)">$${usd.toFixed(4)}</strong> · Fee: ${(amt*0.001).toFixed(0)} CATS · @ $${execPrice.toFixed(6)}`;
  }
}

// ── EXECUTE ORDER ─────────────────────────────────────────────
function cxExecute() {
  const inp=$('cxAmt'); const amt=parseFloat(inp?.value)||0;
  if(amt<=0){toast('Enter an amount');return;}
  const limitP=parseFloat($('cxLimitPrice')?.value)||0;

  if (_cxOrderType==='market') {
    _fillTrade(_catsTab, amt, CX.price);
  } else {
    // Queue limit/stop order
    if(!limitP){toast('Enter a limit price');return;}
    CX.orders.push({
      id:Date.now(), side:_catsTab, type:_cxOrderType,
      amt, limitPrice:limitP, created:Date.now(),
    });
    LS.set('cx_orders', CX.orders);
    _renderOpenOrders();
    toast(`${_cxOrderType.toUpperCase()} order placed: ${_catsTab} ${_cxOrderType==='limit'?'at':'stop'} $${limitP.toFixed(6)}`, true);
  }
  if(inp) inp.value='';
  cxUpdateEst();
}

function _fillTrade(side, amt, price) {
  const fee = amt * 0.001;
  if (side==='buy') {
    if(amt>CX.wallet.usd){toast('Insufficient USD');return;}
    const cats=(amt-fee)/price;
    CX.wallet.usd -= amt;
    CX.wallet.cats += cats;
    CX.trades.unshift({side:'buy',cats:+cats.toFixed(4),price,usd:amt,fee,time:Date.now()});
    toast(`✓ Bought ${cats.toFixed(0)} CATS @ $${price.toFixed(6)}`,true);
  } else {
    if(amt>CX.wallet.cats){toast('Insufficient CATS');return;}
    const usd=(amt-fee)*price;
    CX.wallet.cats -= amt;
    CX.wallet.usd += usd;
    CX.trades.unshift({side:'sell',cats:amt,price,usd,fee,time:Date.now()});
    toast(`✓ Sold ${amt.toFixed(0)} CATS for $${usd.toFixed(4)}`,true);
  }
  if(CX.trades.length>100) CX.trades.pop();
  LS.set('cx_wallet',CX.wallet);
  LS.set('cx_trades',CX.trades);
  _renderTradeHistory();
}

function cxCancelOrder(id) {
  CX.orders = CX.orders.filter(o=>o.id!==id);
  LS.set('cx_orders',CX.orders);
  _renderOpenOrders();
  toast('Order cancelled');
}

function _checkOrders() {
  if(!CX.orders.length) return;
  const filled=[];
  CX.orders.forEach(o => {
    const should = o.type==='limit'
      ? (o.side==='buy' ? CX.price<=o.limitPrice : CX.price>=o.limitPrice)
      : (o.side==='buy' ? CX.price>=o.limitPrice : CX.price<=o.limitPrice);
    if(should) { _fillTrade(o.side, o.amt, o.limitPrice); filled.push(o.id); }
  });
  if(filled.length) {
    CX.orders = CX.orders.filter(o=>!filled.includes(o.id));
    LS.set('cx_orders',CX.orders);
    _renderOpenOrders();
  }
}

function cxResetWallet() {
  CX.wallet={usd:10000,cats:0};CX.trades=[];CX.orders=[];
  LS.set('cx_wallet',CX.wallet);LS.set('cx_trades',CX.trades);LS.set('cx_orders',CX.orders);
  _renderTradeHistory();_renderOpenOrders();
  toast('Wallet reset to $10,000');
}

// ── LIVE UI UPDATE ────────────────────────────────────────────
function _updateLiveUI() {
  const prev24 = CX.history.length>=288 ? CX.history[CX.history.length-288].c : CX.history[0]?.c||CX.price;
  const chgPct = (CX.price-prev24)/prev24*100;
  const cls = clsc(chgPct);
  const total = CX.wallet.usd + CX.wallet.cats * CX.price;

  const set=(id,v,col)=>{const el=$(id);if(el){el.textContent=v;if(col)el.style.color=col;}};
  set('cxPrice','$'+CX.price.toFixed(6), chgPct>=0?'var(--green2)':'var(--red2)');
  set('cxChg',arrow(chgPct)+' '+fpct(chgPct));
  const ce=$('cxChg');if(ce)ce.className='cs-val '+cls;
  set('cxHigh', '$'+CX.stats.high24.toFixed(6));
  set('cxLow',  '$'+CX.stats.low24.toFixed(6));
  set('cxPortVal', fp(total));
  set('cxWalletTotal', fp(total));
  set('cxWalUsd', fp(CX.wallet.usd));
  set('cxWalCats', CX.wallet.cats.toFixed(0)+' CATS');
  set('cxUsdBal', fp(CX.wallet.usd));
  set('cxCatsBal', CX.wallet.cats.toFixed(0)+' CATS');
  cxUpdateEst();
}

// ── ORDER BOOK ────────────────────────────────────────────────
function _renderOrderBook() {
  const asks=$('cxAsks'), bids=$('cxBids'); if(!asks||!bids) return;
  const spread = CX.price*0.002;
  const maxSz = 80000;
  const mkRow=(price,size,side)=>{
    const pct=size/maxSz*100;
    const bg=side==='ask'?'rgba(239,68,68,1)':'rgba(16,185,129,1)';
    return `<div class="ob-row">
      <div class="fill-bar" style="width:${pct.toFixed(0)}%;background:${bg}"></div>
      <span style="color:${side==='ask'?'var(--red2)':'var(--green2)'};font-family:var(--mono);font-size:10px;cursor:pointer" onclick="document.getElementById('cxLimitPrice')&&(document.getElementById('cxLimitPrice').value=${price.toFixed(6)},cxUpdateEst())">${price.toFixed(6)}</span>
      <span style="color:var(--text3);font-family:var(--mono);font-size:9px">${fvol(size)}</span>
    </div>`;
  };
  asks.innerHTML = Array.from({length:8},(_,i)=>mkRow(CX.price+spread+i*CX.price*0.0008, (8000+Math.random()*60000)|0,'ask')).join('');
  bids.innerHTML = Array.from({length:8},(_,i)=>mkRow(CX.price-spread-i*CX.price*0.0008, (8000+Math.random()*60000)|0,'bid')).join('');
}
setInterval(()=>{if($('cxAsks')) _renderOrderBook();}, 3000);

// ── TRADE HISTORY ─────────────────────────────────────────────
function _renderTradeHistory() {
  const el=$('cxTradeHistory'); if(!el) return;
  if(!CX.trades.length){el.innerHTML='<div style="font-family:var(--mono);font-size:10px;color:var(--text3)">No trades yet</div>';return;}

  // Calc total P&L
  let realizedPnl=0;
  const buyStack=[];
  [...CX.trades].reverse().forEach(t=>{
    if(t.side==='buy') buyStack.push({cats:t.cats,price:t.price});
    else if(buyStack.length){
      const cost=buyStack.reduce((s,b)=>s+b.cats*b.price,0)/buyStack.reduce((s,b)=>s+b.cats,0);
      realizedPnl+=(t.price-cost)*t.cats;
    }
  });

  const pnlCls=clsc(realizedPnl);
  el.innerHTML=`<div style="padding:8px 0;margin-bottom:8px;border-bottom:1px solid var(--border);font-family:var(--mono);font-size:10px;display:flex;justify-content:space-between">
    <span style="color:var(--text3)">Realized P&L</span>
    <span class="${pnlCls}">${realizedPnl>=0?'+':''}${fp(realizedPnl)}</span>
  </div>`+
  CX.trades.slice(0,30).map(t=>{
    const d=new Date(t.time).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
    const cls=t.side==='buy'?'var(--green2)':'var(--red2)';
    return`<div style="display:grid;grid-template-columns:36px 1fr 1fr;gap:6px;padding:5px 0;border-bottom:1px solid rgba(22,32,64,.4);font-family:var(--mono);font-size:9px">
      <span style="color:${cls};font-weight:700;text-transform:uppercase">${t.side}</span>
      <span style="color:var(--text2)">${t.cats.toFixed(0)} CATS @ $${t.price.toFixed(5)}</span>
      <span style="color:var(--text3);text-align:right">${d}</span>
    </div>`;
  }).join('');
}

function _renderOpenOrders() {
  const el=$('cxOpenOrders'); if(!el) return;
  if(!CX.orders.length){el.innerHTML='<div style="font-family:var(--mono);font-size:10px;color:var(--text3)">No open orders</div>';return;}
  el.innerHTML=CX.orders.map(o=>`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-family:var(--mono);font-size:9px">
      <span class="${o.side==='buy'?'up':'dn'}" style="font-weight:700;text-transform:uppercase">${o.type} ${o.side}</span>
      <span style="color:var(--text2)">${o.amt} ${o.side==='buy'?'USD':'CATS'} @ $${o.limitPrice.toFixed(6)}</span>
      <button class="btn btn-sm btn-ghost" onclick="cxCancelOrder(${o.id})" style="padding:2px 8px;font-size:8px">Cancel</button>
    </div>`).join('');
}

// ── CHART ─────────────────────────────────────────────────────
async function _renderCatsChart(count) {
  const history = CX.history.slice(-count);
  const color = history[history.length-1]?.c >= history[0]?.c ? '#10B981' : '#EF4444';
  const labels = history.map(c=>new Date(c.time*1000).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}));
  const prices = history.map(c=>c.c);

  const stats=$('cxChartStats');
  if(stats && history.length>1){
    const open=history[0].c, close=history[history.length-1].c;
    const p=((close-open)/open*100).toFixed(2);
    stats.innerHTML=`O:$${open.toFixed(5)} H:$${Math.max(...history.map(c=>c.h)).toFixed(5)} L:$${Math.min(...history.map(c=>c.l)).toFixed(5)} <span class="${clsc(close-open)}">${arrow(close-open)}${Math.abs(p)}%</span>`;
  }

  _catsChartInst = await mkChart('catsChart','line',
    {labels,datasets:[lineDs(prices,color)]},
    {...chartOpts(v=>'$'+v.toFixed(5)), animation:{duration:0}}
  );
}

async function cxChartPeriod(count, btn) {
  $all('.chart-tabs .cht').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  await _renderCatsChart(count);
}
