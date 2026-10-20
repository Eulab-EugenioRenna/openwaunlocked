// Read-only audit. Never sends, changes a profile, publishes status, joins groups or starts calls.
import assert from 'node:assert/strict';
import { clientRegistry } from '@eulab/openwaunlocked-schema';
const base = process.env.DEV_TEST_URL ?? 'http://127.0.0.1:8099';
const clean = text => String(text).replace(/\d{7,}/g, '[redacted]');
async function request(method, params) {
  const response = await fetch(`${base}/api/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
  return { status: response.status, body: await response.json() };
}
const health = await (await fetch(`${base}/health`)).json();
assert.equal(health.state, 'ready');
const methods = await (await fetch(`${base}/methods`)).json();
assert.equal(methods.length, 29);
assert.ok(methods.every(m => m.license === 'none' && m.sdkBound));
const host = await request('getHostNumber', {});
assert.equal(host.body.ok, true);
const contactId = host.body.result.includes('@') ? host.body.result : `${host.body.result}@c.us`;
const cases = [['checkNumberStatus', { contactId }], ['getNumberProfile', { contactId }], ['getStatus', { contactId }],
  ['getStories', {}], ['getStarredMessages', { chatId: contactId }], ['getActiveCall', {}], ['getCallCapabilities', {}]];
const results = [];
for (const [method, params] of cases) {
  try {
    const { status, body } = await request(method, params);
    const schema = body.ok ? await clientRegistry.resolve(method).meta.outputSchema.safeParseAsync(body.result) : null;
    results.push({ method, status, ok: body.ok === true, ...(schema ? { outputSchema: schema.success, ...(schema.success ? {} : { invalidFields: schema.error.issues.slice(0, 8).map(issue => ({ path: issue.path, code: issue.code })) }) } : {}), ...(body.ok ? { resultType: Array.isArray(body.result) ? 'array' : body.result === null ? 'null' : typeof body.result,
      ...(Array.isArray(body.result) ? { count: body.result.length } : {}) } : { error: clean(body.error) }) });
  } catch (error) { results.push({ method, ok: false, error: clean(error.message) }); }
}
const invalidOrder = await request('getOrder', { id: 'openwa-dev-nonexistent-order' });
results.push({ method: 'getOrder', scenario: 'nonexistent order', expectedRejection: invalidOrder.status === 422, error: clean(invalidOrder.body.error) });
const call = { id: 'audit-no-active-call', sessionId: 'audit-unrelated-session', generation: 'audit-stale' };
for (const method of ['acceptCall','rejectCall','endCall','muteCall','clearCallAudio','setCallMedia','observeCallAudio','stopCallAudioObserver']) {
  const { status, body } = await request(method, { call, muted: true, media: {}, speaker: null, observerId: 'audit-none' });
  results.push({ method, scenario: 'stale identity; no call requested', expectedRejection: body.result?.ok === false || status === 422,
    reason: clean(body.result?.reason?.code ?? body.error ?? 'none') });
}
const missingRecipient = await request('startCall', {});
results.push({ method: 'startCall', scenario: 'missing required recipient; no call requested', expectedRejection: missingRecipient.status === 422 });
console.log(JSON.stringify({ readOnly: true, methods: methods.length, results }, null, 2));

if (results.some(result => result.ok === false || result.outputSchema === false || result.expectedRejection === false)) process.exitCode = 1;
