import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true }); const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_') && !m.text().includes('fonts')) errs.push('CONSOLE ' + m.text()); });
await p.goto('file:///home/claude/buildsmart/dist/index.html#project'); await p.waitForTimeout(600);
console.log('project name button:', await p.locator('.proj').innerText());
await p.locator('#vname').fill('Before AAC'); await p.getByRole('button', { name: 'Save this version' }).click();
await p.locator('.steps button').nth(1).click(); await p.getByRole('tab', { name: /Savings/ }).click(); await p.locator('.card.idea.save button.primary').first().click();
await p.locator('.proj').click(); await p.getByRole('button', { name: 'Compare with now' }).click(); await p.waitForTimeout(300);
console.log('compare lead:', await p.locator('.card.report .lead').last().innerText());
const [d1] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Download Excel workbook' }).click()]); await d1.saveAs('/tmp/dl.xlsx'); console.log('xlsx', d1.suggestedFilename(), fs.statSync('/tmp/dl.xlsx').size);
const [d2] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Download project file' }).click()]); await d2.saveAs('/tmp/dl.json'); console.log('json', d2.suggestedFilename(), fs.statSync('/tmp/dl.json').size);
await p.screenshot({ path: 'dist/shot-project.png' });
// new project from sample, then import the json
await p.getByRole('button', { name: 'New empty project' }).click(); await p.waitForTimeout(200); console.log('after new:', await p.locator('.proj').innerText(), await p.locator('.livecost b').innerText());
await p.locator('input[type=file]').setInputFiles('/tmp/dl.json'); await p.waitForTimeout(400); console.log('after import:', await p.locator('.proj').innerText(), await p.locator('.livecost b').innerText(), '| projects:', await p.locator('.card:has(h2:text("Your projects")) tbody tr').count());
// tender sheet round trip
await p.locator('.steps button').nth(5).click(); const [d3] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Download a tender sheet for builders' }).click()]); await d3.saveAs('/tmp/tender.csv');
let csv = fs.readFileSync('/tmp/tender.csv', 'utf8'); csv = csv.replace('Builder name,', 'Builder name,Kiran Builders').split('\r\n').map(l => /^(excav|pcc|rcc|steel|masonry|plaster|flooring|painting),/.test(l) ? l.replace(/,$/, ',' + ({ excav: 250, pcc: 6400, rcc: 12100, steel: 85, masonry: 6900, plaster: 230, flooring: 1150, painting: 175 })[l.split(',')[0]]) : l).join('\r\n'); fs.writeFileSync('/tmp/tender_filled.csv', csv);
await p.locator('input[type=file]').setInputFiles('/tmp/tender_filled.csv'); await p.waitForTimeout(400); console.log('tender msg:', await p.locator('.okmsg').last().innerText()); console.log('tender answer:', (await p.locator('.card.report .lead').innerText()).slice(0, 160));
// reload keeps the project
await p.reload(); await p.waitForTimeout(500); console.log('after reload:', await p.locator('.proj').innerText(), await p.locator('.livecost b').innerText());
console.log(errs.join('\n') || 'no page errors'); await b.close();
