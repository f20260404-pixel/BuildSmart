// DXF in and out. Import turns the lines of a CAD floor plan into walls; export writes the plan as a layered drawing.
import * as E from './engine';
import type { Model, Pt, Wall, Opening, Label, RoomType } from './engine';

export interface DxfSeg { a: Pt; b: Pt; layer: string }
export interface DxfDoc { segs: DxfSeg[]; texts: { p: Pt; text: string; layer: string }[]; layers: string[]; insunits: number | null; extent: number }
export const UNITS: Record<string, { label: string; m: number }> = { mm: { label: 'Millimetres', m: 0.001 }, cm: { label: 'Centimetres', m: 0.01 }, m: { label: 'Metres', m: 1 }, in: { label: 'Inches', m: 0.0254 }, ft: { label: 'Feet', m: 0.3048 } };
const INS: Record<number, string> = { 1: 'in', 2: 'ft', 4: 'mm', 5: 'cm', 6: 'm' };

export function parseDxf(text: string): DxfDoc {
  if (text.startsWith('AutoCAD Binary DXF')) throw new Error('binary');
  const lines = text.split(/\r\n|\r|\n/); const segs: DxfSeg[] = []; const texts: DxfDoc['texts'] = []; let insunits: number | null = null;
  let section = '', i = 0; const n = lines.length - 1;
  const code = (k: number) => parseInt(lines[k], 10), val = (k: number) => (lines[k + 1] ?? '').trim();
  while (i < n) {
    const c = code(i), v = val(i);
    if (c === 0 && v === 'SECTION') { section = val(i + 2); i += 4; continue; }
    if (c === 0 && v === 'ENDSEC') { section = ''; i += 2; continue; }
    if (section === 'HEADER' && c === 9 && v === '$INSUNITS') { insunits = parseInt(val(i + 2), 10) || null; i += 4; continue; }
    if (section === 'ENTITIES' && c === 0) {
      const type = v; let j = i + 2; const g: [number, string][] = [];
      while (j < n && code(j) !== 0) { g.push([code(j), val(j)]); j += 2; }
      const get = (k: number) => { const f = g.find(x => x[0] === k); return f ? f[1] : ''; }; const num = (k: number) => parseFloat(get(k)) || 0; const layer = get(8) || '0';
      if (type === 'LINE') segs.push({ a: { x: num(10), y: num(20) }, b: { x: num(11), y: num(21) }, layer });
      else if (type === 'LWPOLYLINE') {
        const xs = g.filter(x => x[0] === 10).map(x => parseFloat(x[1])), ys = g.filter(x => x[0] === 20).map(x => parseFloat(x[1])); const closed = (parseInt(get(70), 10) || 0) & 1;
        for (let k = 0; k + 1 < xs.length; k++) segs.push({ a: { x: xs[k], y: ys[k] }, b: { x: xs[k + 1], y: ys[k + 1] }, layer });
        if (closed && xs.length > 2) segs.push({ a: { x: xs[xs.length - 1], y: ys[ys.length - 1] }, b: { x: xs[0], y: ys[0] }, layer });
      } else if (type === 'POLYLINE') {
        const closed = (parseInt(get(70), 10) || 0) & 1; const pts: Pt[] = [];
        while (j < n && val(j) === 'VERTEX') { let k = j + 2; let x = 0, y = 0; while (k < n && code(k) !== 0) { if (code(k) === 10) x = parseFloat(val(k)); if (code(k) === 20) y = parseFloat(val(k)); k += 2; } pts.push({ x, y }); j = k; }
        if (j < n && val(j) === 'SEQEND') { j += 2; while (j < n && code(j) !== 0) j += 2; }
        for (let k = 0; k + 1 < pts.length; k++) segs.push({ a: pts[k], b: pts[k + 1], layer }); if (closed && pts.length > 2) segs.push({ a: pts[pts.length - 1], b: pts[0], layer });
      } else if (type === 'TEXT' || type === 'MTEXT') { const t = get(1).replace(/\\P/g, ' ').replace(/\{|\}|\\[A-Za-z][^;]*;/g, '').trim(); if (t) texts.push({ p: { x: num(10), y: num(20) }, text: t, layer }); }
      i = j; continue;
    }
    i += 2;
  }
  const ok = segs.filter(s => [s.a.x, s.a.y, s.b.x, s.b.y].every(isFinite));
  let x0 = 1e18, y0 = 1e18, x1 = -1e18, y1 = -1e18; ok.forEach(s => [s.a, s.b].forEach(p => { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }));
  return { segs: ok, texts, layers: Array.from(new Set(ok.map(s => s.layer))).sort(), insunits, extent: ok.length ? Math.max(x1 - x0, y1 - y0) : 0 };
}
export const guessUnit = (d: DxfDoc): string => (d.insunits && INS[d.insunits]) || (d.extent > 3000 ? 'mm' : d.extent > 300 ? 'cm' : 'm');
const isOpenLayer = (l: string) => /door|window|win\b|fenetre|opening/i.test(l);
const isNoise = (l: string) => /dim|text|hatch|furn|grid|axis|cent(er|re)|plot|setback|col|room|stair|san|plumb|elec|title|border|annot/i.test(l);
/** Layers ticked by default: wall layers if the drawing names any, otherwise everything that is not clearly annotation. */
export function defaultLayers(d: DxfDoc): string[] { const w = d.layers.filter(l => /wall|mur\b|masonry|brick/i.test(l)); return (w.length ? [...w, ...d.layers.filter(isOpenLayer)] : d.layers.filter(l => !isNoise(l) || isOpenLayer(l))); }
const roomType = (s: string): RoomType => /bed|master|guest|child/i.test(s) ? 'bedroom' : /living|hall|dining|drawing|lounge/i.test(s) ? 'living' : /kitchen|pantry/i.test(s) ? 'kitchen' : /bath|toilet|w\.?c|wash/i.test(s) ? 'bath' : /passage|corridor|lobby|foyer/i.test(s) ? 'corridor' : 'other';

export interface PlanResult { walls: Wall[]; openings: Opening[]; labels: Label[]; info: { lines: number; paired: number; mode: 'double' | 'single'; w: number; h: number; rooms: number } }
export function dxfToPlan(d: DxfDoc, unit: string, layers: string[]): PlanResult {
  const k = UNITS[unit].m; const use = new Set(layers);
  let x0 = 1e18, y1 = -1e18; const all = d.segs.filter(s => use.has(s.layer)); all.forEach(s => [s.a, s.b].forEach(p => { x0 = Math.min(x0, p.x); y1 = Math.max(y1, p.y); }));
  const tr = (p: Pt): Pt => ({ x: (p.x - x0) * k, y: (y1 - p.y) * k }); // DXF y runs up, the plan's y runs down
  const segs = all.map(s => ({ a: tr(s.a), b: tr(s.b), layer: s.layer })).filter(s => E.dist(s.a, s.b) > 0.05).slice(0, 4000);
  const hints = segs.filter(s => isOpenLayer(s.layer)); const cand = segs.filter(s => !isOpenLayer(s.layer));
  type C = { a: Pt; b: Pt; t: number }; const cl: C[] = []; const used = new Uint8Array(cand.length);
  for (let i = 0; i < cand.length; i++) {
    const s = cand[i], L = E.dist(s.a, s.b), ux = (s.b.x - s.a.x) / L, uy = (s.b.y - s.a.y) / L;
    for (let j = i + 1; j < cand.length; j++) {
      const o = cand[j], Lo = E.dist(o.a, o.b), vx = (o.b.x - o.a.x) / Lo, vy = (o.b.y - o.a.y) / Lo;
      if (Math.abs(ux * vy - uy * vx) > 0.02) continue;
      const dd = (o.a.x - s.a.x) * -uy + (o.a.y - s.a.y) * ux; const ad = Math.abs(dd); if (ad < 0.07 || ad > 0.4) continue;
      const p0 = (o.a.x - s.a.x) * ux + (o.a.y - s.a.y) * uy, p1 = (o.b.x - s.a.x) * ux + (o.b.y - s.a.y) * uy; const lo = Math.max(0, Math.min(p0, p1)), hi = Math.min(L, Math.max(p0, p1));
      if (hi - lo < 0.15) continue;
      const ox = -uy * dd / 2, oy = ux * dd / 2; cl.push({ a: { x: s.a.x + ux * lo + ox, y: s.a.y + uy * lo + oy }, b: { x: s.a.x + ux * hi + ox, y: s.a.y + uy * hi + oy }, t: ad }); used[i] = used[j] = 1;
    }
  }
  let paired = 0; used.forEach(u => paired += u); const mode: 'double' | 'single' = cand.length && paired / cand.length >= 0.3 ? 'double' : 'single';
  let lines: C[] = mode === 'double' ? cl : cand.map(s => ({ a: s.a, b: s.b, t: 0.23 }));
  // merge pieces on the same line; a gap of door or window size becomes an opening
  const gaps: { p: Pt; w: number }[] = []; const groups = new Map<string, { ux: number; uy: number; off: number; t: number; iv: [number, number][] }>();
  lines.forEach(c => {
    let L = E.dist(c.a, c.b), ux = (c.b.x - c.a.x) / L, uy = (c.b.y - c.a.y) / L; if (ux < -1e-6 || (Math.abs(ux) < 1e-6 && uy < 0)) { ux = -ux; uy = -uy; }
    const ang = Math.round(Math.atan2(uy, ux) * 180 / Math.PI * 2) / 2; const off = c.a.x * -uy + c.a.y * ux; const key = ang + '|' + Math.round(off / 0.04);
    const s0 = c.a.x * ux + c.a.y * uy, s1 = c.b.x * ux + c.b.y * uy; const g = groups.get(key) || { ux, uy, off, t: c.t, iv: [] }; g.iv.push([Math.min(s0, s1), Math.max(s0, s1)]); g.t = Math.max(g.t, c.t); groups.set(key, g);
  });
  lines = [];
  groups.forEach(g => {
    g.iv.sort((a, b) => a[0] - b[0]); let cur = g.iv[0].slice() as [number, number]; const pt = (s: number): Pt => ({ x: g.ux * s - g.uy * g.off, y: g.uy * s + g.ux * g.off });
    for (let i = 1; i < g.iv.length; i++) {
      const gap = g.iv[i][0] - cur[1];
      if (gap <= 0.06) cur[1] = Math.max(cur[1], g.iv[i][1]);
      else if (mode === 'double' && (hints.length ? hints.some(h => E.dist(E.lerp(h.a, h.b, 0.5), pt(cur[1] + gap / 2)) < 0.3) : gap >= 0.5 && gap <= 2.5)) { gaps.push({ p: pt(cur[1] + gap / 2), w: gap }); cur[1] = g.iv[i][1]; }
      else { lines.push({ a: pt(cur[0]), b: pt(cur[1]), t: g.t }); cur = g.iv[i].slice() as [number, number]; }
    }
    lines.push({ a: pt(cur[0]), b: pt(cur[1]), t: g.t });
  });
  // stretch each end to the wall it should meet (face lines stop half a wall short of the corner)
  if (mode === 'double') lines.forEach((c, ci) => {
    (['a', 'b'] as const).forEach(end => {
      const P = c[end], Q = c[end === 'a' ? 'b' : 'a']; const L = E.dist(P, Q); const ux = (P.x - Q.x) / L, uy = (P.y - Q.y) / L; let best: Pt | null = null, bd = 0.46;
      lines.forEach((o, oi) => {
        if (oi === ci) return; const Lo = E.dist(o.a, o.b), vx = (o.b.x - o.a.x) / Lo, vy = (o.b.y - o.a.y) / Lo; const den = ux * vy - uy * vx; if (Math.abs(den) < 0.05) return;
        const t = ((o.a.x - P.x) * vy - (o.a.y - P.y) * vx) / den, u = ((o.a.x - P.x) * uy - (o.a.y - P.y) * ux) / den;
        if (Math.abs(t) < bd && u > -0.46 && u < Lo + 0.46) { bd = Math.abs(t); best = { x: P.x + ux * t, y: P.y + uy * t }; }
      });
      if (best) c[end] = best;
    });
  });
  const raw: Wall[] = lines.filter(c => E.dist(c.a, c.b) > 0.25).map(c => ({ id: E.uid('w'), a: E.rp(c.a), b: E.rp(c.b), t: c.t >= 0.17 ? 0.23 : 0.115, mat: 'clay' as const }));
  const walls = E.normalize(raw, []).walls; const tmp = E.blankModel(); tmp.walls = walls;
  hints.forEach(h => { const w = E.dist(h.a, h.b); if (w >= 0.4 && w <= 4) E.addOpeningAt(tmp, E.lerp(h.a, h.b, 0.5), /door/i.test(h.layer) ? 'door' : 'window', Math.round(w * 20) / 20, /door/i.test(h.layer) ? 2.1 : 1.2); });
  if (!hints.length) gaps.forEach(g => E.addOpeningAt(tmp, g.p, g.w <= 1.25 ? 'door' : 'window', Math.round(g.w * 20) / 20, g.w <= 1.25 ? 2.1 : 1.2));
  const geo = E.geometry(tmp); const labels: Label[] = [];
  d.texts.forEach(t => { const p = tr(t.p); const r = geo.rooms.find(q => E.pointInPoly(p, q.poly)); if (r && !/^[\d\s.,x×m²]+$/i.test(t.text) && !labels.some(l => E.pointInPoly(l, r.poly))) labels.push({ x: r.c.x, y: r.c.y, name: t.text.slice(0, 24), type: roomType(t.text) }); });
  let bx = 0, by = 0; walls.forEach(w => [w.a, w.b].forEach(p => { bx = Math.max(bx, p.x); by = Math.max(by, p.y); }));
  return { walls, openings: tmp.openings, labels, info: { lines: cand.length, paired, mode, w: bx, h: by, rooms: geo.rooms.length } };
}

// ---------- export ----------
export function toDxf(m: Model, est: E.Estimate): string {
  const out: string[] = ['0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '6', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES'];
  const f = (v: number) => (Math.round(v * 10000) / 10000).toString();
  const line = (layer: string, a: Pt, b: Pt) => out.push('0', 'LINE', '8', layer, '10', f(a.x), '20', f(-a.y), '30', '0', '11', f(b.x), '21', f(-b.y), '31', '0');
  const text = (layer: string, p: Pt, h: number, s: string) => out.push('0', 'TEXT', '8', layer, '10', f(p.x), '20', f(-p.y), '30', '0', '40', f(h), '1', s);
  m.walls.forEach(w => {
    const L = E.wlen(w); if (L < 0.01) return; const ux = (w.b.x - w.a.x) / L, uy = (w.b.y - w.a.y) / L, nx = -uy * w.t / 2, ny = ux * w.t / 2;
    const at = (s: number, side: number): Pt => ({ x: w.a.x + ux * s + nx * side, y: w.a.y + uy * s + ny * side });
    const ops = m.openings.filter(o => o.wallId === w.id).map(o => ({ o, s0: o.pos * L - o.w / 2, s1: o.pos * L + o.w / 2 })).sort((a, b) => a.s0 - b.s0);
    let s = 0; ops.forEach(({ o, s0, s1 }) => {
      if (s0 - s > 0.01) { line('WALL', at(s, 1), at(s0, 1)); line('WALL', at(s, -1), at(s0, -1)); }
      line('WALL', at(s0, 1), at(s0, -1)); line('WALL', at(s1, 1), at(s1, -1)); line(o.kind === 'door' ? 'DOOR' : 'WINDOW', at(s0, 0), at(s1, 0)); s = s1;
    });
    if (L - s > 0.01) { line('WALL', at(s, 1), at(L, 1)); line('WALL', at(s, -1), at(L, -1)); }
  });
  est.st.columns.forEach(c => { const hx = est.st.col[1] / 2, hy = est.st.col[0] / 2; const q = [{ x: c.x - hx, y: c.y - hy }, { x: c.x + hx, y: c.y - hy }, { x: c.x + hx, y: c.y + hy }, { x: c.x - hx, y: c.y + hy }]; q.forEach((p, i) => line('COLUMN', p, q[(i + 1) % 4])); });
  est.geo.rooms.forEach(r => { text('ROOM', { x: r.c.x - r.name.length * 0.07, y: r.c.y }, 0.18, r.name); text('ROOM-AREA', { x: r.c.x - 0.35, y: r.c.y + 0.3 }, 0.13, r.carpet.toFixed(1) + ' sq m'); });
  const p = E.plotInfo(m); if (p.has) { const rect = (layer: string, r: { x0: number; y0: number; x1: number; y1: number }) => { const q = [{ x: r.x0, y: r.y0 }, { x: r.x1, y: r.y0 }, { x: r.x1, y: r.y1 }, { x: r.x0, y: r.y1 }]; q.forEach((a, i) => line(layer, a, q[(i + 1) % 4])); }; rect('PLOT', p); rect('SETBACK', p.inner); }
  out.push('0', 'ENDSEC', '0', 'EOF'); return out.join('\r\n') + '\r\n';
}

/** A clean SVG drawing of the plan, for printing or sharing. */
export function toSvg(m: Model, est: E.Estimate, title: string): string {
  const S = 100, pad = 120; const p = E.plotInfo(m); const pts = m.walls.flatMap(w => [w.a, w.b]); if (p.has) pts.push({ x: p.x0, y: p.y0 }, { x: p.x1, y: p.y1 }); if (!pts.length) pts.push({ x: 0, y: 0 }, { x: 5, y: 5 });
  const x0 = Math.min(...pts.map(q => q.x)) * S - pad, y0 = Math.min(...pts.map(q => q.y)) * S - pad, w = Math.max(...pts.map(q => q.x)) * S - x0 + pad, h = Math.max(...pts.map(q => q.y)) * S - y0 + pad + 60;
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); const wm = new Map(m.walls.map(q => [q.id, q])); let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${w} ${h}" font-family="Arial, sans-serif"><rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#fff"/>`;
  if (p.has) s += `<rect x="${p.x0 * S}" y="${p.y0 * S}" width="${(p.x1 - p.x0) * S}" height="${(p.y1 - p.y0) * S}" fill="none" stroke="#333" stroke-width="3"/><rect x="${p.inner.x0 * S}" y="${p.inner.y0 * S}" width="${Math.max(0, p.inner.x1 - p.inner.x0) * S}" height="${Math.max(0, p.inner.y1 - p.inner.y0) * S}" fill="none" stroke="#999" stroke-width="2" stroke-dasharray="14 9"/>`;
  est.geo.rooms.forEach(r => { s += `<text x="${r.c.x * S}" y="${r.c.y * S}" text-anchor="middle" font-size="20" font-weight="bold">${esc(r.name)}</text><text x="${r.c.x * S}" y="${r.c.y * S + 24}" text-anchor="middle" font-size="16" fill="#555">${r.carpet.toFixed(1)} m²</text>`; });
  m.walls.forEach(q => { s += `<line x1="${q.a.x * S}" y1="${q.a.y * S}" x2="${q.b.x * S}" y2="${q.b.y * S}" stroke="#222" stroke-width="${q.t * S}" stroke-linecap="square"/>`; });
  m.openings.forEach(o => { const q = wm.get(o.wallId); if (!q) return; const L = E.wlen(q), ux = (q.b.x - q.a.x) / L, uy = (q.b.y - q.a.y) / L, c = E.lerp(q.a, q.b, o.pos); const a = { x: (c.x - ux * o.w / 2) * S, y: (c.y - uy * o.w / 2) * S }, b = { x: (c.x + ux * o.w / 2) * S, y: (c.y + uy * o.w / 2) * S }; s += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#fff" stroke-width="${q.t * S + 3}"/><line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${o.kind === 'window' ? '#3a8fc4' : '#888'}" stroke-width="${o.kind === 'window' ? q.t * S * 0.5 : 3}"/>`; });
  est.st.columns.forEach(c => { s += `<rect x="${c.x * S - est.st.col[1] * S / 2}" y="${c.y * S - est.st.col[0] * S / 2}" width="${est.st.col[1] * S}" height="${est.st.col[0] * S}" fill="#000"/>`; });
  m.walls.filter(q => est.geo.ext.has(q.id) && E.wlen(q) >= 1).forEach(q => { const L = E.wlen(q), mx = (q.a.x + q.b.x) / 2, my = (q.a.y + q.b.y) / 2; let nx = -(q.b.y - q.a.y) / L, ny = (q.b.x - q.a.x) / L; if (est.geo.rooms.some(r => E.pointInPoly({ x: mx + nx * 0.4, y: my + ny * 0.4 }, r.poly))) { nx = -nx; ny = -ny; } s += `<text x="${(mx + nx * 0.45) * S}" y="${(my + ny * 0.45) * S}" text-anchor="middle" dominant-baseline="middle" font-size="15" fill="#444">${L.toFixed(2)} m</text>`; });
  s += `<text x="${x0 + 30}" y="${y0 + h - 28}" font-size="20" font-weight="bold">${esc(title)}</text><text x="${x0 + w - 30}" y="${y0 + h - 28}" font-size="16" text-anchor="end" fill="#555">${est.geo.rooms.length} rooms · ${est.geo.carpet.toFixed(1)} m² carpet · ${est.geo.footprint.toFixed(1)} m² built-up per floor · 1 square on screen = 1 m</text></svg>`;
  return s;
}
