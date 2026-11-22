export type ThreatState =
  | "STANDBY"
  | "VERIFIED_SAFE"
  | "SUSPICIOUS_VERIFY"
  | "IMPERSONATION_MIMICRY_WARNING"
  | "CRITICAL_AI_CLONE";

export interface LiveTelemetryMessage {
  type: "telemetry" | "config_ack" | "chunk_skipped" | "error";
  threat_state?: ThreatState;
  risk_score?: number;
  ai_score?: number;
  voiceprint_match?: number | null;
  transcript?: string;
  matched_keywords?: string[];
  challenges?: string[];
  forensic_hash?: string | null;
  duration_sec?: number;
  latency_ms?: number;
  reason?: string;
  message?: string;
}

export interface AnalysisResult {
  threat_state: ThreatState;
  risk_score: number;
  ai_clone_detection: {
    peak_score: number;
    average_score: number;
    timeline: Array<{
      start_time: number;
      end_time: number;
      fake_score: number;
    }>;
  };
  voiceprint_verification: {
    claimed_contact_id: string | null;
    claimed_contact_name: string | null;
    similarity_pct: number | null;
  };
  scam_intent: {
    transcript: string;
    matched_keywords: string[];
  };
  acoustic_telemetry: {
    snr_db: number;
    spectral_flatness: number;
    pitch_variance: number;
    duration_sec: number;
    zero_crossing_rate: number;
    rms_energy: number;
  };
  spectrogram_image: string;
  active_prevention: {
    liveness_challenges: string[];
    forensic_hash: string | null;
  };
  latency_ms: number;
}

export interface Contact {
  id: string;
  name: string;
  relation: string;
  created_at: string;
  has_embedding: boolean;
}

export interface Incident {
  id: string;
  timestamp: string;
  threat_state: ThreatState;
  risk_score: number;
  ai_score: number;
  voiceprint_match: number | null;
  claimed_contact: string | null;
  matched_keywords: string[];
  transcript: string;
  challenges: string[];
  forensic_hash: string | null;
  telemetry?: {
    snr_db: number;
    spectral_flatness: number;
    pitch_variance: number;
    duration_sec: number;
    zero_crossing_rate: number;
    rms_energy: number;
  };
}

export interface HealthStatus {
  status: string;
  service: string;
  cuda_available: boolean;
  gpu_name: string;
  models_loaded: boolean;
  vram_allocated_mb: number;
  startup_time: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
