/**
 * Direct API client for the Deno backend.
 * Used in E2E tests to set up webhook endpoints and verify responses
 * without going through the Firebase-based UI.
 */

const API_BASE = process.env.API_URL || 'http://localhost:3000';

export interface ApiUser {
  token: string;
  user: { id: string; email: string; createdAt: string };
}

export interface ApiEndpoint {
  id: string;
  userId: string;
  name: string;
  script: string;
  defaultStatusCode: number;
  defaultContentType: string;
  defaultBody: string;
  createdAt: string;
}

export interface ApiRequestLog {
  id: string;
  endpointId: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: string;
  ip: string;
  responseStatus: number;
  responseBody: string;
  timestamp: string;
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`API ${path} returned non-JSON: ${text.slice(0, 200)}`);
  }
}

/** Generate a random IP to avoid rate limiting across tests. */
function randomIp(): string {
  return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

/** Register a new user on the Deno API. Returns token + user info. */
export async function registerUser(email: string, password: string): Promise<ApiUser> {
  return apiRequest<ApiUser>('/api/auth/register', {
    method: 'POST',
    headers: { 'X-Forwarded-For': randomIp() },
    body: JSON.stringify({ email, password }),
  });
}

/** Login an existing user on the Deno API. */
export async function loginUser(email: string, password: string): Promise<ApiUser> {
  return apiRequest<ApiUser>('/api/auth/login', {
    method: 'POST',
    headers: { 'X-Forwarded-For': randomIp() },
    body: JSON.stringify({ email, password }),
  });
}

/** Create a webhook endpoint. */
export async function createEndpoint(
  token: string,
  name: string,
  script = ''
): Promise<ApiEndpoint> {
  const res = await apiRequest<{ endpoint: ApiEndpoint }>('/api/endpoints', {
    method: 'POST',
    body: JSON.stringify({ name, script }),
  }, token);
  return res.endpoint;
}

/** Update an endpoint (name, script, etc). */
export async function updateEndpoint(
  token: string,
  id: string,
  data: Partial<Pick<ApiEndpoint, 'name' | 'script' | 'defaultStatusCode' | 'defaultContentType' | 'defaultBody'>>
): Promise<ApiEndpoint> {
  const res = await apiRequest<{ endpoint: ApiEndpoint }>(`/api/endpoints/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }, token);
  return res.endpoint;
}

/** Delete an endpoint. */
export async function deleteEndpoint(token: string, id: string): Promise<void> {
  await apiRequest<{ ok: boolean }>(`/api/endpoints/${id}`, {
    method: 'DELETE',
  }, token);
}

/** List all endpoints for the authenticated user. */
export async function listEndpoints(token: string): Promise<ApiEndpoint[]> {
  const res = await apiRequest<{ endpoints: ApiEndpoint[] }>('/api/endpoints', {}, token);
  return res.endpoints;
}

/** Get request logs for an endpoint. */
export async function getRequestLogs(token: string, endpointId: string): Promise<ApiRequestLog[]> {
  const res = await apiRequest<{ requests: ApiRequestLog[] }>(
    `/api/endpoints/${endpointId}/requests`, {}, token
  );
  return res.requests;
}

/** Clear all request logs for an endpoint. */
export async function clearRequestLogs(token: string, endpointId: string): Promise<void> {
  await apiRequest<{ ok: boolean }>(`/api/endpoints/${endpointId}/requests`, {
    method: 'DELETE',
  }, token);
}

/** Call a webhook endpoint directly (simulating an external caller). */
export async function callWebhook(
  endpointId: string,
  options: {
    method?: string;
    body?: string;
    headers?: Record<string, string>;
    query?: Record<string, string>;
  } = {}
): Promise<{ status: number; body: string; headers: Headers }> {
  const method = options.method || 'POST';
  const queryString = options.query
    ? '?' + new URLSearchParams(options.query).toString()
    : '';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_BASE}/w/${endpointId}${queryString}`, {
    method,
    headers,
    body: method !== 'GET' && method !== 'HEAD' ? (options.body || '{}') : undefined,
  });

  return {
    status: res.status,
    body: await res.text(),
    headers: res.headers,
  };
}

/** Health check for the API server. */
export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}
