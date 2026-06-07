/**
 * Centralised API client.
 *
 * All network calls go through this module so that:
 * - The base URL is configured in one place
 * - Auth tokens are attached automatically
 * - Error handling is consistent
 */

import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token to every request if present in localStorage
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  register: (email: string, password: string, full_name?: string) =>
    api.post("/api/auth/register", { email, password, full_name }),
  login: (email: string, password: string) =>
    api.post("/api/auth/login", { email, password }),
  me: () => api.get("/api/auth/me"),
};

// ── Leads ─────────────────────────────────────────────────────────────────────
export const leadsApi = {
  list: (params?: Record<string, unknown>) => api.get("/api/leads", { params }),
  get: (id: string) => api.get(`/api/leads/${id}`),
  analyze: (data: { business_name: string; website: string; city?: string; category?: string }) =>
    api.post("/api/leads/analyze", data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/api/leads/${id}`, data),
  delete: (id: string) => api.delete(`/api/leads/${id}`),
  sendEmail: (id: string, data: { email_type: string; custom_subject?: string; custom_body?: string }) =>
    api.post(`/api/leads/${id}/send`, data),
  sendFollowUp: (id: string, num: 1 | 2) =>
    api.post(`/api/leads/${id}/followup?follow_up_number=${num}`),
  exportCsv: () => api.get("/api/leads/export/csv", { responseType: "blob" }),
};

// ── Pipeline ──────────────────────────────────────────────────────────────────
export const pipelineApi = {
  run: (data: { niche: string; city: string; num_leads?: number; send_emails?: boolean; email_type?: string }) =>
    api.post("/api/pipeline/run", data),
  getStatus: (runId: string) => api.get(`/api/pipeline/${runId}`),
  listRuns: () => api.get("/api/pipeline"),
};

// ── Settings ──────────────────────────────────────────────────────────────────
export const settingsApi = {
  get: () => api.get("/api/settings"),
  update: (data: Record<string, unknown>) => api.patch("/api/settings", data),
};
