// 3D model view: an orbiting, shaded model drawn on a canvas, with cut-away, exploded floors, structure and sun study.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as E from './engine';
import type { Model, Pt } from './engine';
import { saveFile } from './xlsx';

type V3 = [number, number, number]; type RGB = [number, number, number];
interface Face { pts: V3[]; n: V3; col: RGB; a: number; line?: boolean }
type Mode = 'finished' | 'rooms' | 'white' | 'structure';
interface Opts { mode: Mode; floors: number; roof: boolean; cut: boolean; explode: number; hour: number; spin: boolean; labels: boolean }
const hex = (h: string): RGB => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const ROOMCOL: Record<string, RGB> = { bedroom: [176, 201, 240], living: [240, 222, 170], kitchen: [176, 222, 186], bath: [160, 214, 226], corridor: [214, 214, 220], other: [222, 224, 230] };
const SLAB: RGB = [226, 229, 234], CONC: RGB = [168, 174, 182], GLASS: RGB = [120, 190, 235], GROUND: RGB = [205, 214, 200], ROAD: RGB = [120, 124, 130], WHITE: RGB = [240, 241, 243];

function prism(out: Face[], c: Pt[], z0: number, z1: number, col: RGB, a = 1, top = true) {
  if (z1 - z0 < 0.005) return; const cx = (c[0].x + c[1].x + c[2].x + c[3].x) / 4, cy = (c[0].y + c[1].y + c[2].y + c[3].y) / 4;
  if (top) out.push({ pts: c.map(p => [p.x, p.y, z1] as V3), n: [0, 0, 1], col, a });
  for (let i = 0; i < 4; i++) {
    const p = c[i], q = c[(i + 1) % 4]; let nx = q.y - p.y, ny = -(q.x - p.x); const L = Math.hypot(nx, ny); if (L < 1e-6) continue; nx /= L; ny /= L;
    if (((p.x + q.x) / 2 - cx) * nx + ((p.y + q.y) / 2 - cy) * ny < 0) { nx = -nx; ny = -ny; }
    out.push({ pts: [[p.x, p.y, z0], [q.x, q.y, z0], [q.x, q.y, z1], [p.x, p.y, z1]], n: [nx, ny, 0], col, a });
  }
}
const plate = (out: Face[], poly: Pt[], z: number, col: RGB, a = 1) => out.push({ pts: poly.map(p => [p.x, p.y, z] as V3), n: [0, 0, 1], col, a });
const box = (x0: number, y0: number, x1: number, y1: number): Pt[] => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];

function buildScene(m: Model, est: E.Estimate, o: Opts) {
  const faces: Face[] = []; const labels: { p: V3; text: string; sub: string }[] = []; const s = m.settings; const fh = s.f2f; const st = est.st; const plot = E.plotInfo(m);
  const pts = m.walls.flatMap(w => [w.a, w.b]); if (!pts.length) return { faces, labels, c: [0, 0, 0] as V3, ext: 10 };
  const x0 = Math.min(...pts.map(p => p.x)), x1 = Math.max(...pts.map(p => p.x)), y0 = Math.min(...pts.map(p => p.y)), y1 = Math.max(...pts.map(p => p.y));
  const shown = Math.max(1, Math.min(o.floors, s.floors)); const zOf = (l: number) => l * (fh + o.explode); const topZ = zOf(shown - 1) + fh;
  // ground, plot and road
  const pad = 2.5; const g = plot.has ? box(plot.x0, plot.y0, plot.x1, plot.y1) : box(x0 - pad, y0 - pad, x1 + pad, y1 + pad); plate(faces, g, -0.03, GROUND, o.mode === 'structure' ? 0.45 : 1);
  if (plot.has) { const rw = Math.min(6, m.site.roadWidth ?? 6); const r = plot.front === 'top' ? box(plot.x0 - 1, plot.y0 - rw, plot.x1 + 1, plot.y0) : plot.front === 'bottom' ? box(plot.x0 - 1, plot.y1, plot.x1 + 1, plot.y1 + rw) : plot.front === 'left' ? box(plot.x0 - rw, plot.y0 - 1, plot.x0, plot.y1 + 1) : box(plot.x1, plot.y0 - 1, plot.x1 + rw, plot.y1 + 1); plate(faces, r, -0.035, ROAD); }
  const wallBox = (w: E.Wall, a: number, b: number, half: number): Pt[] => { const L = E.wlen(w), ux = (w.b.x - w.a.x) / L, uy = (w.b.y - w.a.y) / L, nx = -uy * half, ny = ux * half; const at = (q: number, sd: number): Pt => ({ x: w.a.x + ux * q + nx * sd, y: w.a.y + uy * q + ny * sd }); return [at(a, 1), at(b, 1), at(b, -1), at(a, -1)]; };
  if (o.mode === 'structure') {
    const f = st.found; const cw = st.col[1] / 2, cd = st.col[0] / 2;
    st.columns.forEach(c => {
      if (f.type === 'isolated') { prism(faces, box(c.x - f.side / 2, c.y - f.side / 2, c.x + f.side / 2, c.y + f.side / 2), -f.depth, -f.depth + f.thick, CONC); prism(faces, box(c.x - cw, c.y - cd, c.x + cw, c.y + cd), -f.depth + f.thick, 0, CONC, 1, false); }
      else if (f.type === 'pile') { prism(faces, box(c.x - 0.3, c.y - 0.3, c.x + 0.3, c.y + 0.3), -f.thick, 0, CONC); prism(faces, box(c.x - 0.15, c.y - 0.15, c.x + 0.15, c.y + 0.15), -f.depth, -f.thick, CONC, 1, false); }
    });
    if (f.type === 'raft') prism(faces, box(x0 - 0.4, y0 - 0.4, x1 + 0.4, y1 + 0.4), -f.depth, -f.depth + f.thick, CONC);
    m.walls.forEach(w => { if (E.wlen(w) > 0.2) prism(faces, wallBox(w, 0, E.wlen(w), 0.115), -0.3, 0, [150, 156, 166]); });
    for (let l = 0; l < shown; l++) {
      const z = zOf(l); st.columns.forEach(c => prism(faces, box(c.x - cw, c.y - cd, c.x + cw, c.y + cd), z, z + fh, [196, 120, 84]));
      m.walls.forEach(w => { if (E.wlen(w) > 0.2) prism(faces, wallBox(w, 0, E.wlen(w), st.beamW / 2), z + fh - st.beamD, z + fh, [92, 128, 190]); });
      est.geo.rooms.forEach(r => plate(faces, r.poly, z + fh + 0.01, SLAB, 0.38));
    }
  } else {
    for (let l = 0; l < shown; l++) {
      const z = zOf(l); const isTop = l === shown - 1; const hTop = o.cut && isTop ? Math.min(1.2, fh) : fh;
      est.geo.rooms.forEach(r => plate(faces, r.poly, z + 0.01, o.mode === 'rooms' ? ROOMCOL[r.type] : o.mode === 'white' ? WHITE : [232, 226, 214]));
      if (o.explode > 0.05 && l > 0) est.geo.rooms.forEach(r => plate(faces, r.poly, z - 0.12, SLAB));
      m.walls.forEach(w => {
        const L = E.wlen(w); if (L < 0.05) return; const col: RGB = o.mode === 'finished' ? hex(E.MATS[w.mat].color) : est.geo.ext.has(w.id) ? [246, 246, 248] : [232, 233, 237]; const h = w.t / 2;
        const ops = m.openings.filter(q => q.wallId === w.id).map(q => ({ q, a: Math.max(0, q.pos * L - q.w / 2), b: Math.min(L, q.pos * L + q.w / 2) })).sort((u, v) => u.a - v.a);
        let cur = 0;
        ops.forEach(({ q, a, b }) => {
          if (a - cur > 0.01) prism(faces, wallBox(w, cur, a, h), z, z + hTop, col);
          const sill = q.kind === 'window' ? Math.max(0, Math.min(0.9, fh - 0.3 - q.h)) : 0, head = Math.min(fh - 0.05, sill + q.h);
          if (sill > 0) prism(faces, wallBox(w, a, b, h), z, z + Math.min(sill, hTop), col);
          if (head < hTop) prism(faces, wallBox(w, a, b, h), z + head, z + hTop, col, 1);
          if (q.kind === 'window' && sill < hTop) prism(faces, wallBox(w, a, b, 0.02), z + sill, z + Math.min(head, hTop), GLASS, 0.5, false);
          cur = b;
        });
        if (L - cur > 0.01) prism(faces, wallBox(w, cur, L, h), z, z + hTop, col);
      });
      if (o.roof && isTop && !o.cut) { est.geo.rooms.forEach(r => plate(faces, r.poly, z + fh + 0.02, SLAB)); m.walls.forEach(w => { if (E.wlen(w) > 0.05) plate(faces, wallBox(w, 0, E.wlen(w), w.t / 2 + 0.01), z + fh + 0.03, SLAB); }); }
      if (isTop && o.labels && (o.cut || !o.roof)) est.geo.rooms.forEach(r => labels.push({ p: [r.c.x, r.c.y, z + 0.05], text: r.name, sub: r.carpet.toFixed(1) + ' m²' }));
    }
  }
  return { faces, labels, c: [(x0 + x1) / 2, (y0 + y1) / 2, topZ / 2] as V3, ext: Math.max(x1 - x0, y1 - y0, topZ) + (plot.has ? 6 : 3) };
}

export function View3D({ m, est }: { m: Model; est: E.Estimate }) {
  const cv = useRef<HTMLCanvasElement>(null); const wrap = useRef<HTMLDivElement>(null);
  const [cam, setCam] = useState({ az: -32, el: 30, zoom: 1 }); const [size, setSize] = useState({ w: 800, h: 600 }); const [msg, setMsg] = useState('');
  const [o, setO] = useState<Opts>({ mode: 'finished', floors: m.settings.floors, roof: true, cut: false, explode: 0, hour: 15, spin: false, labels: true });
  const set = (p: Partial<Opts>) => setO(v => ({ ...v, ...p })); const drag = useRef<{ x: number; y: number; az: number; el: number } | null>(null);
  useEffect(() => { if (o.floors > m.settings.floors) set({ floors: m.settings.floors }); }, [m.settings.floors]);
  const scene = useMemo(() => buildScene(m, est, o), [m, est, o.mode, o.floors, o.roof, o.cut, o.explode, o.labels]);
  useEffect(() => { const el = wrap.current; if (!el) return; const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight })); ro.observe(el); setSize({ w: el.clientWidth, h: el.clientHeight }); return () => ro.disconnect(); }, []);
  useEffect(() => { if (!o.spin) return; let id = 0, last = performance.now(); const tick = (t: number) => { const dt = t - last; last = t; setCam(c => ({ ...c, az: c.az + dt * 0.012 })); id = requestAnimationFrame(tick); }; id = requestAnimationFrame(tick); return () => cancelAnimationFrame(id); }, [o.spin]);
  const paint = (ctx: CanvasRenderingContext2D, W: number, H: number, ink: string) => {
    const th = cam.az * Math.PI / 180, ph = cam.el * Math.PI / 180, ct = Math.cos(th), sn = Math.sin(th), cp = Math.cos(ph), sp = Math.sin(ph); const sc = Math.min(W, H) / (scene.ext * 1.25) * cam.zoom; const [cx, cy, cz] = scene.c;
    // sun: east at 6, south at noon, west at 18, measured clockwise from the plan's north
    const nd = m.site.northDeg * Math.PI / 180, sa = (90 + (o.hour - 6) * 15) * Math.PI / 180, se = Math.max(0.14, 1.3 * Math.sin(Math.PI * (o.hour - 6) / 12)); const N = { x: Math.sin(nd), y: -Math.cos(nd) };
    const hx = N.x * Math.cos(sa) - N.y * Math.sin(sa), hy = N.x * Math.sin(sa) + N.y * Math.cos(sa); const Lx = hx * Math.cos(se), Ly = hy * Math.cos(se), Lz = Math.sin(se);
    const pr = (p: V3) => { const dx = p[0] - cx, dy = p[1] - cy; const xr = dx * ct - dy * sn, yr = dx * sn + dy * ct; return { X: W / 2 + xr * sc, Y: H / 2 + (yr * sp - (p[2] - cz) * cp) * sc, d: yr * cp + p[2] * sp }; };
    const list: { pts: { X: number; Y: number }[]; d: number; f: Face }[] = [];
    for (const f of scene.faces) { const nyr = f.n[0] * sn + f.n[1] * ct; if (nyr * cp + f.n[2] * sp <= 0.01) continue; let d = 0; const pp = f.pts.map(p => { const q = pr(p); d += q.d; return q; }); list.push({ pts: pp, d: d / pp.length, f }); }
    list.sort((a, b) => a.d - b.d);
    ctx.lineJoin = 'round';
    for (const it of list) {
      const f = it.f; const b = 0.56 + 0.44 * Math.max(0, f.n[0] * Lx + f.n[1] * Ly + f.n[2] * Lz); ctx.beginPath(); it.pts.forEach((p, i) => i ? ctx.lineTo(p.X, p.Y) : ctx.moveTo(p.X, p.Y)); ctx.closePath();
      ctx.fillStyle = `rgba(${Math.round(f.col[0] * b)},${Math.round(f.col[1] * b)},${Math.round(f.col[2] * b)},${f.a})`; ctx.fill(); ctx.strokeStyle = `rgba(20,24,32,${f.a < 1 ? 0.1 : 0.16})`; ctx.lineWidth = 0.8; ctx.stroke();
    }
    if (scene.labels.length && cam.el > 22) { ctx.textAlign = 'center'; ctx.fillStyle = ink; scene.labels.forEach(l => { const q = pr(l.p); ctx.font = `600 ${Math.max(10, Math.min(15, sc * 0.3))}px Manrope, system-ui, sans-serif`; ctx.fillText(l.text, q.X, q.Y); ctx.font = `500 ${Math.max(9, Math.min(12, sc * 0.24))}px Manrope, system-ui, sans-serif`; ctx.globalAlpha = 0.65; ctx.fillText(l.sub, q.X, q.Y + Math.max(11, Math.min(16, sc * 0.32))); ctx.globalAlpha = 1; }); }
  };
  useEffect(() => { const c = cv.current; if (!c) return; const dpr = Math.min(2, window.devicePixelRatio || 1); c.width = Math.max(1, Math.round(size.w * dpr)); c.height = Math.max(1, Math.round(size.h * dpr)); const ctx = c.getContext('2d'); if (!ctx) return; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, size.w, size.h); paint(ctx, size.w, size.h, getComputedStyle(c).color || '#222'); }, [scene, cam, size, o.hour]);
  const save = async () => { const W = 1920, H = 1200; const c = document.createElement('canvas'); c.width = W; c.height = H; const ctx = c.getContext('2d'); if (!ctx) return; const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#f7f8fa'); g.addColorStop(1, '#dfe3ea'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); paint(ctx, W, H, '#1d1d1f'); const blob: Blob | null = await new Promise(r => c.toBlob(r, 'image/png')); if (!blob) return; const res = await saveFile('BuildSmart_3D_view.png', new Uint8Array(await blob.arrayBuffer())); setMsg(res === 'saved' ? 'Image saved' : res === 'declined' ? 'Cancelled' : 'Saving is not available here'); setTimeout(() => setMsg(''), 3000); };
  if (!m.walls.length) return <div className="empty">Draw some walls to see the building in 3D.</div>;
  const modes: [Mode, string][] = [['finished', 'Materials'], ['rooms', 'Room use'], ['white', 'White model'], ['structure', 'Structure']];
  const hh = Math.floor(o.hour), mm = Math.round((o.hour - hh) * 60);
  return <div className="v3d" ref={wrap}>
    <canvas ref={cv} className="v3dcanvas" role="img" aria-label="3D model of the building. Drag to turn it."
      onPointerDown={e => { (e.target as Element).setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, az: cam.az, el: cam.el }; set({ spin: false }); }}
      onPointerMove={e => { const d = drag.current; if (!d || !(e.buttons & 1)) return; setCam(c => ({ ...c, az: d.az + (e.clientX - d.x) * 0.4, el: Math.max(6, Math.min(89.5, d.el + (e.clientY - d.y) * 0.3)) })); }}
      onPointerUp={() => { drag.current = null; }} onWheel={e => setCam(c => ({ ...c, zoom: Math.max(0.4, Math.min(6, c.zoom * (e.deltaY > 0 ? 0.9 : 1.11))) }))} onDoubleClick={() => setCam({ az: -32, el: 30, zoom: 1 })} />
    <div className="v3dpanel">
      <div className="v3drow seg4">{modes.map(([k, l]) => <button key={k} className={o.mode === k ? 'on' : ''} onClick={() => set({ mode: k })}>{l}</button>)}</div>
      <label className="v3dfield"><span>Floors shown <b>{Math.min(o.floors, m.settings.floors)} of {m.settings.floors}</b></span><input id="v3floors" type="range" min={1} max={m.settings.floors} value={Math.min(o.floors, m.settings.floors)} onChange={e => set({ floors: parseInt(e.target.value) })} /></label>
      <label className="v3dfield"><span>Pull floors apart <b>{o.explode.toFixed(1)} m</b></span><input id="v3explode" type="range" min={0} max={4} step={0.1} value={o.explode} onChange={e => set({ explode: parseFloat(e.target.value) })} /></label>
      <label className="v3dfield"><span>Sun at <b>{hh}:{String(mm).padStart(2, '0')}</b></span><input id="v3hour" type="range" min={6} max={18} step={0.25} value={o.hour} onChange={e => set({ hour: parseFloat(e.target.value) })} /></label>
      {o.mode !== 'structure' && <div className="v3dchecks"><label><input id="v3roof" type="checkbox" checked={o.roof && !o.cut} disabled={o.cut} onChange={e => set({ roof: e.target.checked })} />Roof</label><label><input id="v3cut" type="checkbox" checked={o.cut} onChange={e => set({ cut: e.target.checked })} />Look inside</label><label><input id="v3lab" type="checkbox" checked={o.labels} onChange={e => set({ labels: e.target.checked })} />Room names</label></div>}
      <div className="v3dchecks"><label><input id="v3spin" type="checkbox" checked={o.spin} onChange={e => set({ spin: e.target.checked })} />Turn slowly</label></div>
      {o.mode === 'structure' && <p className="v3dnote">{est.st.columns.length} columns {Math.round(est.st.col[0] * 1000)} × {Math.round(est.st.col[1] * 1000)} mm, beams {Math.round(est.st.beamW * 1000)} × {Math.round(est.st.beamD * 1000)} mm, {Math.round(est.st.slabT * 1000)} mm slab, {est.st.found.type === 'isolated' ? `footings ${est.st.found.side.toFixed(1)} m square` : est.st.found.type === 'raft' ? 'raft foundation' : 'piles'} shown below ground.</p>}
    </div>
    <div className="v3dviews"><button onClick={() => setCam({ az: -32, el: 30, zoom: 1 })}>Corner</button><button onClick={() => setCam(c => ({ ...c, az: 0, el: 89.5 }))}>Top</button><button onClick={() => setCam(c => ({ ...c, az: 0, el: 8 }))}>Front</button><button onClick={() => setCam(c => ({ ...c, az: 90, el: 8 }))}>Side</button><button onClick={() => setCam(c => ({ ...c, zoom: Math.min(6, c.zoom * 1.25) }))} aria-label="Zoom in">+</button><button onClick={() => setCam(c => ({ ...c, zoom: Math.max(0.4, c.zoom * 0.8) }))} aria-label="Zoom out">−</button><button onClick={save}>Save image</button></div>
    <div className="v3dhint">{msg || 'Drag to turn · scroll to zoom · double-click to reset'}</div>
  </div>;
}
