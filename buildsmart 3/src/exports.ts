// Files the app can hand over: the Excel workbook, the tender sheet for builders, and reading a filled tender sheet back.
import * as E from './engine';
import * as R from './rebar';
import * as S from './site';
import type { Model, Estimate } from './engine';
import type { Sheet, Cell } from './xlsx';
type Sched = ReturnType<typeof E.schedule>; type Tender = ReturnType<typeof E.analyseQuotes>;

export function workbook(name: string, m: Model, e: Estimate, sched: Sched, flags: E.Flag[], tender: Tender): Sheet[] {
  const plan = R.cuttingPlan(e.bars); const cf = S.cashflow(m, e, sched); const sheets: Sheet[] = [];
  sheets.push({ name: 'Summary', bold: [0], widths: [34, 46], rows: [['BuildSmart project summary', name], ['City', m.site.city], ['Seismic zone', m.site.zone], ['Soil', `${E.SOILS[m.site.soil].name}, ${m.site.sbc} kN/m2 (${m.site.soilSource === 'report' ? 'soil report' : 'presumptive'})`], ['Floors', m.settings.floors], ['Floor-to-floor height (m)', m.settings.f2f], ['Built-up area (m2)', e.builtUp], ['Carpet area per floor (m2)', e.geo.carpet], ['Total cost (Rs)', e.total], ['Cost per sq ft (Rs)', e.perSqft], ['Build time (days)', sched.totalDays], ['Finish date', sched.finish], ['Rule violations', flags.filter(f => f.sev === 'error').length], ['Foundation', e.st.found.basis], ['Columns', `${e.st.columns.length} columns, ${e.st.colBasis}`], ['Beams', e.st.beamBasis], ['Slab', e.st.slabBasis], ['Tender', tender.answer]] });
  const boq: Cell[][] = [['Item', 'Unit', 'Quantity', 'Material (Rs)', 'Labour (Rs)', 'Rate (Rs per unit)', 'Amount (Rs)']];
  e.boq.forEach(b => boq.push([b.label, b.unit, b.qty, b.mat, b.lab, b.rate, b.amount])); e.packages.forEach(p => boq.push([p.label + ' (' + p.basis + ')', '', null, null, null, null, p.amount]));
  boq.push(['Material buffer', '', null, null, null, null, e.bufferCost], [`Contingency, ${m.allow.contingencyPct} %`, '', null, null, null, null, e.contingency], ['Total', '', null, null, null, null, e.total]);
  sheets.push({ name: 'Bill of quantities', rows: boq, bold: [0, boq.length - 1], widths: [52, 8, 12, 14, 14, 16, 16] });
  sheets.push({ name: 'Materials to order', widths: [20, 8, 14, 10, 44, 14, 12, 14], rows: [['Material', 'Unit', 'Exact need', 'Buffer %', 'Why this buffer', 'Order quantity', 'Price (Rs)', 'Cost (Rs)'], ...e.matLines.map(l => [l.label, l.unit, l.net, l.bufPct, l.why, l.order, l.price, l.cost] as Cell[])] });
  sheets.push({ name: 'Schedule', widths: [36, 10, 8, 44], rows: [['Activity', 'Start day', 'Days', 'People'], ...sched.acts.map(a => [a.label, a.start + 1, a.days, a.crew] as Cell[])] });
  sheets.push({ name: 'Daily plan', widths: [6, 16, 34, 40, 10, 10, 12, 10, 10, 12, 10], rows: [['Day', 'Date', 'Work', 'People', 'Cement (bags)', 'Sand (m3)', 'Aggregate (m3)', 'Steel (kg)', 'Clay bricks', 'Fly-ash bricks', 'AAC (m3)'], ...sched.days.map(d => [d.day, d.date, d.label, d.crew, Math.ceil(d.mats.cement) || null, +d.mats.sand.toFixed(2) || null, +d.mats.agg.toFixed(2) || null, Math.round(d.mats.steel) || null, Math.round(d.mats.clay) || null, Math.round(d.mats.flyash) || null, +d.mats.aac.toFixed(2) || null] as Cell[])] });
  sheets.push({ name: 'Bar schedule', widths: [16, 34, 8, 8, 14, 12], rows: [['Member', 'Bar', 'Dia (mm)', 'Nos', 'Cut length (m)', 'Weight (kg)'], ...R.mergedSchedule(e.bars).map(b => [b.group, b.mark, b.dia, b.n, b.len, b.kg] as Cell[])] });
  const cuts: Cell[][] = [['Dia (mm)', 'Bars of 12 m', 'Cut each bar into (m)', 'Offcut (m)']]; plan.plans.forEach(p => p.patterns.forEach(pt => cuts.push([p.dia, pt.bars, pt.cuts.map(c => c.toFixed(2)).join(' + '), pt.offcut])));
  cuts.push([], ['Dia (mm)', 'Bars to buy', 'Weight to buy (kg)', 'Offcut %']); const cb = cuts.length - 1; plan.plans.forEach(p => cuts.push([p.dia, p.bars, p.kgBuy, +p.wastePct.toFixed(1)]));
  sheets.push({ name: 'Steel cutting list', rows: cuts, bold: [0, cb], widths: [10, 14, 70, 12] });
  sheets.push({ name: 'Cash flow', widths: [8, 12, 36, 14, 14, 20, 14, 14], rows: [['Week', 'From', 'Main work', 'Materials (Rs)', 'Labour (Rs)', 'Finishes and services (Rs)', 'This week (Rs)', 'Total so far (Rs)'], ...cf.weeks.map(w => [w.n, w.from, w.main, w.materials, w.labour, w.other, w.amount, w.cum] as Cell[])] });
  sheets.push({ name: 'Rules', widths: [34, 10, 80, 50, 40], rows: [['Finding', 'Level', 'Detail', 'Fix', 'Rule'], ...flags.map(f => [f.title, f.sev === 'error' ? 'Violation' : 'Warning', f.detail, f.fix || '', f.clause] as Cell[])] });
  if (tender.results.length) { const head: Cell[] = ['Item', 'Unit', 'Quantity', 'Our rate (Rs)']; tender.results.forEach(r => head.push(`${r.q.name} (${r.q.type === 'labour_only' ? 'labour only' : 'with material'})`)); const rows: Cell[][] = [head];
    e.boq.filter(b => E.TENDER_ITEMS.includes(b.key)).forEach(b => rows.push([b.label, b.unit, b.qty, b.rate, ...tender.results.map(r => r.q.rates[b.key] ?? null)]));
    rows.push(['Total for this work (Rs)', '', null, tender.estTotal, ...tender.results.map(r => r.total)]); sheets.push({ name: 'Quotes', rows, bold: [0, rows.length - 1], widths: [46, 8, 12, 14, ...tender.results.map(() => 30)] }); }
  if ((m.stock || []).length || (m.expenses || []).length) { const names: Record<string, string> = {}; e.matLines.forEach(l => names[l.key] = l.label);
    const rows: Cell[][] = [['Date', 'Entry', 'Material or item', 'Quantity', 'Price or amount (Rs)', 'Note']]; (m.stock || []).forEach(s => rows.push([s.date, s.type, names[s.mat] || s.mat, s.qty, s.price, s.note])); (m.expenses || []).forEach(x => rows.push([x.date, 'extra expense', x.desc, null, x.amount, x.reason])); sheets.push({ name: 'Stock and expenses', rows, widths: [12, 14, 40, 12, 18, 30] }); }
  return sheets;
}

// ---------- tender sheet: a blank quote form a builder fills in, and reading it back ----------
export function tenderSheet(name: string, m: Model, e: Estimate): Cell[][] {
  const rows: Cell[][] = [['BuildSmart tender sheet'], ['Project', name], ['City', m.site.city], ['Builder name', ''], ['Quote type (with material / labour only)', 'with material'], ['Completion time (weeks)', ''], [],
  ['Code', 'Item', 'Unit', 'Quantity', 'Your rate (Rs per unit)']];
  e.boq.filter(b => E.TENDER_ITEMS.includes(b.key)).forEach(b => rows.push([b.key, b.label, b.unit, +b.qty.toFixed(b.qty < 100 ? 1 : 0), '']));
  rows.push([], ['Fill in the last column and the three lines at the top, then send this file back. Do not change the Code column.']);
  return rows;
}
export function readTenderSheet(rows: string[][]): { name: string; type: 'with_material' | 'labour_only'; weeks: number | null; rates: Record<string, number | null>; found: number } {
  let name = '', type: 'with_material' | 'labour_only' = 'with_material', weeks: number | null = null; const rates: Record<string, number | null> = {}; let found = 0;
  const numOf = (s: string) => { const v = parseFloat(String(s || '').replace(/[₹,\s]|rs\.?/gi, '')); return isFinite(v) && v > 0 ? v : null; };
  rows.forEach(r => {
    const k = (r[0] || '').trim().toLowerCase(); const v = (r[1] || '').trim();
    if (k.startsWith('builder name')) name = v; else if (k.startsWith('quote type')) type = /labou?r/i.test(v) ? 'labour_only' : 'with_material'; else if (k.startsWith('completion time')) weeks = numOf(v);
    else if (E.TENDER_ITEMS.includes(k)) { const rate = numOf(r[4]); rates[k] = rate; if (rate) found++; }
  });
  return { name, type, weeks, rates, found };
}
