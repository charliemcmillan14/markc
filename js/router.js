'use strict';
const PAGES = [
  'home','markets','quote','news','crypto','cats',
  'screener','insider','analyst','ipo','forex',
  'heatmap','macro','sector',
  'sentiment','earnings','watchlist','portfolio','simulator'
];
const _inited = {};

function go(name) {
  if (!PAGES.includes(name)) return;
  PAGES.forEach(p => {
    const el = $('page-'+p);
    if (el) el.classList.toggle('active', p===name);
  });
  $all('.nb').forEach(b => b.classList.toggle('active', b.dataset.page===name));
  window.scrollTo(0,0);
  window.location.hash = name;
  if (!_inited[name]) { _inited[name]=true; _init(name); }
  else if (name==='home') renderHomeTiles();
  else if (name==='watchlist') { renderWatchlist(); renderAlerts(); }
}

async function _init(name) {
  switch(name) {
    case 'home':       await initHome();      break;
    case 'markets':    await initMarkets();   break;
    case 'quote':      initQuotePage();       break;
    case 'news':       await initNews();      break;
    case 'crypto':     await initCrypto();    break;
    case 'cats':       initCats();            break;
    case 'screener':   await initScreener();  break;
    case 'insider':    await initInsider();   break;
    case 'analyst':    await initAnalyst();   break;
    case 'ipo':        await initIPO();       break;
    case 'forex':      await initForex();     break;
    case 'heatmap':    await initHeatmap();   break;
    case 'macro':      await initMacro();     break;
    case 'sector':     await initSector();    break;
    case 'sentiment':  await initSentiment(); break;
    case 'earnings':   await initEarnings();  break;
    case 'watchlist':  initWatchlist();       break;
    case 'portfolio':  initPortfolio();       break;
    case 'simulator':  initSimulator();       break;
  }
}

async function goQuote(symbol) {
  go('quote');
  const inp = $('quoteInput');
  if (inp) inp.value = symbol;
  await renderQuote(symbol);
}

async function goSector(key) {
  _currentSector = key;
  _inited['sector'] = false;
  go('sector');
}

function handleHash() {
  const h = window.location.hash.replace('#','');
  go(PAGES.includes(h) ? h : 'home');
}

document.addEventListener('keydown', e => {
  if (e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
  const m = {'1':'home','2':'markets','3':'quote','4':'news','5':'crypto','6':'cats','7':'screener','8':'heatmap','9':'sentiment','0':'earnings'};
  if (m[e.key]) go(m[e.key]);
  if (e.key==='f') go('forex');
  if (e.key==='i') go('insider');
  if (e.key==='p') go('portfolio');
  if (e.key==='w') go('watchlist');
});
