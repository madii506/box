import { $, $$, esc, usd, num, pct, pctCls, api, toast, copy, addr, ensureWallet, signWith, sendSigned, waitFor, solscan, cancelled, chrome, short, img, ago } from './core.js';
import { fx, watch, roll, reduced } from './fx.js';
import { drawChip, fmtT } from './chipmap.js';
import { graveCard } from './ui.js';

const cfg = await chrome('home');
fx();
const LIVE = cfg.launches === 'open';
let CHIPS = null, TOKEN = null, COINS = null;

/* ---------- hero 3D (falls back to the flat mark) ---------- */
(async () => {
  try { const { hero3d } = await import('./hero3d.js'); if (!hero3d($('#stage'), { reduced })) throw new Error('no webgl'); }
  catch (e) { $('#stageFb').hidden = false; }
})();

/* ---------- $BOX contract pill ---------- */
(() => {
  const pill = $('#caPill'); if (!pill || !cfg.ca) return;
  const ca = cfg.ca;
  $('#cpFull').textContent = ca; $('#cpShort').textContent = ca.slice(0, 6) + '…' + ca.slice(-6);
  $('#cpPump').href = 'https://pump.fun/coin/' + ca; $('#cpChart').href = 'https://dexscreener.com/solana/' + ca;
  let tm = 0;
  $('#cpCa').onclick = () => { copy(ca, 'Contract address copied'); pill.classList.add('ok'); $('#cpCopy').textContent = 'Copied'; clearTimeout(tm); tm = setTimeout(() => { pill.classList.remove('ok'); $('#cpCopy').textContent = 'Copy'; }, 1800); };
  pill.hidden = false;
})();
$('#lvFee').textContent = cfg.fees ? (cfg.fees.creator / 100).toFixed(2) + '%' : '0.30%';

/* ---------- the chips ---------- */
const med = a => { const v = a.filter(x => x > 0).sort((x, y) => x - y); return v.length ? v[Math.floor(v.length / 2)] : null; };
function renderChips() {
  const d = CHIPS; if (!d) return;
  roll($('#lvQ'), String(d.total || 312)); $('#lvQ2').textContent = `on ${d.chips.length} IBM chips`;
  roll($('#lvC'), String(d.claimed || 0));
  const box = $('#chipGrid');
  if (!box.dataset.built) {
    box.innerHTML = d.chips.map(c => `<div class="card chipcard" data-chip="${esc(c.short)}"><div class="chiphead"><b>${esc(c.name)}</b><span class="mu mono" style="font-size:12px">${esc(c.processor)} · ${c.n} qubits</span><span class="tag" data-st></span></div><div class="chipwrap" data-map></div><div class="chipstats" data-stats></div></div>`).join('');
    box.dataset.built = '1'; watch(box);
  }
  for (const c of d.chips) {
    const card = box.querySelector(`[data-chip="${c.short}"]`); if (!card) continue;
    drawChip(card.querySelector('[data-map]'), c, d.claims, { onPick: (q, own) => { location.href = own ? '/chips?c=' + c.short + '&q=' + q : '/launch?chip=' + c.short + '&q=' + q; } });
    const claimed = Object.keys(d.claims).filter(k => k.startsWith(c.short + ':')).length;
    const st = c.status;
    const tag = card.querySelector('[data-st]');
    tag.className = 'tag ' + (st ? (/online|active|available/i.test(st.status) ? 'ok' : 'warn') : '');
    tag.textContent = st ? `● ${String(st.status || 'online').toLowerCase()}` : d.ibm ? '● checking' : '● layout';
    card.querySelector('[data-stats]').innerHTML = `<div><small>Claimed</small><b>${claimed}</b></div><div><small>Free</small><b>${c.n - claimed}</b></div><div><small>Median T1</small><b>${fmtT(med(c.qubits.map(q => q.t1)))}</b></div><div><small>Queue</small><b>${st && st.queue != null ? st.queue : '—'}</b></div>`;
  }
  $('#chipNote').textContent = d.ibm ? `Live from IBM Quantum · calibration ${d.chips[0] && d.chips[0].calibrated ? ago(Date.parse(d.chips[0].calibrated)) + ' ago' : 'loading'}` : 'Chip layout shown · live calibration appears once IBM Quantum is connected';
}
const loadChips = async () => { try { CHIPS = await api('chips'); renderChips(); } catch (e) { $('#chipGrid').innerHTML = `<div class="empty sm"><b>Could not load the chips.</b><span>${esc(e.message)}</span></div>`; } };
loadChips(); setInterval(() => { if (!document.hidden) loadChips(); }, 60000);

/* ---------- live box openings from IBM ---------- */
async function loadOps() {
  const feed = $('#opFeed');
  try {
    const d = await api('openings');
    if (!d.ibm) { $('#opState').textContent = 'offline'; feed.innerHTML = '<div class="empty sm"><b>The quantum feed opens with the first box.</b><span>Every opening will appear here live: chip, qubit, and the bit IBM measured.</span></div>'; $('#lvO').textContent = '0'; return; }
    $('#opState').innerHTML = '<span class="up">● live</span>';
    $('#lvO').textContent = String(d.list.filter(x => x.bit != null).length);
    feed.innerHTML = d.list.length ? d.list.map(o => {
      const done = o.bit != null, run = /queued|running/i.test(o.status);
      return `<div class="op"><span class="bit ${done ? 'b' + o.bit : run ? 'run' : ''}">${done ? o.bit : run ? '…' : '×'}</span><div><b>${done ? `Version ${o.winner} was born` : run ? (/running/i.test(o.status) ? 'Measuring…' : 'In the queue at IBM') : esc(o.status)}</b><span>${esc(o.backend)} · Q${o.qubit ?? '—'} · ${esc(o.user || '')}</span></div><time>${o.created ? ago(Date.parse(o.created)) : ''}</time></div>`;
    }).join('') : '<div class="empty sm"><b>No boxes opened yet.</b><span>Be the first: the measurement shows up here the moment IBM returns it.</span></div>';
  } catch (e) { $('#opState').textContent = 'offline'; }
}
loadOps(); setInterval(() => { if (!document.hidden) loadOps(); }, 15000);

/* ---------- the graveyard preview ---------- */
api('graveyard').then(d => {
  const box = $('#gravePrev');
  const list = (d.list || []).slice(0, 4);
  box.innerHTML = list.length ? list.map(graveCard).join('') : Array.from({ length: 4 }, (_, i) => `<div class="card grave"><div class="gp"></div><span class="rip">R.I.P.</span><b><s>$????</s></b><span class="meta">the ${['first', 'second', 'third', 'fourth'][i]} coin that never existed</span></div>`).join('');
  watch(box);
}).catch(() => { });
/* ---------- $BOX ---------- */
function renderToken() {
  const a = TOKEN || { live: false }, CA = a.ca || cfg.ca;
  $('#tokMain').innerHTML = `
    <span class="kick">Contract</span>
    <div class="ca-big" id="tokCa">${CA ? esc(CA) + '<i>COPY</i>' : '<span class="mu scan">Contract address</span>'}</div>
    <div class="stat-row">
      <div class="stat"><small>Price</small><b>${a.live ? usd(a.priceUsd) : '—'}</b></div>
      <div class="stat"><small>Market cap</small><b>${a.live ? usd(a.mcapUsd) : '—'}</b></div>
      <div class="stat"><small>24h</small><b class="${pctCls(a.chg24)}">${a.live ? pct(a.chg24) : '—'}</b></div>
    </div>
    <div class="grid" style="gap:10px">
      <b style="font-size:18px">${!a.live ? (CA ? 'Going live on pump.fun' : 'Pre-launch') : a.venue === 'pumpswap' ? 'Trading on PumpSwap' : 'On its pump.fun curve'}</b>
      <span class="mu" style="font-size:14px">${!a.live ? 'Coins can be born the moment $BOX is live. Until then you can explore the chips and pick your qubit.' : a.pairable ? 'Accepting new coins: every coin born now is priced in $BOX.' : esc(a.why || 'Not accepting new coins right now.')}</span>
      <div class="badges">${a.live ? `<span class="tag ${a.pairable ? 'ok' : 'bad'}">${a.pairable ? '● the box is open' : '● paused'}</span>` : ''}${CA ? `<a class="tag" href="https://pump.fun/coin/${esc(CA)}" target="_blank" rel="noopener">pump.fun ↗</a><a class="tag" href="https://dexscreener.com/solana/${esc(CA)}" target="_blank" rel="noopener">Dexscreener ↗</a>` : ''}${cfg.x ? `<a class="tag" href="${esc(cfg.x)}" target="_blank" rel="noopener">X ↗</a>` : ''}</div>
    </div>`;
  const el = $('#tokCa'); if (CA && el) el.onclick = () => copy(CA, 'Contract address copied');
}
function tokBuy() {
  const box = $('#tokBuy');
  box.innerHTML = `
    <span class="kick">Buy $BOX</span>
    <div class="inrow"><input id="abAmt" inputmode="decimal" value="0.5" aria-label="SOL amount"><span class="unit">SOL</span></div>
    <div class="quick">${[0.1, 0.5, 1, 5].map(v => `<button data-v="${v}">${v} SOL</button>`).join('')}</div>
    <div class="sum"><div><span>You get about</span><b id="abOut">—</b></div><div><span>Route</span><b>SOL → $BOX</b></div><div><span>Slippage</span><b>5%</b></div></div>
    <button class="btn gold lg block" id="abGo" ${cfg.ca ? '' : 'disabled'}>${cfg.ca ? 'Buy $BOX' : 'Opens at launch'}</button>
    <p class="mu" style="font-size:12.5px;margin:0">Straight through pump.fun's program. Simulated before you sign.</p>`;
  const inp = $('#abAmt'); let tm = 0, seq = 0;
  const quote = async () => {
    const v = parseFloat(inp.value); const my = ++seq;
    if (!cfg.ca || !(v > 0)) { $('#abOut').textContent = '—'; return; }
    $('#abOut').innerHTML = '<span class="skel">000000</span>';
    try { const q = await api('quote', { kind: 'trade', mint: cfg.ca, side: 'buy', via: 'SOL', amount: v, user: addr() }); if (my === seq) $('#abOut').textContent = num(q.out) + ' $BOX'; }
    catch (e) { if (my === seq) $('#abOut').textContent = '—'; }
  };
  inp.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(quote, 450); });
  $$('.quick button', box).forEach(b => b.onclick = () => { inp.value = b.dataset.v; quote(); });
  quote();
  $('#abGo').onclick = async () => {
    const v = parseFloat(inp.value); if (!(v > 0)) return toast('Enter an amount', 'bad');
    const btn = $('#abGo'); btn.disabled = true; const t0 = btn.textContent;
    try {
      await ensureWallet(); btn.textContent = 'Building…';
      const b = await api('trade', { user: addr(), mint: cfg.ca, side: 'buy', via: 'SOL', amount: v, slippage: 5 });
      btn.textContent = 'Sign in your wallet…';
      const sig = await sendSigned(await signWith(b.tx)); btn.textContent = 'Confirming…';
      await waitFor(sig); toast('Bought $BOX', 'ok');
      btn.outerHTML = `<a class="btn lg block" href="${solscan(sig)}" target="_blank" rel="noopener">View on Solscan ↗</a>`;
    } catch (e) { if (!cancelled(e)) toast(e.message, 'bad'); btn.disabled = false; btn.textContent = t0; }
  };
}
renderToken(); tokBuy();
if (cfg.ca) api('token').then(d => { TOKEN = d; renderToken(); }).catch(() => { });

/* ---------- numbers ---------- */
function renderNums() {
  const f = cfg.fees || {};
  const tiles = [
    ['Real qubits', String(CHIPS ? CHIPS.total : 312), '', 'on two IBM Heron r2 chips', true],
    ['Coins per qubit', '1', '', 'the first coin on a qubit holds it', false],
    ['Shots per box', '1', '', 'one measurement decides', true],
    ['Versions', '2', '', 'go in. One comes out.', false],
    ['Creator fees to holders', '100', '%', 'pump.fun Holder Rewards, on every coin', true],
    ['Creator fee', f.creator != null ? (f.creator / 100).toFixed(2) : '0.30', '%', 'of every trade, paid to holders', false],
    ['Dev buy cap', String(cfg.devMaxSol || 1), 'SOL', 'bought through $BOX', false],
    ['Re-rolls', '0', '', 'one opening per wallet per qubit per day', true],
  ];
  $('#nums').innerHTML = tiles.map(([k, v, u, t, g]) => `<div class="card num${g ? ' g' : ''}"><small>${k}</small><b><span data-roll="${v}">${v}</span><i>${u}</i></b><span>${t}</span></div>`).join('');
  $('#nums').addEventListener('shown', () => $$('#nums [data-roll]').forEach(el => roll(el, el.dataset.roll, 1100)), { once: true });
  watch();
}
renderNums();
api('coins').then(d => { COINS = d; }).catch(() => { });
