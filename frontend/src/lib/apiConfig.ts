/**
 * VoxShield AI - Dynamic API Configuration & Cloudflare Tunnel Switcher
 * Manages the backend HTTP URL, WebSocket URL derivation, and Supabase auth token propagation.
 */

const STORAGE_KEY_API_URL = "voxshield_api_url";
const STORAGE_KEY_AUTH_TOKEN = "voxshield_access_token";

/**
 * Strips trailing slashes from a URL string.
 */
export function sanitizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/**
 * Gets the current active Backend HTTP Base URL.
 * Priority:
 * 1. User-configured localStorage override (e.g. Cloudflare tunnel URL)
 * 2. NEXT_PUBLIC_API_URL environment variable
 * 3. Default 'http://localhost:8000'
 */
export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem(STORAGE_KEY_API_URL);
    if (stored && stored.trim()) {
      return sanitizeUrl(stored);
    }
  }
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && envUrl.trim()) {
    return sanitizeUrl(envUrl);
  }
  return "http://localhost:8000";
}

/**
 * Sets or resets the active Backend HTTP Base URL in localStorage.
 * Pass null or empty string to reset back to default.
 */
export function setApiBaseUrl(url: string | null): void {
  if (typeof window !== "undefined") {
    if (url && url.trim()) {
      localStorage.setItem(STORAGE_KEY_API_URL, sanitizeUrl(url));
    } else {
      localStorage.removeItem(STORAGE_KEY_API_URL);
    }
    // Dispatch a storage event so UI components can update immediately
    window.dispatchEvent(new Event("voxshield_api_url_changed"));
  }
}

/**
 * Gets the stored Supabase/session access token.
 */
export function getAccessToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem(STORAGE_KEY_AUTH_TOKEN);
  }
  return null;
}

/**
 * Persists the Supabase/session access token.
 */
export function setAccessToken(token: string | null): void {
  if (typeof window !== "undefined") {
    if (token) {
      localStorage.setItem(STORAGE_KEY_AUTH_TOKEN, token);
    } else {
      localStorage.removeItem(STORAGE_KEY_AUTH_TOKEN);
    }
  }
}

/**
 * Automatically derives the WebSocket URL corresponding to the current HTTP API URL.
 * - https://xxxx.trycloudflare.com -> wss://xxxx.trycloudflare.com/ws/live-analyze
 * - http://localhost:8000 -> ws://localhost:8000/ws/live-analyze
 * Appends `?token=<access_token>` if a token is present.
 */
export function getLiveAnalyzeWebSocketUrl(token?: string | null): string {
  const httpBase = getApiBaseUrl();
  let wsBase: string;

  if (httpBase.startsWith("https://")) {
    wsBase = httpBase.replace(/^https:\/\//i, "wss://");
  } else if (httpBase.startsWith("http://")) {
    wsBase = httpBase.replace(/^http:\/\//i, "ws://");
  } else {
    // Relative or protocol-agnostic fallback
    if (typeof window !== "undefined") {
      const isHttps = window.location.protocol === "https:";
      wsBase = `${isHttps ? "wss" : "ws"}://${httpBase}`;
    } else {
      wsBase = `ws://${httpBase}`;
    }
  }

  const endpoint = `${wsBase}/ws/live-analyze`;
  const activeToken = token ?? getAccessToken();

  if (activeToken) {
    return `${endpoint}?token=${encodeURIComponent(activeToken)}`;
  }
  return endpoint;
}

/**
 * Exports headers with Authorization: Bearer <access_token> attached if available.
 */
export function getAuthHeaders(
  customHeaders: Record<string, string> = {},
  token?: string | null
): Record<string, string> {
  const activeToken = token ?? getAccessToken();
  const headers: Record<string, string> = { ...customHeaders };
  if (activeToken) {
    headers["Authorization"] = `Bearer ${activeToken}`;
  }
  return headers;
}
