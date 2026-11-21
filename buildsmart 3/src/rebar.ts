// Bar bending schedule and steel cutting plan. Deterministic: detailing rules in, bars and cuts out.
import type { Model, Geo, Struct, Zone } from './engine';

export type BarGroup = 'Foundation' | 'Plinth beam' | 'Columns' | 'Beams' | 'Slab' | 'Lintels';
export interface Bar { comp: string; group: BarGroup; mark: string; dia: number; n: number; len: number }
export const kgPerM = (d: number) => (d * d) / 162; // kg per metre for a bar of d mm
export const STOCK = 12; // metres, standard bar length
const UNIT = 0.05; // cut lengths are rounded up to 50 mm
const up5 = (v: number) => Math.ceil(v / UNIT - 1e-9) * UNIT;
const lap = (d: number) => 50 * d / 1000; // lap and anchorage length, 50 × diameter

/** Detailing rules used for the preliminary bar schedule (all in one place so they can be reviewed). */
export const DETAIL = {
  footing: { dia: 12, spacing: 0.15 }, raft: { dia: 12, spacing: 0.15 },
  plinth: { top: [2, 12], bottom: [2, 12], stirrup: 8, spacing: 0.2 },
  column: { tie: 8, spacing: 0.15, spacingSeismic: 0.1, steelPct: 1.0 },
  beam: { top: [2, 12], stirrup: 8, spacing: 0.15, spacingSeismic: 0.1 },
  slab: { main: 10, mainSp: 0.15, dist: 8, distSp: 0.15, top: 10, topSp: 0.3 },
  lintel: { bottom: [2, 10], top: [2, 8], stirrup: 8, spacing: 0.15 },
};

export function colBars(col: [number, number]): { n: number; dia: number } {
  const need = col[0] * col[1] * 1e6 * DETAIL.column.steelPct / 100; // mm2
  let dia = 16; let n = Math.max(4, Math.ceil(need / 201 / 2) * 2);
  if (n > 8) { dia = 20; n = Math.max(4, Math.ceil(need / 314 / 2) * 2); }
  return { n, dia };
}

export function barSchedule(m: Model, g: Geo, st: Struct): Bar[] {
  const out: Bar[] = []; const s = m.settings; const seismic = (m.site.zone as Zone) === 'IV' || m.site.zone === 'V';
  const add = (comp: string, group: BarGroup, mark: string, dia: number, n: number, len: number) => { if (n > 0 && len > 0.05) out.push({ comp, group, mark, dia, n: Math.round(n), len: up5(len) }); };
  const nCol = st.columns.length; const cb = colBars(st.col); const f = st.found;
  // foundation
  if (f.type === 'isolated') {
    const d = DETAIL.footing, per = Math.ceil(f.side / d.spacing) + 1;
    add('footing', 'Foundation', 'Footing mesh, both ways', d.dia, nCol * per * 2, f.side + 0.2);
  } else if (f.type === 'raft') {
    const d = DETAIL.raft, a = Math.sqrt(f.area), per = Math.ceil(a / d.spacing) + 1;
    add('footing', 'Foundation', 'Raft mesh, top and bottom, both ways', d.dia, per * 4, a + 0.2);
  } else {
    add('footing', 'Foundation', 'Pile main bars', 12, nCol * f.piles * 4, f.depth + 0.5);
    add('footing', 'Foundation', 'Pile rings', 8, nCol * f.piles * Math.ceil(f.depth / 0.2), Math.PI * 0.22 + 0.1);
    add('footing', 'Foundation', 'Pile cap mesh', 12, nCol * (Math.ceil(0.6 / 0.15) + 1) * 2, 0.8);
  }
  add('footing', 'Foundation', 'Column starter bars', cb.dia, nCol * cb.n, f.depth + lap(cb.dia));
  // plinth beam and floor beams run along every wall segment
  const segs = m.walls.map(w => Math.hypot(w.a.x - w.b.x, w.a.y - w.b.y)).filter(L => L > 0.3);
  const pl = DETAIL.plinth;
  segs.forEach(L => {
    add('plinth', 'Plinth beam', 'Top bars', pl.top[1], pl.top[0], L + lap(pl.top[1]));
    add('plinth', 'Plinth beam', 'Bottom bars', pl.bottom[1], pl.bottom[0], L + lap(pl.bottom[1]));
    add('plinth', 'Plinth beam', 'Stirrups', pl.stirrup, Math.ceil(L / pl.spacing) + 1, 2 * (0.23 + 0.3) - 0.2 + 0.16);
  });
  for (let fl = 1; fl <= s.floors; fl++) {
    // columns
    const ties = Math.ceil(s.f2f / (seismic ? DETAIL.column.spacingSeismic : DETAIL.column.spacing));
    add('col' + fl, 'Columns', 'Main bars', cb.dia, nCol * cb.n, s.f2f + lap(cb.dia));
    add('col' + fl, 'Columns', 'Ties', DETAIL.column.tie, nCol * ties, 2 * (st.col[0] + st.col[1]) - 0.16);
    // beams
    const b = DETAIL.beam, sp = seismic ? b.spacingSeismic : b.spacing;
    segs.forEach(L => {
      const bd = L <= 3 ? 12 : 16, bn = L > 4 ? 3 : 2;
      add('slab' + fl, 'Beams', 'Bottom bars', bd, bn, L + lap(bd));
      add('slab' + fl, 'Beams', 'Top bars', b.top[1], b.top[0], L + lap(b.top[1]));
      add('slab' + fl, 'Beams', 'Extra top bars at supports', b.top[1], 2, 0.25 * L + 0.3);
      add('slab' + fl, 'Beams', 'Stirrups', b.stirrup, Math.ceil(L / sp) + 1, 2 * (st.beamW + st.beamD) - 0.2 + 0.16);
    });
    // slab panels, one per room
    const d = DETAIL.slab;
    g.rooms.forEach(r => {
      const lx = r.minW + 0.23, ly = r.maxW + 0.23;
      add('slab' + fl, 'Slab', 'Bottom bars, short span', d.main, Math.ceil(ly / d.mainSp) + 1, lx + 0.2);
      add('slab' + fl, 'Slab', 'Bottom bars, long span', d.dist, Math.ceil(lx / d.distSp) + 1, ly + 0.2);
      add('slab' + fl, 'Slab', 'Top bars at supports', d.top, 2 * (Math.ceil(ly / d.topSp) + 1) + 2 * (Math.ceil(lx / d.topSp) + 1), 0.3 * lx + 0.25);
    });
    // lintels
    const l = DETAIL.lintel; const wm = new Map(m.walls.map(w => [w.id, w]));
    m.openings.forEach(o => {
      const w = wm.get(o.wallId); if (!w) return; const L = o.w + 0.3;
      add('lint' + fl, 'Lintels', 'Bottom bars', l.bottom[1], l.bottom[0], L);
      add('lint' + fl, 'Lintels', 'Top bars', l.top[1], l.top[0], L);
      add('lint' + fl, 'Lintels', 'Stirrups', l.stirrup, Math.ceil(L / l.spacing) + 1, 2 * (w.t + 0.15) - 0.1 + 0.16);
    });
  }
  return out;
}

export const barKg = (b: Bar) => b.n * b.len * kgPerM(b.dia);
export function kgByComp(bars: Bar[]): Record<string, number> { const o: Record<string, number> = {}; bars.forEach(b => { o[b.comp] = (o[b.comp] || 0) + barKg(b); }); return o; }

/** Merge identical bars so the schedule reads like a site bar list. */
export function mergedSchedule(bars: Bar[]): (Bar & { kg: number })[] {
  const map = new Map<string, Bar>();
  bars.forEach(b => { const k = [b.group, b.mark, b.dia, b.len.toFixed(2)].join('|'); const e = map.get(k); if (e) e.n += b.n; else map.set(k, { ...b, comp: '' }); });
  const order: BarGroup[] = ['Foundation', 'Plinth beam', 'Columns', 'Beams', 'Slab', 'Lintels'];
  return Array.from(map.values()).map(b => ({ ...b, kg: barKg(b) })).sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || a.mark.localeCompare(b.mark) || b.dia - a.dia || b.len - a.len);
}

// ---------- cutting stock ----------
export interface CutPattern { cuts: number[]; bars: number; offcut: number }
export interface CutResult { bars: number; naiveBars: number; minBars: number; patterns: CutPattern[]; needM: number; pieces: number; splices: number }

/** Pack required cut lengths into stock bars. Each new bar takes the longest piece left, then the best-filling
 *  combination of the remaining pieces (bounded knapsack), and the pattern is repeated while pieces last. */
export function cutStock(pieces: { len: number; n: number }[], stock = STOCK, lapLen = 0): CutResult {
  const cap = Math.round(stock / UNIT); const rem = new Map<number, number>(); let splices = 0;
  pieces.forEach(p => {
    if (p.n <= 0 || p.len <= 0) return; let li = Math.round(up5(p.len) / UNIT); let n = Math.round(p.n);
    if (li > cap) { // longer than a stock bar: split into equal parts joined by laps
      const lapU = Math.round(up5(lapLen) / UNIT); const k = Math.ceil((li - lapU) / (cap - lapU)); li = Math.ceil((li + (k - 1) * lapU) / k); n = n * k; splices += Math.round(p.n) * (k - 1);
    }
    rem.set(li, (rem.get(li) || 0) + n);
  });
  let total = 0, count = 0, naiveBars = 0;
  rem.forEach((n, li) => { total += n * li; count += n; naiveBars += Math.ceil(n / Math.floor(cap / li)); });
  const patterns: CutPattern[] = []; let bars = 0;
  while (true) {
    const lens = Array.from(rem.keys()).filter(k => (rem.get(k) || 0) > 0).sort((a, b) => b - a);
    if (!lens.length) break;
    const first = lens[0]; const c = cap - first;
    const reach = new Uint8Array(c + 1); const from = new Int32Array(c + 1); reach[0] = 1;
    for (const li of lens) {
      if (li > c) continue; const avail = (rem.get(li) || 0) - (li === first ? 1 : 0); const copies = Math.min(avail, Math.floor(c / li));
      for (let k = 0; k < copies; k++) { let any = false; for (let w = c; w >= li; w--) if (!reach[w] && reach[w - li]) { reach[w] = 1; from[w] = li; any = true; } if (!any) break; }
    }
    let best = c; while (best > 0 && !reach[best]) best--;
    const cuts = [first]; for (let w = best; w > 0; w -= from[w]) cuts.push(from[w]);
    const need = new Map<number, number>(); cuts.forEach(l => need.set(l, (need.get(l) || 0) + 1));
    let times = Infinity; need.forEach((k, l) => { times = Math.min(times, Math.floor((rem.get(l) || 0) / k)); });
    times = Math.max(1, times); need.forEach((k, l) => rem.set(l, (rem.get(l) || 0) - k * times));
    patterns.push({ cuts: cuts.sort((a, b) => b - a).map(u => +(u * UNIT).toFixed(2)), bars: times, offcut: +((cap - first - best) * UNIT).toFixed(2) }); bars += times;
  }
  return { bars, naiveBars, minBars: Math.ceil(total / cap), patterns: patterns.sort((a, b) => b.bars - a.bars), needM: total * UNIT, pieces: count, splices };
}

export interface CutPlan extends CutResult { dia: number; kgNeed: number; kgBuy: number; kgNaive: number; wastePct: number; naivePct: number; reusableM: number }
export function cuttingPlan(bars: Bar[]): { plans: CutPlan[]; kgNeed: number; kgBuy: number; kgNaive: number; wastePct: number; naivePct: number; barsTotal: number } {
  const byDia = new Map<number, { len: number; n: number }[]>();
  bars.forEach(b => { if (!byDia.has(b.dia)) byDia.set(b.dia, []); byDia.get(b.dia)!.push({ len: b.len, n: b.n }); });
  const plans: CutPlan[] = [];
  Array.from(byDia.keys()).sort((a, b) => a - b).forEach(dia => {
    const r = cutStock(byDia.get(dia)!, STOCK, lap(dia)); const w = kgPerM(dia);
    const reusableM = r.patterns.reduce((a, p) => a + (p.offcut >= 1 ? p.offcut * p.bars : 0), 0);
    plans.push({ ...r, dia, kgNeed: r.needM * w, kgBuy: r.bars * STOCK * w, kgNaive: r.naiveBars * STOCK * w, wastePct: r.bars ? (1 - r.needM / (r.bars * STOCK)) * 100 : 0, naivePct: r.naiveBars ? (1 - r.needM / (r.naiveBars * STOCK)) * 100 : 0, reusableM });
  });
  const sum = (f: (p: CutPlan) => number) => plans.reduce((a, p) => a + f(p), 0);
  const kgNeed = sum(p => p.kgNeed), kgBuy = sum(p => p.kgBuy), kgNaive = sum(p => p.kgNaive);
  return { plans, kgNeed, kgBuy, kgNaive, wastePct: kgBuy ? (1 - kgNeed / kgBuy) * 100 : 0, naivePct: kgNaive ? (1 - kgNeed / kgNaive) * 100 : 0, barsTotal: sum(p => p.bars) };
}
