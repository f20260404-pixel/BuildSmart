import React from 'react';
import * as E from './engine';
import * as RU from './rules';
import { Num, Field, Pill, type Ctx } from './ui';

const tone = (b?: RU.Basis) => b === 'official' ? 'ok' : b === 'unverified' ? 'warn' : 'info';
export const BasisPill = ({ basis }: { basis?: RU.Basis }) => basis ? <Pill tone={tone(basis)}>{RU.BASIS_TEXT[basis]}</Pill> : null;
const SIDES: Record<E.Side, string> = { top: 'Top of the plan', bottom: 'Bottom of the plan', left: 'Left of the plan', right: 'Right of the plan' };

export function PlotCard({ m, update }: Ctx) {
  const st = m.site; const R = E.rulesOf(m).v; const mum = st.city === 'Mumbai';
  const setRule = (k: string, v: number) => update(x => { x.rules = { ...(x.rules || {}), [k]: v }; });
  const setDim = (k: 'plotW' | 'plotD', v: number) => update(x => { x.site[k] = v; x.site.plotArea = Math.round((x.site.plotW || 0) * (x.site.plotD || 0)); });
  return <section className="card"><h2>Plot and local limits</h2>
    <div className="grid2">
      <Field label="Plot width along the road (m)"><Num id="plotw" value={st.plotW || 0} min={3} max={500} step={0.5} onChange={v => setDim('plotW', v)} /></Field>
      <Field label="Plot depth (m)" hint={`Plot area ${E.num((st.plotW || 0) * (st.plotD || 0))} m²`}><Num id="plotd" value={st.plotD || 0} min={3} max={500} step={0.5} onChange={v => setDim('plotD', v)} /></Field>
      <Field label="The road is at the"><select id="front" value={st.front || 'top'} onChange={e => update(x => { x.site.front = e.target.value as E.Side; })}>{(Object.keys(SIDES) as E.Side[]).map(k => <option key={k} value={k}>{SIDES[k]}</option>)}</select></Field>
      <Field label="Road width (m)"><Num id="roadw" value={st.roadWidth ?? 9} min={3} max={90} step={0.5} onChange={v => update(x => { x.site.roadWidth = v; })} /></Field>
      {mum ? <Field label="Part of Mumbai" hint="Sets the FSI from DCPR 2034 Table 12"><select id="marea" value={st.area || 'suburbs'} onChange={e => update(x => { x.site.area = e.target.value as any; })}><option value="suburbs">Suburbs and extended suburbs</option><option value="island">Island City</option></select></Field>
        : <Field label="Permitted FSI" hint="From your local development control rules"><Num id="fsi" value={st.fsi} min={0.1} max={10} step={0.05} onChange={v => update(x => { x.site.fsi = v; })} /></Field>}
      <Field label="Maximum ground coverage (%)"><Num id="cov" value={st.maxCoverage} min={5} max={100} onChange={v => update(x => { x.site.maxCoverage = v; })} /></Field>
      <Field label="Front open space (m)"><Num id="sbf" value={R.sbFront} min={0} max={30} step={0.1} onChange={v => setRule('sbFront', v)} /></Field>
      <Field label="Side open space (m)"><Num id="sbs" value={R.sbSide} min={0} max={30} step={0.1} onChange={v => setRule('sbSide', v)} /></Field>
      <Field label="Rear open space (m)"><Num id="sbr" value={R.sbRear} min={0} max={30} step={0.1} onChange={v => setRule('sbRear', v)} /></Field>
      <Field label="Height limit for this plot (m)" hint="Airport, heritage or local cap"><Num id="maxh" value={st.maxHeight} min={3} max={300} step={0.5} onChange={v => update(x => { x.site.maxHeight = v; })} /></Field>
      <Field label="North direction (degrees clockwise from up)"><Num id="north" value={st.northDeg} min={0} max={359} step={15} onChange={v => update(x => { x.site.northDeg = v; })} /></Field>
    </div>
    <label className="chk2"><input id="pcentre" type="checkbox" checked={st.centre !== false} onChange={e => update(x => { x.site.centre = e.target.checked; })} />Place the building in the middle of the buildable area</label>
    {st.centre === false && <div className="grid2"><Field label="Distance from the front boundary (m)"><Num id="gapf" value={st.gapFront ?? R.sbFront} min={0} max={200} step={0.1} onChange={v => update(x => { x.site.gapFront = v; })} /></Field><Field label={`Distance from the ${st.front === 'left' || st.front === 'right' ? 'top' : 'left'} boundary (m)`}><Num id="gapl" value={st.gapLeft ?? R.sbSide} min={0} max={200} step={0.1} onChange={v => update(x => { x.site.gapLeft = v; })} /></Field></div>}
    <p className="note">The plot outline and its open spaces are drawn on the Design step. The three open-space values are working defaults: replace them with the figures for your plot.</p>
  </section>;
}

export function EnvelopeCard({ m, est }: Ctx) {
  const p = E.plotInfo(m); const f = E.fsiFor(m); if (!p.has) return null;
  const used = est.builtUp / p.area; const iw = Math.max(0, p.inner.x1 - p.inner.x0), ih = Math.max(0, p.inner.y1 - p.inner.y0);
  const floorsBasic = est.geo.footprint > 0 ? Math.floor(f.basic * p.area / est.geo.footprint + 1e-6) : 0, floorsMax = est.geo.footprint > 0 ? Math.floor(f.max * p.area / est.geo.footprint + 1e-6) : 0;
  const order: E.Side[] = [p.front, ...(['top', 'bottom', 'left', 'right'] as E.Side[]).filter(s => s !== p.front)];
  return <section className="card report"><h2>What this plot allows</h2>
    <p className="lead">This {E.num(p.area)} m² plot can carry <b>{E.num(f.basic * p.area)} m²</b> of built-up area at the basic FSI of {f.basic}{f.max > f.basic ? <>, or {E.num(f.max * p.area)} m² with premium FSI and TDR</> : ''}. After the open spaces, the building can cover up to <b>{E.num(p.maxFootprint)} m²</b> ({iw.toFixed(1)} × {ih.toFixed(1)} m). The current design uses an FSI of <b className={used > f.max + 0.001 ? 'badtxt' : ''}>{used.toFixed(2)}</b> on a footprint of {E.num(est.geo.footprint)} m².</p>
    <div className="tiles"><div><span>Basic FSI</span><b>{f.basic}</b></div><div><span>Most FSI allowed</span><b>{f.max}</b></div><div><span>FSI used now</span><b className={used > f.max + 0.001 ? 'badtxt' : ''}>{used.toFixed(2)}</b></div><div><span>Floors at this footprint</span><b>{floorsBasic}{floorsMax > floorsBasic ? ` (${floorsMax} with premium)` : ''}</b></div><div><span>Largest footprint</span><b>{E.num(p.maxFootprint)} m²</b></div></div>
    <p className="note">{f.text}. <BasisPill basis={f.basis} /> <span className="clause">{f.clause}</span></p>
    <div className="tablewrap"><table><thead><tr><th>Side</th><th className="r">Open space needed</th><th className="r">In this design</th><th /></tr></thead><tbody>
      {order.map(sd => { const gap = p.gaps[sd], need = p.need[sd]; const ok = gap >= need - 0.01; return <tr key={sd}><td>{p.role[sd][0].toUpperCase() + p.role[sd].slice(1)} <span className="sub">{SIDES[sd].toLowerCase()}</span></td><td className="r tn">{need.toFixed(2)} m</td><td className="r tn">{p.bb ? gap.toFixed(2) + ' m' : 'no building yet'}</td><td>{p.bb && <Pill tone={ok ? 'ok' : 'bad'}>{ok ? 'Enough' : gap < 0 ? 'Crosses the boundary' : `Short by ${(need - gap).toFixed(2)} m`}</Pill>}</td></tr>; })}</tbody></table></div>
    <p className="note">FSI here is total built-up area ÷ plot area. Authorities leave some areas out of the FSI count, such as certain staircases, lift wells and parking, so the approved figure can be a little lower.</p>
  </section>;
}

export function RulesCard({ m, update }: Ctx) {
  const rr = E.rulesOf(m); const changed = Object.keys(m.rules || {}).length > 0;
  return <section className="card"><div className="dochead"><h2>Rules used: {rr.pack.name}</h2>{changed && <button className="ghost" onClick={() => update(x => { x.rules = {}; })}>Back to the pack's values</button>}</div>
    <p className="note">{rr.pack.note}</p>
    <details className="more"><summary>All {rr.pack.rules.filter(r => r.value > 0 || rr.v[r.key] > 0).length} rule values, with where each one comes from</summary>
      <div className="tablewrap"><table><thead><tr><th>Rule</th><th className="r">Value</th><th>Comes from</th><th>How far it is checked</th></tr></thead><tbody>
        {rr.pack.rules.filter(r => r.value > 0 || rr.v[r.key] > 0).map(r => <tr key={r.key}><td>{r.label}</td><td className="r"><Num id={'rule' + r.key} w={76} value={rr.v[r.key]} min={0} max={500} step={0.05} onChange={v => update(x => { x.rules = { ...(x.rules || {}), [r.key]: v }; })} /> <span className="sub inl">{r.unit}</span></td><td><span className="clause">{r.clause}</span></td><td><BasisPill basis={rr.def[r.key].basis} /></td></tr>)}</tbody></table></div>
      <p className="note">Change any value to match your authority's current rule; the plan is re-checked at once. A value you change is marked "Entered by you".</p></details>
  </section>;
}
