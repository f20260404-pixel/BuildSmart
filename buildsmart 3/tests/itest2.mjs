import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_') && !m.text().includes('fonts')) errs.push('CONSOLE ' + m.text()); });
await p.goto('file:///home/claude/buildsmart/dist/index.html#plan'); await p.waitForTimeout(600);
for (const [name, file] of [['Steel cutting list', 'steel'], ['Stock and expenses', 'stock'], ['Cash flow', 'cash']]) {
  await p.getByRole('tab', { name }).click(); await p.waitForTimeout(300);
  if (file === 'stock') {
    await p.locator('#sqty').fill('600'); await p.getByRole('button', { name: 'Add', exact: true }).first().click();
    await p.selectOption('#stype', 'received'); await p.locator('#sqty').fill('400'); await p.locator('#sprice').fill('395'); await p.getByRole('button', { name: 'Add', exact: true }).first().click();
    await p.selectOption('#stype', 'issued'); await p.locator('#sqty').fill('20'); await p.getByRole('button', { name: 'Add', exact: true }).first().click();
    await p.locator('#xdesc').fill('20 bags cement from local dealer'); await p.locator('#xamt').fill('1800'); await p.getByRole('button', { name: 'Add', exact: true }).last().click(); await p.waitForTimeout(200);
    console.log('stock lead:', (await p.locator('.card.report .lead').innerText()).slice(0, 260));
  }
  if (file === 'steel') { console.log('steel lead:', (await p.locator('.card.report .lead').innerText()).slice(0, 300)); await p.locator('#steelbars').check(); await p.waitForTimeout(200); console.log('cost with bar schedule:', await p.locator('.livecost b').innerText()); await p.locator('#steelbars').uncheck(); }
  if (file === 'cash') console.log('cash lead:', (await p.locator('.card.report .lead').innerText()).slice(0, 260));
  await p.screenshot({ path: `dist/shot-${file}.png`, fullPage: false });
}
console.log(errs.join('\n') || 'no page errors'); await b.close();
