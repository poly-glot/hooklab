/**
 * API client for the Deno backend server.
 *
 * ZERO local storage — no localStorage, no sessionStorage, no IndexedDB.
 * Auth tokens come from Firebase Auth (in-memory only, managed by Firebase SDK).
 * Firebase SDK handles token refresh and persistence internally via IndexedDB
 * with its own encryption — we never touch it directly.
 */

import { auth } from "./firebase-init";

export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface Endpoint {
  id: string;
  userId: string;
  name: string;
  script: string;
  defaultStatusCode: number;
  defaultContentType: string;
  defaultBody: string;
  isActive: boolean;
  createdAt: string;
}

export interface RequestLog {
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

export interface Stats {
  totalEndpoints: number;
  totalRequests: number;
  recentRequests: RequestLog[];
}

// ── Reports types ──────────────────────────────────────────────────

export type ReportDuration = "7d" | "30d" | "90d" | "180d";
export type ReportFormat = "table" | "csv" | "json" | "markdown" | "chart" | "summary";

export interface ReportQueryRequest {
  question: string;
  duration: ReportDuration;
  format: ReportFormat;
  endpointIds?: string[];
}

export interface TableColumn {
  name: string;
  type: string;
}

export interface TableOutput {
  columns: TableColumn[];
  rows: Record<string, unknown>[];
}

export interface ChartOutput {
  type: "bar" | "line" | "pie" | "scatter";
  labels: string[];
  datasets: { label: string; data: number[]; color?: string }[];
  xAxis?: string;
  yAxis?: string;
}

export interface ReportMeta {
  query: string;
  explanation: string;
  bytesProcessed: number;
  rowCount: number;
  executionTime: number;
  timeWindow: { start: string; end: string };
}

export interface QuotaStatus {
  queriesUsed: number;
  queriesLimit: number;
  bytesUsed: number;
  bytesLimit: number;
}

export interface ReportQueryResponse {
  id: string;
  meta: ReportMeta;
  data: TableOutput | ChartOutput | string;
  format: ReportFormat;
  quota: QuotaStatus;
}

export interface ReportHistoryEntry {
  id: string;
  question: string;
  format: ReportFormat;
  duration: ReportDuration;
  createdAt: string;
  meta: ReportMeta;
}

export interface EndpointSchemaInfo {
  endpointId: string;
  discoveredAt: string;
  sampleSize: number;
  bodiesWithContent: number;
  topLevelKeys: string[];
}

class ApiClient {
  /**
   * Get a fresh Firebase ID token for the current user.
   * Returns null if no user is signed in.
   * Firebase handles token caching and refresh internally.
   */
  private async getIdToken(): Promise<string | null> {
    const currentUser = auth.currentUser;
    if (!currentUser) return null;
    return currentUser.getIdToken();
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    const token = await this.getIdToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`/api${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth
  async getMe(): Promise<{ user: User }> {
    return this.request("/auth/me");
  }

  // Endpoints
  async getEndpoints(): Promise<{ endpoints: Endpoint[] }> {
    return this.request("/endpoints");
  }

  async createEndpoint(name: string): Promise<{ endpoint: Endpoint }> {
    return this.request("/endpoints", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  }

  async getEndpoint(id: string): Promise<{ endpoint: Endpoint }> {
    return this.request(`/endpoints/${id}`);
  }

  async updateEndpoint(
    id: string,
    data: Partial<
      Pick<
        Endpoint,
        | "name"
        | "script"
        | "defaultStatusCode"
        | "defaultContentType"
        | "defaultBody"
      >
    >
  ): Promise<{ endpoint: Endpoint }> {
    return this.request(`/endpoints/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteEndpoint(id: string): Promise<{ ok: boolean }> {
    return this.request(`/endpoints/${id}`, { method: "DELETE" });
  }

  // Request logs
  async getRequestLogs(
    endpointId: string
  ): Promise<{ requests: RequestLog[] }> {
    return this.request(`/endpoints/${endpointId}/requests`);
  }

  async clearRequestLogs(endpointId: string): Promise<{ ok: boolean }> {
    return this.request(`/endpoints/${endpointId}/requests`, {
      method: "DELETE",
    });
  }

  async deleteRequestLog(
    endpointId: string,
    requestId: string
  ): Promise<{ ok: boolean }> {
    return this.request(`/endpoints/${endpointId}/requests/${requestId}`, {
      method: "DELETE",
    });
  }

  // Stats
  async getStats(): Promise<Stats> {
    return this.request("/endpoints/_stats");
  }

  // Reports
  async queryReport(data: ReportQueryRequest): Promise<ReportQueryResponse> {
    return this.request("/reports/query", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getReportQuota(): Promise<QuotaStatus> {
    return this.request("/reports/quota");
  }

  async getReportHistory(): Promise<{ history: ReportHistoryEntry[] }> {
    return this.request("/reports/history");
  }

  async getEndpointSchema(endpointId: string): Promise<EndpointSchemaInfo> {
    return this.request(`/reports/schema/${endpointId}`);
  }
}

export const api = new ApiClient();
