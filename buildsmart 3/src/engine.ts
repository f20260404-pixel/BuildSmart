// BuildSmart engine: every number in the app comes from this file. No AI in here.

import { barSchedule, kgByComp, type Bar } from './rebar';
import * as RU from './rules';

export type Pt = { x: number; y: number };
export type MatKey = 'clay' | 'flyash' | 'aac';
export type RoomType = 'bedroom' | 'living' | 'kitchen' | 'bath' | 'corridor' | 'other';
export interface Wall { id: string; a: Pt; b: Pt; t: number; mat: MatKey }
export interface Opening { id: string; wallId: string; kind: 'door' | 'window'; pos: number; w: number; h: number }
export interface Label { x: number; y: number; name: string; type: RoomType }
export type Grade = 'M20' | 'M25';
export type Zone = 'II' | 'III' | 'IV' | 'V';
export type SoilKey = 'rock' | 'murum' | 'stiffclay' | 'medclay' | 'softclay' | 'sand' | 'blackcotton' | 'filled';
export type ClimateKey = 'warm_humid' | 'hot_dry' | 'composite' | 'temperate' | 'cold';

export interface Model {
  walls: Wall[]; openings: Opening[]; labels: Label[];
  settings: { floors: number; f2f: number; slabT: number | null; grade: Grade; mortar: number; steelFromBars?: boolean };
  site: {
    city: string; zone: Zone; soil: SoilKey; sbc: number; soilSource: 'presumptive' | 'report'; waterTable: number | null;
    plotArea: number; fsi: number; maxHeight: number; maxCoverage: number; climate: ClimateKey; northDeg: number;
    plotW?: number; plotD?: number; front?: Side; roadWidth?: number; area?: 'island' | 'suburbs'; centre?: boolean; gapFront?: number; gapLeft?: number;
  };
  prices: Record<string, { label: string; unit: string; v1: number; v2: number | null }>;
  labour: Record<string, { label: string; unit: string; trade: Trade; skH: number; hpH: number; skRate: number; hpRate: number }>;
  allow: { electrical: number; plumbing: number; waterproofing: number; flooring: number; painting: number; door: number; window: number; shutterHire: number; contingencyPct: number; ohpPct: number };
  crew: { masons: number; helpers: number; barbenders: number; carpenters: number; hoursPerDay: number; startDate: string };
  buffer: { crew: 'new' | 'average' | 'expert'; monsoon: boolean; storage: 'covered' | 'open'; rebarOpt: boolean };
  rules: Record<string, number>;
  quotes: Quote[];
  tenderMode: 'decided' | 'choose';
  decidedQuoteId: string | null;
  owner: { budget: number; notes: string };
  stock?: StockEntry[]; expenses?: Expense[];
}
export interface StockEntry { id: string; mat: string; type: 'ordered' | 'received' | 'issued'; qty: number; price: number | null; date: string; note: string }
export interface Expense { id: string; date: string; desc: string; amount: number; reason: 'urgent' | 'price' | 'rework' | 'other' }
export type Side = 'top' | 'bottom' | 'left' | 'right';
export type Trade = 'mason' | 'barbender' | 'carpenter' | 'helper';
export interface Quote { id: string; name: string; type: 'with_material' | 'labour_only'; weeks: number; source: string; received: string; rates: Record<string, number | null> }

let _id = 0;
export const uid = (p = 'w') => p + (++_id).toString(36) + Math.random().toString(36).slice(2, 6);
const r2 = (v: number) => Math.round(v * 100) / 100;
export const rp = (p: Pt): Pt => ({ x: r2(p.x), y: r2(p.y) });
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
export const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const key = (p: Pt) => r2(p.x).toFixed(2) + ',' + r2(p.y).toFixed(2);
export const wlen = (w: Wall) => dist(w.a, w.b);
const up = (v: number, step: number) => Math.ceil(v / step - 1e-9) * step;

// ---------- reference data (all editable defaults; see the report for sources) ----------
export const MATS: Record<MatKey, { name: string; short: string; unitsPerM3: number; mortarFrac: number; density: number; priceKey: string; byVolume: boolean; thick: number[]; color: string }> = {
  clay: { name: 'Clay brick', short: 'Clay', unitsPerM3: 408, mortarFrac: 0.226, density: 19, priceKey: 'clay', byVolume: false, thick: [0.23, 0.115], color: '#b5532f' },
  flyash: { name: 'Fly-ash brick', short: 'Fly-ash', unitsPerM3: 408, mortarFrac: 0.226, density: 18, priceKey: 'flyash', byVolume: false, thick: [0.23, 0.115], color: '#7d8590' },
  aac: { name: 'AAC block', short: 'AAC', unitsPerM3: 0, mortarFrac: 0.063, density: 7.5, priceKey: 'aac', byVolume: true, thick: [0.2, 0.15, 0.1], color: '#3f8f8a' },
};
export const CONC: Record<string, { c: number; s: number; a: number }> = { M15: { c: 1, s: 2, a: 4 }, M20: { c: 1, s: 1.5, a: 3 }, M25: { c: 1, s: 1, a: 2 } };
export const CITIES: Record<string, { zone: Zone; climate: ClimateKey }> = {
  Mumbai: { zone: 'III', climate: 'warm_humid' }, Pune: { zone: 'III', climate: 'warm_humid' }, Delhi: { zone: 'IV', climate: 'composite' },
  Bengaluru: { zone: 'II', climate: 'temperate' }, Chennai: { zone: 'III', climate: 'warm_humid' }, Kolkata: { zone: 'III', climate: 'warm_humid' },
  Hyderabad: { zone: 'II', climate: 'composite' }, Ahmedabad: { zone: 'III', climate: 'hot_dry' }, Jaipur: { zone: 'II', climate: 'hot_dry' },
  Lucknow: { zone: 'III', climate: 'composite' }, Patna: { zone: 'IV', climate: 'composite' }, Chandigarh: { zone: 'IV', climate: 'composite' },
  Dehradun: { zone: 'IV', climate: 'composite' }, Guwahati: { zone: 'V', climate: 'warm_humid' }, Srinagar: { zone: 'V', climate: 'cold' }, Bhuj: { zone: 'V', climate: 'hot_dry' },
};
export const ZONE: Record<Zone, { Z: number; steel: number; minCol: number }> = {
  II: { Z: 0.10, steel: 1.0, minCol: 0.23 }, III: { Z: 0.16, steel: 1.0, minCol: 0.23 }, IV: { Z: 0.24, steel: 1.1, minCol: 0.3 }, V: { Z: 0.36, steel: 1.2, minCol: 0.3 },
};
export const SOILS: Record<SoilKey, { name: string; sbc: number; depth: number }> = {
  rock: { name: 'Soft rock', sbc: 450, depth: 0.9 }, murum: { name: 'Hard murum / dense gravel', sbc: 300, depth: 1.2 },
  stiffclay: { name: 'Stiff clay', sbc: 250, depth: 1.5 }, medclay: { name: 'Medium clay', sbc: 150, depth: 1.5 },
  softclay: { name: 'Soft clay', sbc: 100, depth: 1.8 }, sand: { name: 'Medium sand', sbc: 250, depth: 1.5 },
  blackcotton: { name: 'Black cotton (expansive)', sbc: 130, depth: 3.5 }, filled: { name: 'Filled-up ground', sbc: 75, depth: 2.0 },
};
export const VENT_RATIO: Record<ClimateKey, number> = { warm_humid: 1 / 6, hot_dry: 1 / 10, composite: 1 / 8, temperate: 1 / 8, cold: 1 / 12 };
const STEEL = { footing: 80, column: 180, beam: 140, slab: 90, plinth: 110, lintel: 90 }; // kg per m3 of concrete, planning rules
const COLS: [number, number][] = [[0.23, 0.3], [0.23, 0.38], [0.23, 0.45], [0.3, 0.3], [0.3, 0.38], [0.3, 0.45], [0.3, 0.6], [0.38, 0.6], [0.45, 0.6], [0.45, 0.75]];
export const ROOM_TYPES: Record<RoomType, string> = { bedroom: 'Bedroom', living: 'Living / dining', kitchen: 'Kitchen', bath: 'Bath / WC', corridor: 'Passage', other: 'Other' };

// ---------- geometry ----------
function paramOn(w: Wall, p: Pt): number | null {
  const dx = w.b.x - w.a.x, dy = w.b.y - w.a.y, L2 = dx * dx + dy * dy;
  if (L2 < 1e-9) return null;
  const t = ((p.x - w.a.x) * dx + (p.y - w.a.y) * dy) / L2;
  const q = { x: w.a.x + dx * t, y: w.a.y + dy * t };
  return dist(p, q) < 0.012 ? t : null;
}
function cross(w: Wall, v: Wall): number | null {
  const d1x = w.b.x - w.a.x, d1y = w.b.y - w.a.y, d2x = v.b.x - v.a.x, d2y = v.b.y - v.a.y;
  const den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((v.a.x - w.a.x) * d2y - (v.a.y - w.a.y) * d2x) / den;
  const u = ((v.a.x - w.a.x) * d1y - (v.a.y - w.a.y) * d1x) / den;
  return t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6 ? t : null;
}
/** Split walls where they meet or cross, drop duplicates, and re-attach openings. */
export function normalize(walls: Wall[], openings: Opening[]): { walls: Wall[]; openings: Opening[] } {
  const src = walls.map(w => ({ ...w, a: rp(w.a), b: rp(w.b) })).filter(w => wlen(w) > 0.05);
  const opPts = openings.map(o => { const w = walls.find(x => x.id === o.wallId); return w ? { o, p: lerp(w.a, w.b, o.pos) } : null; }).filter(Boolean) as { o: Opening; p: Pt }[];
  const out: Wall[] = []; const seen = new Set<string>();
  for (const w of src) {
    const ts: number[] = [0, 1];
    for (const v of src) {
      if (v === w) continue;
      for (const p of [v.a, v.b]) { const t = paramOn(w, p); if (t !== null && t > 1e-6 && t < 1 - 1e-6) ts.push(t); }
      const x = cross(w, v); if (x !== null) ts.push(x);
    }
    ts.sort((a, b) => a - b);
    const pts: Pt[] = [];
    for (const t of ts) { const p = rp(lerp(w.a, w.b, t)); if (!pts.length || dist(pts[pts.length - 1], p) > 0.03) pts.push(p); }
    for (let i = 0; i < pts.length - 1; i++) {
      const k = [key(pts[i]), key(pts[i + 1])].sort().join('|');
      if (seen.has(k)) continue; seen.add(k);
      out.push({ ...w, id: i === 0 ? w.id : uid('w'), a: pts[i], b: pts[i + 1] });
    }
  }
  const ops: Opening[] = [];
  for (const { o, p } of opPts) {
    let best: Wall | null = null, bt = 0, bd = 0.08;
    for (const w of out) {
      const L = wlen(w), dx = w.b.x - w.a.x, dy = w.b.y - w.a.y;
      const t = ((p.x - w.a.x) * dx + (p.y - w.a.y) * dy) / (L * L);
      if (t < 0 || t > 1) continue;
      const d = dist(p, lerp(w.a, w.b, t)); if (d < bd) { bd = d; best = w; bt = t; }
    }
    if (best && wlen(best) > o.w + 0.1) {
      const half = o.w / 2 / wlen(best);
      ops.push({ ...o, wallId: best.id, pos: Math.min(1 - half, Math.max(half, bt)) });
    }
  }
  return { walls: out, openings: ops };
}
export function nearestWall(walls: Wall[], p: Pt, tol = 0.3): { wall: Wall; t: number } | null {
  let best: { wall: Wall; t: number } | null = null, bd = tol;
  for (const w of walls) {
    const L = wlen(w); if (L < 0.01) continue;
    const dx = w.b.x - w.a.x, dy = w.b.y - w.a.y;
    const t = Math.min(1, Math.max(0, ((p.x - w.a.x) * dx + (p.y - w.a.y) * dy) / (L * L)));
    const d = dist(p, lerp(w.a, w.b, t)); if (d < bd) { bd = d; best = { wall: w, t }; }
  }
  return best;
}
export function pointInPoly(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
export interface Room { id: string; poly: Pt[]; wallIds: string[]; area: number; carpet: number; name: string; type: RoomType; minW: number; maxW: number; c: Pt; labelled: boolean }
export interface Geo { rooms: Room[]; ext: Set<string>; footprint: number; carpet: number; wallLen: number; extLen: number; nodes: { p: Pt; deg: number; straight: boolean }[] }

export function geometry(m: Model): Geo {
  const nodes = new Map<string, { p: Pt; out: { to: string; wall: Wall; ang: number }[] }>();
  const nd = (p: Pt) => { const k = key(p); if (!nodes.has(k)) nodes.set(k, { p, out: [] }); return nodes.get(k)!; };
  for (const w of m.walls) {
    const ka = key(w.a), kb = key(w.b); if (ka === kb) continue;
    nd(w.a).out.push({ to: kb, wall: w, ang: Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x) });
    nd(w.b).out.push({ to: ka, wall: w, ang: Math.atan2(w.a.y - w.b.y, w.a.x - w.b.x) });
  }
  nodes.forEach(n => n.out.sort((a, b) => a.ang - b.ang));
  const visited = new Set<string>(); const faces: { poly: Pt[]; wallIds: string[]; area: number }[] = [];
  nodes.forEach((n, k0) => {
    for (const e0 of n.out) {
      const startKey = k0 + '>' + e0.to;
      if (visited.has(startKey)) continue;
      const poly: Pt[] = []; const wallIds: string[] = [];
      let u = k0, v = e0.to, wall = e0.wall, guard = 0;
      while (guard++ < 5000) {
        visited.add(u + '>' + v); poly.push(nodes.get(u)!.p); wallIds.push(wall.id);
        const nv = nodes.get(v)!; const i = nv.out.findIndex(o => o.to === u);
        const nx = nv.out[(i - 1 + nv.out.length) % nv.out.length];
        u = v; v = nx.to; wall = nx.wall;
        if (u + '>' + v === startKey) break;
      }
      let A = 0; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; A += a.x * b.y - b.x * a.y; }
      faces.push({ poly, wallIds, area: A / 2 });
    }
  });
  const wmap = new Map(m.walls.map(w => [w.id, w]));
  const useCount = new Map<string, number>();
  const rooms: Room[] = [];
  const used = new Set<number>();
  faces.filter(f => f.area > 0.3).forEach((f, idx) => {
    const ids = Array.from(new Set(f.wallIds));
    ids.forEach(id => useCount.set(id, (useCount.get(id) || 0) + 1));
    let per = 0, tsum = 0; ids.forEach(id => { const w = wmap.get(id)!; per += wlen(w) * w.t / 2; tsum += w.t; });
    const tavg = tsum / ids.length;
    const xs = f.poly.map(p => p.x), ys = f.poly.map(p => p.y);
    const bw = Math.max(...xs) - Math.min(...xs) - tavg, bh = Math.max(...ys) - Math.min(...ys) - tavg;
    let cx = 0, cy = 0; for (let i = 0; i < f.poly.length; i++) { const a = f.poly[i], b = f.poly[(i + 1) % f.poly.length]; const cr = a.x * b.y - b.x * a.y; cx += (a.x + b.x) * cr; cy += (a.y + b.y) * cr; }
    const c = { x: cx / (6 * f.area), y: cy / (6 * f.area) };
    let name = 'Room ' + (idx + 1), type: RoomType = 'other', labelled = false;
    m.labels.forEach((l, li) => { if (!used.has(li) && !labelled && pointInPoly(l, f.poly)) { name = l.name; type = l.type; labelled = true; used.add(li); } });
    rooms.push({ id: 'r' + idx + '_' + key(c), poly: f.poly, wallIds: ids, area: f.area, carpet: Math.max(0, f.area - per), name, type, minW: Math.max(0, Math.min(bw, bh)), maxW: Math.max(bw, bh), c, labelled });
  });
  const ext = new Set<string>(); let extLen = 0, wallLen = 0;
  m.walls.forEach(w => { wallLen += wlen(w); if (useCount.get(w.id) === 1) { ext.add(w.id); extLen += wlen(w); } });
  let footprint = rooms.reduce((s, r) => s + r.area, 0);
  ext.forEach(id => { const w = wmap.get(id)!; footprint += wlen(w) * w.t / 2; });
  const nl: Geo['nodes'] = [];
  nodes.forEach(n => {
    let straight = false;
    if (n.out.length === 2) { const d = Math.abs(Math.abs(n.out[0].ang - n.out[1].ang) - Math.PI); straight = d < 0.05; }
    nl.push({ p: n.p, deg: n.out.length, straight });
  });
  return { rooms, ext, footprint, carpet: rooms.reduce((s, r) => s + r.carpet, 0), wallLen, extLen, nodes: nl };
}

// ---------- structure + foundation sizing ----------
export interface Struct {
  slabT: number; slabBasis: string; columns: Pt[]; col: [number, number]; colBasis: string; beamW: number; beamD: number; beamBasis: string;
  floorLoad: number; colLoad: number; found: { type: 'isolated' | 'raft' | 'pile'; side: number; thick: number; depth: number; piles: number; basis: string; area: number };
  confidence: 'high' | 'medium' | 'low'; notes: string[];
}
export function structure(m: Model, g: Geo): Struct {
  const s = m.settings, z = ZONE[m.site.zone];
  const spans = g.rooms.map(r => r.minW + 0.23); const maxShort = spans.length ? Math.max(...spans) : 3;
  const longs = g.rooms.map(r => r.maxW + 0.23); const maxLong = longs.length ? Math.max(...longs) : 4;
  const recSlab = Math.min(0.2, Math.max(0.1, up(maxShort / 32, 0.005)));
  const slabT = s.slabT ?? recSlab;
  const slabBasis = `${Math.round(recSlab * 1000)} mm from the longest short span of ${maxShort.toFixed(1)} m (span ÷ 32, two-way continuous slab, IS 456 deflection control)`;
  // columns at wall corners and junctions, at least 1.2 m apart
  const cols: Pt[] = [];
  g.nodes.filter(n => n.deg >= 2 && !n.straight).sort((a, b) => b.deg - a.deg).forEach(n => { if (!cols.some(c => dist(c, n.p) < 1.8)) cols.push(n.p); });
  const beamD = Math.min(0.75, Math.max(0.3, up(maxLong / 12, 0.025)));
  const beamW = 0.23;
  const beamBasis = `${Math.round(beamW * 1000)} × ${Math.round(beamD * 1000)} mm from the longest span of ${maxLong.toFixed(1)} m (span ÷ 12)`;
  // loads per floor, kN
  let wallW = 0; const h = Math.max(0.5, s.f2f - beamD);
  m.walls.forEach(w => { wallW += wlen(w) * h * w.t * MATS[w.mat].density; });
  const slabW = g.footprint * slabT * 25, fin = g.footprint * 1.5, live = g.footprint * 2.0;
  const beamWt = g.wallLen * beamW * Math.max(0, beamD - slabT) * 25;
  const n = Math.max(1, cols.length);
  let col: [number, number] = COLS[0]; let colLoad = 0;
  for (let pass = 0; pass < 2; pass++) {
    const colW = n * col[0] * col[1] * s.f2f * 25;
    const floorLoad = slabW + fin + live + wallW + beamWt + colW;
    colLoad = (floorLoad * s.floors / n) * 1.25;
    const fck = s.grade === 'M25' ? 25 : 20;
    const need = (1.5 * colLoad * 1000) / (0.4 * fck + 0.67 * 500 * 0.01) / 1e6; // m2, 1% steel, axial with planning margin
    col = COLS.find(c => c[0] >= z.minCol - 1e-9 && c[0] * c[1] >= need) || COLS[COLS.length - 1];
  }
  const colW = n * col[0] * col[1] * s.f2f * 25;
  const floorLoad = slabW + fin + live + wallW + beamWt + colW;
  colLoad = (floorLoad * s.floors / n) * 1.25;
  const colBasis = `${Math.round(col[0] * 1000)} × ${Math.round(col[1] * 1000)} mm for about ${Math.round(colLoad)} kN per column over ${s.floors} floor${s.floors > 1 ? 's' : ''}` + (z.minCol > 0.23 ? `; 300 mm minimum width for seismic zone ${m.site.zone} (IS 13920)` : '');
  // foundation
  const soil = SOILS[m.site.soil], sbc = Math.max(20, m.site.sbc);
  let side = Math.max(1.0, up(Math.sqrt((1.1 * colLoad) / sbc), 0.1));
  let thick = Math.max(0.3, up(side * 0.25, 0.05));
  let type: Struct['found']['type'] = 'isolated', piles = 0, area = n * side * side, basis = '';
  const notes: string[] = [];
  if (m.site.soil === 'blackcotton') {
    type = 'pile'; piles = Math.max(1, Math.ceil(colLoad / 160)); side = 0.3; thick = 0.45; area = 0;
    basis = `Under-reamed piles, ${piles} per column (300 mm dia, 3.5 m deep, about 160 kN each). Black cotton soil swells and shrinks with moisture, so shallow footings would move (IS 2911 Part 3).`;
  } else if (area > 0.5 * g.footprint) {
    type = 'raft'; thick = Math.max(0.3, up(0.2 + 0.05 * s.floors, 0.05)); area = g.footprint * 1.1; side = 0;
    basis = `Raft, ${Math.round(thick * 1000)} mm thick. Separate footings would need ${Math.round((n * Math.pow(Math.max(1.0, up(Math.sqrt((1.1 * colLoad) / sbc), 0.1)), 2) / g.footprint) * 100)} % of the building's footprint at ${sbc} kN/m², so they would overlap (IS 2950).`;
  } else {
    basis = `Isolated footings ${side.toFixed(1)} × ${side.toFixed(1)} m, ${Math.round(thick * 1000)} mm thick, ${soil.depth.toFixed(1)} m deep: ${Math.round(colLoad)} kN ÷ ${sbc} kN/m² bearing capacity, plus 10 % for the footing's own weight.`;
  }
  if (m.site.waterTable !== null && m.site.waterTable < soil.depth + 0.5) notes.push(`Water table at ${m.site.waterTable} m is close to the foundation level: add waterproofing to the plinth and use dewatering during excavation.`);
  if (m.site.zone === 'IV' || m.site.zone === 'V') notes.push(`Seismic zone ${m.site.zone}: column width kept at 300 mm or more and steel allowance raised ${Math.round((z.steel - 1) * 100)} % for ductile detailing (IS 13920).`);
  const confidence = m.site.soilSource === 'report' ? 'high' : 'low';
  return { slabT, slabBasis, columns: cols, col, colBasis, beamW, beamD, beamBasis, floorLoad, colLoad, found: { type, side, thick, depth: soil.depth, piles, basis, area }, confidence, notes };
}

// ---------- quantities ----------
export interface Comp {
  key: string; label: string; group: 'excavation' | 'pcc' | 'rcc' | 'masonry' | 'plaster'; floor?: number;
  excav?: number; conc?: number; grade?: string; steel?: number; shutter?: number; mas?: Partial<Record<MatKey, number>>; pIn?: number; pOut?: number;
}
export interface Mats { cement: number; sand: number; agg: number; clay: number; flyash: number; aac: number; steel: number }
const zeroM = (): Mats => ({ cement: 0, sand: 0, agg: 0, clay: 0, flyash: 0, aac: 0, steel: 0 });
const BAG = 0.0347; // m3 per 50 kg bag
export function compMats(c: Comp, m: Model): Mats {
  const o = zeroM();
  if (c.conc && c.grade) { const mix = CONC[c.grade], sum = mix.c + mix.s + mix.a, dry = c.conc * 1.54; o.cement += (dry * mix.c / sum) / BAG; o.sand += dry * mix.s / sum; o.agg += dry * mix.a / sum; }
  if (c.steel) o.steel += c.steel;
  if (c.mas) (Object.keys(c.mas) as MatKey[]).forEach(k => {
    const v = c.mas![k] || 0, mt = MATS[k];
    if (mt.byVolume) o.aac += v * (1 - mt.mortarFrac); else (o as any)[k] += v * mt.unitsPerM3;
    const dry = v * mt.mortarFrac * 1.33; o.cement += (dry / (1 + m.settings.mortar)) / BAG; o.sand += dry * m.settings.mortar / (1 + m.settings.mortar);
  });
  const pv = ((c.pIn || 0) * 0.012 + (c.pOut || 0) * 0.02) * 1.33;
  if (pv) { o.cement += (pv / 5) / BAG; o.sand += pv * 4 / 5; }
  return o;
}
export function compLabour(c: Comp, m: Model): { hours: Record<Trade, number>; cost: number } {
  const hours: Record<Trade, number> = { mason: 0, barbender: 0, carpenter: 0, helper: 0 }; let cost = 0;
  const add = (k: string, q: number) => { const l = m.labour[k]; if (!l || !q) return; hours[l.trade] += q * l.skH; hours.helper += q * l.hpH; cost += q * (l.skH * l.skRate + l.hpH * l.hpRate); };
  add('excav', c.excav || 0); add('concrete', c.conc || 0); add('steel', c.steel || 0); add('shutter', c.shutter || 0);
  if (c.mas) { add('brick', (c.mas.clay || 0) + (c.mas.flyash || 0)); add('block', c.mas.aac || 0); }
  add('plaster', (c.pIn || 0) + (c.pOut || 0));
  return { hours, cost };
}
export const price = (m: Model, k: string) => { const p = m.prices[k]; if (!p) return 0; return p.v2 !== null && p.v2 > 0 && p.v2 < p.v1 ? p.v2 : p.v1; };
export const vendorOf = (m: Model, k: string) => { const p = m.prices[k]; return p && p.v2 !== null && p.v2 > 0 && p.v2 < p.v1 ? 2 : 1; };

export interface MatLine { key: string; label: string; unit: string; net: number; bufPct: number; why: string; order: number; price: number; cost: number; naive: number }
export interface BoqLine { key: string; label: string; unit: string; qty: number; mat: number; lab: number; rate: number; amount: number; labRate: number }
export interface Estimate {
  geo: Geo; st: Struct; comps: Comp[]; mats: Mats; matLines: MatLine[]; boq: BoqLine[]; packages: { key: string; label: string; basis: string; amount: number }[];
  materialCost: number; labourCost: number; bufferCost: number; naiveBufferCost: number; matNetCost: number; shutterCost: number; ohpAmt: number; finishes: number; boqTotal: number; civil: number; other: number; contingency: number; total: number;
  builtUp: number; perSqft: number; height: number; doors: number; windows: number; plasterArea: number; concVol: number; bars: Bar[]; steelThumb: number; steelBars: number;
}
function bufferFor(k: string, m: Model): { pct: number; why: string } {
  const b = m.buffer; const base: Record<string, number> = { cement: 2, sand: 7, agg: 4, clay: 4, flyash: 4, aac: 2.5, steel: 4 };
  let pct = base[k] ?? 3; const why: string[] = [`base ${pct} %`];
  const crewAdj = b.crew === 'new' ? 1.5 : b.crew === 'expert' ? -1 : 0;
  if (crewAdj && ['clay', 'flyash', 'aac', 'steel'].includes(k)) { pct += crewAdj; why.push(`${crewAdj > 0 ? '+' : ''}${crewAdj} % ${b.crew} crew`); }
  if (b.monsoon && k === 'cement') { pct += 1.5; why.push('+1.5 % monsoon damp'); }
  if (b.monsoon && k === 'sand') { pct += 3; why.push('+3 % monsoon wash-out'); }
  if (b.storage === 'open' && k === 'cement') { pct += 1; why.push('+1 % open storage'); }
  if (b.storage === 'open' && (k === 'sand' || k === 'agg')) { pct += 2; why.push('+2 % open storage'); }
  if (k === 'steel' && b.rebarOpt) { pct = 1.5; why.length = 0; why.push('1.5 % after cutting-plan optimisation'); }
  return { pct: Math.max(0.5, pct), why: why.join(', ') };
}
const PACK: Record<string, number> = { cement: 1, sand: 0.5, agg: 0.5, clay: 500, flyash: 500, aac: 0.5, steel: 50 };

export function estimate(m: Model): Estimate {
  const g = geometry(m), st = structure(m, g), s = m.settings, z = ZONE[m.site.zone];
  const comps: Comp[] = []; const n = st.columns.length; const f = st.found;
  const wmap = new Map(m.walls.map(w => [w.id, w]));
  // foundation
  if (f.type === 'isolated') {
    comps.push({ key: 'excav', label: 'Excavation', group: 'excavation', excav: n * Math.pow(f.side + 0.6, 2) * f.depth });
    comps.push({ key: 'pcc', label: 'PCC bed (M15)', group: 'pcc', conc: n * Math.pow(f.side + 0.2, 2) * 0.1, grade: 'M15' });
    const v = n * f.side * f.side * f.thick + n * st.col[0] * st.col[1] * Math.max(0, f.depth - f.thick);
    comps.push({ key: 'footing', label: 'Footings and column stubs', group: 'rcc', conc: v, grade: s.grade, steel: v * STEEL.footing * z.steel, shutter: n * 4 * f.side * f.thick });
  } else if (f.type === 'raft') {
    comps.push({ key: 'excav', label: 'Excavation', group: 'excavation', excav: f.area * f.depth });
    comps.push({ key: 'pcc', label: 'PCC bed (M15)', group: 'pcc', conc: f.area * 0.1, grade: 'M15' });
    const v = f.area * f.thick;
    comps.push({ key: 'footing', label: 'Raft foundation', group: 'rcc', conc: v, grade: s.grade, steel: v * 100 * z.steel, shutter: Math.sqrt(f.area) * 4 * f.thick });
  } else {
    const pv = n * f.piles * Math.PI * 0.15 * 0.15 * f.depth * 1.15;
    comps.push({ key: 'excav', label: 'Pile boring', group: 'excavation', excav: pv });
    comps.push({ key: 'pcc', label: 'PCC under pile caps (M15)', group: 'pcc', conc: n * 0.7 * 0.7 * 0.075, grade: 'M15' });
    const v = pv + n * 0.6 * 0.6 * f.thick;
    comps.push({ key: 'footing', label: 'Under-reamed piles and caps', group: 'rcc', conc: v, grade: s.grade, steel: v * 95 * z.steel, shutter: n * 4 * 0.6 * f.thick });
  }
  const pv = g.wallLen * 0.23 * 0.3;
  comps.push({ key: 'plinth', label: 'Plinth beam', group: 'rcc', conc: pv, grade: s.grade, steel: pv * STEEL.plinth * z.steel, shutter: g.wallLen * 2 * 0.3 });
  // per floor
  const hWall = Math.max(0.5, s.f2f - st.beamD);
  let doors = 0, windows = 0, plasterArea = 0;
  for (let fl = 1; fl <= s.floors; fl++) {
    const cv = n * st.col[0] * st.col[1] * s.f2f;
    comps.push({ key: 'col' + fl, label: `Columns, floor ${fl}`, group: 'rcc', floor: fl, conc: cv, grade: s.grade, steel: cv * STEEL.column * z.steel, shutter: n * 2 * (st.col[0] + st.col[1]) * s.f2f });
    const bv = g.wallLen * st.beamW * Math.max(0, st.beamD - st.slabT), sv = g.footprint * st.slabT;
    comps.push({ key: 'slab' + fl, label: `Beams and slab, floor ${fl}`, group: 'rcc', floor: fl, conc: bv + sv, grade: s.grade, steel: (bv * STEEL.beam + sv * STEEL.slab) * z.steel, shutter: g.footprint + g.wallLen * 2 * Math.max(0, st.beamD - st.slabT) });
    const mas: Partial<Record<MatKey, number>> = {}; let pIn = 0, pOut = 0, lint = 0;
    m.walls.forEach(w => {
      const L = wlen(w); let open = 0;
      m.openings.filter(o => o.wallId === w.id).forEach(o => { open += o.w * Math.min(o.h, hWall); lint += (o.w + 0.3) * w.t * 0.15; if (fl === 1) { if (o.kind === 'door') doors++; else windows++; } });
      const face = Math.max(0, L * hWall - open);
      mas[w.mat] = (mas[w.mat] || 0) + face * w.t;
      if (g.ext.has(w.id)) { pOut += face; pIn += face; } else pIn += 2 * face;
    });
    comps.push({ key: 'mas' + fl, label: `Masonry, floor ${fl}`, group: 'masonry', floor: fl, mas });
    comps.push({ key: 'lint' + fl, label: `Lintels, floor ${fl}`, group: 'rcc', floor: fl, conc: lint, grade: s.grade, steel: lint * STEEL.lintel, shutter: lint / 0.15 });
    comps.push({ key: 'pl' + fl, label: `Plaster, floor ${fl}`, group: 'plaster', floor: fl, pIn, pOut });
    plasterArea += pIn + pOut;
  }
  doors *= s.floors; windows *= s.floors;
  // steel: planning allowances by default, or the bar schedule when the user switches to it
  const bars = barSchedule(m, g, st); const byComp = kgByComp(bars);
  const steelThumb = comps.reduce((a, c) => a + (c.steel || 0), 0), steelBars = bars.reduce((a, b) => a + b.n * b.len * b.dia * b.dia / 162, 0);
  if (s.steelFromBars) comps.forEach(c => { if (c.steel !== undefined) c.steel = byComp[c.key] || 0; });
  // totals
  const mats = zeroM(); let labourCost = 0;
  const groupMat: Record<string, Mats> = {}; const groupLab: Record<string, number> = {}; const groupQty: Record<string, number> = {};
  const gk = (c: Comp) => c.group === 'rcc' ? 'rcc' : c.group;
  comps.forEach(c => {
    const cm = compMats(c, m), cl = compLabour(c, m);
    (Object.keys(mats) as (keyof Mats)[]).forEach(k => mats[k] += cm[k]);
    labourCost += cl.cost;
    const k = gk(c); groupMat[k] = groupMat[k] || zeroM(); (Object.keys(mats) as (keyof Mats)[]).forEach(q => groupMat[k][q] += cm[q]);
    groupLab[k] = (groupLab[k] || 0) + cl.cost;
  });
  const sum = (fn: (c: Comp) => number) => comps.reduce((a, c) => a + fn(c), 0);
  groupQty.excavation = sum(c => c.excav || 0);
  groupQty.pcc = sum(c => c.group === 'pcc' ? c.conc || 0 : 0);
  groupQty.rcc = sum(c => c.group === 'rcc' ? c.conc || 0 : 0);
  groupQty.steel = mats.steel;
  groupQty.masonry = sum(c => c.mas ? Object.values(c.mas).reduce((a, b) => a + (b || 0), 0) : 0);
  groupQty.plaster = plasterArea;
  const shutter = sum(c => c.shutter || 0);
  const names: Record<string, [string, string]> = { cement: ['Cement', 'bags'], sand: ['Sand', 'm³'], agg: ['Aggregate', 'm³'], clay: ['Clay bricks', 'nos'], flyash: ['Fly-ash bricks', 'nos'], aac: ['AAC blocks', 'm³'], steel: ['TMT steel', 'kg'] };
  const matLines: MatLine[] = []; let materialCost = 0, bufferCost = 0, naiveBufferCost = 0;
  (Object.keys(mats) as (keyof Mats)[]).forEach(k => {
    const net = mats[k]; if (net <= 0.0001) return;
    const b = bufferFor(k, m), pr = price(m, k);
    const order = up(net * (1 + b.pct / 100), PACK[k]); const naive = up(net * 1.1, PACK[k]);
    matLines.push({ key: k, label: names[k][0], unit: names[k][1], net, bufPct: b.pct, why: b.why, order, price: pr, cost: order * pr, naive });
    materialCost += order * pr; bufferCost += (order - net) * pr; naiveBufferCost += (naive - net) * pr;
  });
  const matCostOf = (mm: Mats) => (Object.keys(mm) as (keyof Mats)[]).reduce((a, k) => a + mm[k] * price(m, k), 0);
  const ohp = 1 + m.allow.ohpPct / 100;
  const steelOnly = (mm: Mats): Mats => ({ ...zeroM(), steel: mm.steel });
  const noSteel = (mm: Mats): Mats => ({ ...mm, steel: 0 });
  const steelLab = comps.reduce((a, c) => a + (c.steel || 0) * (m.labour.steel.skH * m.labour.steel.skRate + m.labour.steel.hpH * m.labour.steel.hpRate), 0);
  const boq: BoqLine[] = [];
  const line = (k: string, label: string, unit: string, qty: number, mat: number, lab: number) => { if (qty > 0.0001) boq.push({ key: k, label, unit, qty, mat, lab, rate: (mat + lab) * ohp / qty, amount: (mat + lab) * ohp, labRate: lab * ohp / qty }); };
  line('excav', 'Excavation for foundations', 'm³', groupQty.excavation, 0, groupLab.excavation || 0);
  line('pcc', 'Plain concrete bed, M15', 'm³', groupQty.pcc, matCostOf(groupMat.pcc || zeroM()), groupLab.pcc || 0);
  line('rcc', `Reinforced concrete, ${s.grade}, with shuttering`, 'm³', groupQty.rcc, matCostOf(noSteel(groupMat.rcc || zeroM())) + shutter * m.allow.shutterHire, (groupLab.rcc || 0) - steelLab);
  line('steel', 'TMT steel, cut, bent and fixed', 'kg', mats.steel, matCostOf(steelOnly(mats)), steelLab);
  line('masonry', `Masonry in cement mortar 1:${m.settings.mortar}`, 'm³', groupQty.masonry, matCostOf(groupMat.masonry || zeroM()), groupLab.masonry || 0);
  line('plaster', 'Plaster, 12 mm inside and 20 mm outside', 'm²', groupQty.plaster, matCostOf(groupMat.plaster || zeroM()), groupLab.plaster || 0);
  const floorArea = g.carpet * s.floors, builtUp = g.footprint * s.floors;
  line('flooring', 'Flooring', 'm²', floorArea, floorArea * m.allow.flooring / ohp, 0);
  line('painting', 'Painting', 'm²', plasterArea, plasterArea * m.allow.painting / ohp, 0);
  const wet = g.rooms.filter(r => r.type === 'bath').reduce((a, r) => a + r.carpet, 0) * s.floors;
  const packages = [
    { key: 'electrical', label: 'Electrical', basis: `${builtUp.toFixed(0)} m² built-up × ₹${m.allow.electrical}`, amount: builtUp * m.allow.electrical },
    { key: 'plumbing', label: 'Plumbing and sanitary', basis: `${builtUp.toFixed(0)} m² built-up × ₹${m.allow.plumbing}`, amount: builtUp * m.allow.plumbing },
    { key: 'waterproofing', label: 'Waterproofing', basis: `${(g.footprint + wet).toFixed(0)} m² terrace and wet areas × ₹${m.allow.waterproofing}`, amount: (g.footprint + wet) * m.allow.waterproofing },
    { key: 'doors', label: 'Doors', basis: `${doors} × ₹${m.allow.door}`, amount: doors * m.allow.door },
    { key: 'windows', label: 'Windows', basis: `${windows} × ₹${m.allow.window}`, amount: windows * m.allow.window },
  ];
  const shutterCost = shutter * m.allow.shutterHire;
  const finishes = floorArea * m.allow.flooring + plasterArea * m.allow.painting;
  const matNetCost = materialCost - bufferCost;
  const ohpAmt = (matNetCost + labourCost + shutterCost) * m.allow.ohpPct / 100;
  const boqTotal = boq.reduce((a, b) => a + b.amount, 0);
  const civil = boqTotal + bufferCost;
  const other = packages.reduce((a, p) => a + p.amount, 0);
  const contingency = (civil + other) * m.allow.contingencyPct / 100;
  const total = civil + other + contingency;
  return { geo: g, st, comps, mats, matLines, boq, packages, materialCost, labourCost, bufferCost, naiveBufferCost, matNetCost, shutterCost, ohpAmt, finishes, boqTotal, civil, other, contingency, total, builtUp, perSqft: builtUp > 0 ? total / (builtUp * 10.764) : 0, height: s.floors * s.f2f, doors, windows, plasterArea, concVol: groupQty.rcc + groupQty.pcc, bars, steelThumb, steelBars };
}

// ---------- schedule ----------
export interface Activity { key: string; label: string; days: number; start: number; crew: string; mats: Mats; wait?: boolean; note?: string; lab: number; shutter: number }
export interface DayPlan { day: number; date: string; iso: string; label: string; crew: string; mats: Mats; wait: boolean; batches: number; act: number }
export const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function schedule(m: Model, e: Estimate): { acts: Activity[]; days: DayPlan[]; totalDays: number; finish: string } {
  const c = m.crew; const acts: Activity[] = []; let t = 0;
  const cap: Record<Trade, number> = { mason: Math.max(1, c.masons), helper: Math.max(1, c.helpers), barbender: Math.max(1, c.barbenders), carpenter: Math.max(1, c.carpenters) };
  const add = (keys: string[], label: string) => {
    const cs = e.comps.filter(x => keys.includes(x.key)); if (!cs.length) return;
    const hrs: Record<Trade, number> = { mason: 0, barbender: 0, carpenter: 0, helper: 0 }; const mt = zeroM(); let lab = 0, shutter = 0;
    cs.forEach(x => { const l = compLabour(x, m); lab += l.cost; shutter += x.shutter || 0; (Object.keys(hrs) as Trade[]).forEach(k => hrs[k] += l.hours[k]); const cm = compMats(x, m); (Object.keys(mt) as (keyof Mats)[]).forEach(k => mt[k] += cm[k]); });
    let days = 1; let limit = 'helper' as Trade;
    (Object.keys(hrs) as Trade[]).forEach(k => { const d = hrs[k] / (cap[k] * c.hoursPerDay); if (d > days) { days = d; limit = k; } });
    days = Math.max(1, Math.ceil(days));
    const used = (Object.keys(hrs) as Trade[]).filter(k => hrs[k] > 0).map(k => `${Math.min(cap[k], Math.max(1, Math.ceil(hrs[k] / (days * c.hoursPerDay))))} ${k === 'barbender' ? 'bar bender' : k}${Math.ceil(hrs[k] / (days * c.hoursPerDay)) > 1 ? 's' : ''}`).join(', ');
    acts.push({ key: keys[0], label, days, start: t, crew: used, mats: mt, lab, shutter, note: `limited by ${limit === 'barbender' ? 'bar benders' : limit + 's'}` }); t += days;
  };
  const wait = (label: string, days: number) => { acts.push({ key: 'wait' + t, label, days, start: t, crew: 'curing only', mats: zeroM(), wait: true, lab: 0, shutter: 0 }); t += days; };
  add(['excav'], e.st.found.type === 'pile' ? 'Pile boring' : 'Excavation');
  add(['pcc', 'footing'], 'Foundation concrete'); wait('Foundation curing', 3);
  add(['plinth'], 'Plinth beam');
  for (let f = 1; f <= m.settings.floors; f++) { add(['col' + f], `Columns, floor ${f}`); add(['slab' + f], `Beams and slab, floor ${f}`); wait(`Slab curing, floor ${f}`, f === m.settings.floors ? 7 : 3); }
  for (let f = 1; f <= m.settings.floors; f++) add(['mas' + f, 'lint' + f], `Masonry, floor ${f}`);
  for (let f = 1; f <= m.settings.floors; f++) add(['pl' + f], `Plaster, floor ${f}`);
  const fin = Math.max(1, Math.ceil((e.geo.carpet * m.settings.floors) / (10 * cap.mason)) + Math.ceil(e.plasterArea / (30 * Math.max(2, cap.helper / 2))));
  acts.push({ key: 'finish', label: 'Flooring, painting and fittings', days: fin, start: t, crew: 'finishing crews', mats: zeroM(), lab: 0, shutter: 0 }); t += fin;
  // calendar days, skipping Sundays for working activities
  const days: DayPlan[] = []; const d0 = new Date(m.crew.startDate + 'T00:00:00'); const cur = isNaN(d0.getTime()) ? new Date() : d0; let n = 1;
  const fmt = (d: Date) => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  for (let ai = 0; ai < acts.length; ai++) { const a = acts[ai]; for (let i = 0; i < a.days; i++) {
    if (!a.wait) while (cur.getDay() === 0) cur.setDate(cur.getDate() + 1);
    const mt = zeroM(); (Object.keys(mt) as (keyof Mats)[]).forEach(k => mt[k] = a.mats[k] / a.days);
    days.push({ day: n++, date: fmt(cur), iso: isoDate(cur), label: a.label, crew: a.crew, mats: mt, wait: !!a.wait, batches: Math.ceil(mt.cement), act: ai });
    cur.setDate(cur.getDate() + 1);
  } }
  return { acts, days, totalDays: days.length, finish: days.length ? days[days.length - 1].date : '' };
}

// ---------- plot and buildable envelope ----------
export interface PlotInfo {
  has: boolean; x0: number; y0: number; x1: number; y1: number; inner: { x0: number; y0: number; x1: number; y1: number }; front: Side; area: number;
  bb: { x0: number; y0: number; x1: number; y1: number } | null; gaps: Record<Side, number>; need: Record<Side, number>; role: Record<Side, 'front' | 'side' | 'rear'>; maxFootprint: number;
}
export function plotInfo(m: Model): PlotInfo {
  const st = m.site; const R = RU.resolve(st.city, m.rules).v; const front: Side = st.front || 'top'; const W = st.plotW || 0, D = st.plotD || 0;
  const horiz = front === 'top' || front === 'bottom'; const px = horiz ? W : D, py = horiz ? D : W;
  const opp: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
  const role = {} as Record<Side, 'front' | 'side' | 'rear'>; (['top', 'bottom', 'left', 'right'] as Side[]).forEach(sd => { role[sd] = sd === front ? 'front' : sd === opp[front] ? 'rear' : 'side'; });
  const need = {} as Record<Side, number>; (Object.keys(role) as Side[]).forEach(sd => { need[sd] = role[sd] === 'front' ? R.sbFront : role[sd] === 'rear' ? R.sbRear : R.sbSide; });
  let bb: PlotInfo['bb'] = null;
  if (m.walls.length) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; m.walls.forEach(w => { const h = w.t / 2; [w.a, w.b].forEach(p => { x0 = Math.min(x0, p.x - h); y0 = Math.min(y0, p.y - h); x1 = Math.max(x1, p.x + h); y1 = Math.max(y1, p.y + h); }); }); bb = { x0, y0, x1, y1 }; }
  const b = bb || { x0: 0, y0: 0, x1: 0, y1: 0 }; const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
  // where the plot sits around the building: centred in the buildable area, or at the distances the user gave
  const freeX = px - need.left - need.right - bw, freeY = py - need.top - need.bottom - bh;
  let gl = need.left + freeX / 2, gt = need.top + freeY / 2;
  if (st.centre === false) {
    const gf = st.gapFront ?? need[front], gs = st.gapLeft ?? need.left;
    if (front === 'top') { gt = gf; gl = gs; } else if (front === 'bottom') { gt = py - bh - gf; gl = gs; } else if (front === 'left') { gl = gf; gt = gs; } else { gl = px - bw - gf; gt = gs; }
  }
  const x0 = b.x0 - gl, y0 = b.y0 - gt, x1 = x0 + px, y1 = y0 + py;
  const gaps: Record<Side, number> = { left: b.x0 - x0, right: x1 - b.x1, top: b.y0 - y0, bottom: y1 - b.y1 };
  const inner = { x0: x0 + need.left, y0: y0 + need.top, x1: x1 - need.right, y1: y1 - need.bottom };
  return { has: W > 0 && D > 0, x0, y0, x1, y1, inner, front, area: W * D, bb, gaps, need, role, maxFootprint: Math.max(0, inner.x1 - inner.x0) * Math.max(0, inner.y1 - inner.y0) };
}
/** FSI the plot is allowed: Mumbai from the DCPR table by area and road width, elsewhere the value typed on the Site step. */
export function fsiFor(m: Model): { basic: number; max: number; clause: string; basis: RU.Basis; text: string } {
  if (m.site.city === 'Mumbai') { const r = RU.mumbaiFsi(m.site.area || 'suburbs', m.site.roadWidth ?? 9); return { basic: r.basic, max: r.max, clause: RU.FSI_CLAUSE, basis: 'official', text: `${m.site.area === 'island' ? 'Island City' : 'Suburbs'}, road ${m.site.roadWidth ?? 9} m wide: basic FSI ${r.basic}` + (r.max > r.basic ? `, up to ${r.max} with premium FSI (${r.premium}) and TDR (${r.tdr})` : ', no premium FSI or TDR on a road under 9 m') }; }
  return { basic: m.site.fsi, max: m.site.fsi, clause: 'FSI entered on the Site step', basis: 'yours', text: `FSI ${m.site.fsi}, as entered` };
}

// ---------- compliance ----------
export interface Flag { id: string; sev: 'error' | 'warn'; title: string; detail: string; clause: string; roomId?: string; fix?: string; basis?: RU.Basis }
export const DEFAULT_RULES: Record<string, number> = RU.resolve('', undefined).v;
export const rulesOf = (m: Model) => RU.resolve(m.site.city, m.rules);
export function compliance(m: Model, e: Estimate): Flag[] {
  const rr = rulesOf(m); const R = rr.v; const out: Flag[] = []; const g = e.geo;
  const push = (f: Flag, key?: string) => { if (key && rr.def[key]) { f.clause = rr.def[key].clause; f.basis = rr.def[key].basis; } out.push(f); };
  const chk = (r: Room, aKey: string, wKey: string, what: string) => {
    const minA = R[aKey], minW = R[wKey];
    if (r.carpet < minA - 0.01) push({ id: 'a' + r.id, sev: 'error', roomId: r.id, title: `${r.name} is too small`, detail: `${r.carpet.toFixed(1)} m² inside; the minimum for ${what} is ${minA} m².`, clause: '', fix: `Add ${(minA - r.carpet).toFixed(1)} m² by moving one wall out by about ${((minA - r.carpet) / Math.max(1, r.maxW)).toFixed(2)} m.` }, aKey);
    if (r.minW < minW - 0.01) push({ id: 'w' + r.id, sev: 'error', roomId: r.id, title: `${r.name} is too narrow`, detail: `${r.minW.toFixed(2)} m wide inside; the minimum for ${what} is ${minW} m.`, clause: '' }, wKey);
  };
  // habitable rooms: the largest must meet the full size, the others the smaller size
  const hab = g.rooms.filter(r => r.type === 'bedroom' || r.type === 'living').sort((a, b) => b.carpet - a.carpet);
  hab.forEach((r, i) => i === 0 ? chk(r, 'habArea', 'habWidth', 'the main habitable room') : chk(r, 'habArea2', 'habWidth2', 'a second habitable room'));
  g.rooms.forEach(r => {
    if (r.type === 'kitchen') chk(r, 'kitArea', 'kitWidth', 'a kitchen');
    if (r.type === 'bath') chk(r, 'bathArea', 'bathWidth', 'a bathroom');
    if (r.type === 'corridor' && r.minW < R.corridorWidth - 0.01) push({ id: 'c' + r.id, sev: 'error', roomId: r.id, title: `${r.name} is too narrow`, detail: `${r.minW.toFixed(2)} m wide; passages need ${R.corridorWidth} m.`, clause: '' }, 'corridorWidth');
    if (r.type === 'bedroom' || r.type === 'living' || r.type === 'kitchen') {
      let open = 0; m.openings.forEach(o => { if (r.wallIds.includes(o.wallId) && g.ext.has(o.wallId)) open += o.w * o.h; });
      const need = r.carpet * VENT_RATIO[m.site.climate];
      if (open < need - 0.01) out.push({ id: 'v' + r.id, sev: 'warn', roomId: r.id, title: `${r.name} needs more window area`, detail: `${open.toFixed(2)} m² of openings to the outside; ${need.toFixed(2)} m² needed (1/${Math.round(1 / VENT_RATIO[m.site.climate])} of floor area in this climate).`, clause: 'NBC 2016 Part 8, lighting and ventilation', basis: 'secondary', fix: `Widen a window by ${((need - open) / 1.2).toFixed(2)} m, or add one.` });
    }
  });
  const clear = m.settings.f2f - e.st.slabT;
  if (clear < R.clearHeight - 0.001) push({ id: 'h', sev: 'error', title: 'Rooms are too low', detail: `Clear height is ${clear.toFixed(2)} m (floor-to-floor ${m.settings.f2f} m less ${Math.round(e.st.slabT * 1000)} mm slab); habitable rooms need ${R.clearHeight} m.`, clause: '', fix: `Raise floor-to-floor height to ${(R.clearHeight + e.st.slabT).toFixed(2)} m.` }, 'clearHeight');
  if (R.maxClearHeight > 0 && clear > R.maxClearHeight + 0.001) push({ id: 'hmax', sev: 'warn', title: 'Rooms are taller than the usual limit', detail: `Clear height is ${clear.toFixed(2)} m; above ${R.maxClearHeight} m the extra height is counted towards FSI.`, clause: '', fix: `Lower floor-to-floor height to ${(R.maxClearHeight + e.st.slabT).toFixed(2)} m or less.` }, 'maxClearHeight');
  if (e.height > m.site.maxHeight + 0.001) out.push({ id: 'bh', sev: 'error', title: 'Building is too tall', detail: `${e.height.toFixed(1)} m high; your limit for this plot is ${m.site.maxHeight} m.`, clause: 'Height limit entered on the Site step', basis: 'yours' });
  if (e.height > R.highRise + 0.001) push({ id: 'hr', sev: 'warn', title: 'Building counts as high-rise', detail: `${e.height.toFixed(1)} m high; above ${R.highRise} m the high-rise rules apply: wider access road, fire lift, refuge and fire-fighting provisions.`, clause: '' }, 'highRise');
  const p = plotInfo(m); const plotArea = p.has ? p.area : m.site.plotArea;
  if (plotArea > 0) {
    const f = fsiFor(m); const fsi = e.builtUp / plotArea, cov = e.geo.footprint / plotArea * 100;
    if (fsi > f.max + 0.001) out.push({ id: 'fsi', sev: 'error', title: 'Built-up area exceeds the FSI', detail: `FSI used is ${fsi.toFixed(2)} (${e.builtUp.toFixed(0)} m² on a ${plotArea.toFixed(0)} m² plot); the most this plot allows is ${f.max}. Remove ${(e.builtUp - f.max * plotArea).toFixed(0)} m².`, clause: f.clause, basis: f.basis });
    else if (fsi > f.basic + 0.001) out.push({ id: 'fsip', sev: 'warn', title: 'Built-up area needs premium FSI or TDR', detail: `FSI used is ${fsi.toFixed(2)}; the basic FSI is ${f.basic}. The extra ${((fsi - f.basic) * plotArea).toFixed(0)} m² has to be bought as premium FSI or TDR, up to a total FSI of ${f.max}.`, clause: f.clause, basis: f.basis });
    if (cov > m.site.maxCoverage + 0.01) out.push({ id: 'cov', sev: 'error', title: 'Ground coverage is too high', detail: `${cov.toFixed(0)} % of the plot is covered; the limit is ${m.site.maxCoverage} %.`, clause: 'Coverage limit entered on the Site step', basis: 'yours' });
  }
  if (p.has && p.bb) (['top', 'bottom', 'left', 'right'] as Side[]).forEach(sd => {
    const gap = p.gaps[sd], need = p.need[sd], nm = p.role[sd], key = nm === 'front' ? 'sbFront' : nm === 'rear' ? 'sbRear' : 'sbSide';
    if (gap < -0.01) push({ id: 'pl' + sd, sev: 'error', title: `Building crosses the ${nm} plot boundary`, detail: `It extends ${(-gap).toFixed(2)} m beyond the boundary on the ${sd} of the plan.`, clause: '', fix: 'Make the building smaller on that side or move it on the plot.' }, key);
    else if (gap < need - 0.01) push({ id: 'sb' + sd, sev: 'error', title: `${nm[0].toUpperCase() + nm.slice(1)} open space is too small`, detail: `${gap.toFixed(2)} m between the building and the ${nm} boundary (${sd} of the plan); ${need} m is needed.`, clause: '', fix: `Move that side of the building in by ${(need - gap).toFixed(2)} m, or shift the building on the plot.` }, key);
  });
  return out;
}

// ---------- rule-based suggestions (savings measured by re-running the estimate) ----------
export interface Suggestion { id: string; title: string; why: string; dCost: number; dCarpet: number; dDays: number; fixes: number; apply?: (m: Model) => Model; kind: 'save' | 'fix' | 'advice' }
export const clone = (m: Model): Model => JSON.parse(JSON.stringify(m));
export function measure(m: Model, base: Estimate, baseFlags: number, baseDays: number, next: Model) {
  const e2 = estimate(next); const f2 = compliance(next, e2).filter(f => f.sev === 'error').length; const s2 = schedule(next, e2);
  return { dCost: e2.total - base.total, dCarpet: (e2.geo.carpet - base.geo.carpet) * next.settings.floors, dDays: s2.totalDays - baseDays, fixes: baseFlags - f2, est: e2 };
}
export function suggestions(m: Model, e: Estimate, flags: Flag[], totalDays: number): Suggestion[] {
  const out: Suggestion[] = []; const nErr = flags.filter(f => f.sev === 'error').length;
  const tryIt = (id: string, title: string, why: string, kind: Suggestion['kind'], fn: (x: Model) => void) => {
    const next = clone(m); fn(next); const d = measure(m, e, nErr, totalDays, next);
    if (kind === 'save' && d.dCost > -500) return;
    out.push({ id, title, why, kind, dCost: d.dCost, dCarpet: d.dCarpet, dDays: d.dDays, fixes: d.fixes, apply: (x: Model) => { const y = clone(x); fn(y); return y; } });
  };
  const g = e.geo;
  const hf = flags.find(f => f.id === 'h');
  if (hf) tryIt('fixh', `Raise floor-to-floor height to ${(rulesOf(m).v.clearHeight + e.st.slabT).toFixed(2)} m`, 'Clears the room-height violation on every floor.', 'fix', x => { x.settings.f2f = Math.ceil((rulesOf(m).v.clearHeight + e.st.slabT) * 100) / 100; });
  const thickInt = m.walls.filter(w => !g.ext.has(w.id) && w.t > 0.16);
  if (thickInt.length) tryIt('thin', `Build the ${thickInt.length} inside walls in 100 mm AAC block`, 'Partition walls carry no load in an RCC frame. Thinner, lighter walls free up floor area and reduce the load on columns and footings.', 'save', x => x.walls.forEach(w => { if (thickInt.some(t => t.id === w.id)) { w.mat = 'aac'; w.t = 0.1; } }));
  if (m.walls.some(w => g.ext.has(w.id) && w.mat !== 'aac')) tryIt('aacext', 'Build the outside walls in 200 mm AAC block', 'AAC is about 60 % lighter than brick and lays faster. It also insulates better against heat.', 'save', x => x.walls.forEach(w => { if (g.ext.has(w.id)) { w.mat = 'aac'; w.t = 0.2; } }));
  if (m.walls.some(w => w.mat === 'clay')) tryIt('flyash', 'Use fly-ash bricks instead of clay bricks', 'Same wall size and strength class, lower price per brick.', 'save', x => x.walls.forEach(w => { if (w.mat === 'clay') w.mat = 'flyash'; }));
  if (m.settings.grade === 'M25' && m.settings.floors <= 4) tryIt('m20', 'Use M20 concrete instead of M25', 'For a building of this height M20 is enough for slabs, beams and columns.', 'save', x => { x.settings.grade = 'M20'; });
  if (m.settings.mortar < 6) tryIt('mortar', 'Use 1:6 mortar for masonry', 'Infill walls in a frame do not need a richer mix.', 'save', x => { x.settings.mortar = 6; });
  if (m.settings.f2f > 3.05) tryIt('f2f', 'Reduce floor-to-floor height to 3.0 m', 'Every extra 100 mm of height adds masonry, plaster, column concrete and steel on all floors.', 'save', x => { x.settings.f2f = 3.0; });
  if (!m.buffer.rebarOpt) tryIt('rebar', 'Order steel against a cutting plan', 'Planning cuts from 12 m bars lets the steel buffer drop from about 4 % to 1.5 %.', 'save', x => { x.buffer.rebarOpt = true; });
  g.rooms.filter(r => r.type === 'corridor' && r.minW > 1.3).forEach(r => out.push({ id: 'cor' + r.id, kind: 'advice', title: `${r.name} is ${r.minW.toFixed(2)} m wide; 1.2 m is enough`, why: `Narrowing it gives about ${((r.minW - 1.2) * r.maxW).toFixed(1)} m² per floor back to the rooms beside it. Ask the copilot to move the wall.`, dCost: 0, dCarpet: (r.minW - 1.2) * r.maxW * m.settings.floors, dDays: 0, fixes: 0 }));
  // west-facing glazing in hot climates
  if (m.site.climate !== 'cold' && m.site.climate !== 'temperate') {
    const wm = new Map(m.walls.map(w => [w.id, w])); const th = (m.site.northDeg * Math.PI) / 180;
    const west = { x: -Math.cos(th), y: -Math.sin(th) }; // north is up when northDeg = 0
    m.openings.filter(o => o.kind === 'window' && o.w * o.h >= 2 && g.ext.has(o.wallId)).forEach(o => {
      const w = wm.get(o.wallId)!; const L = wlen(w); let nx = -(w.b.y - w.a.y) / L, ny = (w.b.x - w.a.x) / L;
      const mid = lerp(w.a, w.b, o.pos); if (g.rooms.some(r => pointInPoly({ x: mid.x + nx * 0.4, y: mid.y + ny * 0.4 }, r.poly))) { nx = -nx; ny = -ny; }
      if (nx * west.x + ny * west.y > 0.7) { const room = g.rooms.find(r => r.wallIds.includes(w.id)); out.push({ id: 'west' + o.id, kind: 'advice', title: `Shade the ${o.w.toFixed(1)} m west window${room ? ' in ' + room.name : ''}`, why: 'West-facing glass takes low afternoon sun and overheats the room. Add a 600 mm chajja with side fins, or move part of the glazing to the north wall.', dCost: 0, dCarpet: 0, dDays: 0, fixes: 0 }); }
    });
  }
  return out.sort((a, b) => (b.fixes - a.fixes) || (a.dCost - b.dCost));
}

// ---------- copilot commands (the AI may only return these) ----------
export type Cmd =
  | { op: 'setWallMaterial'; scope: 'all' | 'internal' | 'external'; mat: MatKey; t?: number }
  | { op: 'setFloorHeight'; value: number } | { op: 'setFloors'; value: number } | { op: 'setConcrete'; grade: Grade } | { op: 'setMortar'; mix: number }
  | { op: 'moveWall'; wallId: string; by: number } | { op: 'resizeWindow'; room: string; addWidth: number } | { op: 'setSlab'; mm: number | null } | { op: 'rebarPlan'; on: boolean };
export function applyCmds(m: Model, cmds: Cmd[]): { model: Model; done: string[]; skipped: string[] } {
  let x = clone(m); const done: string[] = [], skipped: string[] = [];
  for (const c of cmds || []) {
    try {
      const g = geometry(x);
      if (c.op === 'setWallMaterial' && MATS[c.mat]) {
        const t = c.t && MATS[c.mat].thick.some(v => Math.abs(v - c.t!) < 0.001) ? c.t : undefined; let k = 0;
        x.walls.forEach(w => { const isExt = g.ext.has(w.id); if (c.scope === 'all' || (c.scope === 'external') === isExt) { w.mat = c.mat; w.t = t ?? (MATS[c.mat].thick.includes(w.t) ? w.t : isExt ? MATS[c.mat].thick[0] : MATS[c.mat].thick[MATS[c.mat].thick.length - 1]); k++; } });
        done.push(`${k} ${c.scope} walls → ${MATS[c.mat].name}${t ? ' ' + t * 1000 + ' mm' : ''}`);
      } else if (c.op === 'setFloorHeight' && c.value >= 2.6 && c.value <= 4.5) { x.settings.f2f = r2(c.value); done.push(`floor-to-floor ${c.value} m`); }
      else if (c.op === 'setFloors' && c.value >= 1 && c.value <= 8) { x.settings.floors = Math.round(c.value); done.push(`${x.settings.floors} floors`); }
      else if (c.op === 'setConcrete' && (c.grade === 'M20' || c.grade === 'M25')) { x.settings.grade = c.grade; done.push(`concrete ${c.grade}`); }
      else if (c.op === 'setMortar' && [4, 5, 6].includes(c.mix)) { x.settings.mortar = c.mix; done.push(`mortar 1:${c.mix}`); }
      else if (c.op === 'setSlab') { x.settings.slabT = c.mm ? Math.min(0.25, Math.max(0.1, c.mm / 1000)) : null; done.push(c.mm ? `slab ${c.mm} mm` : 'slab back to recommended'); }
      else if (c.op === 'rebarPlan') { x.buffer.rebarOpt = !!c.on; done.push('steel ordered against a cutting plan'); }
      else if (c.op === 'moveWall') {
        const w = x.walls.find(v => v.id === c.wallId); const by = Math.max(-1.5, Math.min(1.5, Number(c.by) || 0));
        if (!w || Math.abs(by) < 0.02 || g.ext.has(w.id)) { skipped.push(`move wall ${c.wallId}`); continue; }
        const L = wlen(w), nx = -(w.b.y - w.a.y) / L, ny = (w.b.x - w.a.x) / L;
        // move this wall and any walls in line with it that share its ends (so a full partition line moves together)
        const line = new Set<string>([w.id]); let grew = true;
        while (grew) { grew = false; x.walls.forEach(v => { if (line.has(v.id) || g.ext.has(v.id)) return; const col = Math.abs((v.b.x - v.a.x) * ny - (v.b.y - v.a.y) * nx) / wlen(v) > 0.999; if (!col) return; x.walls.forEach(u => { if (line.has(u.id) && (key(u.a) === key(v.a) || key(u.a) === key(v.b) || key(u.b) === key(v.a) || key(u.b) === key(v.b))) { line.add(v.id); grew = true; } }); }); }
        const ops = x.openings.map(o => { const ow = x.walls.find(v => v.id === o.wallId)!; return { o, p: lerp(ow.a, ow.b, o.pos), moved: line.has(o.wallId) }; });
        const oldPts = new Map<string, Pt>(); x.walls.forEach(v => { if (line.has(v.id)) { oldPts.set(key(v.a), v.a); oldPts.set(key(v.b), v.b); } });
        const mv = (p: Pt) => rp({ x: p.x + nx * by, y: p.y + ny * by });
        x.walls.forEach(v => { if (line.has(v.id)) { v.a = mv(v.a); v.b = mv(v.b); } else { if (oldPts.has(key(v.a)) && !isOnExt(x, g, v.a)) v.a = mv(v.a); if (oldPts.has(key(v.b)) && !isOnExt(x, g, v.b)) v.b = mv(v.b); } });
        // re-seat openings at their (moved) world position
        const tmpWalls = x.walls.map(v => ({ ...v })); const reOps: Opening[] = [];
        ops.forEach(({ o, p, moved }) => { const q = moved ? { x: p.x + nx * by, y: p.y + ny * by } : p; const nw = nearestWall(tmpWalls, q, 0.6); if (nw) reOps.push({ ...o, wallId: nw.wall.id, pos: nw.t }); });
        const nz = normalize(x.walls, reOps); x.walls = nz.walls; x.openings = nz.openings;
        // keep room labels inside rooms
        done.push(`wall moved ${Math.abs(by).toFixed(2)} m`);
      } else if (c.op === 'resizeWindow') {
        const room = g.rooms.find(r => r.name.toLowerCase() === String(c.room).toLowerCase()); const add = Math.max(0.1, Math.min(2, Number(c.addWidth) || 0));
        const o = room && x.openings.find(v => v.kind === 'window' && room.wallIds.includes(v.wallId) && g.ext.has(v.wallId));
        const ow = o && x.walls.find(v => v.id === o.wallId);
        if (o && ow && wlen(ow) > o.w + add + 0.4) { o.w = r2(o.w + add); done.push(`${room!.name} window widened to ${o.w} m`); } else skipped.push(`widen window in ${c.room}`);
      } else skipped.push(JSON.stringify(c).slice(0, 60));
    } catch (err) { skipped.push(String((c as any).op)); }
  }
  return { model: x, done, skipped };
}
function isOnExt(x: Model, g: Geo, p: Pt): boolean { return false; }

// ---------- tenders ----------
export const TENDER_ITEMS = ['excav', 'pcc', 'rcc', 'steel', 'masonry', 'plaster', 'flooring', 'painting'];
const LAB_ITEMS = ['excav', 'pcc', 'rcc', 'steel', 'masonry', 'plaster'];
export interface QuoteResult { q: Quote; lines: { key: string; label: string; unit: string; qty: number; est: number; rate: number | null; amount: number; dev: number | null; flag: string }[]; total: number; flags: string[]; quoted: number; own: number }
export function analyseQuotes(m: Model, e: Estimate): { estTotal: number; results: QuoteResult[]; options: { title: string; who: string; total: number; why: string; risks: string }[]; answer: string } {
  const bl = new Map(e.boq.map(b => [b.key, b])); const estTotal = e.boq.reduce((a, b) => a + b.amount, 0);
  const results: QuoteResult[] = m.quotes.map(q => {
    const flags: string[] = []; let total = 0, quoted = 0, own = 0;
    const lines = TENDER_ITEMS.filter(k => bl.has(k)).map(k => {
      const b = bl.get(k)!; const lo = q.type === 'labour_only';
      if (lo && !LAB_ITEMS.includes(k)) { total += b.amount; own += b.amount; return { key: k, label: b.label, unit: b.unit, qty: b.qty, est: b.rate, rate: null, amount: b.amount, dev: null, flag: 'bought separately' }; }
      const est = lo ? b.labRate : b.rate; const rate = q.rates[k]; let flag = '';
      if (rate === null || rate === undefined || !(rate > 0)) { const amt = est * b.qty + (lo ? b.mat : 0); total += amt; own += amt; flags.push(`${b.label}: no rate given`); return { key: k, label: b.label, unit: b.unit, qty: b.qty, est, rate: null, amount: amt, dev: null, flag: 'missing, our rate used' }; }
      const dev = est > 0 ? (rate - est) / est * 100 : 0;
      if (dev < -15) { flag = 'unusually low'; flags.push(`${b.label}: ${Math.abs(dev).toFixed(0)} % below our rate`); } else if (dev > 20) { flag = 'high'; flags.push(`${b.label}: ${dev.toFixed(0)} % above our rate`); }
      const amt = rate * b.qty + (lo ? b.mat : 0); total += amt; quoted += rate * b.qty; if (lo) own += b.mat;
      return { key: k, label: b.label, unit: b.unit, qty: b.qty, est, rate, amount: amt, dev, flag };
    });
    return { q, lines, total, flags, quoted, own };
  });
  const options: { title: string; who: string; total: number; why: string; risks: string }[] = []; let answer = 'Add at least two real quotes to get a recommendation.';
  if (results.length >= 1) {
    const by = [...results].sort((a, b) => a.total - b.total); const cheap = by[0];
    const lowFlags = (r: QuoteResult) => r.flags.filter(f => f.includes('below') || f.includes('no rate')).length;
    const safe = [...results].filter(r => r.q.type === 'with_material').sort((a, b) => lowFlags(a) - lowFlags(b) || a.total - b.total)[0] || by[0];
    const fast = [...results].sort((a, b) => a.q.weeks - b.q.weeks || a.total - b.total)[0];
    const desc = (r: QuoteResult) => r.q.type === 'labour_only' ? `${r.q.name} for labour, with materials bought from your own vendors` : `${r.q.name}, materials included`;
    const next = by[1];
    answer = `Most economical: ${desc(cheap)}, at ${inr(cheap.total)}` + (next ? `. That is ${inr(next.total - cheap.total)} less than ${next.q.name}` : '') + ` and ${cheap.total <= estTotal ? inr(estTotal - cheap.total) + ' under' : inr(cheap.total - estTotal) + ' over'} our own estimate of ${inr(estTotal)}.` + (lowFlags(cheap) ? ` Check ${lowFlags(cheap)} rate${lowFlags(cheap) > 1 ? 's' : ''} that look too low before you commit.` : '');
    options.push({ title: 'Cheapest', who: cheap.q.name, total: cheap.total, why: cheap.q.type === 'labour_only' ? `You buy materials at your vendor prices (${inr(cheap.own)}) and pay ${cheap.q.name} ${inr(cheap.quoted)} for labour.` : 'Lowest total with materials included.', risks: cheap.q.type === 'labour_only' ? 'You carry material price changes, wastage and delivery timing yourself.' : (cheap.flags.join('; ') || 'No rates out of range.') });
    if (safe && safe !== cheap) options.push({ title: 'Lowest risk', who: safe.q.name, total: safe.total, why: `One party responsible for materials and workmanship, with ${lowFlags(safe) ? lowFlags(safe) + ' rate(s) to query' : 'no under-quoted rates'}.`, risks: safe.flags.join('; ') || 'No rates out of range.' });
    if (fast && fast !== cheap && fast !== safe) options.push({ title: 'Fastest', who: fast.q.name, total: fast.total, why: `Promises ${fast.q.weeks} weeks, ${Math.max(...results.map(r => r.q.weeks)) - fast.q.weeks} weeks sooner than the slowest quote.`, risks: fast.flags.join('; ') || 'No rates out of range.' });
  }
  return { estTotal, results, options, answer };
}

// ---------- formatting ----------
export function inr(v: number): string {
  const a = Math.abs(v), s = v < 0 ? '−' : '';
  if (a >= 1e7) return `${s}₹${(a / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `${s}₹${(a / 1e5).toFixed(2)} L`;
  return s + '₹' + Math.round(a).toLocaleString('en-IN');
}
export const inrFull = (v: number) => (v < 0 ? '−' : '') + '₹' + Math.round(Math.abs(v)).toLocaleString('en-IN');
export const num = (v: number, d = 0) => v.toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d });

// ---------- defaults and demo ----------
export function addOpeningAt(m: Model, p: Pt, kind: 'door' | 'window', w: number, h: number) {
  const nw = nearestWall(m.walls, p, 0.4); if (!nw || wlen(nw.wall) < w + 0.2) return;
  const half = w / 2 / wlen(nw.wall); m.openings.push({ id: uid('o'), wallId: nw.wall.id, kind, pos: Math.min(1 - half, Math.max(half, nw.t)), w, h });
}
export function blankModel(): Model {
  const lab = (label: string, unit: string, trade: Trade, skH: number, hpH: number, skRate: number): Model['labour'][string] => ({ label, unit, trade, skH, hpH, skRate, hpRate: 70 });
  return {
    walls: [], openings: [], labels: [],
    settings: { floors: 1, f2f: 3.0, slabT: null, grade: 'M20', mortar: 6 },
    site: { city: 'Mumbai', zone: 'III', soil: 'murum', sbc: 300, soilSource: 'presumptive', waterTable: null, plotArea: 330, fsi: 1.0, maxHeight: 16, maxCoverage: 50, climate: 'warm_humid', northDeg: 0, plotW: 15, plotD: 22, front: 'top', roadWidth: 9, area: 'suburbs', centre: true },
    prices: {
      cement: { label: 'Cement (50 kg bag)', unit: 'bag', v1: 380, v2: 365 }, sand: { label: 'Sand', unit: 'm³', v1: 1900, v2: null }, agg: { label: 'Aggregate 20 mm', unit: 'm³', v1: 1500, v2: null },
      clay: { label: 'Clay brick', unit: 'each', v1: 9, v2: null }, flyash: { label: 'Fly-ash brick', unit: 'each', v1: 6.5, v2: null }, aac: { label: 'AAC block', unit: 'm³', v1: 4200, v2: 4050 }, steel: { label: 'TMT steel Fe500D', unit: 'kg', v1: 62, v2: 60.5 },
    },
    labour: {
      excav: lab('Excavation', 'm³', 'helper', 0, 3.2, 0), concrete: lab('Concreting (mix, place, cure)', 'm³', 'mason', 1.6, 14, 110), steel: lab('Steel cutting, bending, fixing', 'kg', 'barbender', 0.08, 0.08, 105),
      shutter: lab('Shuttering', 'm²', 'carpenter', 1.6, 1.6, 115), brick: lab('Brickwork', 'm³', 'mason', 7.2, 10.4, 110), block: lab('AAC block work', 'm³', 'mason', 4.0, 5.6, 110), plaster: lab('Plastering', 'm²', 'mason', 0.65, 0.8, 110),
    },
    allow: { electrical: 1200, plumbing: 900, waterproofing: 450, flooring: 1100, painting: 180, door: 14000, window: 9000, shutterHire: 220, contingencyPct: 5, ohpPct: 15 },
    crew: { masons: 4, helpers: 8, barbenders: 2, carpenters: 2, hoursPerDay: 8, startDate: new Date().toISOString().slice(0, 10) },
    buffer: { crew: 'average', monsoon: false, storage: 'covered', rebarOpt: false },
    rules: {}, quotes: [], tenderMode: 'choose', decidedQuoteId: null,
    owner: { budget: 9000000, notes: 'Family of five with an elderly parent. One person works from home.' },
  };
}
export function demoModel(): Model {
  const m = blankModel(); const W = (x1: number, y1: number, x2: number, y2: number): Wall => ({ id: uid('w'), a: { x: x1, y: y1 }, b: { x: x2, y: y2 }, t: 0.23, mat: 'clay' });
  const raw = [W(0, 0, 9, 0), W(9, 0, 9, 8), W(9, 8, 0, 8), W(0, 8, 0, 0), W(4.4, 0, 4.4, 8), W(4.4, 3, 9, 3), W(0, 4.8, 9, 4.8), W(7, 0, 7, 3), W(7, 1.4, 9, 1.4), W(7, 4.8, 7, 8)];
  m.walls = normalize(raw, []).walls;
  const D = (x: number, y: number, w = 0.9) => addOpeningAt(m, { x, y }, 'door', w, 2.1), Wn = (x: number, y: number, w: number, h: number) => addOpeningAt(m, { x, y }, 'window', w, h);
  D(1.2, 0, 1.0); D(4.4, 3.9); D(5.3, 3); D(7, 0.7, 0.75); D(8, 3, 0.75); D(3.6, 4.8); D(5.4, 4.8); D(8.1, 4.8, 0.75);
  Wn(0, 2.4, 2.4, 1.5); Wn(5.7, 0, 1.2, 1.2); Wn(8, 0, 0.6, 0.6); Wn(9, 2.2, 0.6, 0.6); Wn(2.2, 8, 1.8, 1.35); Wn(5.8, 8, 1.0, 1.2); Wn(9, 6.4, 0.6, 0.6);
  m.labels = [{ x: 2.2, y: 2.4, name: 'Living', type: 'living' }, { x: 5.7, y: 1.5, name: 'Kitchen', type: 'kitchen' }, { x: 8, y: 0.7, name: 'Utility', type: 'other' }, { x: 8, y: 2.2, name: 'Bath 1', type: 'bath' },
  { x: 6.7, y: 3.9, name: 'Passage', type: 'corridor' }, { x: 2.2, y: 6.4, name: 'Bedroom 1', type: 'bedroom' }, { x: 5.8, y: 6.4, name: 'Bedroom 2', type: 'bedroom' }, { x: 8.1, y: 6.4, name: 'Bath 2', type: 'bath' }];
  m.settings = { floors: 4, f2f: 2.85, slabT: null, grade: 'M25', mortar: 6 }; m.owner.budget = 5000000;
  const e = estimate(m); const rate = (k: string, f: number, lab = false) => { const b = e.boq.find(x => x.key === k); if (!b) return null; const v = (lab ? b.labRate : b.rate) * f; return v > 200 ? Math.round(v / 10) * 10 : Math.round(v * 10) / 10; };
  m.quotes = [
    { id: uid('q'), name: 'Shree Constructions', type: 'with_material', weeks: 30, source: 'Uploaded quotation', received: 'sample', rates: { excav: rate('excav', 1.1), pcc: rate('pcc', 1.06), rcc: rate('rcc', 1.07), steel: rate('steel', 1.04), masonry: rate('masonry', 1.08), plaster: rate('plaster', 1.05), flooring: rate('flooring', 1.03), painting: rate('painting', 1.05) } },
    { id: uid('q'), name: 'Apex Buildcon', type: 'with_material', weeks: 26, source: 'Invite link', received: 'sample', rates: { excav: rate('excav', 0.95), pcc: rate('pcc', 1.0), rcc: rate('rcc', 0.98), steel: rate('steel', 0.78), masonry: rate('masonry', 0.99), plaster: null, flooring: rate('flooring', 1.0), painting: rate('painting', 0.97) } },
    { id: uid('q'), name: 'Verma Labour Contractors', type: 'labour_only', weeks: 32, source: 'Typed in', received: 'sample', rates: { excav: rate('excav', 0.92, true), pcc: rate('pcc', 0.9, true), rcc: rate('rcc', 0.88, true), steel: rate('steel', 0.9, true), masonry: rate('masonry', 0.86, true), plaster: rate('plaster', 0.9, true) } },
  ];
  return m;
}
