// Site-side calculations: stock position, extra expenses, budget against actual, weekly cash flow.
import * as E from './engine';
import type { Model, Estimate, Mats } from './engine';
type Sched = ReturnType<typeof E.schedule>;

const MK: (keyof Mats)[] = ['cement', 'sand', 'agg', 'clay', 'flyash', 'aac', 'steel'];
export const todayIso = () => E.isoDate(new Date());

export interface StockRow {
  key: string; label: string; unit: string; planned: number; ordered: number; received: number; issued: number; pending: number; onSite: number; toOrder: number;
  plannedPrice: number; paid: number; atPlanned: number; variance: number; need3: number; plannedUse: number; status: 'ok' | 'low' | 'await' | 'order' | 'none'; statusText: string;
}
export interface StockView { rows: StockRow[]; paid: number; atPlanned: number; variance: number; extra: number; forecast: number; dayIndex: number; started: boolean; finished: boolean }

export function stockSummary(m: Model, e: Estimate, sched: Sched, today = todayIso()): StockView {
  const days = sched.days; let dayIndex = days.findIndex(d => d.iso >= today); const finished = dayIndex < 0 && days.length > 0; if (dayIndex < 0) dayIndex = days.length;
  const started = days.length > 0 && days[0].iso <= today;
  const need3: Record<string, number> = {}, used: Record<string, number> = {}; MK.forEach(k => { need3[k] = 0; used[k] = 0; });
  let taken = 0; for (let i = dayIndex; i < days.length && taken < 3; i++) { if (days[i].wait) continue; taken++; MK.forEach(k => need3[k] += days[i].mats[k]); }
  for (let i = 0; i < dayIndex; i++) MK.forEach(k => used[k] += days[i].mats[k]);
  const st = m.stock || [];
  const rows: StockRow[] = e.matLines.map(l => {
    const mine = st.filter(s => s.mat === l.key); const sum = (t: string) => mine.filter(s => s.type === t).reduce((a, s) => a + s.qty, 0);
    const ordered = sum('ordered'), received = sum('received'), issued = sum('issued');
    const paid = mine.filter(s => s.type === 'received').reduce((a, s) => a + s.qty * (s.price ?? l.price), 0); const atPlanned = received * l.price;
    const pending = Math.max(0, ordered - received), onSite = received - issued, toOrder = Math.max(0, l.order - Math.max(ordered, received));
    let status: StockRow['status'] = 'ok', statusText = 'In hand';
    const u = (v: number) => `${E.num(v, v < 100 ? 1 : 0)} ${l.unit}`;
    if (ordered === 0 && received === 0) { status = 'none'; statusText = 'Not ordered yet'; }
    else if (onSite < need3[l.key] - 1e-6) { status = 'low'; statusText = `Short for the next 3 working days (need ${u(need3[l.key])})`; }
    else if (pending > 0) { status = 'await'; statusText = `${u(pending)} still to be delivered`; }
    else if (toOrder > 0) { status = 'order'; statusText = `${u(toOrder)} left to order`; }
    else if (onSite <= 1e-6 && issued > 0) { statusText = 'All issued'; }
    return { key: l.key, label: l.label, unit: l.unit, planned: l.order, ordered, received, issued, pending, onSite, toOrder, plannedPrice: l.price, paid, atPlanned, variance: paid - atPlanned, need3: need3[l.key], plannedUse: used[l.key], status, statusText };
  });
  const paid = rows.reduce((a, r) => a + r.paid, 0), atPlanned = rows.reduce((a, r) => a + r.atPlanned, 0);
  const extra = (m.expenses || []).reduce((a, x) => a + x.amount, 0);
  return { rows, paid, atPlanned, variance: paid - atPlanned, extra, forecast: e.total + (paid - atPlanned) + extra, dayIndex, started, finished };
}

export interface Week { n: number; from: string; amount: number; cum: number; main: string; materials: number; labour: number; other: number }
export function cashflow(m: Model, e: Estimate, sched: Sched): { weeks: Week[]; total: number; peak: Week | null; scale: number } {
  const ohp = 1 + m.allow.ohpPct / 100; const days = sched.days; if (!days.length) return { weeks: [], total: 0, peak: null, scale: 1 };
  const cost = sched.acts.map(a => {
    if (a.key === 'finish') return { mat: 0, lab: 0, oth: e.finishes + e.other };
    const mat = MK.reduce((s, k) => s + a.mats[k] * E.price(m, k), 0) + a.shutter * m.allow.shutterHire;
    return { mat: mat * ohp, lab: a.lab * ohp, oth: 0 };
  });
  const base = cost.reduce((s, c) => s + c.mat + c.lab + c.oth, 0); const scale = base > 0 ? e.total / base : 1; // spreads buffer and contingency in proportion
  const t0 = new Date(days[0].iso + 'T00:00:00').getTime(); const weeks: Week[] = []; const byAct: Record<number, Record<number, number>> = {};
  days.forEach(d => {
    const a = sched.acts[d.act], c = cost[d.act]; const wk = Math.floor((new Date(d.iso + 'T00:00:00').getTime() - t0) / (7 * 864e5) + 1e-6);
    while (weeks.length <= wk) { const f = new Date(t0 + weeks.length * 7 * 864e5); weeks.push({ n: weeks.length + 1, from: f.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), amount: 0, cum: 0, main: '', materials: 0, labour: 0, other: 0 }); }
    const mat = c.mat / a.days * scale, lab = c.lab / a.days * scale, oth = c.oth / a.days * scale;
    weeks[wk].materials += mat; weeks[wk].labour += lab; weeks[wk].other += oth; weeks[wk].amount += mat + lab + oth;
    byAct[wk] = byAct[wk] || {}; byAct[wk][d.act] = (byAct[wk][d.act] || 0) + mat + lab + oth;
  });
  let cum = 0; weeks.forEach((w, i) => { cum += w.amount; w.cum = cum; const b = byAct[i] || {}; const top = Object.keys(b).sort((x, y) => b[+y] - b[+x])[0]; w.main = top !== undefined ? sched.acts[+top].label : 'No work'; });
  const peak = weeks.reduce<Week | null>((p, w) => (!p || w.amount > p.amount ? w : p), null);
  return { weeks, total: cum, peak, scale };
}
