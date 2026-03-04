'use strict';
// Live quote cache
const LQ = {};

async function apiFetch(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('HTTP '+r.status);
  return r.json();
}

async function fetchMovers() {
  try {
    const d = await apiFetch('/api/movers');
    if (Array.isArray(d)) d.forEach(q => { LQ[q.symbol] = q; });
    return d || [];
  } catch(e) { console.warn('movers:',e.message); return []; }
}

async function fetchQuote(sym) {
  try {
    const d = await apiFetch('/api/quote?symbol='+encodeURIComponent(sym));
    if (d.price) LQ[sym] = d;
    return d;
  } catch(e) { console.warn('quote:',e.message); return null; }
}

async function fetchCandles(sym, days=90, res='D') {
  try {
    const d = await apiFetch(`/api/candles?symbol=${encodeURIComponent(sym)}&days=${days}&resolution=${res}`);
    return d.candles || [];
  } catch(e) { console.warn('candles:',e.message); return []; }
}

async function fetchTechnicals(sym, days=90) {
  try {
    return await apiFetch(`/api/technicals?symbol=${encodeURIComponent(sym)}&days=${days}`);
  } catch(e) { console.warn('technicals:',e.message); return null; }
}

async function fetchAllNews(sym='') {
  try {
    const url = sym ? `/api/news-all?symbol=${encodeURIComponent(sym)}` : '/api/news-all';
    return await apiFetch(url);
  } catch(e) { console.warn('news:',e.message); return {articles:[],sources:[]}; }
}

async function fetchSentiment() {
  try { return await apiFetch('/api/sentiment'); }
  catch(e) { return null; }
}

async function fetchEarnings() {
  try { return await apiFetch('/api/earnings'); }
  catch(e) { return null; }
}

async function fetchMacro() {
  try { return await apiFetch('/api/macro'); }
  catch(e) { return null; }
}

async function fetchAnalyst(sym) {
  try { return await apiFetch('/api/analyst?symbol='+encodeURIComponent(sym)); }
  catch(e) { return null; }
}

async function fetchInsider(sym) {
  try { return await apiFetch('/api/insider?symbol='+encodeURIComponent(sym)); }
  catch(e) { return null; }
}

async function fetchIPO() {
  try { return await apiFetch('/api/ipo'); }
  catch(e) { return null; }
}

async function fetchForex() {
  try { return await apiFetch('/api/forex'); }
  catch(e) { return null; }
}

async function fetchCrypto() {
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana,dogecoin,cardano,avalanche-2,chainlink,polkadot&order=market_cap_desc&per_page=8&page=1&sparkline=false&price_change_percentage=24h,7d');
    if (!r.ok) throw new Error('CoinGecko '+r.status);
    return await r.json();
  } catch(e) { console.warn('crypto:',e.message); return []; }
}
