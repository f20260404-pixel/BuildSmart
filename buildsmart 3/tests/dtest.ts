import { demoModel, estimate, geometry, blankModel } from './src/engine';
import { toDxf, parseDxf, dxfToPlan, guessUnit, defaultLayers, toSvg } from './src/dxf';
import { writeFileSync } from 'fs';
const ok = (c: boolean, msg: string) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
const m = demoModel(); const e = estimate(m); const dxf = toDxf(m, e); writeFileSync('/tmp/demo.dxf', dxf); writeFileSync('/tmp/demo.svg', toSvg(m, e, 'Sample'));
const d = parseDxf(dxf); const unit = guessUnit(d); const layers = defaultLayers(d); console.log('layers', d.layers.join(','), '| default', layers.join(','), '| unit', unit, '| segs', d.segs.length, 'texts', d.texts.length);
const r = dxfToPlan(d, unit, layers); const b = blankModel(); b.walls = r.walls; b.openings = r.openings; b.labels = r.labels; const g = geometry(b);
console.log('info', JSON.stringify(r.info), 'openings', r.openings.length, '/', m.openings.length, 'walls', r.walls.length, '/', m.walls.length);
console.log('rooms', g.rooms.map(x => `${x.name} ${x.carpet.toFixed(1)}`).join(' | ')); console.log('orig ', e.geo.rooms.map(x => `${x.name} ${x.carpet.toFixed(1)}`).join(' | '));
ok(g.rooms.length === 8, 'round trip: 8 rooms come back from the exported drawing');
ok(Math.abs(g.carpet - e.geo.carpet) < 0.3 && Math.abs(g.footprint - e.geo.footprint) < 0.3, `round trip: carpet ${g.carpet.toFixed(1)} vs ${e.geo.carpet.toFixed(1)} m², built-up ${g.footprint.toFixed(1)} vs ${e.geo.footprint.toFixed(1)} m²`);
ok(r.openings.length === m.openings.length && r.labels.length === 8, 'round trip: all doors, windows and room names come back');
// a foreign-style drawing: millimetres, no door/window layers, single WALLS layer drawn as double lines with door gaps
const mm = dxf.replace('$INSUNITS\r\n70\r\n6', '$INSUNITS\r\n70\r\n4').split('\r\n'); const out: string[] = []; 
for (let i = 0; i < mm.length; i++) out.push(mm[i]);
// scale coordinates ×1000 and drop DOOR/WINDOW/ROOM layers
const dd = parseDxf(dxf); const lines: string[] = ['0', 'SECTION', '2', 'ENTITIES']; dd.segs.filter(s => s.layer === 'WALL').forEach(s => lines.push('0', 'LINE', '8', 'A-WALLS', '10', String(s.a.x * 1000), '20', String(s.a.y * 1000), '11', String(s.b.x * 1000), '21', String(s.b.y * 1000))); lines.push('0', 'ENDSEC', '0', 'EOF');
const d2 = parseDxf(lines.join('\n')); const u2 = guessUnit(d2); const r2 = dxfToPlan(d2, u2, defaultLayers(d2)); const b2 = blankModel(); b2.walls = r2.walls; b2.openings = r2.openings; const g2 = geometry(b2);
console.log('mm drawing: unit', u2, JSON.stringify(r2.info), 'openings', r2.openings.map(o => o.kind[0] + o.w).join(' '));
ok(u2 === 'mm' && g2.rooms.length >= 8 && r2.openings.length >= 13, `millimetre drawing with door gaps: ${g2.rooms.length} rooms, ${r2.openings.length} openings found from gaps`);
// single-line drawing
const sl: string[] = ['0', 'SECTION', '2', 'ENTITIES']; m.walls.forEach(w => sl.push('0', 'LINE', '8', '0', '10', String(w.a.x), '20', String(-w.a.y), '11', String(w.b.x), '21', String(-w.b.y))); sl.push('0', 'ENDSEC', '0', 'EOF');
const d3 = parseDxf(sl.join('\n')); const r3 = dxfToPlan(d3, guessUnit(d3), defaultLayers(d3)); ok(r3.info.mode === 'single' && r3.info.rooms === 8, `single-line drawing: ${r3.info.rooms} rooms`);
// LWPOLYLINE closed room
const d4 = parseDxf(['0', 'SECTION', '2', 'ENTITIES', '0', 'LWPOLYLINE', '8', '0', '90', '4', '70', '1', '10', '0', '20', '0', '10', '4', '20', '0', '10', '4', '20', '3', '10', '0', '20', '3', '0', 'ENDSEC', '0', 'EOF'].join('\n')); const r4 = dxfToPlan(d4, 'm', d4.layers); ok(r4.info.rooms === 1 && r4.walls.length === 4, 'closed polyline becomes one room');
