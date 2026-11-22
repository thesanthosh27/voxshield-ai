import { AnalysisResult, Contact, HealthStatus, Incident, User, AuthResponse } from "@/types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const TOKEN_KEY = "voxshield_auth_token";

export function getAuthToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem(TOKEN_KEY);
  }
  return null;
}

export function setAuthToken(token: string | null): void {
  if (typeof window !== "undefined") {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }
}

export function getAuthHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = { ...customHeaders };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export const getLiveAnalyzeWebSocketUrl = (): string => {
  if (typeof window !== "undefined") {
    const isHttps = window.location.protocol === "https:";
    const host = window.location.hostname;
    const token = getAuthToken();
    const baseWs = `${isHttps ? "wss" : "ws"}://${host}:8000/ws/live-analyze`;
    return token ? `${baseWs}?token=${encodeURIComponent(token)}` : baseWs;
  }
  return "ws://localhost:8000/ws/live-analyze";
};

// -------------------------------------------------------------
// Authentication Endpoints
// -------------------------------------------------------------
export async function apiRegister(name: string, email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Registration failed");
  }
  const data: AuthResponse = await res.json();
  setAuthToken(data.token);
  return data;
}

export async function apiLogin(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Invalid email or password");
  }
  const data: AuthResponse = await res.json();
  setAuthToken(data.token);
  return data;
}

export async function apiLogout(): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
  } catch {}
  setAuthToken(null);
}

export async function apiGetMe(): Promise<User> {
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Unauthorized");
  }
  const data = await res.json();
  return data.user;
}

// -------------------------------------------------------------
// System Health
// -------------------------------------------------------------
export async function checkHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_BASE}/api/health`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Health check failed");
  return res.json();
}

// -------------------------------------------------------------
// Contact Voiceprints (Scoped by current user token)
// -------------------------------------------------------------
export async function fetchContacts(): Promise<Contact[]> {
  const res = await fetch(`${API_BASE}/api/contacts`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    if (res.status === 401) return [];
    throw new Error("Failed to load contacts");
  }
  return res.json();
}

export async function enrollContact(
  name: string,
  relation: string,
  file: File
): Promise<{ success: boolean; contact: Contact }> {
  const formData = new FormData();
  formData.append("name", name);
  formData.append("relation", relation);
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/api/enroll-contact`, {
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
  const res = await fetch(`${API_BASE}/api/contacts/${contactId}`, {
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
  const formData = new FormData();
  formData.append("file", file);
  if (claimedContactId) {
    formData.append("claimed_contact_id", claimedContactId);
  }
  if (simulateTelephony) {
    formData.append("simulate_telephony", "true");
  }

  const res = await fetch(`${API_BASE}/api/analyze-file`, {
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
  const res = await fetch(`${API_BASE}/api/incidents`, {
    headers: getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}
