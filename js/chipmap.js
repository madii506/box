/* A real IBM chip, drawn from its coupling map: rows of qubits joined by bridge qubits (heavy-hex).
   Claimed qubits wear their coin's picture; free qubits glow brighter the longer they hold a quantum state (T1). */
import { esc, img } from './core.js';

export function layout(chip) {
  const n = chip.n, adj = Array.from({ length: n }, () => new Set());
  for (const [a, b] of chip.edges) if (a < n && b < n) { adj[a].add(b); adj[b].add(a); }
  // rows: runs of consecutive indices joined one after another
  const runs = []; let cur = [];
  for (let i = 0; i < n; i++) {
    if (cur.length && cur[cur.length - 1] === i - 1 && adj[i].has(i - 1)) cur.push(i);
    else { if (cur.length) runs.push(cur); cur = [i]; }
  }
  if (cur.length) runs.push(cur);
  const rows = runs.filter(r => r.length >= 4);
  const pos = new Array(n).fill(null);
  rows.forEach((r, ri) => r.forEach((q, ci) => { pos[q] = { x: ci, y: ri * 2 }; }));
  for (let i = 0; i < n; i++) if (!pos[i]) {
    const nb = [...adj[i]].map(j => pos[j]).filter(Boolean);
    if (nb.length) pos[i] = { x: nb.reduce((s, p) => s + p.x, 0) / nb.length, y: nb.length > 1 ? nb.reduce((s, p) => s + p.y, 0) / nb.length : nb[0].y + 1, bridge: true };
  }
  const maxY = Math.max(0, ...pos.filter(Boolean).map(p => p.y));
  let k = 0;
  for (let i = 0; i < n; i++) if (!pos[i]) pos[i] = { x: k++, y: maxY + 2 };
  return { pos, W: Math.max(...pos.map(p => p.x)) + 1, H: Math.max(...pos.map(p => p.y)) + 1 };
}

export const fmtT = v => (v == null ? '—' : v >= 1000 ? (v / 1000).toFixed(2) + ' ms' : v.toFixed(0) + ' µs');
export const fmtE = v => (v == null ? '—' : (v * 100).toFixed(v < 0.01 ? 2 : 1) + '%');

export function drawChip(el, chip, claims = {}, o = {}) {
  const L = chip._L || (chip._L = layout(chip));
  const sx = 40, sy = 30, pad = 24;
  const w = (L.W - 1) * sx + pad * 2, h = (L.H - 1) * sy + pad * 2;
  const X = p => pad + p.x * sx, Y = p => pad + p.y * sy;
  const t1 = chip.qubits.map(q => q.t1).filter(v => v > 0).sort((a, b) => a - b);
  const top = t1.length ? t1[Math.floor(t1.length * 0.9)] : null;
  let edges = '', defs = '', nodes = '';
  for (const [a, b] of chip.edges) { const p = L.pos[a], q = L.pos[b]; if (p && q) edges += `<line x1="${X(p)}" y1="${Y(p)}" x2="${X(q)}" y2="${Y(q)}"/>`; }
  chip.qubits.forEach((qb, i) => {
    const p = L.pos[i]; if (!p) return;
    const x = X(p).toFixed(1), y = Y(p).toFixed(1), c = claims[chip.short + ':' + i];
    if (c) {
      const r = 11.5, id = `cp-${chip.short}-${i}`;
      if (c.image) { defs += `<clipPath id="${id}"><circle cx="${x}" cy="${y}" r="${r}"/></clipPath>`; nodes += `<g class="q own" data-q="${i}"><circle class="ring" cx="${x}" cy="${y}" r="${r + 2.4}"/><image href="${esc(img(c.image))}" x="${x - r}" y="${y - r}" width="${r * 2}" height="${r * 2}" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/></g>`; }
      else nodes += `<g class="q own" data-q="${i}"><circle class="ring" cx="${x}" cy="${y}" r="${r + 2.4}"/><circle class="fill" cx="${x}" cy="${y}" r="${r}"/><text x="${x}" y="${(+y + 3.4).toFixed(1)}">${esc(String(c.symbol || '').slice(0, 3))}</text></g>`;
    } else {
      const k = top && qb.t1 ? Math.max(0.18, Math.min(1, qb.t1 / top)) : 0.55;
      nodes += `<g class="q free" data-q="${i}" style="--k:${k.toFixed(2)}"><circle class="hit" cx="${x}" cy="${y}" r="13"/><circle class="dot" cx="${x}" cy="${y}" r="6.6"/></g>`;
    }
  });
  el.innerHTML = `<svg class="chipsvg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(chip.name)}: ${chip.n} qubits"><defs>${defs}</defs><g class="edges">${edges}</g><g class="nodes">${nodes}</g><g class="sel"></g></svg><div class="qtip" hidden></div>`;
  const svg = el.querySelector('svg'), tip = el.querySelector('.qtip'), sel = el.querySelector('.sel');
  const info = i => {
    const qb = chip.qubits[i] || {}, c = claims[chip.short + ':' + i];
    return `<b>Q${i}</b><span>${esc(chip.name)}</span>${c ? `<em class="own">$${esc(c.symbol)}</em>` : '<em>free</em>'}<dl><dt>T1</dt><dd>${fmtT(qb.t1)}</dd><dt>T2</dt><dd>${fmtT(qb.t2)}</dd><dt>Readout error</dt><dd>${fmtE(qb.ro)}</dd></dl>`;
  };
  svg.addEventListener('pointermove', e => {
    const g = e.target.closest('.q'); if (!g) { tip.hidden = true; return; }
    const r = el.getBoundingClientRect();
    tip.innerHTML = info(+g.dataset.q); tip.hidden = false;
    const tx = Math.min(r.width - 190, Math.max(0, e.clientX - r.left + 14)), ty = Math.max(0, e.clientY - r.top - 20);
    tip.style.transform = `translate(${tx}px,${ty}px)`;
  });
  svg.addEventListener('pointerleave', () => { tip.hidden = true; });
  svg.addEventListener('click', e => { const g = e.target.closest('.q'); if (g && o.onPick) o.onPick(+g.dataset.q, !!claims[chip.short + ':' + g.dataset.q]); });
  const api = {
    select(i) {
      sel.innerHTML = '';
      if (i == null || !L.pos[i]) return;
      const p = L.pos[i];
      sel.innerHTML = `<circle class="selring" cx="${X(p)}" cy="${Y(p)}" r="15"/><circle class="selpulse" cx="${X(p)}" cy="${Y(p)}" r="15"/>`;
    },
    flash(i) { const g = svg.querySelector(`.q[data-q="${i}"]`); if (g) { g.classList.remove('flash'); void g.getBBox(); g.classList.add('flash'); } },
  };
  if (o.selected != null) api.select(o.selected);
  return api;
}
