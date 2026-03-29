import { test, expect } from '@playwright/test';
import {
  registerUser,
  loginUser,
  healthCheck,
} from '../helpers/api-client';

test.describe('API Server Health & Authentication', () => {
  test.beforeAll(async () => {
    const healthy = await healthCheck();
    test.skip(!healthy, 'Deno API server not running on port 3000');
  });

  test('health endpoint returns ok', async () => {
    const res = await fetch('http://localhost:3000/api/health');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.timestamp).toBeTruthy();
  });

  test('register a new user', async () => {
    const email = `reg-${Date.now()}@test.com`;
    const result = await registerUser(email, 'password123');
    expect(result.token).toBeTruthy();
    expect(result.user.email).toBe(email);
    expect(result.user.id).toBeTruthy();
    expect(result.user.createdAt).toBeTruthy();
  });

  test('register rejects duplicate email', async () => {
    const email = `dup-${Date.now()}@test.com`;
    await registerUser(email, 'password123');

    const res = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' }),
    });
    expect(res.status).toBe(409);
  });

  test('register rejects short password', async () => {
    const res = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `short-${Date.now()}@test.com`, password: '123' }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('8 characters');
  });

  test('register rejects invalid email', async () => {
    const res = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'notanemail', password: 'password123' }),
    });
    expect(res.status).toBe(400);
  });

  test('login with valid credentials', async () => {
    const email = `login-${Date.now()}@test.com`;
    await registerUser(email, 'password123');

    const result = await loginUser(email, 'password123');
    expect(result.token).toBeTruthy();
    expect(result.user.email).toBe(email);
  });

  test('login with wrong password returns 401', async () => {
    const email = `wrong-${Date.now()}@test.com`;
    await registerUser(email, 'password123');

    const res = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      },
      body: JSON.stringify({ email, password: 'wrongpassword' }),
    });
    expect([401, 429]).toContain(res.status);
    if (res.status === 401) {
      const data = await res.json();
      expect(data.error).toContain('Invalid');
    }
  });

  test('login with nonexistent email returns 401', async () => {
    const res = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': `10.1.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      },
      body: JSON.stringify({ email: `noexist-${Date.now()}@test.com`, password: 'password123' }),
    });
    expect([401, 429]).toContain(res.status);
  });

  test('GET /api/auth/me returns user info with valid token', async () => {
    const email = `me-${Date.now()}@test.com`;
    const regRes = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': `10.2.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      },
      body: JSON.stringify({ email, password: 'password123' }),
    });
    const { token } = await regRes.json();

    const res = await fetch('http://localhost:3000/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user.email).toBe(email);
  });

  test('GET /api/auth/me rejects invalid token', async () => {
    const res = await fetch('http://localhost:3000/api/auth/me', {
      headers: { Authorization: 'Bearer invalid.token.here' },
    });
    expect(res.status).toBe(401);
  });

  test('protected endpoints reject requests without auth', async () => {
    const res = await fetch('http://localhost:3000/api/endpoints');
    expect(res.status).toBe(401);
  });
});
