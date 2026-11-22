"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ThreatState } from "@/types";
import { ShieldAlert, X, Hash } from "lucide-react";

interface ThreatOverlayProps {
  threatState: ThreatState;
  riskScore: number;
  challenges: string[];
  forensicHash: string | null;
  claimedContactName: string | null;
  onDismiss: () => void;
}

export const ThreatOverlay: React.FC<ThreatOverlayProps> = ({
  threatState,
  riskScore,
  challenges,
  forensicHash,
  claimedContactName,
  onDismiss,
}) => {
  const isAlarm = threatState === "CRITICAL_AI_CLONE";
  const isMimicry = threatState === "IMPERSONATION_MIMICRY_WARNING";

  if (!isAlarm && !isMimicry) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="fixed bottom-6 right-6 z-50 max-w-lg w-[calc(100vw-3rem)] rounded-2xl bg-[#0E1014]/95 backdrop-blur-2xl border border-threat-crimson/50 shadow-2xl shadow-red-950/40 p-6 select-none"
      >
        <div className="flex items-start justify-between gap-4 pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-threat-crimson/20 border border-threat-crimson/40 flex items-center justify-center text-threat-crimson animate-pulse">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="font-sans text-xs text-threat-crimson font-semibold">
                Threat Alert • Risk Score: {riskScore.toFixed(1)}%
              </div>
              <h4 className="font-display font-bold text-lg text-studio-text tracking-normal mt-0.5">
                {isAlarm ? "Critical Synthetic Clone Warning" : "Biometric Mimicry Detected"}
              </h4>
            </div>
          </div>

          <button
            onClick={onDismiss}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-studio-muted hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="font-sans text-xs text-studio-muted mt-3 font-normal leading-relaxed">
          {isAlarm
            ? "Incoming acoustic signal exhibits severe neural vocoder phase artifacts. Do not execute financial transactions or grant sensitive access."
            : `Voice biometrics do not match registered voiceprint for ${claimedContactName || "claimed speaker"}. Immediate verbal challenge required.`}
        </p>

        {challenges.length > 0 && (
          <div className="mt-4 space-y-2">
            <span className="font-sans text-xs text-studio-dim font-medium block">
              Recommended Verification Challenge:
            </span>
            {challenges.map((c, i) => (
              <div
                key={i}
                className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs font-sans text-studio-text flex items-start gap-2"
              >
                <span className="font-sans text-threat-crimson font-bold">0{i + 1}.</span>
                <span>{c}</span>
              </div>
            ))}
          </div>
        )}

        {forensicHash && (
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-1.5 text-xs font-sans text-studio-dim truncate">
            <Hash className="w-3.5 h-3.5 text-studio-muted shrink-0" />
            <span className="truncate">Forensic Hash: {forensicHash}</span>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
