"use client";

import React from "react";
import { motion } from "framer-motion";
import { Radio, ShieldAlert, Fingerprint, MessageSquareText } from "lucide-react";
import { ThreatState } from "@/types";

interface SignalFlowProps {
  threatState: ThreatState;
  isStreaming: boolean;
  aiScore?: number | null;
  voiceprintMatch?: number | null;
  hasKeywords?: boolean;
}

export const SignalFlow: React.FC<SignalFlowProps> = ({
  threatState,
  isStreaming,
  aiScore = null,
  voiceprintMatch = null,
  hasKeywords = false,
}) => {
  const isAlarm = threatState === "CRITICAL_AI_CLONE";
  const isWarning = threatState === "IMPERSONATION_MIMICRY_WARNING";
  const isSafe = threatState === "VERIFIED_SAFE";

  const getThreatLabel = () => {
    switch (threatState) {
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

  const nodes = [
    {
      id: "input",
      label: "Acoustic Stream",
      sub: "16kHz Mono Audio",
      icon: Radio,
      active: isStreaming,
      status: isStreaming ? "Streaming" : "Standby",
      statusColor: "text-studio-text",
    },
    {
      id: "layer1",
      label: "Anti-Spoofing Layer",
      sub: "Deepfake Detection Model",
      icon: ShieldAlert,
      active: isStreaming && aiScore !== null,
      status: aiScore !== null ? `${aiScore.toFixed(1)}% Clone` : "Ready",
      statusColor: isAlarm ? "text-threat-crimson" : isSafe ? "text-threat-emerald" : "text-studio-muted",
    },
    {
      id: "layer2",
      label: "Voiceprint Verification",
      sub: "Speaker Biometrics",
      icon: Fingerprint,
      active: isStreaming && voiceprintMatch !== null,
      status: voiceprintMatch !== null ? `${voiceprintMatch.toFixed(1)}% Match` : "Vault Ready",
      statusColor: isWarning ? "text-threat-amber" : "text-studio-muted",
    },
    {
      id: "layer3",
      label: "Intent & Keyword Gate",
      sub: "Speech Recognition",
      icon: MessageSquareText,
      active: isStreaming,
      status: hasKeywords ? "Urgency Flagged" : "Listening",
      statusColor: hasKeywords ? "text-threat-amber" : "text-studio-muted",
    },
  ];

  return (
    <div className="w-full rounded-2xl bg-studio-card border border-studio-border p-6 select-none relative overflow-hidden">
      <div className="flex items-center justify-between mb-6 border-b border-studio-border/50 pb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-studio-text animate-pulse" />
          <span className="font-sans text-xs font-semibold text-studio-text uppercase tracking-wider">
            Detection Pipeline
          </span>
        </div>
        <div className="font-sans text-xs text-studio-muted flex items-center gap-2">
          <span>Status:</span>
          <span
            className={`font-semibold px-2 py-0.5 rounded text-xs ${
              isAlarm
                ? "bg-threat-crimson/15 text-threat-crimson"
                : isSafe
                ? "bg-threat-emerald/15 text-threat-emerald"
                : isWarning
                ? "bg-threat-amber/15 text-threat-amber"
                : "bg-white/5 text-studio-text"
            }`}
          >
            {getThreatLabel()}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
        {nodes.map((n, i) => {
          const Icon = n.icon;
          return (
            <div key={n.id} className="relative">
              <div
                className={`p-4 rounded-xl border transition-all duration-300 ${
                  n.active
                    ? "bg-studio-elevated/90 border-studio-border-bright"
                    : "bg-studio-card/60 border-studio-border"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-studio-text">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className={`font-sans text-xs font-semibold ${n.statusColor}`}>
                    {n.status}
                  </span>
                </div>
                <div className="font-display font-semibold text-sm text-studio-text">
                  {n.label}
                </div>
                <div className="font-sans text-xs text-studio-dim mt-0.5 font-normal">
                  {n.sub}
                </div>
              </div>

              {i < nodes.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-2 w-4 h-[2px] bg-white/10 -translate-y-1/2 overflow-hidden z-20">
                  <motion.div
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{
                      duration: isStreaming ? 0.75 : 2.0,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    className="w-2 h-full bg-studio-text shadow-sm shadow-white"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
