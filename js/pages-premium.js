'use strict';

// ── SENTIMENT ────────────────────────────────────────────────
async function initSentiment() {
  const el=$('sentimentContent');
  if(el) el.innerHTML='<div class="loading">Analyzing 18 stocks…</div>';
  const d = await fetchSentiment();
  if(!d||!d.score){if(el)el.innerHTML='<div class="empty" style="color:var(--red2)">Check FINNHUB_API_KEY in Vercel env vars</div>';return;}
  renderSentiment(d);
}

function renderSentiment(d) {
  const el=$('sentimentContent');if(!el)return;
  const {score,label,color,breadth,avgChangePct,stocks}=d;
  const C=2*Math.PI*65;
  const offset=C-(score/100)*C;
  el.innerHTML=`
  <div style="display:grid;grid-template-columns:300px 1fr;gap:24px">
    <div>
      <div class="card card-accent" style="margin-bottom:16px;text-align:center">
        <div class="sec-title" style="border:none;margin-bottom:12px"><em>//</em> Fear &amp; Greed Index</div>
        <div class="gauge-ring">
          <svg viewBox="0 0 160 160"><circle class="track" cx="80" cy="80" r="65"/><circle class="fill" cx="80" cy="80" r="65" stroke="${color}" stroke-dasharray="${C}" stroke-dashoffset="${offset}" id="gArc"/></svg>
          <div class="gauge-center"><div class="gauge-num" style="color:${color}" id="gNum">0</div><div class="gauge-lbl">${label}</div></div>
        </div>
        <div style="font-family:var(--mono);font-size:10px;color:var(--text3)">${breadth.up} up · ${breadth.down} down · Avg <span class="${clsc(avgChangePct)}">${fpct(avgChangePct)}</span></div>
      </div>
      <div class="card" style="font-family:var(--mono);font-size:10px;color:var(--text3);line-height:1.8">
        <strong style="color:var(--text);display:block;margin-bottom:4px">How it's calculated</strong>
        60% breadth (how many stocks are up) + 40% momentum (avg % change). Below 30 = extreme fear. Above 70 = extreme greed.
      </div>
    </div>
    <div>
      <div class="sec-title"><em>//</em> Stock Breakdown</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:20px">
        ${stocks.map(s=>`<div onclick="goQuote('${s.symbol}')" style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:10px;cursor:pointer;transition:border-color .12s" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
          <div style="font-family:var(--mono);font-size:9px;color:var(--accent);font-weight:600">${s.symbol}</div>
          <div class="${clsc(s.changePct)}" style="font-family:var(--mono);font-size:11px">${arrow(s.changePct)} ${fpct(s.changePct)}</div>
        </div>`).join('')}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${[['0–25','Extreme Fear','var(--red)','Contrarian buy zone'],['25–45','Fear','var(--red2)','Cautious — wait for reversal'],['45–55','Neutral','var(--amber)','Follow individual setups'],['55–75','Greed','var(--green2)','Strong momentum, watch for extension'],['75–100','Extreme Greed','var(--green)','Consider trimming, tighten stops']].map(([r,l,c,d])=>`
          <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:12px;${score>=parseInt(r.split('–')[0])&&score<=parseInt(r.split('–')[1])?'border-color:'+c:''}">
            <div style="font-family:var(--mono);font-size:8px;color:${c};margin-bottom:3px">${r} · ${l}</div>
            <div style="font-size:11px;color:var(--text2)">${d}</div>
          </div>`).join('')}
      </div>
    </div>
  </div>`;
  let n=0;const ni=$('gNum');const t=setInterval(()=>{n=Math.min(n+Math.ceil(score/25),score);if(ni)ni.textContent=n;if(n>=score)clearInterval(t);},30);
}

// ── EARNINGS ──────────────────────────────────────────────────
async function initEarnings() {
  const el=$('earningsContent');
  if(el) el.innerHTML='<div class="loading">Loading earnings calendar…</div>';
  const d=await fetchEarnings();
  if(!d||!d.earnings){if(el)el.innerHTML='<div class="empty" style="color:var(--red2)">Check FINNHUB_API_KEY</div>';return;}
  renderEarnings(d.earnings);
}

function renderEarnings(earnings) {
  const el=$('earningsContent');if(!el)return;
  if(!earnings.length){el.innerHTML='<div class="empty">No upcoming earnings found</div>';return;}
  const today=new Date().toISOString().split('T')[0];
  const byDate={};
  earnings.forEach(e=>{if(!byDate[e.date])byDate[e.date]=[];byDate[e.date].push(e);});
  el.innerHTML=`
  <div style="padding:12px 16px;background:var(--bg2);border:1px solid var(--acc-border);border-radius:var(--r2);margin-bottom:20px;font-family:var(--mono);font-size:10px;color:var(--text2)">
    📅 Next 60 days · 25 major stocks · Click any row for full quote &amp; chart
  </div>`+
  Object.entries(byDate).map(([date,items])=>{
    const isToday=date===today, isPast=date<today;
    return`<div style="margin-bottom:24px">
      <div class="sec-title" style="${isToday?'color:var(--accent)':''}"><em>${isToday?'★ TODAY':'//'}  </em>${fdatestr(date)} ${isPast?'· Reported':isToday?'· Today!':'· Upcoming'}</div>
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r3);overflow:hidden">
        <table class="tbl">
          <thead><tr class="earn-hdr"><th>Symbol</th><th>EPS Est.</th><th>EPS Actual</th><th>When</th><th>Beat?</th><th>Revenue Est.</th></tr></thead>
          <tbody>${items.map(e=>{
            const beat=e.epsActual!=null&&e.epsEstimate!=null?(e.epsActual>=e.epsEstimate?'beat':'miss'):'pending';
            const bc=beat==='beat'?'var(--green2)':beat==='miss'?'var(--red2)':'var(--text3)';
            const hc=e.hour==='bmo'?'earn-hour bmo':e.hour==='amc'?'earn-hour amc':'';
            return`<tr onclick="goQuote('${e.symbol}')">
              <td><span class="tbl-sym">${e.symbol}</span></td>
              <td style="font-family:var(--mono)">${e.epsEstimate!=null?'$'+Number(e.epsEstimate).toFixed(2):'—'}</td>
              <td style="font-family:var(--mono);color:${bc}">${e.epsActual!=null?'$'+Number(e.epsActual).toFixed(2):'—'}</td>
              <td><span class="${hc}">${e.hour==='bmo'?'Pre-Mkt':e.hour==='amc'?'After-Mkt':e.hour||'—'}</span></td>
              <td style="color:${bc};font-family:var(--mono);font-size:10px">${beat==='beat'?'✓ Beat':beat==='miss'?'✗ Miss':'—'}</td>
              <td style="font-family:var(--mono);color:var(--text3)">${e.revenueEstimate?fmtBig(e.revenueEstimate):'—'}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>
    </div>`;
  }).join('');
}

// ── MACRO ─────────────────────────────────────────────────────
async function initMacro() {
  const el=$('macroContent');
  if(el) el.innerHTML='<div class="loading">Loading macro indicators…</div>';
  const d=await fetchMacro();
  if(!d){if(el)el.innerHTML='<div class="empty">Could not load macro data</div>';return;}
  renderMacro(d);
}

function renderMacro(d) {
  const el=$('macroContent');if(!el)return;
  const {indices,sectors,bonds,other,yieldCurveSignal}=d;
  const mc=items=>items.map(i=>{const cls=clsc(i.changePct);return`<div class="mc" onclick="goQuote('${i.symbol}')"><div class="mc-sym">${i.symbol}</div><div class="mc-price">${fp(i.price)}</div><div class="mc-chg ${cls}">${arrow(i.changePct)} ${fpct(i.changePct)}</div><div class="mc-name">${i.name.slice(0,28)}</div></div>`;}).join('');
  el.innerHTML=`
    <div style="margin-bottom:28px"><div class="sec-title"><em>//</em> US Indices</div><div class="macro-grid">${mc(indices)}</div></div>
    ${yieldCurveSignal?`<div style="margin-bottom:28px">
      <div class="sec-title"><em>//</em> Yield Curve</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
        ${mc(bonds)}
        <div class="card card-accent"><div style="font-family:var(--mono);font-size:8px;color:var(--accent);margin-bottom:6px">SIGNAL</div><div style="font-family:var(--mono);font-size:14px">${yieldCurveSignal.signal}</div></div>
      </div></div>`:''}
    <div style="margin-bottom:28px"><div class="sec-title"><em>//</em> Sectors · Click to drill down</div><div class="macro-grid">${sectors.map(s=>{const k=Object.keys({tech:'XLK',finance:'XLF',energy:'XLE',healthcare:'XLV',consumer:'XLY',industrial:'XLI'}).find(k=>({tech:'XLK',finance:'XLF',energy:'XLE',healthcare:'XLV',consumer:'XLY',industrial:'XLI'})[k]===s.symbol);const cls=clsc(s.changePct);return`<div class="mc" onclick="${k?`goSector('${k}')`:`goQuote('${s.symbol}')`}" style="border-color:${(s.changePct||0)>=0?'rgba(16,185,129,.2)':'rgba(239,68,68,.2)'}"><div class="mc-sym">${s.symbol}</div><div class="mc-price">${fp(s.price)}</div><div class="mc-chg ${cls}">${arrow(s.changePct)} ${fpct(s.changePct)}</div><div class="mc-name" style="color:var(--accent);font-size:9px">Explore →</div></div>`;}).join('')}</div></div>
    <div><div class="sec-title"><em>//</em> Commodities &amp; Dollar</div><div class="macro-grid">${mc(other)}</div></div>`;
}

// ── SCREENER ─────────────────────────────────────────────────
const SCREEN_SYMS = ['AAPL','MSFT','NVDA','AMZN','TSLA','META','GOOGL','JPM','GS','AMD','NFLX','V','XOM','LLY','MA','ABBV','UNH','JNJ','PFE','BAC','C','WFC','HON','CAT','DE','BA','NEE','DUK','LIN','SHW'];

async function initScreener() {
  const el=$('screenerContent');
  if(el) el.innerHTML='<div class="loading">Loading stock data…</div>';
  const missing=SCREEN_SYMS.filter(s=>!LQ[s]||!LQ[s].price);
  if(missing.length) await Promise.allSettled(missing.map(s=>fetchQuote(s)));
  runScreener();
}

function runScreener() {
  const minChg   = parseFloat($('scMinChg')?.value  || '-100');
  const maxChg   = parseFloat($('scMaxChg')?.value  || '100');
  const minPrice = parseFloat($('scMinP')?.value    || '0');
  const maxPrice = parseFloat($('scMaxP')?.value    || '99999');
  const sort     = $('scSort')?.value || 'changePct';

  let results = SCREEN_SYMS
    .map(s=>LQ[s]).filter(q=>q&&q.price)
    .filter(q=>(q.changePct||0)>=minChg && (q.changePct||0)<=maxChg)
    .filter(q=>q.price>=minPrice && q.price<=maxPrice);

  results.sort((a,b)=>{
    if(sort==='changePct') return Math.abs(b.changePct||0)-Math.abs(a.changePct||0);
    if(sort==='gainers')   return (b.changePct||0)-(a.changePct||0);
    if(sort==='losers')    return (a.changePct||0)-(b.changePct||0);
    if(sort==='price')     return b.price-a.price;
    return 0;
  });

  const el=$('screenerContent');if(!el)return;
  el.innerHTML=`<div style="font-family:var(--mono);font-size:10px;color:var(--text3);margin-bottom:12px">${results.length} stocks match your filter</div>
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r3);overflow:hidden">
    <table class="tbl">
      <thead><tr><th>Symbol</th><th>Price</th><th>Change %</th><th>Change $</th><th>High</th><th>Low</th><th>Prev Close</th></tr></thead>
      <tbody>${results.map(q=>{const cls=clsc(q.changePct);return`<tr onclick="goQuote('${q.symbol}')">
        <td><span class="tbl-sym">${q.symbol}</span></td>
        <td>${fp(q.price)}</td>
        <td class="${cls}">${arrow(q.changePct)} ${fpct(q.changePct)}</td>
        <td class="${cls}">${fchg(q.change)}</td>
        <td style="color:var(--green2)">${fp(q.high)}</td>
        <td style="color:var(--red2)">${fp(q.low)}</td>
        <td style="color:var(--text3)">${fp(q.prevClose)}</td>
      </tr>`;}).join('')}</tbody>
    </table>
  </div>`;
}

// ── WATCHLIST ─────────────────────────────────────────────────
let _watchlist = [];
let _alerts = [];
let _watchTimer = null;

function initWatchlist() {
  _watchlist = LS.get('watchlist',['AAPL','TSLA','NVDA','AMZN','META']);
  _alerts    = LS.get('price_alerts',[]);
  renderWatchlist();renderAlerts();
  if(_watchTimer) clearInterval(_watchTimer);
  _watchTimer=setInterval(async()=>{
    await Promise.allSettled(_watchlist.map(s=>fetchQuote(s)));
    renderWatchlist();checkAllAlerts();
  },60000);
}

async function addToWatchlist() {
  const inp=$('watchInput'),sym=(inp?.value||'').trim().toUpperCase();
  if(!sym)return;
  if(_watchlist.includes(sym)){toast(sym+' already in watchlist');return;}
  const q=await fetchQuote(sym);
  if(!q||!q.price){toast(sym+' not found');return;}
  _watchlist.push(sym);LS.set('watchlist',_watchlist);
  if(inp)inp.value='';renderWatchlist();toast(sym+' added ✓',true);
}
function removeFromWatchlist(sym){_watchlist=_watchlist.filter(s=>s!==sym);LS.set('watchlist',_watchlist);renderWatchlist();}

function renderWatchlist() {
  const el=$('watchTable');if(!el)return;
  if(!_watchlist.length){el.innerHTML='<div class="empty">Add symbols above</div>';return;}
  el.innerHTML=`<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r3);overflow:hidden">
    <table class="tbl">
      <thead><tr><th>Symbol</th><th>Price</th><th>Change</th><th>High</th><th>Low</th><th>Alert</th><th></th></tr></thead>
      <tbody>${_watchlist.map(sym=>{
        const q=LQ[sym];
        const a=_alerts.find(a=>a.symbol===sym&&!a.triggered);
        return`<tr>
          <td><span class="tbl-sym" onclick="goQuote('${sym}')" style="cursor:pointer">${sym}</span></td>
          <td>${q?fp(q.price):'—'}</td>
          <td class="${q?clsc(q.changePct):''}">${q?arrow(q.changePct)+' '+fpct(q.changePct):'—'}</td>
          <td style="color:var(--green2)">${q?fp(q.high):'—'}</td>
          <td style="color:var(--red2)">${q?fp(q.low):'—'}</td>
          <td style="font-family:var(--mono);font-size:9px">${a?`<span style="color:var(--accent)">🔔 ${a.type} ${fp(a.target)}</span>`:'<span style="color:var(--text3)">—</span>'}</td>
          <td><button class="btn btn-sm btn-danger" onclick="removeFromWatchlist('${sym}')">✕</button></td>
        </tr>`;
      }).join('')}</tbody>
    </table>
  </div>`;
}

function addAlert() {
  const sym=($('alertSym')?.value||'').trim().toUpperCase();
  const target=parseFloat($('alertTarget')?.value||'0');
  const type=$('alertType')?.value||'above';
  if(!sym||!target){toast('Fill in symbol and target');return;}
  if(!_watchlist.includes(sym)){_watchlist.push(sym);LS.set('watchlist',_watchlist);renderWatchlist();}
  _alerts.push({symbol:sym,target,type,triggered:false,created:Date.now()});
  LS.set('price_alerts',_alerts);renderAlerts();
  if($('alertSym'))$('alertSym').value='';if($('alertTarget'))$('alertTarget').value='';
  toast(`Alert set: ${sym} ${type} ${fp(target)} 🔔`,true);
}
function removeAlert(i){_alerts.splice(i,1);LS.set('price_alerts',_alerts);renderAlerts();}
function renderAlerts() {
  const el=$('alertsList');if(!el)return;
  const active=_alerts.filter(a=>!a.triggered);
  const done=_alerts.filter(a=>a.triggered);
  if(!_alerts.length){el.innerHTML='<div class="empty">No alerts set</div>';return;}
  el.innerHTML=[...active.map((a,i)=>`<div class="alert-row">
    <span style="font-family:var(--mono);font-size:10px"><span style="color:var(--accent)">${a.symbol}</span> ${a.type==='above'?'rises above':'drops below'} <strong>${fp(a.target)}</strong></span>
    <button class="btn btn-sm btn-danger" onclick="removeAlert(${_alerts.indexOf(a)})">✕</button>
  </div>`),...done.map(a=>`<div class="alert-row" style="opacity:.4"><span style="font-family:var(--mono);font-size:10px">✓ ${a.symbol} ${a.type} ${fp(a.target)}</span><span style="font-family:var(--mono);font-size:9px;color:var(--green2)">Triggered</span></div>`)].join('');
}
function checkAllAlerts() {
  let changed=false;
  _alerts.forEach((a,i)=>{
    if(a.triggered)return;
    const q=LQ[a.symbol];if(!q||!q.price)return;
    if((a.type==='above'&&q.price>=a.target)||(a.type==='below'&&q.price<=a.target)){
      _alerts[i].triggered=true;changed=true;
      toast(`🔔 ${a.symbol} alert: ${a.type} ${fp(a.target)}`,true);
    }
  });
  if(changed){LS.set('price_alerts',_alerts);renderAlerts();renderWatchlist();}
}

// ── PORTFOLIO ─────────────────────────────────────────────────
let _portfolio=[];
let _portChartInst=null;

function initPortfolio(){_portfolio=LS.get('portfolio',[]);renderPortfolio();}

async function addHolding(){
  const sym=($('portSym')?.value||'').trim().toUpperCase();
  const qty=parseFloat($('portQty')?.value||'0');
  const cost=parseFloat($('portCost')?.value||'0');
  if(!sym||!qty||!cost){toast('Fill all three fields');return;}
  let q=LQ[sym];if(!q?.price){toast('Looking up '+sym+'…');q=await fetchQuote(sym);}
  if(!q?.price){toast(sym+' not found');return;}
  const ex=_portfolio.findIndex(h=>h.symbol===sym);
  if(ex>=0){const total=_portfolio[ex].qty+qty;_portfolio[ex].cost=(_portfolio[ex].cost*_portfolio[ex].qty+cost*qty)/total;_portfolio[ex].qty=total;}
  else _portfolio.push({symbol:sym,qty,cost,name:q.name||sym});
  LS.set('portfolio',_portfolio);renderPortfolio();
  if($('portSym'))$('portSym').value='';if($('portQty'))$('portQty').value='';if($('portCost'))$('portCost').value='';
  toast(sym+' added ✓',true);
}
function removeHolding(sym){_portfolio=_portfolio.filter(h=>h.symbol!==sym);LS.set('portfolio',_portfolio);renderPortfolio();}

function renderPortfolio(){
  const te=$('portTable'),se=$('portSummary');if(!te)return;
  if(!_portfolio.length){te.innerHTML='<div class="empty" style="padding:40px">Add holdings above</div>';if(se)se.innerHTML='<div class="empty">No holdings</div>';return;}
  let totalVal=0,totalCost=0;
  const rows=_portfolio.map(h=>{
    const q=LQ[h.symbol];const price=q?.price||h.cost;
    const value=price*h.qty,pnl=(price-h.cost)*h.qty,pct=((price-h.cost)/h.cost)*100;
    totalVal+=value;totalCost+=h.cost*h.qty;
    return{...h,price,value,pnl,pct};
  });
  const totalPnl=totalVal-totalCost,totalPct=(totalPnl/totalCost)*100;
  te.innerHTML=`<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r3);overflow:hidden">
    <table class="tbl">
      <thead><tr><th>Symbol</th><th>Qty</th><th>Avg Cost</th><th>Price</th><th>Value</th><th>P&L</th><th>P&L %</th><th></th></tr></thead>
      <tbody>${rows.map(r=>`<tr>
        <td><span class="tbl-sym" onclick="goQuote('${r.symbol}')" style="cursor:pointer">${r.symbol}</span></td>
        <td style="font-family:var(--mono)">${r.qty}</td>
        <td style="font-family:var(--mono)">${fp(r.cost)}</td>
        <td style="font-family:var(--mono)">${fp(r.price)}</td>
        <td style="font-family:var(--mono)">${fmtBig(r.value)}</td>
        <td class="${clsc(r.pnl)}" style="font-family:var(--mono)">${r.pnl>=0?'+':''}${fmtBig(Math.abs(r.pnl))}</td>
        <td class="${clsc(r.pct)}" style="font-family:var(--mono)">${fpct(r.pct)}</td>
        <td><button class="btn btn-sm btn-danger" onclick="removeHolding('${r.symbol}')">✕</button></td>
      </tr>`).join('')}</tbody>
    </table>
  </div>`;
  if(se){
    const pc=clsc(totalPnl);
    se.innerHTML=`<div style="font-family:var(--mono);font-size:8px;color:var(--accent);letter-spacing:.12em;margin-bottom:6px">PORTFOLIO</div>
    <div class="ps-total">${fmtBig(totalVal)}</div>
    <div class="${pc}" style="font-family:var(--mono);font-size:12px;margin-bottom:16px">${totalPnl>=0?'+':''}${fmtBig(Math.abs(totalPnl))} (${fpct(totalPct)})</div>
    ${rows.map(r=>`<div class="ps-row"><span>${r.symbol}</span><span class="${clsc(r.pct)}">${fpct(r.pct)}</span></div>`).join('')}
    <div class="ps-row" style="margin-top:8px;border-top:1px solid var(--border);padding-top:12px"><span>Cost Basis</span><span>${fmtBig(totalCost)}</span></div>
    <div style="margin-top:16px"><div class="sec-title">Allocation</div><div style="height:200px"><canvas id="pieChart" style="width:100%;height:100%"></canvas></div></div>`;
    setTimeout(async()=>{
      const COLS=['#00D4FF','#10B981','#EF4444','#F59E0B','#8B5CF6','#EC4899','#14B8A6','#F97316'];
      _portChartInst=await mkChart('pieChart','doughnut',
        {labels:rows.map(r=>r.symbol),datasets:[{data:rows.map(r=>r.value),backgroundColor:rows.map((_,i)=>COLS[i%COLS.length]+'CC'),borderColor:rows.map((_,i)=>COLS[i%COLS.length]),borderWidth:1}]},
        {responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:'#2E3D5C',font:{family:'DM Mono',size:9},boxWidth:10,padding:10}},tooltip:{backgroundColor:'#090C18',borderColor:'#162040',borderWidth:1,bodyColor:'#C8D4E8',callbacks:{label:ctx=>' '+fmtBig(ctx.parsed)+' · '+(ctx.parsed/totalVal*100).toFixed(1)+'%'}}}}
      );
    },50);
  }
}

// ── SIMULATOR ─────────────────────────────────────────────────
function initSimulator(){calcPosition();}
function calcPosition(){
  const acct=parseFloat($('simAcct')?.value)||50000;
  const risk=parseFloat($('simRisk')?.value)||1;
  const entry=parseFloat($('simEntry')?.value)||150;
  const stop=parseFloat($('simStop')?.value)||144;
  const target=parseFloat($('simTarget')?.value)||165;
  if(entry<=0||stop<=0||entry===stop)return;
  const rps=Math.abs(entry-stop);
  const dr=acct*risk/100;
  const shares=Math.floor(dr/rps);
  const rr=(Math.abs(target-entry)/rps);
  const maxLoss=shares*rps;
  const maxGain=shares*Math.abs(target-entry);
  const posSize=shares*entry;
  const pct=(posSize/acct)*100;
  const el=$('simResults');if(!el)return;
  const rc=(lbl,val,sub,cls)=>`<div class="res-card ${cls||''}"><div class="rc-lbl">${lbl}</div><div class="rc-val ${cls||''}">${val}</div><div class="rc-sub">${sub}</div></div>`;
  el.innerHTML=`<div class="res-grid">
    ${rc('Shares to Buy',shares.toLocaleString(),`Position size: ${fmtBig(posSize)} (${pct.toFixed(1)}% of account)`,'card-accent')}
    ${rc('Max Loss if Stopped','-'+fmtBig(maxLoss),`${risk}% risk · Stop at ${fp(stop)}`,'dn')}
    ${rc('Max Gain if Target Hit','+'+fmtBig(maxGain),`Target at ${fp(target)}`,'up')}
    ${rc('Risk / Reward','1 : '+rr.toFixed(2),rr>=3?'Excellent':rr>=2?'Good':rr>=1?'Acceptable':'Poor — consider skipping',rr>=2?'up':rr>=1?'':'dn')}
    ${rc('Breakeven',fp(entry),'Your exact entry price','')}
    ${rc('Trades to Wipe Account',Math.floor(100/risk).toLocaleString(),`At ${risk}% risk per trade`,'')}</div>`;
}
