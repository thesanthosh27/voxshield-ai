"use client";

import React, { useState, useRef } from "react";
import { analyzeFile } from "@/lib/api";
import { AnalysisResult, Contact, ThreatState } from "@/types";
import { TiltPanel } from "@/components/TiltPanel";
import { Odometer } from "@/components/Odometer";
import { MagneticButton } from "@/components/MagneticButton";
import {
  Upload,
  Play,
  Pause,
  FileAudio,
  Hash,
} from "lucide-react";

interface ForensicLabTabProps {
  contacts: Contact[];
  threatState: ThreatState;
  onAnalysisComplete: (result: AnalysisResult) => void;
}

export const ForensicLabTab: React.FC<ForensicLabTabProps> = ({
  contacts,
  threatState,
  onAnalysisComplete,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [simulateTelephony, setSimulateTelephony] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleFileChange = (newFile: File) => {
    setFile(newFile);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    const url = URL.createObjectURL(newFile);
    setAudioUrl(url);
    setIsPlaying(false);
  };

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const executeAudit = async () => {
    if (!file) return;
    setIsAnalyzing(true);
    try {
      const res = await analyzeFile(file, selectedContactId || undefined, simulateTelephony);
      setResult(res);
      onAnalysisComplete(res);
    } catch (err: unknown) {
      alert(`Forensic analysis failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getVerdictLabel = (state: ThreatState) => {
    switch (state) {
      case "CRITICAL_AI_CLONE":
        return "AI Clone Detected";
      case "IMPERSONATION_MIMICRY_WARNING":
        return "Mimicry Warning";
      case "SUSPICIOUS_VERIFY":
        return "Suspicious Signal";
      case "VERIFIED_SAFE":
        return "Verified Safe";
      case "STANDBY":
      default:
        return "Standby";
    }
  };

  return (
    <div className="space-y-8 select-none">
      {/* Upload & Inspection Command Box */}
      <div className="rounded-3xl bg-studio-card/80 border border-studio-border p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-studio-border">
          <div>
            <div className="font-sans text-xs font-semibold text-studio-muted uppercase tracking-wider mb-2 flex items-center gap-2">
              <FileAudio className="w-3.5 h-3.5 text-studio-muted" />
              <span>Audio Lab</span>
            </div>
            <h2 className="font-display font-bold text-3xl text-studio-text tracking-normal">
              Audio Lab Analysis
            </h2>
            <p className="font-sans text-sm text-studio-muted mt-2 font-normal max-w-xl leading-relaxed">
              Universal decoding for WhatsApp voice notes (.ogg), voice memos (.m4a), MP3, and WAV recordings.
            </p>
          </div>

          {/* Controls: Target Contact & Call Quality Test */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-sans font-medium text-studio-muted block">
                Target Contact
              </label>
              <select
                value={selectedContactId}
                onChange={(e) => setSelectedContactId(e.target.value)}
                className="bg-studio-elevated border border-studio-border rounded-xl px-3 py-2 text-xs font-sans text-studio-text focus:outline-none cursor-pointer"
              >
                <option value="">No Claimed Speaker</option>
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
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-sans transition-colors cursor-pointer ${
                  simulateTelephony
                    ? "bg-threat-amber/15 border-threat-amber/40 text-threat-amber font-semibold"
                    : "bg-studio-elevated border-studio-border text-studio-muted hover:text-studio-text"
                }`}
              >
                <span>Simulate Phone Call (8kHz):</span>
                <span>{simulateTelephony ? "Active" : "Off"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Drag & Drop File Zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files?.[0]) handleFileChange(e.dataTransfer.files[0]);
          }}
          className="mt-6 border border-dashed border-studio-border hover:border-studio-text/40 rounded-2xl p-10 sm:p-14 text-center bg-studio-bg hover:bg-studio-elevated/40 transition-colors cursor-pointer flex flex-col items-center justify-center group"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.ogg,.mp3,.wav,.m4a,.webm"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleFileChange(e.target.files[0]);
            }}
          />

          <div className="w-14 h-14 rounded-2xl bg-studio-card border border-studio-border flex items-center justify-center text-studio-text mb-4 group-hover:scale-105 transition-transform">
            <Upload className="w-6 h-6" />
          </div>

          <div className="font-display font-semibold text-base sm:text-lg text-studio-text">
            {file ? file.name : "Drop audio recording here, or click to browse"}
          </div>
          <div className="font-sans text-xs text-studio-dim mt-1.5 font-normal">
            {file
              ? `${(file.size / 1024).toFixed(1)} KB ready for inspection`
              : "Supports WhatsApp audio, voice memos, MP3, and WAV"}
          </div>
        </div>

        {/* Audio Player and Trigger */}
        {file && (
          <div className="mt-6 p-4 rounded-xl bg-studio-elevated border border-studio-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlayback}
                className="w-10 h-10 rounded-xl bg-studio-text text-studio-bg flex items-center justify-center text-xs font-sans hover:bg-white cursor-pointer"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>
              <div>
                <span className="font-sans font-bold text-xs text-studio-text block truncate max-w-xs">
                  {file.name}
                </span>
                <span className="font-sans text-xs text-studio-dim font-normal">
                  {isPlaying ? "Playing audio..." : "Click to preview"}
                </span>
              </div>
              {audioUrl && (
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  onEnded={() => setIsPlaying(false)}
                  className="hidden"
                />
              )}
            </div>

            <MagneticButton
              variant="primary"
              onClick={executeAudit}
              disabled={isAnalyzing}
              className="w-full sm:w-auto text-sm"
            >
              {isAnalyzing ? "Executing Forensic Audit..." : "Execute Forensic Audit"}
            </MagneticButton>
          </div>
        )}
      </div>

      {/* Audit Results Presentation */}
      {result && (
        <div className="space-y-6">
          {/* Top Verdict Card */}
          <TiltPanel>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-studio-border">
              <div>
                <span className="text-xs font-sans text-studio-dim font-medium uppercase tracking-wider">
                  Audit Result
                </span>
                <h3 className="font-display font-bold text-2xl text-studio-text mt-1 tracking-normal">
                  Verdict:{" "}
                  <span
                    className={
                      result.threat_state === "CRITICAL_AI_CLONE"
                        ? "text-threat-crimson"
                        : result.threat_state === "IMPERSONATION_MIMICRY_WARNING"
                        ? "text-threat-amber"
                        : "text-threat-emerald"
                    }
                  >
                    {getVerdictLabel(result.threat_state)}
                  </span>
                </h3>
              </div>
              <div className="font-sans text-xs text-studio-muted">
                Latency: {result.latency_ms} ms
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4">
              <div>
                <div className="text-xs font-sans text-studio-muted font-medium mb-2">Overall Risk</div>
                <div className="flex items-baseline flex-nowrap whitespace-nowrap">
                  <Odometer
                    value={result.risk_score}
                    decimals={1}
                    suffix="%"
                    size="lg"
                    className={
                      result.threat_state === "CRITICAL_AI_CLONE"
                        ? "text-threat-crimson"
                        : "text-threat-emerald"
                    }
                  />
                </div>
              </div>

              <div>
                <div className="text-xs font-sans text-studio-muted font-medium mb-2">Peak AI Score</div>
                <div className="flex items-baseline flex-nowrap whitespace-nowrap">
                  <Odometer
                    value={result.ai_clone_detection.peak_score}
                    decimals={1}
                    suffix="%"
                    size="lg"
                    className="text-studio-text"
                  />
                </div>
              </div>

              <div>
                <div className="text-xs font-sans text-studio-muted font-medium mb-2">Voiceprint Match</div>
                <div className="font-sans text-2xl font-bold text-studio-text tabular-nums">
                  {result.voiceprint_verification.similarity_pct !== null
                    ? `${result.voiceprint_verification.similarity_pct.toFixed(1)}%`
                    : "Not Claimed"}
                </div>
              </div>
            </div>
          </TiltPanel>

          {/* Mel Spectrogram Visualizer */}
          {result.spectrogram_image && (
            <TiltPanel>
              <div className="flex items-center justify-between pb-3 border-b border-studio-border mb-4">
                <span className="font-sans text-xs font-semibold text-studio-text uppercase tracking-wider">
                  Mel-Spectrogram Analysis
                </span>
                <span className="font-sans text-xs text-studio-dim">
                  Frequency range: 0Hz – 8,000Hz
                </span>
              </div>

              <div className="rounded-xl overflow-hidden bg-[#07080A] border border-studio-border flex items-center justify-center p-2">
                <img
                  src={result.spectrogram_image}
                  alt="Forensic Mel Spectrogram"
                  className="w-full h-auto max-h-[280px] object-contain rounded"
                />
              </div>

              {/* Acoustic Telemetry Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-studio-border/50 text-xs font-sans">
                <div>
                  <span className="text-studio-dim block">Signal-to-Noise:</span>
                  <span className="text-studio-text font-bold tabular-nums">
                    {result.acoustic_telemetry.snr_db} dB
                  </span>
                </div>
                <div>
                  <span className="text-studio-dim block">Spectral Flatness:</span>
                  <span className="text-studio-text font-bold tabular-nums">
                    {result.acoustic_telemetry.spectral_flatness}
                  </span>
                </div>
                <div>
                  <span className="text-studio-dim block">Pitch Variance:</span>
                  <span className="text-studio-text font-bold tabular-nums">
                    {result.acoustic_telemetry.pitch_variance}
                  </span>
                </div>
                <div>
                  <span className="text-studio-dim block">Duration:</span>
                  <span className="text-studio-text font-bold tabular-nums">
                    {result.acoustic_telemetry.duration_sec}s
                  </span>
                </div>
              </div>
            </TiltPanel>
          )}

          {/* Transcript & Active Challenges */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TiltPanel>
              <div className="text-xs font-sans font-semibold text-studio-text uppercase tracking-wider mb-2">
                Audio Transcription
              </div>
              <p className="font-sans text-sm text-studio-text leading-relaxed font-normal bg-studio-bg p-4 rounded-xl border border-studio-border min-h-[80px]">
                {result.scam_intent.transcript || "No speech detected in audio slice."}
              </p>
              {result.scam_intent.matched_keywords.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {result.scam_intent.matched_keywords.map((kw) => (
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

            <TiltPanel>
              <div className="text-xs font-sans font-semibold text-studio-text uppercase tracking-wider mb-2">
                Active Protection Challenges
              </div>
              {result.active_prevention.liveness_challenges.length > 0 ? (
                <div className="space-y-2">
                  {result.active_prevention.liveness_challenges.map((c, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-threat-crimson/10 border border-threat-crimson/30 text-xs font-sans text-studio-text flex items-start gap-2"
                    >
                      <span className="font-sans text-threat-crimson font-bold">0{i + 1}.</span>
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-studio-bg border border-studio-border text-xs font-sans text-studio-dim">
                  Signal verified safe. No active verification required.
                </div>
              )}

              {result.active_prevention.forensic_hash && (
                <div className="mt-3 flex items-center gap-1.5 text-xs font-sans text-studio-dim truncate">
                  <Hash className="w-3.5 h-3.5 text-studio-muted shrink-0" />
                  <span className="truncate">Forensic Hash: {result.active_prevention.forensic_hash}</span>
                </div>
              )}
            </TiltPanel>
          </div>
        </div>
      )}
    </div>
  );
};
