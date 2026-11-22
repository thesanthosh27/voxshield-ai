import { AnalysisResult, Contact, HealthStatus, Incident, User, AuthResponse } from "@/types";
import {
  getApiBaseUrl,
  getAuthHeaders,
  getAccessToken,
  setAccessToken,
  getLiveAnalyzeWebSocketUrl,
} from "./apiConfig";

export {
  getApiBaseUrl,
  getAuthHeaders,
  getAccessToken,
  setAccessToken,
  getLiveAnalyzeWebSocketUrl,
};

// Backwards-compatible token accessors
export function getAuthToken(): string | null {
  return getAccessToken();
}

export function setAuthToken(token: string | null): void {
  setAccessToken(token);
}

// -------------------------------------------------------------
// System Health
// -------------------------------------------------------------
export async function checkHealth(): Promise<HealthStatus> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/health`, {
    cache: "no-store",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
  return res.json();
}

// -------------------------------------------------------------
// Contact Voiceprints (Scoped by Authorization: Bearer <access_token>)
// -------------------------------------------------------------
export async function fetchContacts(): Promise<Contact[]> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/contacts`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    if (res.status === 401) return [];
    throw new Error(`Failed to load contacts (${res.status})`);
  }
  return res.json();
}

export async function enrollContact(
  name: string,
  relation: string,
  file: File
): Promise<{ success: boolean; contact: Contact }> {
  const base = getApiBaseUrl();
  const formData = new FormData();
  formData.append("name", name);
  formData.append("relation", relation);
  formData.append("file", file);

  const res = await fetch(`${base}/api/enroll-contact`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Enrollment failed");
  }
  return res.json();
}

export async function deleteContact(contactId: string): Promise<boolean> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/contacts/${contactId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return res.ok;
}

// -------------------------------------------------------------
// Audio Lab File Forensic Analysis
// -------------------------------------------------------------
export async function analyzeFile(
  file: File,
  claimedContactId?: string,
  simulateTelephony: boolean = false
): Promise<AnalysisResult> {
  const base = getApiBaseUrl();
  const formData = new FormData();
  formData.append("file", file);
  if (claimedContactId) {
    formData.append("claimed_contact_id", claimedContactId);
  }
  if (simulateTelephony) {
    formData.append("simulate_telephony", "true");
  }

  const res = await fetch(`${base}/api/analyze-file`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "File analysis failed");
  }
  return res.json();
}

export async function fetchIncidents(): Promise<Incident[]> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/incidents`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

// -------------------------------------------------------------
// Optional Direct Backend Auth Endpoints (preserved for dual-mode / legacy)
// -------------------------------------------------------------
export async function apiRegister(name: string, email: string, password: string): Promise<AuthResponse> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Registration failed");
  }
  const data: AuthResponse = await res.json();
  setAccessToken(data.token);
  return data;
}

export async function apiLogin(email: string, password: string): Promise<AuthResponse> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Invalid email or password");
  }
  const data: AuthResponse = await res.json();
  setAccessToken(data.token);
  return data;
}

export async function apiLogout(): Promise<void> {
  const base = getApiBaseUrl();
  try {
    await fetch(`${base}/api/auth/logout`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
  } catch {}
  setAccessToken(null);
}

export async function apiGetMe(): Promise<User> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/auth/me`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Unauthorized");
  }
  const data = await res.json();
  return data.user;
}
