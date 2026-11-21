import React, { useMemo, useRef, useState } from 'react';
import * as E from './engine';
import * as Store from './store';
import { compare } from './versions';
import { workbook } from './exports';
import { buildXlsx, saveFile, zipStore } from './xlsx';
import { toDxf, toSvg } from './dxf';
import { Field, Pill, type Ctx } from './ui';

const when = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); };
const safe = (s: string) => s.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_').slice(0, 60) || 'project';
const fmt = (v: number, u: string) => u === 'inr' ? E.inr(v) : u === 'm2' ? E.num(v, 1) + ' m²' : u === 'days' ? E.num(v) + ' days' : u === 'kg' ? E.num(v) + ' kg' : u === 'bags' ? E.num(v) + ' bags' : E.num(v);

export function ProjectTab(ctx: Ctx & { pid: string; openProject: (id: string) => void; refresh: () => void }) {
  const { m, replace, est, sched, flags, tender, pid, pname, openProject, refresh } = ctx;
  const [, bump] = useState(0); const re = () => { bump(x => x + 1); refresh(); };
  const projects = Store.listProjects(); const versions = Store.listVersions(pid);
  const [vname, setVname] = useState(''); const [cmpId, setCmpId] = useState<string | null>(null); const [msg, setMsg] = useState(''); const [confirm, setConfirm] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cmpV = versions.find(v => v.id === cmpId) || null; const cmp = useMemo(() => cmpV ? compare(cmpV.model, m) : null, [cmpV, m]);
  const say = (s: string) => { setMsg(s); setTimeout(() => setMsg(''), 5000); };
  const dl = async (filename: string, data: string | Uint8Array) => { const r = await saveFile(filename, data); say(r === 'saved' ? `${filename} is ready.` : r === 'declined' ? 'Download cancelled.' : 'Downloads are not available in this view. Open the page on its own link and try again.'); };
  const importFile = async (f: File) => { try { const j = JSON.parse(await f.text()); const model = j && j.model ? j.model : j; if (!Store.validModel(model)) throw new Error('bad'); const id = Store.createProject((j && j.name) || f.name.replace(/\.json$/i, ''), Store.upgrade(model)); openProject(id); say('Project imported and opened.'); } catch { say('That file is not a BuildSmart project file.'); } };
  return <div className="page">
    <section className="card report"><h2>Project</h2>
      <p className="lead"><b>{pname}</b> is saved in this browser as you work. It has {versions.length} saved version{versions.length === 1 ? '' : 's'}. Download the project file to keep a copy or move it to another computer.</p>
      <div className="formrow first">
        <Field label="Project name"><input id="pname" type="text" style={{ width: 300 }} value={pname} onChange={e => { Store.renameProject(pid, e.target.value); re(); }} /></Field>
        <button className="primary" onClick={() => dl(safe(pname) + '.xlsx', buildXlsx(workbook(pname, m, est, sched, flags, tender)))}>Download Excel workbook</button>
        <button onClick={() => dl(safe(pname) + '.json', JSON.stringify({ app: 'BuildSmart', name: pname, saved: new Date().toISOString(), model: m }))}>Download project file</button>
        <button onClick={() => dl(safe(pname) + '_plan.svg', toSvg(m, est, pname))}>Download the plan drawing (SVG)</button>
        <button onClick={() => dl(safe(pname) + '_dxf.zip', zipStore([{ name: safe(pname) + '.dxf', data: new TextEncoder().encode(toDxf(m, est)) }]))}>Download the CAD drawing (DXF, zipped)</button>
        <button onClick={() => fileRef.current?.click()}>Import a project file</button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={e => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ''; }} />
      </div>
      {msg && <p className="okmsg" role="status">{msg}</p>}
      <p className="note">The Excel workbook has the bill of quantities, materials to order, schedule, daily plan, bar schedule, steel cutting list, cash flow, rule findings and quote comparison on separate sheets.</p>
    </section>
    <div className="two">
      <section className="card"><h2>Versions</h2>
        <p className="note">Save a version before a big change. You can compare any version with the current design, or go back to it.</p>
        <div className="formrow first"><Field label="Name this version"><input id="vname" type="text" style={{ width: 260 }} value={vname} onChange={e => setVname(e.target.value)} placeholder="e.g. Before switching to AAC" /></Field><button className="primary" onClick={() => { Store.saveVersion(pid, vname.trim() || 'Version ' + (versions.length + 1), m); setVname(''); re(); }}>Save this version</button></div>
        {versions.length > 0 && <div className="tablewrap"><table><thead><tr><th>Version</th><th>Saved</th><th className="r">Cost</th><th /></tr></thead><tbody>
          {versions.map(v => <VersionRow key={v.id} v={v} on={cmpId === v.id} onCompare={() => setCmpId(cmpId === v.id ? null : v.id)} onRestore={() => { replace(E.clone(v.model)); say(`Went back to "${v.name}". Undo brings the newer design back.`); }} onDelete={() => { Store.deleteVersion(pid, v.id); if (cmpId === v.id) setCmpId(null); re(); }} />)}</tbody></table></div>}
      </section>
      <section className="card"><h2>Your projects</h2>
        <div className="tablewrap"><table><thead><tr><th>Project</th><th>Last changed</th><th /></tr></thead><tbody>
          {projects.map(p => <tr key={p.id} className={p.id === pid ? 'rowon' : ''}><td>{p.name} {p.id === pid && <Pill tone="info">open</Pill>}</td><td className="tn">{when(p.updated)}</td><td className="r acts">
            {p.id !== pid && <button className="sm" onClick={() => openProject(p.id)}>Open</button>}
            <button className="ghost sm" onClick={() => { const mm = Store.loadModel(p.id); if (mm) { Store.createProject(p.name + ' (copy)', mm); re(); } }}>Duplicate</button>
            {p.id !== pid && (confirm === p.id ? <button className="danger sm" onClick={() => { Store.deleteProject(p.id); setConfirm(null); re(); }}>Confirm delete</button> : <button className="ghost sm" onClick={() => setConfirm(p.id)}>Delete</button>)}</td></tr>)}</tbody></table></div>
        <div className="row"><button onClick={() => { const b = E.blankModel(); b.prices = E.clone(m).prices; b.labour = E.clone(m).labour; b.allow = E.clone(m).allow; openProject(Store.createProject('New project', b)); }}>New empty project</button><button onClick={() => openProject(Store.createProject('Sample building, Mumbai', E.demoModel()))}>New project from the sample</button></div>
        <p className="note">A new empty project keeps your current prices and labour rates.</p>
      </section>
    </div>
    {cmp && cmpV && <section className="card report"><h2>What changed since "{cmpV.name}"</h2>
      <p className="lead">The current design {Math.abs(cmp.dCost) < 50 ? 'costs the same' : <>costs <b className={cmp.dCost > 0 ? 'badtxt' : ''}>{E.inr(Math.abs(cmp.dCost))} {cmp.dCost > 0 ? 'more' : 'less'}</b></>}{cmp.dDays !== 0 ? <>, takes {Math.abs(cmp.dDays)} day{Math.abs(cmp.dDays) === 1 ? '' : 's'} {cmp.dDays > 0 ? 'longer' : 'less'}</> : ''}{cmp.dViol !== 0 ? <> and has {Math.abs(cmp.dViol)} {cmp.dViol > 0 ? 'more' : 'fewer'} rule violation{Math.abs(cmp.dViol) === 1 ? '' : 's'}</> : ''}.</p>
      <div className="two">
        <div><div className="tablewrap"><table><thead><tr><th>Measure</th><th className="r">{cmpV.name}</th><th className="r">Now</th><th className="r">Change</th></tr></thead><tbody>
          {cmp.rows.map(r => { const d = r.b - r.a; const good = r.better === 'none' || Math.abs(d) < 1e-6 ? '' : (r.better === 'down' ? d < 0 : d > 0) ? 'good' : 'bad'; return <tr key={r.label}><td>{r.label}</td><td className="r tn">{fmt(r.a, r.unit)}</td><td className="r tn">{fmt(r.b, r.unit)}</td><td className="r tn"><span className={'delta ' + (good || 'zero')}>{Math.abs(d) < (r.unit === 'inr' ? 50 : 0.05) ? 'no change' : (d > 0 ? '+' : '−') + fmt(Math.abs(d), r.unit).replace('−', '')}</span></td></tr>; })}</tbody></table></div>
          <h3>Design changes</h3>{cmp.changes.length ? <ul className="plain">{cmp.changes.map((c, i) => <li key={i}>{c}</li>)}</ul> : <p className="note">No design changes.</p>}</div>
        <div><div className="tablewrap"><table><thead><tr><th>Cost by item</th><th className="r">{cmpV.name}</th><th className="r">Now</th><th className="r">Change</th></tr></thead><tbody>
          {cmp.boq.map(b => { const d = b.b - b.a; return <tr key={b.label}><td>{b.label}</td><td className="r tn">{E.inr(b.a)}</td><td className="r tn">{E.inr(b.b)}</td><td className="r tn"><span className={'delta ' + (Math.abs(d) < 50 ? 'zero' : d < 0 ? 'good' : 'bad')}>{Math.abs(d) < 50 ? 'no change' : (d > 0 ? '+' : '−') + E.inr(Math.abs(d))}</span></td></tr>; })}</tbody></table></div></div>
      </div></section>}
  </div>;
}
function VersionRow({ v, on, onCompare, onRestore, onDelete }: { v: Store.Version; on: boolean; onCompare: () => void; onRestore: () => void; onDelete: () => void }) {
  const cost = useMemo(() => { try { return E.estimate(v.model).total; } catch { return 0; } }, [v]);
  return <tr className={on ? 'rowon' : ''}><td>{v.name}</td><td className="tn">{when(v.date)}</td><td className="r tn">{E.inr(cost)}</td><td className="r acts"><button className="sm" onClick={onCompare}>{on ? 'Hide comparison' : 'Compare with now'}</button><button className="ghost sm" onClick={onRestore}>Go back to it</button><button className="ghost sm" onClick={onDelete}>Delete</button></td></tr>;
}
