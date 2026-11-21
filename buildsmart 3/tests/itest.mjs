import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
await p.goto('file:///home/claude/buildsmart/dist/index.html#design'); await p.waitForTimeout(600);
const bar = async () => (await p.locator('.stagebar').innerText()).replace(/\n/g, ' ');
const cost = async () => await p.locator('.livecost b').innerText();
console.log('start', await bar(), await cost());
// draw a wall splitting the living room: from west wall to V1 at y=2.4m. find screen coords via svg CTM
const pt = async (x, y) => await p.evaluate(([x, y]) => { const s = document.querySelector('svg.canvas'); const q = s.createSVGPoint(); q.x = x * 100; q.y = y * 100; const r = q.matrixTransform(s.getScreenCTM()); return [r.x, r.y]; }, [x, y]);
await p.getByRole('button', { name: 'Wall', exact: true }).click();
let a = await pt(0, 1.6), c = await pt(4.4, 1.6);
await p.mouse.move(a[0], a[1]); await p.mouse.down(); await p.mouse.up(); await p.mouse.move(c[0], c[1]); await p.mouse.down(); await p.mouse.up(); await p.keyboard.press('Escape');
console.log('after wall', await bar(), await cost());
await p.keyboard.press('Control+z'); console.log('after undo', await bar());
// select a wall and a room
let w = await pt(4.4, 6.4); await p.mouse.click(w[0], w[1]); console.log('props:', (await p.locator('.pbody .card').first().innerText()).slice(0, 60).replace(/\n/g, ' '));
// apply first saving
await p.getByRole('tab', { name: /Savings/ }).click(); await p.locator('.card.idea.save button.primary').first().click(); console.log('after apply', await bar(), await cost());
await p.getByRole('button', { name: '3D view' }).click(); await p.waitForTimeout(300); await p.screenshot({ path: 'dist/shot-3d.png' });
await p.getByRole('button', { name: '2D plan' }).click(); await p.getByRole('tab', { name: 'Copilot' }).click(); await p.locator('.chips button').first().click(); await p.waitForTimeout(500); console.log('copilot msg:', await p.locator('.errmsg').innerText().catch(() => 'none'));
console.log(errs.join('\n') || 'no page errors'); await b.close();
