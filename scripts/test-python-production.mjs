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
  await page.getByLabel('Python code').fill('print("production-smoke-42")');
  await page.getByRole('button',{name:'Run Python',exact:true}).click();
  await page.locator('#tool-app .status-line').getByText(/Program finished|error|failed|did not load|Stopped/i).waitFor({timeout:90000});
  const status=await page.locator('#tool-app .status-line').textContent();
  console.log('Python status:',status);
  assert.match(status,/Program finished/);
  assert.match(await page.getByRole('region',{name:'Python output output'}).textContent(),/production-smoke-42/);
  console.log('✓ Deployed Python runtime executes code in Chromium');
} finally { await browser.close(); }
