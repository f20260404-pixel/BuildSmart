// Compare two versions of a project: what changed in the design and what it does to cost, time and rules.
import * as E from './engine';
import type { Model } from './engine';

export interface CmpRow { label: string; a: number; b: number; unit: 'inr' | 'num' | 'm2' | 'days' | 'kg' | 'bags'; better: 'down' | 'up' | 'none' }
export interface Comparison { rows: CmpRow[]; boq: { label: string; a: number; b: number }[]; changes: string[]; dCost: number; dDays: number; dViol: number }
const run = (m: Model) => { const e = E.estimate(m); const s = E.schedule(m, e); const f = E.compliance(m, e); return { e, s, f }; };
export function compare(a: Model, b: Model): Comparison {
  const A = run(a), B = run(b); const viol = (x: typeof A) => x.f.filter(f => f.sev === 'error').length;
  const rows: CmpRow[] = [
    { label: 'Total cost', a: A.e.total, b: B.e.total, unit: 'inr', better: 'down' }, { label: 'Cost per sq ft', a: A.e.perSqft, b: B.e.perSqft, unit: 'inr', better: 'down' },
    { label: 'Built-up area', a: A.e.builtUp, b: B.e.builtUp, unit: 'm2', better: 'none' }, { label: 'Carpet area, all floors', a: A.e.geo.carpet * a.settings.floors, b: B.e.geo.carpet * b.settings.floors, unit: 'm2', better: 'up' },
    { label: 'Build time', a: A.s.totalDays, b: B.s.totalDays, unit: 'days', better: 'down' }, { label: 'Rule violations', a: viol(A), b: viol(B), unit: 'num', better: 'down' },
    { label: 'Steel', a: A.e.mats.steel, b: B.e.mats.steel, unit: 'kg', better: 'down' }, { label: 'Cement', a: A.e.mats.cement, b: B.e.mats.cement, unit: 'bags', better: 'down' },
    { label: 'Labour cost', a: A.e.labourCost, b: B.e.labourCost, unit: 'inr', better: 'down' },
  ];
  const keys = Array.from(new Set([...A.e.boq.map(x => x.key), ...B.e.boq.map(x => x.key)]));
  const boq = keys.map(k => { const x = A.e.boq.find(q => q.key === k), y = B.e.boq.find(q => q.key === k); return { label: (y || x)!.label, a: x ? x.amount : 0, b: y ? y.amount : 0 }; });
  [...A.e.packages.map(p => p.key)].forEach(k => { const x = A.e.packages.find(p => p.key === k), y = B.e.packages.find(p => p.key === k); if (x && y) boq.push({ label: x.label, a: x.amount, b: y.amount }); });
  const ch: string[] = []; const sa = a.settings, sb = b.settings;
  if (sa.floors !== sb.floors) ch.push(`Floors: ${sa.floors} → ${sb.floors}`);
  if (Math.abs(sa.f2f - sb.f2f) > 0.001) ch.push(`Floor-to-floor height: ${sa.f2f} m → ${sb.f2f} m`);
  if (sa.grade !== sb.grade) ch.push(`Concrete: ${sa.grade} → ${sb.grade}`);
  if (sa.mortar !== sb.mortar) ch.push(`Mortar: 1:${sa.mortar} → 1:${sb.mortar}`);
  const mix = (m: Model) => { const o: Record<string, number> = {}; m.walls.forEach(w => { const k = `${E.MATS[w.mat].name} ${Math.round(w.t * 1000)} mm`; o[k] = (o[k] || 0) + E.wlen(w); }); return o; };
  const ma = mix(a), mb = mix(b); Array.from(new Set([...Object.keys(ma), ...Object.keys(mb)])).forEach(k => { const d = (mb[k] || 0) - (ma[k] || 0); if (Math.abs(d) > 0.05) ch.push(`${k} walls: ${(ma[k] || 0).toFixed(1)} m → ${(mb[k] || 0).toFixed(1)} m`); });
  if (A.e.geo.rooms.length !== B.e.geo.rooms.length) ch.push(`Rooms per floor: ${A.e.geo.rooms.length} → ${B.e.geo.rooms.length}`);
  B.e.geo.rooms.forEach(r => { const o = A.e.geo.rooms.find(x => x.name === r.name); if (o && Math.abs(o.carpet - r.carpet) > 0.15) ch.push(`${r.name}: ${o.carpet.toFixed(1)} m² → ${r.carpet.toFixed(1)} m²`); });
  if (a.openings.length !== b.openings.length) ch.push(`Doors and windows: ${a.openings.length} → ${b.openings.length}`);
  if (a.site.soil !== b.site.soil || a.site.sbc !== b.site.sbc) ch.push(`Ground: ${E.SOILS[a.site.soil].name} at ${a.site.sbc} kN/m² → ${E.SOILS[b.site.soil].name} at ${b.site.sbc} kN/m²`);
  if (A.e.st.found.type !== B.e.st.found.type) ch.push(`Foundation: ${A.e.st.found.type} → ${B.e.st.found.type}`);
  if (JSON.stringify(a.prices) !== JSON.stringify(b.prices)) ch.push('Material prices were changed');
  if (JSON.stringify(a.labour) !== JSON.stringify(b.labour)) ch.push('Labour rates or outputs were changed');
  if (JSON.stringify(a.crew) !== JSON.stringify(b.crew)) ch.push('Crew size or start date was changed');
  return { rows, boq, changes: ch, dCost: B.e.total - A.e.total, dDays: B.s.totalDays - A.s.totalDays, dViol: viol(B) - viol(A) };
}
