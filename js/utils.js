'use strict';
// ── DOM ───────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const $q = s => document.querySelector(s);
const $all = s => [...document.querySelectorAll(s)];

// ── FORMAT ────────────────────────────────────────────────────
function fp(n){
  if(n==null||isNaN(n))return'—';
  if(n>=10000)return'$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  if(n>=1)return'$'+n.toFixed(2);
  return'$'+n.toFixed(5);
}
function fpct(n,plus=true){
  if(n==null||isNaN(n))return'—';
  return(plus&&n>=0?'+':'')+n.toFixed(2)+'%';
}
function fchg(n){
  if(n==null||isNaN(n))return'—';
  return(n>=0?'+':'')+n.toFixed(2);
}
function fmtBig(n){
  if(!n)return'—';
  if(n>=1e12)return'$'+(n/1e12).toFixed(2)+'T';
  if(n>=1e9)return'$'+(n/1e9).toFixed(2)+'B';
  if(n>=1e6)return'$'+(n/1e6).toFixed(2)+'M';
  return'$'+n.toLocaleString();
}
function fvol(n){
  if(!n)return'—';
  if(n>=1e9)return(n/1e9).toFixed(2)+'B';
  if(n>=1e6)return(n/1e6).toFixed(2)+'M';
  if(n>=1e3)return(n/1e3).toFixed(1)+'K';
  return String(n);
}
function fdate(ts){
  if(!ts)return'—';
  return new Date(ts*1000).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}
function fdatestr(s){
  if(!s)return'—';
  return new Date(s+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
}
function clsc(n){return n>=0?'up':'dn'}
function arrow(n){return n>=0?'▲':'▼'}

// ── TOAST ─────────────────────────────────────────────────────
let _tt;
function toast(msg,accent=false){
  const el=$('toast');if(!el)return;
  el.textContent=msg;el.className='show'+(accent?' accent':'');
  clearTimeout(_tt);_tt=setTimeout(()=>el.className='',3000);
}

// ── LOCAL STORAGE ─────────────────────────────────────────────
const LS={
  get:(k,d=null)=>{try{const v=localStorage.getItem(k);return v!=null?JSON.parse(v):d}catch{return d}},
  set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}},
};

// ── CHART ─────────────────────────────────────────────────────
// THE FIX: always use setTimeout before creating Chart.js charts.
// Chart.js reads canvas dimensions synchronously. If the canvas is
// inside a display:none container (hidden page), dimensions are 0x0.
// setTimeout(0) yields to the browser so the page becomes visible
// before Chart.js measures the canvas.

function mkChart(canvasId, type, data, opts) {
  return new Promise(resolve => {
    setTimeout(() => {
      const cv = $(canvasId);
      if (!cv) { resolve(null); return; }
      // Destroy previous chart on this canvas
      const existing = Chart.getChart(cv);
      if (existing) existing.destroy();
      resolve(new Chart(cv.getContext('2d'), { type, data, options: opts }));
    }, 0);
  });
}

function chartOpts(yFmt) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode:'index', intersect:false },
    plugins: {
      legend: { display:false },
      tooltip: {
        backgroundColor:'#090C18',
        borderColor:'#162040',
        borderWidth:1,
        titleColor:'#2E3D5C',
        bodyColor:'#C8D4E8',
        padding:10,
        displayColors:false,
        callbacks: { label: ctx => ' ' + (yFmt ? yFmt(ctx.parsed.y) : ctx.parsed.y) }
      }
    },
    scales: {
      x: {
        grid: { color:'rgba(22,32,64,.4)', drawBorder:false },
        ticks: { color:'#2E3D5C', font:{family:'DM Mono',size:8}, maxTicksLimit:7 }
      },
      y: {
        position:'right',
        grid: { color:'rgba(22,32,64,.4)', drawBorder:false },
        ticks: { color:'#2E3D5C', font:{family:'DM Mono',size:8}, callback: yFmt || (v=>'$'+v.toFixed(0)) }
      }
    }
  };
}

function lineDs(prices, color) {
  return {
    data: prices,
    borderColor: color,
    borderWidth: 1.5,
    pointRadius: 0,
    fill: true,
    tension: 0.3,
    backgroundColor: ctx => {
      const g = ctx.chart.ctx.createLinearGradient(0,0,0,260);
      g.addColorStop(0, color+'22');
      g.addColorStop(1, color+'00');
      return g;
    }
  };
}

function priceColor(candles) {
  if (!candles || candles.length < 2) return '#00D4FF';
  return candles[candles.length-1].close >= candles[0].close ? '#10B981' : '#EF4444';
}
