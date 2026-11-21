import { demoModel, estimate, schedule, compliance, analyseQuotes } from './src/engine';
import { workbook, tenderSheet, readTenderSheet } from './src/exports'; import { buildXlsx, toCsv, parseCsv } from './src/xlsx'; import { compare } from './src/versions';
import { writeFileSync } from 'fs';
const m = demoModel(); const e = estimate(m); const s = schedule(m, e); const f = compliance(m, e); const t = analyseQuotes(m, e);
const wb = workbook('Sample', m, e, s, f, t); writeFileSync('/tmp/bs.xlsx', buildXlsx(wb)); console.log('sheets', wb.map(x => x.name + ':' + x.rows.length).join(', '));
const csv = toCsv(tenderSheet('Sample', m, e)); const rows = parseCsv(csv); rows.forEach(r => { if (r[0] === 'rcc') r[4] = '12,500'; if (r[0] === 'steel') r[4] = '₹ 84.5'; if (r[0] === 'Builder name') r[1] = 'Test Builders'; if (r[0].startsWith('Completion')) r[1] = '28'; });
const q = readTenderSheet(rows); console.log('tender read', JSON.stringify(q)); if (!(q.name === 'Test Builders' && q.rates.rcc === 12500 && q.rates.steel === 84.5 && q.weeks === 28 && q.found === 2)) { console.log('FAIL tender sheet round trip'); process.exitCode = 1; } else console.log('PASS tender sheet round trip');
const b = demoModel(); b.walls.forEach(w => { w.mat = 'aac'; w.t = 0.2; }); b.settings.grade = 'M20'; const c = compare(m, b); console.log('compare', c.dCost.toFixed(0), c.dDays, c.changes.join(' | '));
if (!(c.dCost < 0 && c.changes.length >= 2 && c.rows[0].a === e.total)) { console.log('FAIL compare'); process.exitCode = 1; } else console.log('PASS version compare');
