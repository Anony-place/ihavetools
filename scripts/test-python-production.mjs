// Independent deployed-runtime smoke test. Uses the public site, not the local CI server.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const origin = 'https://i-have-tools.vercel.app';
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined, headless:true, args:['--no-sandbox']});
try {
  const context = await browser.newContext({serviceWorkers:'allow'});
  const page = await context.newPage();
  page.on('response', r => { if (/python-worker|pyodide|python_stdlib/.test(r.url())) console.log(`runtime asset ${r.status()} ${r.url()} ${r.headers()['content-type'] || ''}`); });
  page.on('pageerror', e => console.log('page error:',e.message));
  const response = await page.goto(`${origin}/tools/python-playground/`,{waitUntil:'load',timeout:60000});
  assert.equal(response.status(),200);
  assert.equal(await page.evaluate(()=>crossOriginIsolated),true,'production Python playground must be cross-origin isolated');
  await page.getByRole('textbox',{name:'Python code',exact:true}).fill('print("production-smoke-42")');
  await page.getByRole('button',{name:'Run Python',exact:true}).click();
  await page.locator('#tool-app .status-line').getByText(/Program finished|error|failed|did not load|Stopped/i).waitFor({timeout:90000});
  const status=await page.locator('#tool-app .status-line').textContent();
  console.log('Python status:',status);
  assert.match(status,/Program finished/);
  assert.match(await page.getByRole('region',{name:'Python output output'}).textContent(),/production-smoke-42/);
  // Production stdin regression: input() must receive supplied lines, not EOF.
  await page.getByRole('textbox',{name:'Python code',exact:true}).fill('port = int(input("Port number daalo: "))\\nif port == 22:\\n    print("SSH Service - High Security Alert!")\\nelif port == 80:\\n    print("HTTP Service - Unencrypted Web Traffic")\\nelif port == 443:\\n    print("HTTPS Service - Secure Web Traffic")\\nelse:\\n    print("Unknown or other port")');
  await page.getByRole('button',{name:'Run Python',exact:true}).click();
  await page.getByText('Port number daalo:',{exact:false}).waitFor({timeout:90000});
  await page.getByPlaceholder('Type input() answer and press Enter').fill('22');
  await page.getByRole('button',{name:'Send input',exact:true}).click();
  await page.locator('#tool-app .status-line').getByText(/Program finished/).waitFor({timeout:90000});
  assert.match(await page.getByRole('region',{name:'Python output output'}).textContent(), /SSH Service - High Security Alert!/);
  console.log('✓ Deployed Python runtime executes print() and input() in Chromium');
} finally { await browser.close(); }
