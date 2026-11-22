"use client";

import React, { useState, useRef, useEffect } from "react";
import { PcmWavRecorder } from "@/lib/pcmRecorder";
import { getLiveAnalyzeWebSocketUrl } from "@/lib/api";
import { Contact, LiveTelemetryMessage, ThreatState } from "@/types";
import { AudioSculpture3D } from "@/components/AudioSculpture3D";
import { Odometer } from "@/components/Odometer";
import { TiltPanel } from "@/components/TiltPanel";
import { MagneticButton } from "@/components/MagneticButton";
import { SignalFlow } from "@/components/SignalFlow";
import {
  PhoneOff,
  Radio,
  ShieldAlert,
  Fingerprint,
  PhoneCall,
  Hash,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";

interface LiveShieldTabProps {
  contacts: Contact[];
  threatState: ThreatState;
  riskScore: number;
  aiScore: number | null;
  voiceprintMatch: number | null;
  matchedKeywords: string[];
  transcript: string;
  challenges: string[];
  forensicHash: string | null;
  latencyMs: number;
  onUpdateState: (
    state: ThreatState,
    risk: number,
    ai: number | null,
    voiceprint: number | null,
    keywords: string[],
    challenges: string[],
    hash: string | null,
    latency: number,
    claimedName: string | null,
    liveTranscript?: string
  ) => void;
}

export const LiveShieldTab: React.FC<LiveShieldTabProps> = ({
  contacts,
  threatState,
  riskScore,
  aiScore,
  voiceprintMatch,
  matchedKeywords,
  transcript,
  challenges,
  forensicHash,
  latencyMs,
  onUpdateState,
}) => {
  const [isActive, setIsActive] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [simulateTelephony, setSimulateTelephony] = useState<boolean>(false);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const recorderRef = useRef<PcmWavRecorder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const contactsRef = useRef<Contact[]>(contacts);
  const selectedContactIdRef = useRef<string>(selectedContactId);

  useEffect(() => {
    contactsRef.current = contacts;
  }, [contacts]);

  useEffect(() => {
    selectedContactIdRef.current = selectedContactId;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "config",
          claimed_contact_id: selectedContactId || null,
          simulate_telephony: simulateTelephony,
        })
      );
    }
  }, [selectedContactId, simulateTelephony]);

  const toggleShield = async () => {
    if (isActive) {
      stopShield();
    } else {
      await startShield();
    }
  };

  const startShield = async () => {
    setCaptureError(null);
    try {
      const recorder = new PcmWavRecorder();
      recorderRef.current = recorder;

      const wsUrl = getLiveAnalyzeWebSocketUrl();
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        ws.send(
          JSON.stringify({
            type: "config",
            claimed_contact_id: selectedContactIdRef.current || null,
            simulate_telephony: simulateTelephony,
          })
        );

        try {
          const { analyser } = await recorder.start(
            (wavBuffer) => {
              if (ws.readyState === WebSocket.OPEN && wavBuffer.byteLength > 0) {
                ws.send(wavBuffer);
              }
            },
            "call",
            () => {
              // Browser 'Stop sharing' bar or track ended
              stopShield();
            }
          );

          setAnalyserNode(analyser);
          setIsActive(true);
        } catch (captureErr) {
          const errMsg = captureErr instanceof Error ? captureErr.message : String(captureErr);
          if (errMsg.includes("Permission denied") || errMsg.includes("NotAllowedError")) {
            setCaptureError("Permission to capture audio was denied or cancelled.");
          } else {
            setCaptureError(errMsg);
          }
          stopShield();
        }
      };

      ws.onmessage = (event) => {
        try {
          const msg: LiveTelemetryMessage = JSON.parse(event.data);
          if (msg.type === "telemetry" && msg.threat_state) {
            const score = msg.risk_score ?? 0;
            const claimedName =
              contactsRef.current.find((c) => c.id === selectedContactIdRef.current)?.name || null;

            onUpdateState(
              msg.threat_state,
              score,
              msg.ai_score ?? null,
              msg.voiceprint_match ?? null,
              msg.matched_keywords ?? [],
              msg.challenges ?? [],
              msg.forensic_hash ?? null,
              msg.latency_ms ?? 0,
              claimedName,
              msg.transcript ?? ""
            );
          }
        } catch {}
      };

      ws.onerror = () => stopShield();
      ws.onclose = () => stopShield();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setCaptureError(errMsg);
      stopShield();
    }
  };

  const stopShield = () => {
    setIsActive(false);
    setAnalyserNode(null);

    if (recorderRef.current) {
      try {
        recorderRef.current.stop();
      } catch {}
      recorderRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopShield();
  }, []);

  const isAlarm = threatState === "CRITICAL_AI_CLONE";
  const isWarning = threatState === "IMPERSONATION_MIMICRY_WARNING";

  return (
    <div className="space-y-8 select-none">
      {/* 3D WebGL Living Acoustic Sculpture Showcase */}
      <div className="relative rounded-3xl bg-studio-card/80 border border-studio-border p-6 sm:p-8 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Command & Telemetry */}
          <div className="lg:col-span-5 space-y-6">
            <div>
              <div className="font-sans text-xs font-semibold text-studio-muted uppercase tracking-wider mb-2 flex items-center gap-2">
                <PhoneCall className="w-3.5 h-3.5 text-threat-emerald animate-pulse" />
                <span>Live Intercept</span>
              </div>
              <h2 className="font-display font-bold text-3xl sm:text-4xl text-studio-text tracking-normal">
                Live Call Shield
              </h2>
              <p className="font-sans text-sm text-studio-muted mt-2 font-normal leading-relaxed">
                Directly intercepts live call audio from Windows Phone Link, WhatsApp Web, or browser VoIP calls into the neural forensics pipeline. Watch the acoustic sculpture react in real time.
              </p>
            </div>

            {/* Target Contact Selector & Call Quality Test */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-sans font-medium text-studio-muted block">
                  Target Contact
                </label>
                <select
                  value={selectedContactId}
                  onChange={(e) => setSelectedContactId(e.target.value)}
                  className="w-full bg-studio-elevated border border-studio-border rounded-xl px-3 py-2 text-xs font-sans text-studio-text focus:outline-none cursor-pointer"
                >
                  <option value="">General Caller (Unknown)</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.relation})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-sans font-medium text-studio-muted block">
                  Call Quality Test
                </label>
                <button
                  type="button"
                  onClick={() => setSimulateTelephony(!simulateTelephony)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-sans transition-colors cursor-pointer ${
                    simulateTelephony
                      ? "bg-threat-amber/15 border-threat-amber/40 text-threat-amber"
                      : "bg-studio-elevated border-studio-border text-studio-muted hover:text-studio-text"
                  }`}
                >
                  <span>Simulate Phone Call (8kHz)</span>
                  <span className="font-semibold">{simulateTelephony ? "Active" : "Off"}</span>
                </button>
              </div>
            </div>

            {/* Call Audio Helper Hint */}
            <div className="pt-1">
              <p className="text-xs font-sans text-studio-muted leading-relaxed flex items-start gap-2 p-3 rounded-xl bg-studio-card border border-studio-border">
                <span className="text-threat-amber shrink-0 font-bold mt-0.5">•</span>
                <span>
                  Works with Windows Phone Link (mobile calls), WhatsApp Web, and browser calls. Tick{" "}
                  <strong className="text-studio-text font-semibold">&apos;Share system audio&apos;</strong> in the popup.
                </span>
              </p>
            </div>

            {/* Inline Capture Error Message */}
            {captureError && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-threat-crimson/10 border border-threat-crimson/30 text-threat-crimson text-xs font-sans">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-semibold block mb-0.5">Audio Capture Notice</span>
                  <span>{captureError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCaptureError(null)}
                  className="text-threat-crimson/80 hover:text-threat-crimson text-xs cursor-pointer font-bold ml-1"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Action Button */}
            <div className="pt-1">
              <MagneticButton
                variant={isActive ? "danger" : "primary"}
                onClick={toggleShield}
                className="w-full sm:w-auto text-sm px-8 py-3.5"
              >
                {isActive ? (
                  <span className="flex items-center gap-2">
                    <PhoneOff className="w-4 h-4" /> Stop Protection
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <PhoneCall className="w-4 h-4" /> Start Live Call Protection
                  </span>
                )}
              </MagneticButton>
            </div>
          </div>

          {/* Right Column: 3D WebGL Audio Sculpture */}
          <div className="lg:col-span-7 h-[420px] rounded-2xl bg-[#050608] border border-studio-border relative overflow-hidden flex items-center justify-center">
            <AudioSculpture3D
              analyserNode={analyserNode}
              threatState={threatState}
              riskScore={riskScore}
              isLive={isActive}
            />
          </div>
        </div>
      </div>

      {/* Numeric Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Risk Score Odometer */}
        <TiltPanel>
          <div className="flex items-center justify-between text-studio-muted text-xs font-sans font-medium mb-2.5">
            <span>Overall Threat Risk</span>
            <AlertTriangle className="w-4 h-4 text-studio-muted" />
          </div>
          <div className="flex items-baseline flex-nowrap whitespace-nowrap">
            <Odometer
              value={riskScore}
              decimals={1}
              suffix="%"
              size="lg"
              className={
                isAlarm
                  ? "text-threat-crimson"
                  : isWarning
                  ? "text-threat-amber"
                  : "text-threat-emerald"
              }
            />
          </div>
          <p className="font-sans text-xs text-studio-dim mt-2 font-normal">
            Fused multi-layer probability
          </p>
        </TiltPanel>

        {/* AI Clone Score Odometer */}
        <TiltPanel>
          <div className="flex items-center justify-between text-studio-muted text-xs font-sans font-medium mb-2.5">
            <span>AI Clone Probability</span>
            <ShieldAlert className="w-4 h-4 text-studio-muted" />
          </div>
          <div className="flex items-baseline flex-nowrap whitespace-nowrap">
            <Odometer
              value={aiScore ?? 0}
              decimals={1}
              suffix="%"
              size="lg"
              className={
                (aiScore ?? 0) >= 65
                  ? "text-threat-crimson"
                  : "text-studio-text"
              }
            />
          </div>
          <p className="font-sans text-xs text-studio-dim mt-2 font-normal">
            Neural vocoder artifact confidence
          </p>
        </TiltPanel>

        {/* Voiceprint Similarity Odometer */}
        <TiltPanel>
          <div className="flex items-center justify-between text-studio-muted text-xs font-sans font-medium mb-2.5">
            <span>Voiceprint Match</span>
            <Fingerprint className="w-4 h-4 text-studio-muted" />
          </div>
          <div className="flex items-baseline flex-nowrap whitespace-nowrap">
            <Odometer
              value={voiceprintMatch ?? 0}
              decimals={1}
              suffix="%"
              size="lg"
              className={
                voiceprintMatch !== null && voiceprintMatch < 58
                  ? "text-threat-amber"
                  : "text-studio-text"
              }
            />
          </div>
          <p className="font-sans text-xs text-studio-dim mt-2 font-normal">
            Speaker biometric similarity
          </p>
        </TiltPanel>

        {/* Latency */}
        <TiltPanel>
          <div className="flex items-center justify-between text-studio-muted text-xs font-sans font-medium mb-2.5">
            <span>Stream Latency</span>
            <Radio className="w-4 h-4 text-studio-muted" />
          </div>
          <div className="flex items-baseline flex-nowrap whitespace-nowrap">
            <Odometer
              value={latencyMs}
              decimals={0}
              suffix="ms"
              size="lg"
              className="text-studio-text"
            />
          </div>
          <p className="font-sans text-xs text-studio-dim mt-2 font-normal">
            Roundtrip verification latency
          </p>
        </TiltPanel>
      </div>

      {/* 3-Layer Signal Flow Pipeline */}
      <SignalFlow
        threatState={threatState}
        isStreaming={isActive}
        aiScore={aiScore}
        voiceprintMatch={voiceprintMatch}
        hasKeywords={matchedKeywords.length > 0}
      />

      {/* Live Transcript Stream & Active Challenges */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Speech Recognition Panel */}
        <TiltPanel>
          <div className="flex items-center justify-between border-b border-studio-border/60 pb-3 mb-4">
            <span className="font-sans text-xs font-semibold text-studio-text uppercase tracking-wider">
              Live Transcription
            </span>
            <span className="font-sans text-xs text-studio-dim">
              {matchedKeywords.length > 0 ? `${matchedKeywords.length} flagged keywords` : "No flags"}
            </span>
          </div>

          <div className="min-h-[110px] bg-studio-bg rounded-xl p-4 border border-studio-border font-sans text-sm text-studio-text leading-relaxed font-normal">
            {transcript ? (
              <span>{transcript}</span>
            ) : (
              <span className="text-studio-dim text-xs">
                {isActive ? "Listening for speech..." : "Start protection to transcribe incoming audio"}
              </span>
            )}
          </div>

          {matchedKeywords.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {matchedKeywords.map((kw) => (
                <span
                  key={kw}
                  className="px-2.5 py-1 rounded bg-threat-amber/15 border border-threat-amber/30 text-threat-amber font-sans text-xs font-semibold"
                >
                  Flagged: {kw}
                </span>
              ))}
            </div>
          )}
        </TiltPanel>

        {/* Active Prevention Liveness Challenges */}
        <TiltPanel>
          <div className="flex items-center justify-between border-b border-studio-border/60 pb-3 mb-4">
            <span className="font-sans text-xs font-semibold text-studio-text uppercase tracking-wider">
              Active Protection Challenges
            </span>
            <span className="font-sans text-xs text-studio-dim">
              {challenges.length > 0 ? `${challenges.length} active` : "Standing by"}
            </span>
          </div>

          {challenges.length > 0 ? (
            <div className="space-y-2.5">
              {challenges.map((c, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-threat-crimson/10 border border-threat-crimson/30 text-studio-text text-xs font-sans font-medium flex items-start gap-2.5"
                >
                  <span className="font-sans font-bold text-threat-crimson">0{idx + 1}.</span>
                  <span>{c}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="min-h-[110px] flex items-center justify-center border border-dashed border-studio-border rounded-xl text-studio-dim font-sans text-xs">
              No active threat detected. System standing by.
            </div>
          )}

          {forensicHash && (
            <div className="mt-4 pt-3 border-t border-studio-border/40 flex items-center gap-2 text-studio-dim font-sans text-xs truncate">
              <Hash className="w-3.5 h-3.5 text-studio-muted shrink-0" />
              <span className="truncate">Forensic Hash: {forensicHash}</span>
            </div>
          )}
        </TiltPanel>
      </div>
    </div>
  );
};
