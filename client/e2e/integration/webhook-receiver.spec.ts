import { test, expect } from '@playwright/test';
import {
  registerUser,
  createEndpoint,
  updateEndpoint,
  callWebhook,
  getRequestLogs,
  clearRequestLogs,
  healthCheck,
} from '../helpers/api-client';

let token: string;

test.describe('Webhook Receiver', () => {
  test.beforeAll(async () => {
    const healthy = await healthCheck();
    test.skip(!healthy, 'Deno API server not running on port 3000');

    const email = `webhook-${Date.now()}@test.com`;
    const result = await registerUser(email, 'password123');
    token = result.token;
  });

  test('returns 404 for nonexistent endpoint', async () => {
    const result = await callWebhook('nonexistent-id-12345');
    expect(result.status).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.error).toContain('not found');
  });

  test('accepts POST request with default response (no script)', async () => {
    const ep = await createEndpoint(token, 'Default POST', '');
    const result = await callWebhook(ep.id, {
      method: 'POST',
      body: JSON.stringify({ event: 'test' }),
    });
    expect(result.status).toBe(200);
    expect(result.body).toBe('{"ok": true}');
  });

  test('accepts GET request', async () => {
    const ep = await createEndpoint(token, 'GET Test', '');
    const result = await callWebhook(ep.id, {
      method: 'GET',
      query: { page: '1', limit: '10' },
    });
    expect(result.status).toBe(200);
  });

  test('accepts PUT request', async () => {
    const ep = await createEndpoint(token, 'PUT Test', '');
    const result = await callWebhook(ep.id, {
      method: 'PUT',
      body: JSON.stringify({ updated: true }),
    });
    expect(result.status).toBe(200);
  });

  test('accepts DELETE request', async () => {
    const ep = await createEndpoint(token, 'DELETE Test', '');
    const result = await callWebhook(ep.id, {
      method: 'DELETE',
    });
    expect(result.status).toBe(200);
  });

  test('accepts PATCH request', async () => {
    const ep = await createEndpoint(token, 'PATCH Test', '');
    const result = await callWebhook(ep.id, {
      method: 'PATCH',
      body: JSON.stringify({ field: 'value' }),
    });
    expect(result.status).toBe(200);
  });

  test('logs incoming requests', async () => {
    const ep = await createEndpoint(token, 'Log Test', '');

    // Send 3 requests
    await callWebhook(ep.id, { method: 'POST', body: '{"n":1}' });
    await callWebhook(ep.id, { method: 'GET', query: { n: '2' } });
    await callWebhook(ep.id, { method: 'PUT', body: '{"n":3}' });

    const logs = await getRequestLogs(token, ep.id);
    expect(logs.length).toBe(3);

    // Most recent first
    expect(logs[0].method).toBe('PUT');
    expect(logs[1].method).toBe('GET');
    expect(logs[2].method).toBe('POST');
  });

  test('request logs contain correct data', async () => {
    const ep = await createEndpoint(token, 'Log Data Test', '');

    await callWebhook(ep.id, {
      method: 'POST',
      body: JSON.stringify({ hello: 'world' }),
      headers: { 'X-Custom-Header': 'test-value' },
      query: { key: 'val' },
    });

    const logs = await getRequestLogs(token, ep.id);
    expect(logs.length).toBe(1);

    const log = logs[0];
    expect(log.method).toBe('POST');
    expect(log.body).toContain('hello');
    expect(log.headers['x-custom-header']).toBe('test-value');
    expect(log.query.key).toBe('val');
    expect(log.responseStatus).toBe(200);
    expect(log.timestamp).toBeTruthy();
    expect(log.id).toBeTruthy();
  });

  test('clear request logs', async () => {
    const ep = await createEndpoint(token, 'Clear Test', '');
    await callWebhook(ep.id);
    await callWebhook(ep.id);

    let logs = await getRequestLogs(token, ep.id);
    expect(logs.length).toBe(2);

    await clearRequestLogs(token, ep.id);
    logs = await getRequestLogs(token, ep.id);
    expect(logs.length).toBe(0);
  });

  test('handles multiple rapid requests', async () => {
    const ep = await createEndpoint(token, 'Rapid Test', '');

    const promises = Array.from({ length: 10 }, (_, i) =>
      callWebhook(ep.id, {
        method: 'POST',
        body: JSON.stringify({ index: i }),
      })
    );

    const results = await Promise.all(promises);
    results.forEach((r) => expect(r.status).toBe(200));

    const logs = await getRequestLogs(token, ep.id);
    expect(logs.length).toBe(10);
  });

  test('preserves query parameters in logs', async () => {
    const ep = await createEndpoint(token, 'Query Test', '');
    await callWebhook(ep.id, {
      method: 'GET',
      query: { status: 'active', page: '3', sort: 'desc' },
    });

    const logs = await getRequestLogs(token, ep.id);
    expect(logs[0].query.status).toBe('active');
    expect(logs[0].query.page).toBe('3');
    expect(logs[0].query.sort).toBe('desc');
  });

  test('handles empty body gracefully', async () => {
    const ep = await createEndpoint(token, 'Empty Body', '');
    const result = await callWebhook(ep.id, { method: 'POST', body: '' });
    expect(result.status).toBe(200);
  });

  test('handles large JSON body', async () => {
    const ep = await createEndpoint(token, 'Large Body', '');
    const largeBody = JSON.stringify({
      data: Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        description: 'A'.repeat(100),
      })),
    });

    const result = await callWebhook(ep.id, { method: 'POST', body: largeBody });
    expect(result.status).toBe(200);

    const logs = await getRequestLogs(token, ep.id);
    expect(logs[0].body).toBe(largeBody);
  });
});
