import { $, $$, esc, num, api, toast, W, addr, ensureWallet, signWith, sendSigned, waitFor, solscan, cancelled, chrome, short, img, sleep } from './core.js';
import { fx } from './fx.js';
import { drawChip, fmtT, fmtE } from './chipmap.js';

const cfg = await chrome('launch');
fx();
const LIVE = cfg.launches === 'open';
const CAP = cfg.devMaxSol || 1;
const qs = new URLSearchParams(location.search);
const S = { v: { A: {}, B: {} }, chips: null, chip: qs.get('chip') || null, q: qs.get('q') != null ? +qs.get('q') : null, dev: 0, mintSecret: null, mintAddr: null, checks: null, job: null, box: null, busy: false, done: null };
const cleanSym = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
const LS = { get: k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };
$('#capLbl').textContent = `optional · max ${CAP.toFixed(1)} SOL`;
if (!LIVE) { $('#lpKick').textContent = cfg.launches === 'prelaunch' ? 'Pre-launch' : 'Paused'; }

/* ---------- the two versions ---------- */
const readURL = f => new Promise((r, j) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.onerror = j; fr.readAsDataURL(f); });
const loadImg = src => new Promise((r, j) => { const im = new Image(); const t = setTimeout(() => j(new Error('timeout')), 9000); im.onload = () => { clearTimeout(t); r(im); }; im.onerror = () => { clearTimeout(t); j(new Error('load')); }; im.src = src; });
function dhash(im) {
  const c = document.createElement('canvas'); c.width = 9; c.height = 8;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, 9, 8);
  const d = x.getImageData(0, 0, 9, 8).data; let bits = '';
  for (let y = 0; y < 8; y++) for (let i = 0; i < 8; i++) { const a = (y * 9 + i) * 4, b = a + 4; bits += (d[a] * .299 + d[a + 1] * .587 + d[a + 2] * .114) > (d[b] * .299 + d[b + 1] * .587 + d[b + 2] * .114) ? '1' : '0'; }
  return bits;
}
async function onFile(k, f) {
  if (!f) return;
  if (!/^image\/(png|jpe?g|gif|webp)$/.test(f.type)) return toast('Use PNG, JPG, GIF or WEBP', 'bad');
  let url = await readURL(f), im = await loadImg(url), type = f.type, bytes = f.size;
  if (bytes > 4e6 || Math.max(im.naturalWidth, im.naturalHeight) > 2400) {
    const c = document.createElement('canvas'), s = 1024 / Math.max(im.naturalWidth, im.naturalHeight);
    c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    url = c.toDataURL('image/jpeg', 0.9); type = 'image/jpeg'; bytes = Math.round((url.length - 23) * 0.75); im = await loadImg(url);
    toast('Large picture: resized to 1024 px', 'ok');
  }
  S.v[k].img = { url, type, bytes, w: im.naturalWidth, h: im.naturalHeight, hash: dhash(im) };
  S.v[k].uri = null;
  $('#pv' + k).style.backgroundImage = `url("${url}")`; $('#pv' + k).textContent = '';
  duel(); schedule();
}
for (const k of ['A', 'B']) {
  $('#file' + k).addEventListener('change', e => onFile(k, e.target.files[0]));
  const drop = $('#drop' + k);
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => onFile(k, e.dataTransfer.files[0]));
  $('#n' + k).addEventListener('input', () => { S.v[k].uri = null; duel(); schedule(); });
  $('#s' + k).addEventListener('input', () => { S.v[k].uri = null; duel(); schedule(); });
  $('#s' + k).addEventListener('blur', e => { e.target.value = cleanSym(e.target.value); duel(); });
}
const V = k => ({ name: $('#n' + k).value.trim(), symbol: cleanSym($('#s' + k).value) });
const shared = () => ({ description: $('#fDesc').value.trim(), twitter: $('#fX').value.trim(), telegram: $('#fTg').value.trim(), website: $('#fWeb').value.trim() });
['fDesc', 'fX', 'fTg', 'fWeb'].forEach(id => $('#' + id).addEventListener('input', () => { S.v.A.uri = S.v.B.uri = null; schedule(); }));
function duel() {
  for (const k of ['A', 'B']) {
    const v = V(k);
    $('#ds' + k).textContent = '$' + (v.symbol || (k === 'A' ? 'ALIVE' : 'DEAD'));
    $('#dp' + k).style.backgroundImage = S.v[k].img ? `url("${S.v[k].img.url}")` : '';
  }
  $('#dQ').textContent = S.q != null && S.chip ? `${S.chip} · Q${S.q}` : 'Q—';
}

/* ---------- dev buy ---------- */
$('#fDev').addEventListener('input', e => { S.dev = Math.max(0, parseFloat(e.target.value) || 0); if (S.dev > CAP) toast(`Dev buy cap is ${CAP} SOL`, 'bad'); schedule(); });
$$('#devQuick button').forEach(b => b.addEventListener('click', () => { $('#fDev').value = b.dataset.v; S.dev = +b.dataset.v; schedule(); }));

/* ---------- claim a qubit ---------- */
let mapApi = null;
function chipNow() { return S.chips && S.chips.chips.find(c => c.short === S.chip); }
function drawPick() {
  const c = chipNow(); if (!c) return;
  $$('#chipTabs button').forEach(b => b.classList.toggle('on', b.dataset.c === S.chip));
  mapApi = drawChip($('#pickMap'), c, S.chips.claims, { selected: S.q, onPick: (q, own) => {
    if (own) { const o = S.chips.claims[c.short + ':' + q]; toast(`Q${q} already belongs to $${o.symbol}`, 'bad'); return; }
    S.q = q; mapApi.select(q); qInfo(); duel(); resetBox(); schedule();
  } });
  qInfo();
}
function qInfo() {
  const c = chipNow(), el = $('#qInfo');
  if (!c || S.q == null) { el.innerHTML = '<span class="mu">Tap a free qubit on the chip. Brighter qubits hold a quantum state longer.</span>'; $('#qSub').textContent = 'pick a free one'; return; }
  const qb = c.qubits[S.q] || {};
  $('#qSub').textContent = `${c.name} · Q${S.q}`;
  el.innerHTML = `<span class="qn">Q${S.q}</span><span class="mu">${esc(c.name)}</span><dl><div><dt>T1</dt><dd>${fmtT(qb.t1)}</dd></div><div><dt>T2</dt><dd>${fmtT(qb.t2)}</dd></div><div><dt>Readout error</dt><dd>${fmtE(qb.ro)}</dd></div></dl>`;
}
api('chips').then(d => {
  S.chips = d;
  if (!S.chip || !d.chips.some(c => c.short === S.chip)) S.chip = d.chips[0] ? d.chips[0].short : null;
  if (S.q != null && d.claims[S.chip + ':' + S.q]) S.q = null;
  $('#chipTabs').innerHTML = d.chips.map(c => `<button type="button" data-c="${esc(c.short)}">${esc(c.name)}</button>`).join('');
  $$('#chipTabs button').forEach(b => b.onclick = () => { S.chip = b.dataset.c; S.q = null; resetBox(); drawPick(); duel(); schedule(); });
  drawPick(); duel(); schedule();
}).catch(e => { $('#pickMap').innerHTML = `<div class="empty sm"><b>Could not load the chips.</b><span>${esc(e.message)}</span></div>`; });

/* ---------- vanity address ---------- */
let workers = [];
function stopVanity() { workers.forEach(w => w.terminate()); workers = []; }
function startVanity() {
  stopVanity(); S.mintSecret = null; S.mintAddr = null;
  if (!window.Worker) { $('#vanityState').textContent = 'Not available in this browser. A random address will be used.'; return; }
  const n = Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 4) - 1));
  let tried = 0; const t0 = performance.now();
  for (let i = 0; i < n; i++) {
    const w = new Worker('/js/vanity.js?v=2');
    w.onmessage = e => {
      const d = e.data;
      if (d.error) { stopVanity(); $('#vanityState').textContent = 'Not available in this browser. A random address will be used.'; return; }
      tried += d.n || 0;
      if (d.found) { stopVanity(); S.mintSecret = Uint8Array.from(d.found); S.mintAddr = d.addr; $('#vanityState').innerHTML = `Found: <span style="color:var(--ink)">${esc(d.addr.slice(0, 6))}…${esc(d.addr.slice(-10, -3))}<b class="gold">box</b></span> after ${num(tried)} tries`; return; }
      $('#vanityState').textContent = `Searching… ${num(tried)} tried · ${num(tried / ((performance.now() - t0) / 1000))}/s`;
    };
    w.onerror = () => { stopVanity(); $('#vanityState').textContent = 'Not available in this browser. A random address will be used.'; };
    w.postMessage({ suffix: 'box' });
    workers.push(w);
  }
}
$('#vanity').addEventListener('change', e => { if (e.target.checked) startVanity(); else { stopVanity(); S.mintSecret = null; S.mintAddr = null; $('#vanityState').textContent = 'A random address will be used.'; } });
setTimeout(() => { if ($('#vanity').checked) startVanity(); }, 800);

/* ---------- checks ---------- */
const ICON = { pass: '✓', warn: '!', fail: '✕', wait: '·', run: '' };
let cTm = 0, cSeq = 0;
function schedule() { clearTimeout(cTm); $$('#checks .ck').forEach(li => { li.className = 'ck run'; }); cTm = setTimeout(runChecks, 600); }
const imgInfo = k => S.v[k].img ? { type: S.v[k].img.type, bytes: S.v[k].img.bytes, w: S.v[k].img.w, h: S.v[k].img.h, hash: S.v[k].img.hash } : null;
async function runChecks() {
  const my = ++cSeq;
  const body = { a: { ...V('A'), image: imgInfo('A') }, b: { ...V('B'), image: imgInfo('B') }, backend: S.chip, qubit: S.q, ...shared(), devSol: S.dev, user: addr() };
  try {
    const r = await api('check', body); if (my !== cSeq) return;
    S.checks = r;
    $('#checks').innerHTML = r.checks.map((c, i) => `<li class="ck ${c.status}" style="animation:rise .45s var(--ease) ${i * 30}ms both"><span class="ic">${ICON[c.status] || ''}</span><div><b>${esc(c.label)}</b><span>${esc(c.note)}</span></div></li>`).join('');
  } catch (e) { if (my === cSeq) $('#checks').innerHTML = `<li class="ck fail"><span class="ic">!</span><div><b>Could not check</b><span>${esc(e.message)}</span></div></li>`; }
  paint();
}
W.change.add(() => { schedule(); paint(); });

/* ---------- the box ---------- */
function resetBox() { if (S.box && S.box.bit != null) return; S.job = null; S.box = null; $('#jobLine').hidden = true; $('#boxPanel').classList.remove('running'); paint(); }
function paint() {
  const ob = $('#openBtn'), lb = $('#launchBtn');
  const st = $('#boxState');
  if (S.done) { ob.hidden = true; lb.hidden = false; lb.disabled = false; lb.textContent = 'Open your coin →'; st.textContent = 'born'; return; }
  if (S.box && S.box.bit != null) {
    ob.hidden = true; lb.hidden = false; st.textContent = `read ${S.box.bit} · version ${S.box.winner}`;
    const win = V(S.box.winner);
    lb.disabled = S.busy || !LIVE; lb.className = 'btn gold lg block';
    lb.textContent = !LIVE ? (cfg.launches === 'prelaunch' ? 'Launches open when $BOX is live' : 'Launches are paused') : S.busy ? 'Working…' : `Launch $${win.symbol || '?'}`;
    return;
  }
  ob.hidden = false; lb.hidden = true;
  if (S.busy) { ob.disabled = true; return; }
  if (!cfg.ibm) { ob.disabled = true; ob.textContent = 'The quantum computer connects soon'; st.textContent = 'offline'; return; }
  if (!W.acct) { ob.disabled = false; ob.textContent = 'Connect wallet to open'; st.textContent = 'closed'; return; }
  const c = S.checks, blockers = c ? c.checks.filter(x => x.status === 'fail' || (x.status === 'wait' && !['pair', 'wallet'].includes(x.id))) : [];
  ob.disabled = !c || blockers.length > 0;
  ob.textContent = !c ? 'Checking…' : blockers.length ? (blockers[0].id === 'qubit' ? 'Pick a qubit first' : `Fix: ${blockers[0].label}`) : 'Open the box';
  st.textContent = 'closed';
}
const logBox = $('#log');
function log(text) { logBox.hidden = false; const li = document.createElement('li'); li.className = 'on'; li.innerHTML = `<i></i><span>${esc(text)}</span><em></em>`; logBox.appendChild(li); return li; }
function ok(li, extra) { if (!li) return; li.className = 'ok'; li.querySelector('i').textContent = '✓'; if (extra) li.querySelector('em').innerHTML = extra; }
function bad(li, msg) { if (li) { li.className = 'bad'; li.querySelector('i').textContent = '✕'; } const l2 = log(msg); l2.className = 'bad'; l2.querySelector('i').textContent = '!'; }
const link = sig => `<a href="${solscan(sig)}" target="_blank" rel="noopener">tx ↗</a>`;

async function upload(k) {
  if (S.v[k].uri) return S.v[k].uri;
  const v = V(k), s = shared();
  const up = await api('ipfs', { image: S.v[k].img.url, name: v.name, symbol: v.symbol, ...s });
  S.v[k].uri = up.uri; return up.uri;
}
async function openBox() {
  if (S.busy) return;
  if (!W.acct) { try { await ensureWallet(); } catch (e) { } paint(); return; }
  await runChecks();
  if (!S.checks || S.checks.checks.some(c => c.status === 'fail')) { toast('Fix the checks first', 'bad'); return; }
  S.busy = true; paint(); logBox.innerHTML = '';
  let st = null;
  try {
    st = log('Uploading both versions to pump.fun (pictures + metadata)');
    const [ua, ub] = await Promise.all([upload('A'), upload('B')]); ok(st);
    const a = { ...V('A'), uri: ua }, b = { ...V('B'), uri: ub };
    st = log(`Sending your box to IBM Quantum: ${S.chips.chips.find(c => c.short === S.chip).name}, Q${S.q}`);
    const r = await api('open', { user: addr(), backend: S.chip, qubit: S.q, a, b });
    if (r.reused && !r.same) {
      const saved = LS.get('box.job.' + r.job);
      if (!saved) throw new Error('You already opened a box on this qubit today with other versions. Pick another qubit.');
      restoreSaved(saved); toast('You already opened this box today: it keeps the versions you sent then.', 'ok');
    } else LS.set('box.job.' + r.job, { a, b, imgs: { A: S.v.A.img && S.v.A.img.url.length < 1.5e6 ? S.v.A.img.url : null, B: S.v.B.img && S.v.B.img.url.length < 1.5e6 ? S.v.B.img.url : null }, chip: S.chip, q: S.q, user: addr(), t: Date.now() });
    ok(st, `job ${esc(r.job.slice(0, 10))}…`);
    S.job = r.job; LS.set('box.last', { job: r.job, user: addr() });
    await watchBox(r.job);
  } catch (e) { bad(st, cancelled(e) ? 'Cancelled.' : e.message); }
  finally { S.busy = false; $('#boxPanel').classList.remove('running'); paint(); }
}
function restoreSaved(sv) {
  for (const k of ['A', 'B']) {
    const v = sv[k.toLowerCase()];
    $('#n' + k).value = v.name; $('#s' + k).value = v.symbol; S.v[k].uri = v.uri;
    if (sv.imgs && sv.imgs[k]) { S.v[k].img = Object.assign(S.v[k].img || {}, { url: sv.imgs[k] }); $('#pv' + k).style.backgroundImage = `url("${sv.imgs[k]}")`; $('#pv' + k).textContent = ''; }
  }
  if (sv.chip) S.chip = sv.chip; if (sv.q != null) S.q = sv.q;
  duel(); if (S.chips) drawPick();
}
async function watchBox(job) {
  $('#boxPanel').classList.add('running');
  const line = $('#jobLine'); line.hidden = false;
  const t0 = Date.now();
  let st = log('Waiting for IBM to measure your qubit');
  for (;;) {
    let b;
    try { b = await api('box?id=' + encodeURIComponent(job)); } catch (e) { line.innerHTML = `IBM job <b>${esc(job)}</b> · ${esc(e.message)}`; await sleep(4000); continue; }
    S.box = b;
    const secs = Math.round((Date.now() - t0) / 1000);
    line.innerHTML = `IBM job <b>${esc(job)}</b><br>${esc(b.backend)} · Q${b.qubit} · <b>${esc(b.status)}</b> · ${secs}s`;
    $('#boxState').textContent = String(b.status).toLowerCase();
    if (b.bit != null) { ok(st, `read ${b.bit}`); break; }
    if (/fail|cancel/i.test(b.status)) { bad(st, `IBM reported: ${b.status}${b.reason ? ' (' + b.reason + ')' : ''}. Your qubit was not measured; try again.`); S.box = null; S.job = null; return; }
    await sleep(/queued/i.test(b.status) ? 3500 : 2000);
  }
  $('#boxPanel').classList.remove('running');
  await reveal(S.box);
  paint();
}
function reveal(b) {
  return new Promise(res => {
    const win = b.winner, lose = win === 'A' ? 'B' : 'A';
    const wv = V(win), lv = V(lose);
    const el = $('#reveal'); el.hidden = false; el.classList.remove('done');
    el.innerHTML = `<div class="reveal-in"><div class="rbox"><span data-mark></span></div><div class="rbit">${b.bit}</div><div class="rwin"><div class="dpic" style="background-image:url('${S.v[win].img ? S.v[win].img.url : ''}')"></div><b>$${esc(wv.symbol)} is born.</b></div><div class="rlose">$${esc(lv.symbol)} never existed.</div><div class="rsub">Measured on ${esc(b.backend)} · Q${b.qubit} · IBM job ${esc(b.id)}</div><button class="btn lg" id="rClose" style="margin-top:8px">Continue</button></div>`;
    import('./core.js').then(m => { el.querySelectorAll('[data-mark]').forEach(x => { x.innerHTML = m.MARK(); }); });
    setTimeout(() => el.classList.add('done'), 1900);
    $$('.dv').forEach(d => d.classList.remove('win', 'lose')); $('#d' + win).classList.add('win'); $('#d' + lose).classList.add('lose');
    $('#v' + win).classList.add('win'); $('#v' + lose).classList.add('lose');
    const close = () => { el.hidden = true; res(); };
    el.querySelector('#rClose').onclick = close;
  });
}
$('#openBtn').addEventListener('click', openBox);

/* ---------- launch the survivor ---------- */
async function launch() {
  if (S.done) { location.href = '/coin?m=' + S.done.mint; return; }
  if (!LIVE || S.busy || !S.box || S.box.bit == null) return;
  if (!W.acct) { try { await ensureWallet(); } catch (e) { } paint(); return; }
  if (S.box.user !== addr()) { toast('Switch back to the wallet that opened this box', 'bad'); return; }
  const win = S.box.winner, lose = win === 'A' ? 'B' : 'A', user = addr();
  const wv = { ...V(win), uri: S.v[win].uri }, lv = { ...V(lose), uri: S.v[lose].uri };
  S.busy = true; paint(); stopVanity();
  let st = null;
  try {
    const L = window.SolanaLite;
    const kp = S.mintSecret ? L.Keypair.fromSecretKey(S.mintSecret) : L.Keypair.generate();
    const mint = kp.publicKey.toBase58();
    st = log(`Building $${wv.symbol}'s launch (simulated on-chain first)`);
    const b = await api('build', { step: 'launch', user, mint, job: S.box.id, version: wv, dev: Math.min(S.dev, CAP) });
    ok(st, `${(b.units || 0).toLocaleString()} CU`);
    st = log('Sign the launch in your wallet');
    const sig = await sendSigned(await signWith(b.tx, kp)); ok(st, link(sig));
    st = log('Confirming on Solana'); await waitFor(sig); ok(st);
    S.done = { mint, sig, symbol: wv.symbol, lost: lv.symbol };
    try {
      st = log(`Recording the measurement and $${lv.symbol} for the Graveyard`);
      const r = await api('build', { step: 'record', user, mint, job: S.box.id, loser: lv }); ok(st);
      st = log('Sign the record (one memo, no tokens move)');
      const s2 = await sendSigned(await signWith(r.tx)); ok(st, link(s2));
      st = log('Confirming'); await waitFor(s2); ok(st);
    } catch (e) { bad(st, cancelled(e) ? 'Record skipped. Your coin is live; the Graveyard just won\'t show its twin.' : e.message); }
    if (b.followUp && b.followUp.dev) {
      try {
        st = log(`Building your first buy: ${b.followUp.dev.amount} SOL → $BOX → $${wv.symbol}`);
        const d = await api('build', { step: 'devbuy', user, mint, amount: b.followUp.dev.amount, slippage: 10 }); ok(st, `${d.dev.pct.toFixed(2)}% of supply`);
        st = log('Sign the first buy'); const s3 = await sendSigned(await signWith(d.tx)); ok(st, link(s3));
        st = log('Confirming'); await waitFor(s3); ok(st);
      } catch (e) { bad(st, cancelled(e) ? 'First buy skipped.' : e.message); }
    }
    success();
  } catch (e) { bad(st, cancelled(e) ? 'Cancelled in the wallet. Nothing was sent.' : e.message); }
  finally { S.busy = false; paint(); }
}
$('#launchBtn').addEventListener('click', launch);
function success() {
  const d = S.done;
  const share = `https://x.com/intent/post?text=${encodeURIComponent(`Two coins went in. One came out.\n\n$${d.symbol} was born on a real IBM quantum computer. $${d.lost} never existed.\n\n${location.origin}/coin?m=${d.mint}`)}`;
  $('#done').hidden = false;
  $('#done').innerHTML = `<div class="grid" style="gap:10px"><b style="font-size:20px">$${esc(d.symbol)} is born.</b><span class="mu">Live on pump.fun, paired to $BOX, holding ${esc(S.box.backend)} Q${S.box.qubit}. $${esc(d.lost)} is in the Graveyard.</span>
    <div class="quick"><a class="btn sm" href="/coin?m=${esc(d.mint)}">Open coin</a><a class="btn sm" href="https://pump.fun/coin/${esc(d.mint)}" target="_blank" rel="noopener">pump.fun ↗</a><a class="btn sm" href="${share}" target="_blank" rel="noopener">Share on X</a></div></div>`;
  toast(`$${d.symbol} is born`, 'ok');
}

/* ---------- resume a box opened earlier (24h) ---------- */
(async () => {
  const last = LS.get('box.last'); if (!last || !last.job) return;
  const sv = LS.get('box.job.' + last.job); if (!sv || Date.now() - sv.t > 864e5) return;
  try {
    const b = await api('box?id=' + encodeURIComponent(last.job));
    if (/fail|cancel/i.test(b.status)) return;
    restoreSaved(sv); S.job = last.job; S.box = b;
    if (b.bit == null) { S.busy = true; paint(); await watchBox(last.job); S.busy = false; }
    else { $$('.dv').forEach(d => d.classList.remove('win', 'lose')); $('#d' + b.winner).classList.add('win'); $('#d' + (b.winner === 'A' ? 'B' : 'A')).classList.add('lose'); $('#v' + b.winner).classList.add('win'); $('#v' + (b.winner === 'A' ? 'B' : 'A')).classList.add('lose'); $('#jobLine').hidden = false; $('#jobLine').innerHTML = `IBM job <b>${esc(b.id)}</b><br>${esc(b.backend)} · Q${b.qubit} · read <b>${b.bit}</b> · version ${b.winner}`; }
    paint();
  } catch (e) { }
})();

duel(); paint(); runChecks();
