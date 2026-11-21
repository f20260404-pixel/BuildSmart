import { demoModel, estimate, schedule, compliance, suggestions, analyseQuotes, applyCmds, inr, normalize, geometry, blankModel } from './engine';
const ok = (c: boolean, msg: string) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
// hand-worked: 4 x 3 m room, 230 clay brick, 3 m high (beam 0.3 → 2.7 m wall), no openings
const b = blankModel(); b.walls = normalize([[0, 0, 4, 0], [4, 0, 4, 3], [4, 3, 0, 3], [0, 3, 0, 0]].map((c, i) => ({ id: 'x' + i, a: { x: c[0], y: c[1] }, b: { x: c[2], y: c[3] }, t: 0.23, mat: 'clay' as const })), []).walls;
const eb = estimate(b); const g = geometry(b);
ok(g.rooms.length === 1 && Math.abs(g.rooms[0].area - 12) < 1e-6, 'one room of 12 m2 centreline area, got ' + g.rooms.map(r => r.area));
const hw = 3 - eb.st.beamD; const vol = 14 * hw * 0.23; const bricks = vol * 408;
ok(Math.abs(eb.mats.clay - bricks) < 1, `bricks ${eb.mats.clay.toFixed(0)} = 14 m x ${hw} m x 0.23 x 408 = ${bricks.toFixed(0)}`);
// M20 slab: 1 m3 → 1.54/5.5/0.0347 = 8.07 bags
const m = demoModel(); const e = estimate(m); const s = schedule(m, e); const f = compliance(m, e); const sg = suggestions(m, e, f, s.totalDays); const t = analyseQuotes(m, e);
console.log('rooms', e.geo.rooms.map(r => `${r.name} ${r.carpet.toFixed(1)}m2 w${r.minW.toFixed(2)}`).join(' | '));
console.log('footprint', e.geo.footprint.toFixed(1), 'builtUp', e.builtUp.toFixed(0), 'cols', e.st.columns.length, e.st.col, 'slab', e.st.slabT, 'beam', e.st.beamD, 'colLoad', e.st.colLoad.toFixed(0));
console.log('found', e.st.found.type, e.st.found.basis);
console.log('mats', Object.entries(e.mats).map(([k, v]) => k + ' ' + v.toFixed(0)).join(', '));
console.log('conc m3', e.concVol.toFixed(1), 'steel kg/m2', (e.mats.steel / e.builtUp).toFixed(1), 'cement bags/m2', (e.mats.cement / e.builtUp).toFixed(2));
console.log('total', inr(e.total), 'per sqft', e.perSqft.toFixed(0), 'civil', inr(e.civil), 'other', inr(e.other), 'labour', inr(e.labourCost), 'mat', inr(e.materialCost), 'buffer', inr(e.bufferCost), 'naive', inr(e.naiveBufferCost));
e.boq.forEach(l => console.log('  ', l.key.padEnd(9), l.qty.toFixed(1).padStart(9), l.unit, 'rate', l.rate.toFixed(0), 'amt', inr(l.amount)));
console.log('schedule days', s.totalDays, 'finish', s.finish, s.acts.slice(0, 8).map(a => a.label + ':' + a.days).join(', '));
console.log('flags', f.map(x => x.sev + ' ' + x.title).join(' | '));
sg.forEach(x => console.log('  sug', x.kind, x.title, inr(x.dCost), 'carpet', x.dCarpet.toFixed(1), 'days', x.dDays, 'fixes', x.fixes));
console.log(t.answer); t.results.forEach(r => console.log('  ', r.q.name, inr(r.total), r.flags.join('; '))); t.options.forEach(o => console.log('  opt', o.title, o.who, inr(o.total)));
ok(f.some(x => x.id === 'h') && f.some(x => x.title.includes('Bedroom 2')), 'planted violations are flagged');
ok(e.geo.rooms.length === 8, '8 rooms detected, got ' + e.geo.rooms.length);
const h1 = m.walls.find(w => Math.abs(w.a.y - 3) < 0.01 && Math.abs(w.b.y - 3) < 0.01)!;
const mv = applyCmds(m, [{ op: 'moveWall', wallId: h1.id, by: 0.3 }, { op: 'setWallMaterial', scope: 'internal', mat: 'aac', t: 0.1 }]);
const e2 = estimate(mv.model); console.log('after cmds', mv.done, mv.skipped, 'rooms', e2.geo.rooms.length, e2.geo.rooms.map(r => `${r.name} ${r.carpet.toFixed(1)}`).join(' | '), 'openings', mv.model.openings.length, '/', m.openings.length, inr(e2.total));
ok(e2.geo.rooms.length === 8 && mv.model.openings.length === m.openings.length, 'move wall keeps 8 rooms and all openings');
const bc = demoModel(); bc.site.soil = 'blackcotton'; bc.site.sbc = 130; const e3 = estimate(bc); console.log('black cotton', e3.st.found.type, inr(e3.total - e.total));
const sc = demoModel(); sc.site.soil = 'softclay'; sc.site.sbc = 60; console.log('soft', estimate(sc).st.found.basis);
ok(e3.st.found.type === 'pile', 'black cotton gives piles');
// ---- rebar + site ----
import * as RB from './rebar'; import * as ST from './site';
{
  const r = RB.cutStock([{ len: 5, n: 4 }, { len: 4, n: 4 }, { len: 3, n: 4 }]);
  ok(r.bars === 4 && r.naiveBars === 5 && r.minBars === 4, `cutting 4×5 m, 4×4 m, 4×3 m: ${r.bars} bars (naive ${r.naiveBars}, minimum ${r.minBars})`);
  const r2 = RB.cutStock([{ len: 14.2, n: 3 }], 12, 0.6); ok(r2.splices === 3 && r2.pieces === 6, `14.2 m bars split in two with a lap: ${r2.pieces} pieces, ${r2.bars} bars`);
  const r3 = RB.cutStock([{ len: 6, n: 10 }, { len: 2.5, n: 7 }, { len: 1.15, n: 40 }]); ok(r3.bars <= r3.naiveBars && r3.bars >= r3.minBars, `mixed lengths: ${r3.bars} bars, naive ${r3.naiveBars}, minimum ${r3.minBars}`);
  const need = r3.patterns.reduce((a, p) => a + p.bars * p.cuts.reduce((x, y) => x + y, 0), 0); ok(Math.abs(need - r3.needM) < 0.01, 'cutting patterns account for every metre needed');
  const md = demoModel(); const ed = estimate(md); const plan = RB.cuttingPlan(ed.bars); const sd = schedule(md, ed);
  console.log('bars kg', ed.steelBars.toFixed(0), 'thumb kg', ed.steelThumb.toFixed(0), 'buy', plan.kgBuy.toFixed(0), 'waste %', plan.wastePct.toFixed(1), 'naive %', plan.naivePct.toFixed(1), 'bars', plan.barsTotal, plan.plans.map(p => `${p.dia}:${p.bars}/${p.naiveBars}/${p.minBars}`).join(' '));
  ok(Math.abs(plan.kgNeed - ed.steelBars) / ed.steelBars < 0.03, 'cutting plan covers the bar schedule (within rounding of cut lengths)');
  ok(plan.wastePct < plan.naivePct && plan.wastePct < 6, 'cutting plan wastes less than cutting length by length');
  ok(ed.steelBars / ed.steelThumb > 0.6 && ed.steelBars / ed.steelThumb < 1.5, 'bar schedule is in the same range as the planning allowance');
  const mb = demoModel(); mb.settings.steelFromBars = true; const eb2 = estimate(mb); ok(Math.abs(eb2.mats.steel - eb2.steelBars) < 1, 'estimate uses the bar schedule when switched on');
  const cf = ST.cashflow(md, ed, sd); ok(Math.abs(cf.total - ed.total) < 1, `cash flow adds up to the estimate: ${inr(cf.total)} over ${cf.weeks.length} weeks, peak ${inr(cf.peak!.amount)}`);
  md.stock = [{ id: 'a', mat: 'cement', type: 'ordered', qty: 500, price: 380, date: '2026-11-01', note: '' }, { id: 'b', mat: 'cement', type: 'received', qty: 300, price: 400, date: '2026-11-02', note: '' }, { id: 'c', mat: 'cement', type: 'issued', qty: 120, price: null, date: '2026-11-03', note: '' }];
  md.expenses = [{ id: 'x', date: '2026-11-03', desc: 'local cement', amount: 2500, reason: 'urgent' }];
  const sv = ST.stockSummary(md, ed, sd, md.crew.startDate); const c = sv.rows.find(r => r.key === 'cement')!;
  ok(c.pending === 200 && c.onSite === 180 && Math.abs(c.variance - 300 * (400 - c.plannedPrice)) < 0.01 && Math.abs(sv.forecast - (ed.total + c.variance + 2500)) < 0.01, `stock: 200 awaited, 180 on site, price difference ${inr(c.variance)}, forecast ${inr(sv.forecast)}`);
}
// ---- plot, setbacks, FSI ----
import { plotInfo, fsiFor } from './engine'; import * as RUL from './rules';
{
  const d = demoModel(); const fl = (x: typeof d) => compliance(x, estimate(x)).map(f => f.id);
  const p = plotInfo(d); ok(p.has && Math.abs(p.area - 330) < 1e-6 && !fl(d).some(i => i.startsWith('sb') || i.startsWith('pl')), `demo plot 15 × 22 m: gaps front ${p.gaps.top.toFixed(2)}, rear ${p.gaps.bottom.toFixed(2)}, sides ${p.gaps.left.toFixed(2)} m, no open-space findings`);
  const n = demoModel(); n.site.plotW = 11; ok(fl(n).includes('sbleft') && fl(n).includes('sbright'), 'an 11 m wide plot leaves the side open spaces short');
  const t = demoModel(); t.site.plotW = 9; ok(fl(t).includes('plleft'), 'a 9 m wide plot is narrower than the building');
  const r = RUL.mumbaiFsi('island', 12); ok(r.basic === 1.33 && r.max === 2.4 && RUL.mumbaiFsi('suburbs', 8).max === 1.0 && RUL.mumbaiFsi('suburbs', 30).max === 2.5, 'Mumbai FSI table lookups');
  const h = demoModel(); h.settings.floors = 6; h.site.maxHeight = 40; ok(fl(h).includes('fsip') && !fl(h).includes('fsi'), `6 floors on a 9 m road needs premium FSI (${fsiFor(h).text})`);
  h.site.roadWidth = 8; ok(fl(h).includes('fsi'), '6 floors on an 8 m road exceeds the FSI');
  const o = demoModel(); o.rules = { habArea2: 6.5 }; ok(!compliance(o, estimate(o)).some(f => f.title.includes('Bedroom 2')), 'changing a rule value re-checks the plan');
  const two = compliance(d, estimate(d)).find(f => f.title.includes('Bedroom 2'))!; ok(two.detail.includes('7.5') && two.basis === 'unverified', 'second bedroom is checked against the smaller size and shows how far the rule is checked');
}
