// Read-only harness smoke check: the UI may read getHostNumber, but never sends or scans a QR.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const requireDriver = createRequire(require.resolve('@open-wa/driver-puppeteer'));
const puppeteer = requireDriver('puppeteer-core');
const base = process.env.DEV_TEST_URL ?? 'http://127.0.0.1:8099';
const health = await (await fetch(`${base}/health`)).json();
assert.equal(health.licenseRequired, false);
assert.notEqual(health.state, 'failed', health.failure);
const methods = await (await fetch(`${base}/methods`)).json();
assert.equal(methods.length, 29);
assert.ok(methods.every(method => method.license === 'none' && method.sdkBound));
const forbidden = await fetch(`${base}/api/sendInteractive`, { method: 'POST', headers: {
  Origin: 'https://example.org', 'Content-Type': 'application/json',
}, body: '{}' });
assert.equal(forbidden.status, 403);
if (health.state !== 'ready') {
  const premature = await fetch(`${base}/api/sendInteractive`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(premature.status, 409);
}
const browser = await puppeteer.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.querySelector('#method')?.options.length === 29);
  assert.equal(await page.$eval('#method', element => element.value), 'sendInteractive');
  if (health.state === 'ready') {
    await page.waitForFunction(() => !document.querySelector('#run').disabled);
    const payload = await page.$eval('#params', el => JSON.parse(el.value));
    assert.match(payload.to, /^[0-9]+@(c\.us|lid)$/);
    assert.equal(payload.content.type, 'buttons');
    assert.deepEqual(payload.content.actions.map(action => ({ id: action.id, label: action.label })), [{ id: 'test_confirm', label: 'Conferma' }, { id: 'test_cancel', label: 'Annulla' }]);
  }
  await page.select('#method', 'getOrder');
  assert.equal(await page.$eval('#run', el => el.disabled), true);
  assert.equal(await page.$eval('#params', el => JSON.parse(el.value).id), null);
  await page.select('#method', 'sendRawMessage');
  assert.equal(await page.$eval('#params', el => typeof JSON.parse(el.value).payload.conversation), 'string');
  await page.select('#method', 'sendInteractive');
  if (health.qrAvailable) {
    await page.waitForFunction(() => { const image = document.querySelector('#qr'); return !image.hidden && image.complete && image.naturalWidth > 0; });
  }
  await page.waitForSelector('[data-case="carousel"]');
  assert.equal(await page.$$eval('[data-case]', elements => elements.length), 45);
  for (const id of ['accept','reject','start','end','clear','mute','unmute','media','observe','stop-observe','form-single','form-multi','buttons','advanced']) {
    assert.ok(await page.$('[data-case="' + id + '"]'), id);
  }
  const eventResponse = await fetch(`${base}/events?after=0`);
  assert.equal(eventResponse.status, 200);
  assert.ok(Array.isArray((await eventResponse.json()).events));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ harness: 'ok', state: health.state, methods: methods.length, qrRendered: health.qrAvailable,
    whatsappApisLiveVerified: false }));
} finally { await browser.close(); }
