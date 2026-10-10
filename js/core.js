/* BOX shared code: formatting, API, wallet, nav, small UI helpers. */
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const short = (a, n = 4) => a ? `${a.slice(0, n)}…${a.slice(-n)}` : '';
export const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- numbers ---------- */
export function usd(n, d) {
  if (n == null || !isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (a >= 1e4) return '$' + (n / 1e3).toFixed(1) + 'K';
  if (a >= 1) return '$' + n.toFixed(d == null ? 2 : d);
  if (a === 0) return '$0';
  return '$' + sig(n, 3);
}
export function num(n, d = 2) {
  if (n == null || !isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (a >= 1e4) return (n / 1e3).toFixed(1) + 'K';
  if (a >= 100) return n.toFixed(0);
  if (a >= 1) return n.toFixed(d);
  if (a === 0) return '0';
  return sig(n, 3);
}
export function sig(n, s = 3) {
  if (!n) return '0';
  const a = Math.abs(n);
  if (a >= 0.001) return n.toPrecision(s).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  const e = Math.floor(Math.log10(a)), z = -e - 1, m = Math.round(a * 10 ** (-e + s - 1));
  return (n < 0 ? '-' : '') + '0.0' + subz(z) + String(m).replace(/0+$/, '');
}
const SUB = '₀₁₂₃₄₅₆₇₈₉';
const subz = z => String(z).split('').map(d => SUB[+d]).join('');
export const pct = (n, d = 1) => n == null || !isFinite(n) ? '—' : (n > 0 ? '+' : '') + n.toFixed(d) + '%';
export const pctCls = n => n == null ? 'mu' : n >= 0 ? 'up' : 'down';
export function ago(t) {
  if (!t) return '—';
  const s = Math.max(1, (Date.now() - t) / 1000);
  if (s < 60) return Math.floor(s) + 's';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  return Math.floor(s / 86400) + 'd';
}

/* ---------- API ---------- */
export async function api(path, body) {
  const r = await fetch('/api/' + path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  let j = null; try { j = await r.json(); } catch (e) { }
  if (!r.ok || !j || j.ok === false) { const e = new Error((j && j.error) || `Request failed (${r.status})`); e.logs = j && j.logs; e.status = r.status; throw e; }
  return j;
}
let cfgP = null;
export const loadConfig = () => (cfgP = cfgP || api('config').catch(() => ({ ca: '', launches: 'prelaunch', devMaxSol: 1, perWallet: 50, fees: null, pump: null, ibm: false, backends: ['ibm_fez', 'ibm_marrakesh'] })));
export const img = u => (u ? '/api/img?u=' + encodeURIComponent(u) : '');

/* ---------- brand mark: the box, solid half + quantum half ---------- */
let mid = 0;
export function MARK(cls = '') {
  const id = 'bm' + (mid++), d = 10.4;
  return `<svg class="bmark ${cls}" viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="${id}l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8d4cb"/><stop offset="1" stop-color="#a9a59c"/></linearGradient><linearGradient id="${id}t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#e7e3da"/></linearGradient><linearGradient id="${id}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7ff4ff" stop-opacity=".22"/><stop offset="1" stop-color="#3fd6ff" stop-opacity=".05"/></linearGradient></defs>
<polygon points="50,50 84.64,30 84.64,70 50,90" fill="url(#${id}r)"/><polygon points="50,10 84.64,30 50,50" fill="#7ff4ff" fill-opacity=".12"/>
<polyline points="50,10 84.64,30 84.64,70 50,90" fill="none" stroke="#7ff4ff" stroke-width="2.4" stroke-linejoin="round"/><line x1="50" y1="${50 + d}" x2="84.64" y2="${30 + d}" stroke="#7ff4ff" stroke-width="2.2"/><line x1="50" y1="50" x2="84.64" y2="70" stroke="#7ff4ff" stroke-opacity=".5" stroke-width="1.6" stroke-dasharray="3.4 3"/>
<polygon points="15.36,30 50,50 50,90 15.36,70" fill="url(#${id}l)"/><polygon points="15.36,30 50,50 50,${50 + d} 15.36,${30 + d}" fill="#ebe8e1"/><polygon points="50,10 50,50 15.36,30" fill="url(#${id}t)"/><line x1="15.36" y1="${30 + d}" x2="50" y2="${50 + d}" stroke="#050507" stroke-width="2.2"/>
<line x1="50" y1="10" x2="50" y2="90" stroke="#7ff4ff" stroke-width="2.2" stroke-linecap="round"/></svg>`;
}
export const AMARK = MARK;

/* ---------- toast + copy ---------- */
export function toast(msg, kind = '') {
  let box = $('.toasts'); if (!box) { box = document.createElement('div'); box.className = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg; box.appendChild(t);
  setTimeout(() => { t.style.transition = 'opacity .4s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 3400);
}
export async function copy(text, msg = 'Copied') {
  try { await navigator.clipboard.writeText(text); toast(msg, 'ok'); }
  catch (e) { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast(msg, 'ok'); } catch (_) { } ta.remove(); }
}

/* ---------- wallets (Wallet Standard: Phantom, Solflare, Backpack, …) ---------- */
const LS = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const LSset = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { } };
export const W = { list: [], w: null, acct: null, on: new Set(), change: new Set() };
function addWallet(w) {
  try {
    if (!w || !w.features || !w.name) return;
    const sol = (w.chains || []).some(c => String(c).startsWith('solana:'));
    const can = w.features['standard:connect'] && (w.features['solana:signTransaction'] || w.features['solana:signAndSendTransaction']);
    if (!sol || !can || W.list.some(x => x.name === w.name)) return;
    W.list.push(w); W.on.forEach(f => f());
    tryRestore(w);
  } catch (e) { }
}
const walletApi = Object.freeze({ register: (...ws) => { ws.forEach(addWallet); return () => { }; } });
window.addEventListener('wallet-standard:register-wallet', e => { try { e.detail(walletApi); } catch (_) { } });
try { window.dispatchEvent(new CustomEvent('wallet-standard:app-ready', { detail: walletApi })); } catch (_) { }
async function tryRestore(w) {
  if (W.acct || LS('box.wallet') !== w.name) return;
  try {
    const r = await w.features['standard:connect'].connect({ silent: true });
    const a = (r && r.accounts && r.accounts[0]) || (w.accounts && w.accounts[0]);
    if (a) setAcct(w, a);
  } catch (e) { }
}
function setAcct(w, a) { W.w = w; W.acct = a; LSset('box.wallet', w ? w.name : null); W.change.forEach(f => { try { f(a); } catch (e) { } }); }
export const addr = () => (W.acct ? W.acct.address : null);
export function disconnect() { try { W.w && W.w.features['standard:disconnect'] && W.w.features['standard:disconnect'].disconnect(); } catch (e) { } setAcct(null, null); }
export function walletModal() {
  return new Promise((resolve, reject) => {
    const m = document.createElement('div'); m.className = 'modal'; m.innerHTML = `<div class="modal-in" role="dialog" aria-modal="true" aria-label="Connect a wallet"><h3>Connect a wallet</h3><p>Any Solana wallet. BOX never sees your keys: your wallet signs every transaction.</p><div class="wl"></div><button class="btn block" data-x>Cancel</button></div>`;
    document.body.appendChild(m);
    const draw = () => {
      const box = m.querySelector('.wl');
      box.innerHTML = W.list.length ? W.list.map((w, i) => `<button class="wopt" data-i="${i}">${w.icon ? `<img src="${esc(w.icon)}" alt="">` : ''}<b>${esc(w.name)}</b></button>`).join('')
        : '<p>No Solana wallet found in this browser.</p><a class="wopt" href="https://phantom.com/download" target="_blank" rel="noopener"><b>Get Phantom</b></a><a class="wopt" href="https://solflare.com/download" target="_blank" rel="noopener"><b>Get Solflare</b></a>';
    };
    draw(); W.on.add(draw);
    const close = err => { W.on.delete(draw); m.remove(); if (err) reject(err); };
    m.addEventListener('click', async e => {
      if (e.target === m || e.target.closest('[data-x]')) return close(new Error('cancelled'));
      const b = e.target.closest('button[data-i]'); if (!b) return;
      const w = W.list[+b.dataset.i];
      try {
        const r = await w.features['standard:connect'].connect();
        const a = (r && r.accounts && r.accounts[0]) || (w.accounts && w.accounts[0]); if (!a) throw new Error('No account shared');
        setAcct(w, a); close(); resolve(a);
      } catch (err) { toast(err && err.message ? err.message : 'Connection cancelled', 'bad'); }
    });
  });
}
export async function ensureWallet() { if (W.acct) return W.acct; return await walletModal(); }
const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
// the wallet signs (an extra signer, the new mint, signs after). Returns {tx} (base64, fully signed) or {sig} if the wallet sent it.
export async function signWith(txB64, extraSigner) {
  const L = window.SolanaLite; if (!L) throw new Error('Signing library not loaded');
  const bytes = Uint8Array.from(atob(txB64), c => c.charCodeAt(0));
  const f = W.w.features;
  if (f['solana:signTransaction']) {
    const [res] = await f['solana:signTransaction'].signTransaction({ account: W.acct, transaction: bytes, chain: 'solana:mainnet' });
    const vt = L.VersionedTransaction.deserialize(res.signedTransaction);
    if (extraSigner) vt.sign([extraSigner]);
    return { tx: b64(vt.serialize()) };
  }
  const vt = L.VersionedTransaction.deserialize(bytes); if (extraSigner) vt.sign([extraSigner]);
  const [res] = await f['solana:signAndSendTransaction'].signAndSendTransaction({ account: W.acct, transaction: vt.serialize(), chain: 'solana:mainnet' });
  const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let n = 0n; for (const x of res.signature) n = n * 256n + BigInt(x); let s = ''; while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; } for (const x of res.signature) { if (x === 0) s = '1' + s; else break; }
  return { sig: s };
}
export async function sendSigned(signed) { if (signed.sig) return signed.sig; const r = await api('send', { tx: signed.tx }); return r.sig; }
export async function waitFor(sig, ms = 80000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { const s = await api('status?sig=' + sig); if (s.err) throw Object.assign(new Error('The transaction failed on-chain.'), { onchain: true }); if (s.status === 'confirmed' || s.status === 'finalized') return s.status; }
    catch (e) { if (e.onchain) throw e; }
    await sleep(1600);
  }
  throw new Error('Not confirmed yet. Check the transaction on Solscan.');
}
export const solscan = sig => `https://solscan.io/tx/${sig}`;
export const cancelled = e => /reject|cancel|denied|declined|closed/i.test(String(e && e.message));

/* ---------- nav + footer + wallet button (every page) ---------- */
export async function chrome(page) {
  document.documentElement.classList.add('fx');
  $$('[data-amark],[data-mark]').forEach(el => { el.innerHTML = MARK(); });
  const burger = $('.burger'), links = $('.links');
  if (burger && links) burger.addEventListener('click', () => links.classList.toggle('open'));
  links && links.addEventListener('click', e => { if (e.target.closest('a')) links.classList.remove('open'); });
  $$('.links a').forEach(a => { if (a.dataset.page === page) a.classList.add('on'); });
  const wb = $('#wBtn');
  const paint = () => { if (!wb) return; if (W.acct) { wb.classList.add('on'); wb.innerHTML = `<span class="dot"></span>${esc(short(W.acct.address))}`; } else { wb.classList.remove('on'); wb.textContent = 'Connect'; } };
  W.change.add(paint); paint();
  wb && wb.addEventListener('click', async () => {
    if (W.acct) { if (confirmDisconnect()) disconnect(); return; }
    try { await walletModal(); } catch (e) { }
  });
  const cfg = await loadConfig();
  const ca = $('#caChip');
  if (ca) {
    if (cfg.ca) { ca.hidden = false; ca.innerHTML = `CA <b>${short(cfg.ca)}</b><i>COPY</i>`; ca.onclick = () => copy(cfg.ca, 'Contract address copied'); }
    else ca.hidden = true;
  }
  $$('[data-x-link]').forEach(a => { if (cfg.x) { a.href = cfg.x; a.hidden = false; } else a.hidden = true; });
  $$('[data-pump-link]').forEach(a => { if (cfg.ca) { a.href = 'https://pump.fun/coin/' + cfg.ca; a.hidden = false; } else a.hidden = true; });
  return cfg;
}
function confirmDisconnect() { return true; }
export function setP(el, p) { if (el) el.style.setProperty('--p', (Math.max(0, Math.min(1, p)) * 100).toFixed(1) + '%'); }
