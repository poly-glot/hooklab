import { test, expect } from '@playwright/test';
import {
  registerUser,
  createEndpoint,
  updateEndpoint,
  callWebhook,
  getRequestLogs,
  healthCheck,
} from '../helpers/api-client';

/**
 * Full end-to-end webhook flow tests.
 *
 * These test the complete lifecycle:
 * 1. Register user via API
 * 2. Create endpoint via API
 * 3. Set up script
 * 4. Call webhook via curl/fetch
 * 5. Verify response
 * 6. Verify request logs
 * 7. Update script and re-test
 * 8. Clean up
 */

let token: string;
let userId: string;

test.describe('Full Webhook Lifecycle', () => {
  test.beforeAll(async () => {
    const healthy = await healthCheck();
    test.skip(!healthy, 'Deno API server not running on port 3000');

    const email = `lifecycle-${Date.now()}@test.com`;
    const result = await registerUser(email, 'password123');
    token = result.token;
    userId = result.user.id;
  });

  test('complete webhook lifecycle: create → script → call → verify → update → re-call', async () => {
    // 1. Create endpoint with echo script
    const echoScript = [
      'var body = JSON.parse(request.body || "{}");',
      'return {',
      '  status: 200,',
      '  headers: {"Content-Type": "application/json"},',
      '  body: JSON.stringify({',
      '    echo: body,',
      '    method: request.method,',
      '    queryParams: request.query,',
      '    receivedHeaders: Object.keys(request.headers)',
      '  })',
      '};',
    ].join('\n');

    const ep = await createEndpoint(token, 'Echo Webhook', echoScript);
    expect(ep.id).toBeTruthy();

    // 2. Call webhook with POST
    const postResult = await callWebhook(ep.id, {
      method: 'POST',
      body: JSON.stringify({ event: 'order.created', orderId: '12345' }),
      headers: { 'X-Webhook-Secret': 'abc123' },
      query: { version: '2' },
    });

    expect(postResult.status).toBe(200);
    const postBody = JSON.parse(postResult.body);
    expect(postBody.echo.event).toBe('order.created');
    expect(postBody.echo.orderId).toBe('12345');
    expect(postBody.method).toBe('POST');
    expect(postBody.queryParams.version).toBe('2');
    expect(postBody.receivedHeaders).toContain('x-webhook-secret');

    // 3. Call with GET
    const getResult = await callWebhook(ep.id, {
      method: 'GET',
      query: { status: 'active' },
    });

    expect(getResult.status).toBe(200);
    const getBody = JSON.parse(getResult.body);
    expect(getBody.method).toBe('GET');
    expect(getBody.queryParams.status).toBe('active');

    // 4. Verify request logs
    const logs = await getRequestLogs(token, ep.id);
    expect(logs.length).toBe(2);
    expect(logs[0].method).toBe('GET');
    expect(logs[1].method).toBe('POST');
    expect(logs[1].responseStatus).toBe(200);
    expect(logs[1].responseBody).toContain('order.created');

    // 5. Update script to validator
    const validatorScript = [
      'var body = JSON.parse(request.body || "{}");',
      'if (!body.event) {',
      '  return {',
      '    status: 400,',
      '    headers: {"Content-Type": "application/json"},',
      '    body: JSON.stringify({ error: "Missing event field" })',
      '  };',
      '}',
      'if (!body.data) {',
      '  return {',
      '    status: 422,',
      '    headers: {"Content-Type": "application/json"},',
      '    body: JSON.stringify({ error: "Missing data field" })',
      '  };',
      '}',
      'return {',
      '  status: 200,',
      '  headers: {"Content-Type": "application/json"},',
      '  body: JSON.stringify({ accepted: true, event: body.event })',
      '};',
    ].join('\n');

    await updateEndpoint(token, ep.id, { script: validatorScript });

    // 6. Test validator: missing event
    const noEvent = await callWebhook(ep.id, {
      body: JSON.stringify({ data: {} }),
    });
    expect(noEvent.status).toBe(400);
    expect(JSON.parse(noEvent.body).error).toContain('Missing event');

    // 7. Test validator: missing data
    const noData = await callWebhook(ep.id, {
      body: JSON.stringify({ event: 'test' }),
    });
    expect(noData.status).toBe(422);
    expect(JSON.parse(noData.body).error).toContain('Missing data');

    // 8. Test validator: valid payload
    const valid = await callWebhook(ep.id, {
      body: JSON.stringify({ event: 'payment.success', data: { amount: 99 } }),
    });
    expect(valid.status).toBe(200);
    expect(JSON.parse(valid.body).accepted).toBe(true);

    // 9. Verify all logs
    const allLogs = await getRequestLogs(token, ep.id);
    expect(allLogs.length).toBe(5); // 2 initial + 3 validator tests
  });

  test('simulate Stripe-like webhook flow', async () => {
    const stripeScript = [
      'var event = JSON.parse(request.body || "{}");',
      'var sig = request.headers["stripe-signature"] || "";',
      'if (!sig) {',
      '  return { status: 401, headers: {"Content-Type": "application/json"}, body: JSON.stringify({ error: "No signature" }) };',
      '}',
      'var type = event.type || "unknown";',
      'var response = {};',
      'if (type === "payment_intent.succeeded") {',
      '  response = { received: true, action: "fulfill_order" };',
      '} else if (type === "payment_intent.payment_failed") {',
      '  response = { received: true, action: "notify_customer" };',
      '} else {',
      '  response = { received: true, action: "log_only" };',
      '}',
      'return { status: 200, headers: {"Content-Type": "application/json"}, body: JSON.stringify(response) };',
    ].join('\n');

    const ep = await createEndpoint(token, 'Stripe Webhook', stripeScript);

    // Test without signature
    const noSig = await callWebhook(ep.id, {
      body: JSON.stringify({ type: 'payment_intent.succeeded' }),
      headers: {}, // override default content-type
    });
    expect(noSig.status).toBe(401);

    // Test successful payment
    const success = await callWebhook(ep.id, {
      body: JSON.stringify({
        type: 'payment_intent.succeeded',
        data: { object: { amount: 2999, currency: 'usd' } },
      }),
      headers: { 'Stripe-Signature': 'whsec_test123' },
    });
    expect(success.status).toBe(200);
    expect(JSON.parse(success.body).action).toBe('fulfill_order');

    // Test failed payment
    const failed = await callWebhook(ep.id, {
      body: JSON.stringify({ type: 'payment_intent.payment_failed' }),
      headers: { 'Stripe-Signature': 'whsec_test123' },
    });
    expect(failed.status).toBe(200);
    expect(JSON.parse(failed.body).action).toBe('notify_customer');

    // Test unknown event
    const unknown = await callWebhook(ep.id, {
      body: JSON.stringify({ type: 'some.other.event' }),
      headers: { 'Stripe-Signature': 'whsec_test123' },
    });
    expect(unknown.status).toBe(200);
    expect(JSON.parse(unknown.body).action).toBe('log_only');
  });

  test('simulate GitHub webhook flow', async () => {
    const githubScript = [
      'var event = request.headers["x-github-event"] || "ping";',
      'var payload = JSON.parse(request.body || "{}");',
      'if (event === "push") {',
      '  var branch = (payload.ref || "").replace("refs/heads/", "");',
      '  var commits = (payload.commits || []).length;',
      '  return {',
      '    status: 200,',
      '    headers: {"Content-Type": "application/json"},',
      '    body: JSON.stringify({ event: event, branch: branch, commits: commits, action: "trigger_ci" })',
      '  };',
      '} else if (event === "ping") {',
      '  return {',
      '    status: 200,',
      '    headers: {"Content-Type": "application/json"},',
      '    body: JSON.stringify({ event: "ping", zen: payload.zen || "ok" })',
      '  };',
      '}',
      'return {',
      '  status: 200,',
      '  headers: {"Content-Type": "application/json"},',
      '  body: JSON.stringify({ event: event, received: true })',
      '};',
    ].join('\n');

    const ep = await createEndpoint(token, 'GitHub Webhook', githubScript);

    // Push event
    const push = await callWebhook(ep.id, {
      body: JSON.stringify({
        ref: 'refs/heads/main',
        commits: [{ id: 'abc123', message: 'fix bug' }, { id: 'def456', message: 'update docs' }],
      }),
      headers: { 'X-GitHub-Event': 'push' },
    });
    expect(push.status).toBe(200);
    const pushBody = JSON.parse(push.body);
    expect(pushBody.branch).toBe('main');
    expect(pushBody.commits).toBe(2);
    expect(pushBody.action).toBe('trigger_ci');

    // Ping event
    const ping = await callWebhook(ep.id, {
      body: JSON.stringify({ zen: 'Keep it logically awesome.' }),
      headers: { 'X-GitHub-Event': 'ping' },
    });
    expect(ping.status).toBe(200);
    expect(JSON.parse(ping.body).zen).toBe('Keep it logically awesome.');
  });

  test('multi-endpoint isolation', async () => {
    // Create two endpoints with different scripts
    const ep1 = await createEndpoint(
      token, 'Endpoint A',
      'return { status: 200, headers: {"Content-Type": "application/json"}, body: JSON.stringify({ source: "A" }) };'
    );
    const ep2 = await createEndpoint(
      token, 'Endpoint B',
      'return { status: 200, headers: {"Content-Type": "application/json"}, body: JSON.stringify({ source: "B" }) };'
    );

    // Call each
    const r1 = await callWebhook(ep1.id);
    const r2 = await callWebhook(ep2.id);

    expect(JSON.parse(r1.body).source).toBe('A');
    expect(JSON.parse(r2.body).source).toBe('B');

    // Logs are isolated
    const logs1 = await getRequestLogs(token, ep1.id);
    const logs2 = await getRequestLogs(token, ep2.id);
    expect(logs1.length).toBe(1);
    expect(logs2.length).toBe(1);
    expect(logs1[0].endpointId).toBe(ep1.id);
    expect(logs2[0].endpointId).toBe(ep2.id);
  });

  test('seed demo data for guest-like user', async () => {
    // Register as guest-like user (email ending in @guest.local)
    const guestEmail = `guest_${Date.now()}@guest.local`;
    const result = await registerUser(guestEmail, 'password123');

    // Should have seeded endpoints
    const res = await fetch('http://localhost:3000/api/endpoints', {
      headers: { Authorization: `Bearer ${result.token}` },
    });
    const data = await res.json();
    expect(data.endpoints.length).toBeGreaterThanOrEqual(1); // At least "My First Webhook" or seeded data
  });
});
