"use client";

import React from "react";
import { ThreatState } from "@/types";

interface KineticMarqueeProps {
  threatState: ThreatState;
}

export const KineticMarquee: React.FC<KineticMarqueeProps> = ({ threatState }) => {
  const isCloneAlert = threatState === "CRITICAL_AI_CLONE";
  const isMimicryAlert = threatState === "IMPERSONATION_MIMICRY_WARNING";

  const track1Text = isCloneAlert
    ? "Critical AI clone detected • High-confidence synthetic voice • Immediate caller verification required • "
    : isMimicryAlert
    ? "Voiceprint mismatch detected • Potential impersonation or mimicry • Unverified speaker on line • "
    : "Real-time voice clone defense • Neural acoustic forensics • Sub-300ms verification • Biometric speaker validation • ";

  const track2Text = isCloneAlert
    ? "Cryptographic forensic record generated • Liveness challenges active • Audio stream flagged • "
    : "Speaker identity verification • Anti-spoofing neural net • Speech intent scan • High-resolution spectral analysis • ";

  return (
    <div
      className={`w-full overflow-hidden border-y transition-colors duration-700 py-3 select-none ${
        isCloneAlert
          ? "bg-threat-crimson/10 border-threat-crimson/30 text-threat-crimson"
          : isMimicryAlert
          ? "bg-threat-amber/10 border-threat-amber/30 text-threat-amber"
          : "bg-studio-card/60 border-studio-border text-studio-muted"
      }`}
    >
      {/* Track 1: Gliding Left */}
      <div className="flex whitespace-nowrap overflow-hidden">
        <div
          className={`flex shrink-0 font-sans text-xs sm:text-sm font-medium tracking-normal ${
            isCloneAlert ? "animate-[marqueeLeft_10s_linear_infinite]" : "animate-marquee-left"
          }`}
        >
          <span>{track1Text.repeat(4)}</span>
        </div>
        <div
          aria-hidden="true"
          className={`flex shrink-0 font-sans text-xs sm:text-sm font-medium tracking-normal ${
            isCloneAlert ? "animate-[marqueeLeft_10s_linear_infinite]" : "animate-marquee-left"
          }`}
        >
          <span>{track1Text.repeat(4)}</span>
        </div>
      </div>

      {/* Track 2: Opposing Glide Right */}
      <div className="flex whitespace-nowrap overflow-hidden mt-1 opacity-70">
        <div
          className={`flex shrink-0 font-sans text-xs sm:text-sm font-normal tracking-normal ${
            isCloneAlert ? "animate-[marqueeRight_10s_linear_infinite]" : "animate-marquee-right"
          }`}
        >
          <span>{track2Text.repeat(4)}</span>
        </div>
        <div
          aria-hidden="true"
          className={`flex shrink-0 font-sans text-xs sm:text-sm font-normal tracking-normal ${
            isCloneAlert ? "animate-[marqueeRight_10s_linear_infinite]" : "animate-marquee-right"
          }`}
        >
          <span>{track2Text.repeat(4)}</span>
        </div>
      </div>
    </div>
  );
};
