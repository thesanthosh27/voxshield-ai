"use client";

import React, { useEffect, useState } from "react";
import { checkHealth } from "@/lib/api";
import { ThreatState, User } from "@/types";
import { MagneticButton } from "./MagneticButton";
import { LogOut } from "lucide-react";

export type StudioTab = "LIVE_CALL_SHIELD" | "AUDIO_LAB" | "VOICE_VAULT";

interface StudioHeaderProps {
  activeTab: StudioTab;
  onSelectTab: (tab: StudioTab) => void;
  threatState: ThreatState;
  user: User | null;
  onSignOut: () => void;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
  activeTab,
  onSelectTab,
  threatState,
  user,
  onSignOut,
}) => {
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean | null>(null);

  // Poll health endpoint silently in the background ONLY for connectivity status
  useEffect(() => {
    let isMounted = true;
    const poll = async () => {
      try {
        const res = await checkHealth();
        if (isMounted) setIsBackendHealthy(res.status === "ok");
      } catch {
        if (isMounted) setIsBackendHealthy(false);
      }
    };

    poll();
    const interval = setInterval(poll, 6000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const getThreatBadge = () => {
    switch (threatState) {
      case "CRITICAL_AI_CLONE":
        return { label: "AI Clone Detected", color: "bg-threat-crimson text-white animate-pulse" };
      case "IMPERSONATION_MIMICRY_WARNING":
        return { label: "Mimicry Warning", color: "bg-threat-amber text-black" };
      case "SUSPICIOUS_VERIFY":
        return { label: "Suspicious Signal", color: "bg-threat-amber/80 text-black" };
      case "VERIFIED_SAFE":
        return { label: "Verified Safe", color: "bg-threat-emerald text-black" };
      case "STANDBY":
      default:
        return { label: "Standby", color: "bg-white/10 text-studio-muted" };
    }
  };

  const badge = getThreatBadge();

  // Compute user initials for avatar
  const getInitials = (name?: string) => {
    if (!name) return "VS";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-studio-bg/85 border-b border-studio-border select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 h-20 flex items-center justify-between gap-4">
        {/* Left: Brand Identity & Silent Health Dot */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-studio-text text-studio-bg flex items-center justify-center font-display font-black text-lg">
              V
            </div>
            <span className="font-display font-bold text-xl sm:text-2xl text-studio-text tracking-normal">
              VoxShield
            </span>
          </div>

          {/* Minimal Status Dot */}
          <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-studio-card border border-studio-border text-xs font-sans text-studio-muted">
            <span
              className={`w-2 h-2 rounded-full ${
                isBackendHealthy ? "bg-threat-emerald animate-pulse" : "bg-threat-crimson"
              }`}
            />
            <span className="font-medium">{isBackendHealthy ? "Shield Live" : "Connecting..."}</span>
          </div>
        </div>

        {/* Center: Strict 3-Tab Workspace Navigation */}
        {user && (
          <nav className="flex items-center gap-1 sm:gap-2">
            <MagneticButton
              variant="tab"
              active={activeTab === "LIVE_CALL_SHIELD"}
              onClick={() => onSelectTab("LIVE_CALL_SHIELD")}
            >
              Live Call Shield
            </MagneticButton>

            <MagneticButton
              variant="tab"
              active={activeTab === "AUDIO_LAB"}
              onClick={() => onSelectTab("AUDIO_LAB")}
            >
              Audio Lab
            </MagneticButton>

            <MagneticButton
              variant="tab"
              active={activeTab === "VOICE_VAULT"}
              onClick={() => onSelectTab("VOICE_VAULT")}
            >
              Voice Vault
            </MagneticButton>
          </nav>
        )}

        {/* Right: Threat State & User Profile Pill */}
        <div className="flex items-center gap-3">
          <div
            className={`px-3 py-1 rounded-lg font-sans text-xs font-semibold transition-colors duration-500 ${badge.color}`}
          >
            {badge.label}
          </div>

          {user && (
            <div className="hidden md:flex items-center gap-2 pl-3 border-l border-studio-border/60">
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-studio-card border border-studio-border">
                <div className="w-6 h-6 rounded-full bg-studio-elevated text-studio-text flex items-center justify-center text-[10px] font-bold">
                  {getInitials(user.name)}
                </div>
                <span className="font-sans text-xs font-medium text-studio-text max-w-[120px] truncate">
                  {user.name}
                </span>
              </div>

              <button
                type="button"
                onClick={onSignOut}
                title="Sign Out"
                className="p-1.5 rounded-lg text-studio-muted hover:text-studio-text hover:bg-studio-card/80 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
