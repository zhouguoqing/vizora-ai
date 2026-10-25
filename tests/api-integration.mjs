// Run against the real API, isolated PostgreSQL and loopback SMTP capture.
// No merchant responses or successful payments are simulated.
import assert from 'node:assert/strict';

const base = process.env.API_TEST_URL || 'http://127.0.0.1:8080/api';
const mailbox = process.env.API_TEST_MAILBOX || 'http://127.0.0.1:55253/messages';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname))
  throw new Error('This destructive fixture suite only runs against loopback');
const email = `api-${Date.now()}@vizora.test`;
const password = 'Integration-Password-2026!';
let count = 0, token;
const check = (name, fn) => { fn(); count++; console.log(`PASS ${name}`); };
async function request(path, method = 'GET', body, auth = token) {
  const r = await fetch(base + path, {
    method, headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: r.status, data: r.status === 204 ? null : await r.json() };
}
async function mailToken() {
  const messages = await (await fetch(mailbox)).json();
  const message = messages.filter(m => m.to.toLowerCase() === email).at(-1);
  assert.ok(message, 'An actual SMTP message must have arrived');
  return message.text.match(/token=([A-Za-z0-9_-]+)/)[1];
}
const health = await request('/health');
check('database readiness', () => assert.equal(health.status, 200));
const plans = await request('/plans');
check('approved catalogue and retained unlimited semantics', () => {
  assert.equal(plans.status, 200);
  assert.deepEqual(plans.data.map(p => [p.code, p.price_fen, p.project_limit]), [
    ['free', 0, 3], ['creator-month', 9900, 10], ['fde-month', 69900, null],
    ['creator-year', 95000, 10], ['fde-year', 671000, null]
  ]);
});
let r = await request('/auth/register', 'POST', { email, password });
check('explicit consent required', () => {
  assert.equal(r.status, 400); assert.equal(r.data.code, 'consent_required');
});
r = await request('/auth/register', 'POST', { email, password, consent: true, name: 'API integration' });
check('register through real SMTP', () => assert.equal(r.status, 200));
r = await request('/auth/login', 'POST', { email, password });
check('unverified login denied', () => {
  assert.equal(r.status, 403); assert.equal(r.data.code, 'email_not_verified');
});
const verify = await mailToken();
r = await request('/auth/verify-email', 'POST', { token: verify });
check('consume actual emailed verification token', () => assert.equal(r.status, 200));
r = await request('/auth/verify-email', 'POST', { token: verify });
check('verification token cannot be replayed', () => assert.equal(r.status, 400));
r = await request('/auth/login', 'POST', { email, password });
token = r.data.token;
check('verified login issues bearer token', () => {
  assert.equal(r.status, 200); assert.equal(typeof token, 'string');
});
let me = await request('/me');
check('me exact effective free quota', () => {
  assert.equal(me.status, 200); assert.equal(me.data.email, email);
  assert.equal(me.data.project_limit, 3); assert.equal(me.data.quota.project_limit, 3);
  assert.equal(me.data.membership, null);
});
const creates = await Promise.all(Array.from({ length: 8 }, (_, i) =>
  request('/dashboards', 'POST', { title: `Integration ${i}`, prompt: 'Persistent fixture' })));
check('concurrent project quota is serialized in PostgreSQL', () => {
  assert.equal(creates.filter(r => r.status === 200).length, 3);
  assert.equal(creates.filter(r => r.status === 403 && r.data.code === 'project_limit_reached').length, 5);
});
let projects = await request('/dashboards');
check('created projects are read from database', () => {
  assert.equal(projects.data.length, 3); assert.ok(projects.data.every(p => p.prompt === 'Persistent fixture' && p.created_at));
});
r = await request('/designer/ticket', 'POST', { dashboardId: projects.data[0].id });
check('unconfigured Designer does not issue tickets', () => {
  assert.equal(r.status, 503); assert.equal(r.data.code, 'designer_unavailable'); assert.equal(r.data.ticket, undefined);
});
r = await request('/dashboards/00000000-0000-0000-0000-000000000001', 'DELETE');
check('other or missing project is concealed', () => assert.equal(r.status, 404));
for (const provider of ['wechat', 'alipay']) {
  r = await request('/orders', 'POST', { planCode: 'creator-month', provider });
  check(`unconfigured ${provider} has no fake checkout`, () => {
    assert.equal(r.status, 503); assert.equal(r.data.code, 'payment_unavailable'); assert.equal(r.data.payUrl, undefined);
  });
}
r = await request('/orders');
check('unconfigured payments created no orders', () => assert.equal(r.data.length, 0));
r = await request('/orders', 'POST', { planCode: 'pro-month', provider: 'wechat' });
check('legacy plan cannot be newly sold', () => assert.equal(r.status, 404));
r = await request('/leads', 'POST', { name: 'Integration', company: 'Isolated tests', email, details: 'Real persisted lead', consent: true });
check('real durable lead accepted', () => {
  assert.equal(r.status, 202); assert.match(r.data.id, /^[0-9a-f-]{36}$/);
});
r = await request('/auth/forgot-password', 'POST', { email });
check('password reset actually sends SMTP', () => assert.equal(r.status, 200));
const reset = await mailToken(), newPassword = password + 'changed';
r = await request('/auth/reset-password', 'POST', { token: reset, newPassword });
check('password reset consumes one-time token', () => assert.equal(r.status, 200));
r = await request('/me');
check('reset invalidates old JWT through database token_version', () => assert.equal(r.status, 401));
r = await request('/auth/reset-password', 'POST', { token: reset, newPassword });
check('password reset token replay denied', () => assert.equal(r.status, 400));
r = await request('/auth/login', 'POST', { email, password: newPassword }, null);
token = r.data.token;
check('new password authenticates', () => assert.equal(r.status, 200));
for (const project of projects.data) await request(`/dashboards/${project.id}`, 'DELETE');
projects = await request('/dashboards');
check('delete persisted and releases quota', () => assert.equal(projects.data.length, 0));
r = await request('/dashboards', 'POST', { title: null });
check('null input yields stable JSON rather than exception', () => {
  assert.equal(r.status, 400); assert.equal(r.data.code, 'invalid_request');
});
r = await request('/auth/logout-all', 'POST');
check('logout-all succeeds', () => assert.equal(r.status, 204));
r = await request('/me');
check('logout-all invalidates issued bearer', () => assert.equal(r.status, 401));
console.log(`API integration: ${count}/${count} passed (real PostgreSQL + SMTP; merchant acceptance NOT tested)`);
