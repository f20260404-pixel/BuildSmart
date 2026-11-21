import React, { useMemo, useState } from 'react';
import * as E from './engine';
import { parseDxf, dxfToPlan, guessUnit, defaultLayers, UNITS, type PlanResult } from './dxf';
import { Field } from './ui';

export function ImportDialog({ text, name, onUse, onClose }: { text: string; name: string; onUse: (r: PlanResult) => void; onClose: () => void }) {
  const doc = useMemo(() => { try { return parseDxf(text); } catch { return null; } }, [text]);
  const [unit, setUnit] = useState(doc ? guessUnit(doc) : 'm'); const [layers, setLayers] = useState<string[]>(doc ? defaultLayers(doc) : []);
  const res = useMemo(() => { try { return doc && layers.length ? dxfToPlan(doc, unit, layers) : null; } catch { return null; } }, [doc, unit, layers]);
  const S = 100; const bad = !doc || !doc.segs.length;
  return <div className="modal" role="dialog" aria-label="Import a drawing"><div className="modalbox">
    <h2>Import {name}</h2>
    {bad ? <p className="errmsg">No lines could be read from this file. Save the drawing from your CAD program as an ASCII DXF (R12 or 2000 format) and try again. DWG files need to be saved as DXF first.</p> : <>
      <p className="lead">{res && res.walls.length ? <>Found <b>{res.walls.length} walls</b>, <b>{res.info.rooms} rooms</b> and {res.openings.length} doors and windows in a drawing {res.info.w.toFixed(1)} × {res.info.h.toFixed(1)} m. {res.info.mode === 'double' ? 'Walls were drawn as double lines and turned into centre lines.' : 'Lines were read as wall centre lines, 230 mm thick.'}</> : 'No walls found with these layers. Tick the layers that hold the walls.'}</p>
      <div className="grid2"><Field label="Drawing units" hint="Change this if the size above looks wrong"><select id="dxfunit" value={unit} onChange={e => setUnit(e.target.value)}>{Object.keys(UNITS).map(k => <option key={k} value={k}>{UNITS[k].label}</option>)}</select></Field>
        <div className="field"><span className="flabel">Layers to read as walls, doors and windows</span><div className="layers">{doc!.layers.map(l => <label key={l} className="chk2"><input type="checkbox" checked={layers.includes(l)} onChange={e => setLayers(e.target.checked ? [...layers, l] : layers.filter(x => x !== l))} />{l}</label>)}</div></div></div>
      {res && res.walls.length > 0 && <svg className="dxfprev" viewBox={`${-40} ${-40} ${res.info.w * S + 80} ${res.info.h * S + 80}`} role="img" aria-label="Preview of the imported walls">{res.walls.map(w => <line key={w.id} x1={w.a.x * S} y1={w.a.y * S} x2={w.b.x * S} y2={w.b.y * S} stroke="var(--ink)" strokeWidth={w.t * S} strokeLinecap="square" />)}{res.openings.map(o => { const w = res.walls.find(x => x.id === o.wallId); if (!w) return null; const c = E.lerp(w.a, w.b, o.pos); return <circle key={o.id} cx={c.x * S} cy={c.y * S} r={14} fill={o.kind === 'door' ? 'var(--warn)' : 'var(--glass)'} />; })}</svg>}
      <p className="note">Check the result on the plan after importing: a drawing with unusual layers or broken lines can leave a wall missing or add one. Doors are shown as amber dots and windows as blue dots. Undo brings your previous plan back.</p></>}
    <div className="row"><button className="primary" disabled={!res || !res.walls.length} onClick={() => res && onUse(res)}>Use this plan</button><button onClick={onClose}>Cancel</button></div>
  </div></div>;
}
