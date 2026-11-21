import React, { useMemo, useState } from 'react';
import * as E from './engine';
import * as R from './rebar';
import * as S from './site';
import { Num, Field, Pill, qty, type Ctx } from './ui';

// ---------- steel: bar schedule and cutting list ----------
export function SteelPanel({ m, update, est }: Ctx) {
  const plan = useMemo(() => R.cuttingPlan(est.bars), [est.bars]); const sched = useMemo(() => R.mergedSchedule(est.bars), [est.bars]);
  const [dia, setDia] = useState<number | null>(null); const cur = plan.plans.find(p => p.dia === dia) || plan.plans[plan.plans.length - 1];
  const steelPrice = E.price(m, 'steel'); const saved = plan.kgNaive - plan.kgBuy;
  if (!plan.plans.length) return <section className="card"><p className="note">Draw a building first; the bar schedule is worked out from its footings, columns, beams and slabs.</p></section>;
  return <>
    <section className="card report"><h2>Steel cutting list</h2>
      <p className="lead">The bar schedule needs <b>{E.num(plan.kgNeed)} kg</b> of steel. Cut to the plan below, that is <b>{E.num(plan.barsTotal)} bars</b> of 12 m ({E.num(plan.kgBuy)} kg) with <b>{plan.wastePct.toFixed(1)} %</b> left as offcuts. Cutting each length from its own bars, the usual way on site, takes {E.num(plan.plans.reduce((a, p) => a + p.naiveBars, 0))} bars and wastes {plan.naivePct.toFixed(1)} %. The plan saves <b>{E.num(saved)} kg</b>, about {E.inr(saved * steelPrice)}.</p>
      <div className="tiles"><div><span>Steel in the building</span><b>{E.num(plan.kgNeed / 1000, 2)} t</b></div><div><span>Bars to buy</span><b>{E.num(plan.barsTotal)}</b></div><div><span>Offcut with the plan</span><b>{plan.wastePct.toFixed(1)} %</b></div><div><span>Offcut without it</span><b>{plan.naivePct.toFixed(1)} %</b></div><div><span>Saved</span><b>{E.inr(saved * steelPrice)}</b></div></div>
      <label className="chk2"><input id="steelbars" type="checkbox" checked={!!m.settings.steelFromBars} onChange={e => update(x => { x.settings.steelFromBars = e.target.checked; })} />Use this bar schedule for the steel quantity in the estimate</label>
      <p className="note">The estimate {m.settings.steelFromBars ? 'now uses' : 'currently uses'} {m.settings.steelFromBars ? 'the bar schedule' : 'planning allowances in kg per m³ of concrete'}: {E.num(est.mats.steel)} kg. Allowances give {E.num(est.steelThumb)} kg and the bar schedule gives {E.num(est.steelBars)} kg.</p>
    </section>
    <div className="two">
      <section className="card"><h2>Bars to buy, by diameter</h2>
        <div className="tablewrap"><table><thead><tr><th>Diameter</th><th className="r">Pieces</th><th className="r">Needed</th><th className="r">12 m bars</th><th className="r">Weight to buy</th><th className="r">Offcut</th><th className="r">Without plan</th></tr></thead><tbody>
          {plan.plans.map(p => <tr key={p.dia} className={cur && cur.dia === p.dia ? 'rowon' : ''}><td><button className="linkbtn" onClick={() => setDia(p.dia)}>{p.dia} mm</button></td><td className="r tn">{E.num(p.pieces)}</td><td className="r tn">{E.num(p.needM)} m</td><td className="r tn"><b>{E.num(p.bars)}</b></td><td className="r tn">{E.num(p.kgBuy)} kg</td><td className="r tn">{p.wastePct.toFixed(1)} %</td><td className="r tn">{E.num(p.naiveBars)} bars</td></tr>)}
          <tr className="total"><td>Total</td><td /><td /><td className="r tn">{E.num(plan.barsTotal)}</td><td className="r tn">{E.num(plan.kgBuy)} kg</td><td className="r tn">{plan.wastePct.toFixed(1)} %</td><td /></tr></tbody></table></div>
        <p className="note">Bars longer than 12 m are split into equal parts joined with a lap of 50 bar diameters. Cut lengths are rounded up to 50 mm.</p>
        <details className="more"><summary>Full bar schedule ({sched.length} lines)</summary>
          <div className="tablewrap"><table><thead><tr><th>Member</th><th>Bar</th><th className="r">Dia</th><th className="r">Nos</th><th className="r">Cut length</th><th className="r">Weight</th></tr></thead><tbody>
            {sched.map((b, i) => <tr key={i}><td>{b.group}</td><td>{b.mark}</td><td className="r tn">{b.dia} mm</td><td className="r tn">{E.num(b.n)}</td><td className="r tn">{b.len.toFixed(2)} m</td><td className="r tn">{E.num(b.kg)} kg</td></tr>)}</tbody></table></div>
          <p className="note">Detailing rules: footing mesh 12 mm at 150; column bars sized to 1 % of the section with 8 mm ties at 150 (100 in seismic zones IV and V); beams with 2 or 3 bottom bars of 12 or 16 mm, 2 top bars of 12 mm and 8 mm stirrups; slabs with 10 mm at 150 on the short span, 8 mm at 150 on the long span and 10 mm top bars at supports.</p></details>
      </section>
      {cur && <section className="card"><h2>How to cut the {cur.dia} mm bars</h2>
        <p className="note">{E.num(cur.bars)} bars. Each line is one way of cutting a 12 m bar and how many bars to cut that way.{cur.splices ? ` Includes ${E.num(cur.splices)} lap joints for bars longer than 12 m.` : ''}</p>
        <div className="seg">{plan.plans.map(p => <button key={p.dia} className={cur.dia === p.dia ? 'on' : ''} onClick={() => setDia(p.dia)}>{p.dia} mm</button>)}</div>
        <div className="tablewrap cuts"><table><thead><tr><th className="r">Bars</th><th>Cut each bar into (m)</th><th className="r">Offcut</th></tr></thead><tbody>
          {cur.patterns.map((p, i) => <tr key={i}><td className="r tn"><b>{E.num(p.bars)}</b></td><td><span className="cutbar" aria-hidden="true">{p.cuts.map((c, j) => <i key={j} style={{ flex: c }} />)}{p.offcut > 0.001 && <i className="off" style={{ flex: p.offcut }} />}</span>{groupCuts(p.cuts)}</td><td className="r tn">{p.offcut > 0.001 ? p.offcut.toFixed(2) + ' m' : 'none'}</td></tr>)}</tbody></table></div>
        {cur.reusableM > 0 && <p className="note">{E.num(cur.reusableM)} m of the offcuts are pieces of 1 m or longer. Keep them for chairs, lintel bars and site repairs.</p>}
      </section>}
    </div>
  </>;
}
function groupCuts(cuts: number[]): string { const out: string[] = []; let i = 0; while (i < cuts.length) { let j = i; while (j < cuts.length && cuts[j] === cuts[i]) j++; out.push((j - i > 1 ? `${j - i} × ` : '') + cuts[i].toFixed(2)); i = j; } return out.join('  +  '); }

// ---------- stock checklist, deliveries, extra expenses ----------
const REASONS: Record<E.Expense['reason'], string> = { urgent: 'Urgent local purchase', price: 'Price went up', rework: 'Rework', other: 'Other' };
export function StockPanel({ m, update, est, sched }: Ctx) {
  const v = useMemo(() => S.stockSummary(m, est, sched), [m, est, sched]);
  const [f, setF] = useState<{ mat: string; type: E.StockEntry['type']; qty: number; price: number; date: string; note: string }>({ mat: est.matLines[0]?.key || 'cement', type: 'ordered', qty: 0, price: 0, date: S.todayIso(), note: '' });
  const [x, setX] = useState<{ desc: string; amount: number; reason: E.Expense['reason']; date: string }>({ desc: '', amount: 0, reason: 'urgent', date: S.todayIso() });
  const line = est.matLines.find(l => l.key === f.mat); const entries = [...(m.stock || [])].sort((a, b) => b.date.localeCompare(a.date));
  const add = () => { if (!(f.qty > 0)) return; update(d => { (d.stock = d.stock || []).push({ id: E.uid('s'), mat: f.mat, type: f.type, qty: f.qty, price: f.type === 'issued' ? null : (f.price > 0 ? f.price : null), date: f.date, note: f.note }); }); setF({ ...f, qty: 0, note: '' }); };
  const orderAll = () => update(d => { d.stock = d.stock || []; v.rows.forEach(r => { if (r.toOrder > 0) d.stock!.push({ id: E.uid('s'), mat: r.key, type: 'ordered', qty: r.toOrder, price: r.plannedPrice, date: S.todayIso(), note: 'Full planned quantity' }); }); });
  const addX = () => { if (!(x.amount > 0) || !x.desc.trim()) return; update(d => { (d.expenses = d.expenses || []).push({ id: E.uid('x'), ...x }); }); setX({ ...x, desc: '', amount: 0 }); };
  const names: Record<string, string> = {}; est.matLines.forEach(l => names[l.key] = l.label); const units: Record<string, string> = {}; est.matLines.forEach(l => units[l.key] = l.unit);
  const tone = (s: S.StockRow['status']) => s === 'low' ? 'bad' : s === 'await' || s === 'order' ? 'warn' : s === 'none' ? 'info' : 'ok';
  const low = v.rows.filter(r => r.status === 'low').length, late = v.rows.filter(r => r.status === 'await').length;
  return <>
    <section className="card report"><h2>Stock and expenses</h2>
      <p className="lead">{(m.stock || []).length === 0 ? 'Nothing has been ordered yet. Record each order, delivery and issue here and this page keeps the running position.' : <>{low ? <><b className="badtxt">{low} material{low > 1 ? 's are' : ' is'} short</b> for the next three working days. </> : 'Stock on site covers the next three working days. '}{late ? `${late} order${late > 1 ? 's are' : ' is'} still to be delivered. ` : ''}</>} Deliveries so far cost {E.inr(v.paid)}{Math.abs(v.variance) > 50 ? <>, <b className={v.variance > 0 ? 'badtxt' : ''}>{E.inr(Math.abs(v.variance))} {v.variance > 0 ? 'more' : 'less'}</b> than planned prices</> : ''}, and extra expenses add {E.inr(v.extra)}. The forecast final cost is <b>{E.inrFull(v.forecast)}</b> against an estimate of {E.inrFull(est.total)}.</p>
      <div className="tiles"><div><span>Estimate</span><b>{E.inr(est.total)}</b></div><div><span>Paid for deliveries</span><b>{E.inr(v.paid)}</b></div><div><span>Price difference</span><b className={v.variance > 50 ? 'badtxt' : ''}>{v.variance > 0 ? '+' : v.variance < 0 ? '−' : ''}{E.inr(Math.abs(v.variance)).replace('−', '')}</b></div><div><span>Extra expenses</span><b className={v.extra > 0 ? 'badtxt' : ''}>{E.inr(v.extra)}</b></div><div><span>Forecast final cost</span><b>{E.inr(v.forecast)}</b></div></div>
    </section>
    <section className="card"><div className="dochead"><h2>Material checklist</h2>{v.rows.some(r => r.toOrder > 0) && <button onClick={orderAll}>Mark everything left as ordered</button>}</div>
      <div className="tablewrap"><table><thead><tr><th>Material</th><th className="r">Planned</th><th className="r">Ordered</th><th className="r">Received</th><th className="r">Awaited</th><th className="r">Issued</th><th className="r">On site</th><th className="r">Left to order</th><th>Status</th></tr></thead><tbody>
        {v.rows.map(r => <tr key={r.key}><td>{r.label}</td><td className="r tn">{qty(r.planned, r.unit)}</td><td className="r tn">{qty(r.ordered)}</td><td className="r tn">{qty(r.received)}</td><td className="r tn">{r.pending > 0 ? <b>{qty(r.pending)}</b> : '0'}</td><td className="r tn">{qty(r.issued)}{v.started && r.plannedUse > 0.5 && r.issued > r.plannedUse * 1.05 && <span className="sub badtxt">{((r.issued / r.plannedUse - 1) * 100).toFixed(0)} % over plan to date</span>}</td><td className="r tn"><b>{qty(r.onSite)}</b></td><td className="r tn">{qty(r.toOrder)}</td><td><Pill tone={tone(r.status)}>{r.statusText}</Pill></td></tr>)}</tbody></table></div>
      <div className="formrow">
        <Field label="Record"><select id="stype" value={f.type} onChange={e => setF({ ...f, type: e.target.value as any })}><option value="ordered">An order placed</option><option value="received">A delivery received</option><option value="issued">Material issued to work</option></select></Field>
        <Field label="Material"><select id="smat" value={f.mat} onChange={e => setF({ ...f, mat: e.target.value })}>{est.matLines.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}</select></Field>
        <Field label={`Quantity (${line?.unit || ''})`}><Num id="sqty" w={96} value={f.qty} min={0} onChange={q => setF({ ...f, qty: q })} /></Field>
        {f.type !== 'issued' && <Field label={`Price paid per ${line?.unit === 'bags' ? 'bag' : line?.unit === 'nos' ? 'piece' : line?.unit || 'unit'} (₹)`} hint={`Planned: ${E.inrFull(line?.price || 0)}`}><Num id="sprice" w={96} value={f.price} min={0} step={0.5} onChange={p => setF({ ...f, price: p })} /></Field>}
        <Field label="Date"><input id="sdate" type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Note"><input id="snote" type="text" value={f.note} onChange={e => setF({ ...f, note: e.target.value })} placeholder="Vendor, challan no." /></Field>
        <button className="primary" disabled={!(f.qty > 0)} onClick={add}>Add</button>
      </div>
      <p className="note">Leave the price at 0 to use the planned price. "Short" compares stock on site with what the next three working days of the site plan need.</p>
      {entries.length > 0 && <details className="more"><summary>All entries ({entries.length})</summary><div className="tablewrap"><table><thead><tr><th>Date</th><th>Entry</th><th>Material</th><th className="r">Quantity</th><th className="r">Price</th><th>Note</th><th /></tr></thead><tbody>
        {entries.map(s => <tr key={s.id}><td className="tn">{s.date}</td><td>{s.type === 'ordered' ? 'Ordered' : s.type === 'received' ? 'Received' : 'Issued'}</td><td>{names[s.mat] || s.mat}</td><td className="r tn">{qty(s.qty, units[s.mat])}</td><td className="r tn">{s.price ? E.inrFull(s.price) : s.type === 'issued' ? '' : 'planned'}</td><td>{s.note}</td><td className="r"><button className="ghost sm" onClick={() => update(d => { d.stock = (d.stock || []).filter(y => y.id !== s.id); })}>Remove</button></td></tr>)}</tbody></table></div></details>}
    </section>
    <section className="card"><h2>Extra expenses</h2>
      <p className="note">Anything outside the plan: an urgent purchase from the local market at a higher price, rework, a price rise. Each entry is added to the forecast final cost.</p>
      {(m.expenses || []).length > 0 && <div className="tablewrap"><table><thead><tr><th>Date</th><th>What</th><th>Why</th><th className="r">Amount</th><th /></tr></thead><tbody>
        {(m.expenses || []).map(e => <tr key={e.id}><td className="tn">{e.date}</td><td>{e.desc}</td><td>{REASONS[e.reason]}</td><td className="r tn">{E.inrFull(e.amount)}</td><td className="r"><button className="ghost sm" onClick={() => update(d => { d.expenses = (d.expenses || []).filter(y => y.id !== e.id); })}>Remove</button></td></tr>)}
        <tr className="total"><td>Total</td><td /><td /><td className="r tn">{E.inrFull(v.extra)}</td><td /></tr></tbody></table></div>}
      <div className="formrow">
        <Field label="What was bought or done"><input id="xdesc" type="text" value={x.desc} onChange={e => setX({ ...x, desc: e.target.value })} placeholder="e.g. 20 bags cement from local dealer" style={{ width: 280 }} /></Field>
        <Field label="Extra cost (₹)"><Num id="xamt" w={110} value={x.amount} min={0} step={100} onChange={a => setX({ ...x, amount: a })} /></Field>
        <Field label="Why"><select id="xwhy" value={x.reason} onChange={e => setX({ ...x, reason: e.target.value as any })}>{(Object.keys(REASONS) as E.Expense['reason'][]).map(k => <option key={k} value={k}>{REASONS[k]}</option>)}</select></Field>
        <Field label="Date"><input id="xdate" type="date" value={x.date} onChange={e => setX({ ...x, date: e.target.value })} /></Field>
        <button className="primary" disabled={!(x.amount > 0) || !x.desc.trim()} onClick={addX}>Add</button>
      </div>
    </section>
  </>;
}

// ---------- weekly cash flow ----------
export function CashPanel({ m, est, sched }: Ctx) {
  const cf = useMemo(() => S.cashflow(m, est, sched), [m, est, sched]); const max = Math.max(1, ...cf.weeks.map(w => w.amount));
  if (!cf.weeks.length) return <section className="card"><p className="note">Draw a building first to see the cash flow.</p></section>;
  const first4 = cf.weeks.slice(0, 4).reduce((a, w) => a + w.amount, 0);
  return <>
    <section className="card report"><h2>Cash flow</h2>
      <p className="lead">The build needs money over <b>{cf.weeks.length} weeks</b>. The heaviest week is week {cf.peak!.n} (from {cf.peak!.from}) at <b>{E.inr(cf.peak!.amount)}</b>, mostly for {cf.peak!.main.toLowerCase()}. The first four weeks need {E.inr(first4)}.</p>
      <div className="tiles"><div><span>Total</span><b>{E.inr(cf.total)}</b></div><div><span>Peak week</span><b>{E.inr(cf.peak!.amount)}</b></div><div><span>Average week</span><b>{E.inr(cf.total / cf.weeks.length)}</b></div><div><span>First 4 weeks</span><b>{E.inr(first4)}</b></div></div>
      <div className="weekchart" role="img" aria-label="Money needed each week">{cf.weeks.map(w => <div key={w.n} className="wk" title={`Week ${w.n}, from ${w.from}: ${E.inr(w.amount)}`}><span className="wkbar"><i className="l3" style={{ height: (w.other / max * 100) + '%' }} /><i className="l2" style={{ height: (w.labour / max * 100) + '%' }} /><i className="l1" style={{ height: (w.materials / max * 100) + '%' }} /></span><span className="wkn">{w.n}</span></div>)}</div>
      <ul className="stackkey"><li><i style={{ background: 'var(--c1)' }} />Materials and shuttering</li><li><i style={{ background: 'var(--c2)' }} />Labour</li><li><i style={{ background: 'var(--c6)' }} />Finishes, electrical, plumbing, doors and windows</li></ul>
    </section>
    <section className="card"><h2>Week by week</h2><div className="tablewrap"><table><thead><tr><th>Week</th><th>From</th><th>Main work</th><th className="r">Materials</th><th className="r">Labour</th><th className="r">Finishes and services</th><th className="r">This week</th><th className="r">Total so far</th></tr></thead><tbody>
      {cf.weeks.map(w => <tr key={w.n}><td className="tn">{w.n}</td><td className="tn">{w.from}</td><td>{w.main}</td><td className="r tn">{E.inr(w.materials)}</td><td className="r tn">{E.inr(w.labour)}</td><td className="r tn">{E.inr(w.other)}</td><td className="r tn"><b>{E.inr(w.amount)}</b></td><td className="r tn">{E.inr(w.cum)}</td></tr>)}</tbody></table></div>
      <p className="note">Each activity's cost is spread evenly over its days and paid in the week the work happens. Material buffer and contingency are spread in proportion. Curing weeks need little money.</p></section>
  </>;
}
