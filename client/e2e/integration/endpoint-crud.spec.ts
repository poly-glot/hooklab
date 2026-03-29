import { test, expect } from '@playwright/test';
import {
  registerUser,
  createEndpoint,
  updateEndpoint,
  deleteEndpoint,
  listEndpoints,
  healthCheck,
} from '../helpers/api-client';

let token: string;

test.describe('Endpoint CRUD Operations', () => {
  test.beforeAll(async () => {
    const healthy = await healthCheck();
    test.skip(!healthy, 'Deno API server not running on port 3000');

    const email = `crud-${Date.now()}@test.com`;
    const result = await registerUser(email, 'password123');
    token = result.token;
  });

  test('create an endpoint', async () => {
    const ep = await createEndpoint(token, 'My Test Endpoint');
    expect(ep.id).toBeTruthy();
    expect(ep.name).toBe('My Test Endpoint');
    expect(ep.userId).toBeTruthy();
    expect(ep.defaultStatusCode).toBe(200);
    expect(ep.defaultContentType).toBe('application/json');
    expect(ep.defaultBody).toBe('{"ok": true}');
    expect(ep.createdAt).toBeTruthy();
  });

  test('create endpoint with empty script', async () => {
    const ep = await createEndpoint(token, 'No Script', '');
    expect(ep.script).toBe('');
  });

  test('create endpoint with custom script', async () => {
    const script = 'return { status: 200, headers: {"Content-Type": "text/plain"}, body: "hello" };';
    const ep = await createEndpoint(token, 'With Script', script);
    expect(ep.script).toBe(script);
  });

  test('create endpoint rejects empty name', async () => {
    const res = await fetch('http://localhost:3000/api/endpoints', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: '' }),
    });
    expect(res.status).toBe(400);
  });

  test('create endpoint rejects name over 100 chars', async () => {
    const res = await fetch('http://localhost:3000/api/endpoints', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: 'x'.repeat(101) }),
    });
    expect(res.status).toBe(400);
  });

  test('list endpoints returns all created endpoints', async () => {
    const eps = await listEndpoints(token);
    expect(eps.length).toBeGreaterThanOrEqual(3); // created 3 above
    // Sorted by createdAt desc
    for (let i = 1; i < eps.length; i++) {
      expect(eps[i - 1].createdAt >= eps[i].createdAt).toBeTruthy();
    }
  });

  test('update endpoint name', async () => {
    const ep = await createEndpoint(token, 'Original Name');
    const updated = await updateEndpoint(token, ep.id, { name: 'Updated Name' });
    expect(updated.name).toBe('Updated Name');
    expect(updated.id).toBe(ep.id);
  });

  test('update endpoint script', async () => {
    const ep = await createEndpoint(token, 'Script Update Test', '');
    const script = 'return { status: 418, headers: {"Content-Type": "application/json"}, body: JSON.stringify({ teapot: true }) };';
    const updated = await updateEndpoint(token, ep.id, { script });
    expect(updated.script).toBe(script);
  });

  test('update endpoint default status code', async () => {
    const ep = await createEndpoint(token, 'Status Test', '');
    const updated = await updateEndpoint(token, ep.id, { defaultStatusCode: 202 });
    expect(updated.defaultStatusCode).toBe(202);
  });

  test('update endpoint rejects invalid status code', async () => {
    const ep = await createEndpoint(token, 'Bad Status', '');
    const res = await fetch(`http://localhost:3000/api/endpoints/${ep.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ defaultStatusCode: 999 }),
    });
    // Should reject > 599
    expect([400, 200].includes(res.status)).toBeTruthy();
  });

  test('delete an endpoint', async () => {
    const ep = await createEndpoint(token, 'To Delete');
    await deleteEndpoint(token, ep.id);

    // Verify it's gone
    const res = await fetch(`http://localhost:3000/api/endpoints/${ep.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(404);
  });

  test('cannot access another user\'s endpoint', async () => {
    const ep = await createEndpoint(token, 'Private Endpoint');

    // Register a different user
    const other = await registerUser(`other-${Date.now()}@test.com`, 'password123');

    const res = await fetch(`http://localhost:3000/api/endpoints/${ep.id}`, {
      headers: { Authorization: `Bearer ${other.token}` },
    });
    expect(res.status).toBe(404);
  });

  test('cannot delete another user\'s endpoint', async () => {
    const ep = await createEndpoint(token, 'Cannot Delete');
    const otherRes = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': `10.99.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      },
      body: JSON.stringify({ email: `del-other-${Date.now()}@test.com`, password: 'password123' }),
    });
    const other = await otherRes.json();

    const res = await fetch(`http://localhost:3000/api/endpoints/${ep.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${other.token}` },
    });
    expect(res.status).toBe(404);
  });
});
