import { test, expect } from '@playwright/test';
import {
  registerUser,
  createEndpoint,
  updateEndpoint,
  getRequestLogs,
  healthCheck,
} from '../helpers/api-client';

const VITE_BASE = process.env.BASE_URL || 'http://localhost:5173';

let token: string;

test.describe('Webhook via Vite Proxy', () => {
  test.beforeAll(async () => {
    const healthy = await healthCheck();
    test.skip(!healthy, 'Deno API server not running on port 3000');

    const email = `proxy-${Date.now()}@test.com`;
    const result = await registerUser(email, 'password123');
    token = result.token;
  });

  test('webhook reachable through Vite proxy /w/:id', async () => {
    const ep = await createEndpoint(token, 'Proxy Test', '');
    const res = await fetch(`${VITE_BASE}/w/${ep.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ via: 'proxy' }),
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"ok": true}');
  });

  test('scripted response works through proxy', async () => {
    const ep = await createEndpoint(
      token,
      'Proxy Script',
      'return { status: 201, headers: {"Content-Type": "application/json"}, body: JSON.stringify({ proxied: true, method: request.method }) };'
    );

    const res = await fetch(`${VITE_BASE}/w/${ep.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(201);
    const body = JSON.parse(await res.text());
    expect(body.proxied).toBe(true);
    expect(body.method).toBe('POST');
  });

  test('API endpoints accessible through Vite proxy', async () => {
    const res = await fetch(`${VITE_BASE}/api/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
  });

  test('webhook 404 works through proxy for nonexistent endpoint', async () => {
    const res = await fetch(`${VITE_BASE}/w/nonexistent-endpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(404);
  });

  test('query parameters pass through proxy', async () => {
    const ep = await createEndpoint(
      token,
      'Proxy Query',
      'return { status: 200, headers: {"Content-Type": "application/json"}, body: JSON.stringify({ q: request.query }) };'
    );

    const res = await fetch(`${VITE_BASE}/w/${ep.id}?foo=bar&n=42`, {
      method: 'GET',
    });
    expect(res.status).toBe(200);
    const body = JSON.parse(await res.text());
    expect(body.q.foo).toBe('bar');
    expect(body.q.n).toBe('42');
  });

  test('request logs capture proxied requests', async () => {
    const ep = await createEndpoint(token, 'Proxy Log', '');
    await fetch(`${VITE_BASE}/w/${ep.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ logged: true }),
    });

    const logs = await getRequestLogs(token, ep.id);
    expect(logs.length).toBe(1);
    expect(logs[0].method).toBe('POST');
    expect(logs[0].body).toContain('logged');
  });
});
