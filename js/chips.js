import { $, $$, esc, api, chrome, img, ago } from './core.js';
import { fx, watch } from './fx.js';
import { drawChip, fmtT, fmtE } from './chipmap.js';

const cfg = await chrome('chips');
fx();
const qs = new URLSearchParams(location.search);
const S = { d: null, chip: qs.get('c'), q: qs.get('q') != null ? +qs.get('q') : null, f: 'all' };
let mapApi = null;
const med = a => { const v = a.filter(x => x > 0).sort((x, y) => x - y); return v.length ? v[Math.floor(v.length / 2)] : null; };
function chipNow() { return S.d && S.d.chips.find(c => c.short === S.chip); }
function render() {
  const c = chipNow(); if (!c) return;
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.c === S.chip));
  mapApi = drawChip($('#bigMap'), c, S.d.claims, { selected: S.q, onPick: q => { S.q = q; mapApi.select(q); panel(); history.replaceState(null, '', `/chips?c=${c.short}&q=${q}`); } });
  filter();
  const claimed = Object.keys(S.d.claims).filter(k => k.startsWith(c.short + ':')).length;
  const st = c.status;
  $('#chipStats').innerHTML = [
    ['Qubits', c.n, c.processor], ['Claimed', claimed, 'one coin each'], ['Free', c.n - claimed, 'waiting for a coin'],
    ['Median T1', fmtT(med(c.qubits.map(q => q.t1))), 'how long a qubit holds its state'],
  ].map(([k, v, t]) => `<div class="card num"><small>${k}</small><b>${esc(String(v))}</b><span>${esc(t)}</span></div>`).join('');
  $('#calib').textContent = c.source === 'ibm' ? `${st ? String(st.status || 'online').toLowerCase() + ' · ' : ''}${st && st.queue != null ? st.queue + ' jobs queued · ' : ''}calibrated ${c.calibrated ? ago(Date.parse(c.calibrated)) + ' ago' : '—'}` : 'Chip layout · live calibration appears once IBM Quantum is connected';
  watch();
  panel();
}
function filter() {
  const c = chipNow(); if (!c) return;
  $$('#bigMap .q').forEach(g => {
    const own = g.classList.contains('own');
    g.classList.toggle('dim', (S.f === 'free' && own) || (S.f === 'own' && !own));
  });
}
function panel() {
  const c = chipNow(), el = $('#qPanel');
  if (!c || S.q == null || !c.qubits[S.q]) { el.innerHTML = '<span class="kick">Qubit</span><b style="font-size:20px">Tap a qubit.</b><span class="mu" style="font-size:14px">Each dot is one physical qubit on the chip. Coin pictures mark claimed qubits; free ones glow brighter the longer they hold a quantum state.</span>'; return; }
  const qb = c.qubits[S.q], own = S.d.claims[c.short + ':' + S.q];
  el.innerHTML = `<span class="kick">${esc(c.name)}</span><div class="qbig">Q${S.q}</div>
    ${own ? `<a class="surv-big" href="/coin?m=${esc(own.mint)}" style="display:flex;gap:12px;align-items:center;padding:10px;border:1px solid var(--line2);border-radius:14px">${own.image ? `<img src="${esc(img(own.image))}" alt="" style="width:46px;height:46px;border-radius:50%;object-fit:cover">` : ''}<div><b style="display:block;font-size:17px">$${esc(own.symbol)}</b><span class="mu" style="font-size:13px">${esc(own.name)} holds this qubit</span></div></a>` : '<span class="tag ok" style="width:max-content">● free</span>'}
    <div class="qrow"><span>T1 (relaxation)</span><b>${fmtT(qb.t1)}</b></div>
    <div class="qrow"><span>T2 (dephasing)</span><b>${fmtT(qb.t2)}</b></div>
    <div class="qrow"><span>Readout error</span><b>${fmtE(qb.ro)}</b></div>
    <div class="qrow"><span>Single-qubit gate error</span><b>${fmtE(qb.sx)}</b></div>
    <div class="qrow"><span>Frequency</span><b>${qb.freq != null ? qb.freq.toFixed(3) + ' GHz' : '—'}</b></div>
    ${own ? `<a class="btn block" href="/coin?m=${esc(own.mint)}">Open $${esc(own.symbol)} <span class="arr">→</span></a>` : `<a class="btn gold block" href="/launch?chip=${esc(c.short)}&q=${S.q}">Claim Q${S.q} <span class="arr">→</span></a>`}`;
}
$$('#filt button').forEach(b => b.onclick = () => { S.f = b.dataset.f; $$('#filt button').forEach(x => x.classList.toggle('on', x === b)); filter(); });
async function load() {
  try {
    S.d = await api('chips');
    if (!S.chip || !S.d.chips.some(c => c.short === S.chip)) S.chip = S.d.chips[0] && S.d.chips[0].short;
    $('#tabs').innerHTML = S.d.chips.map(c => `<button data-c="${esc(c.short)}">${esc(c.name)}</button>`).join('');
    $$('#tabs button').forEach(b => b.onclick = () => { S.chip = b.dataset.c; S.q = null; render(); });
    render();
  } catch (e) { $('#bigMap').innerHTML = `<div class="empty sm"><b>Could not load the chips.</b><span>${esc(e.message)}</span></div>`; }
}
load();
