"use client";

import React, { useEffect, useState } from "react";
import { fetchIncidents } from "@/lib/api";
import { Incident, ThreatState } from "@/types";
import { TiltPanel } from "@/components/TiltPanel";
import { MagneticButton } from "@/components/MagneticButton";
import { History, Hash, RefreshCw } from "lucide-react";

export const AuditLedgerTab: React.FC = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const data = await fetchIncidents();
      setIncidents(data);
    } catch {
      setIncidents([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const getThreatBadge = (state: ThreatState) => {
    switch (state) {
      case "CRITICAL_AI_CLONE":
        return { label: "AI Clone Detected", color: "bg-threat-crimson/20 text-threat-crimson border-threat-crimson/30" };
      case "IMPERSONATION_MIMICRY_WARNING":
        return { label: "Mimicry Warning", color: "bg-threat-amber/20 text-threat-amber border-threat-amber/30" };
      case "SUSPICIOUS_VERIFY":
        return { label: "Suspicious Signal", color: "bg-threat-amber/15 text-threat-amber border-threat-amber/20" };
      case "VERIFIED_SAFE":
        return { label: "Verified Safe", color: "bg-threat-emerald/20 text-threat-emerald border-threat-emerald/30" };
      case "STANDBY":
      default:
        return { label: "Standby", color: "bg-white/10 text-studio-text border-white/10" };
    }
  };

  return (
    <div className="space-y-6 select-none">
      <TiltPanel className="p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-studio-border">
          <div>
            <div className="flex items-center gap-2 font-sans text-xs font-semibold text-studio-muted uppercase tracking-wider mb-2">
              <History className="w-3.5 h-3.5 text-studio-muted" />
              <span>Incident History</span>
            </div>
            <h2 className="font-display font-bold text-3xl text-studio-text tracking-normal">
              Cryptographic Audit Log
            </h2>
            <p className="font-sans text-xs text-studio-muted font-normal mt-1 leading-relaxed">
              Immutable ledger of flagged synthetic voice clones, impersonation warnings, and active protection events.
            </p>
          </div>

          <MagneticButton
            variant="secondary"
            onClick={load}
            disabled={isLoading}
            className="text-xs"
          >
            <span className="flex items-center gap-2">
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh Log
            </span>
          </MagneticButton>
        </div>

        {/* Ledger List */}
        <div className="mt-6">
          {incidents.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-studio-border rounded-xl text-studio-dim font-sans text-xs">
              Zero threat incidents recorded. All analyzed signals verified safe.
            </div>
          ) : (
            <div className="space-y-4">
              {incidents.map((inc) => {
                const badge = getThreatBadge(inc.threat_state);

                return (
                  <div
                    key={inc.id}
                    className="p-5 rounded-2xl bg-studio-elevated border border-studio-border space-y-3 hover:border-white/20 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-studio-border/50 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`px-2.5 py-0.5 rounded font-sans text-xs font-semibold border ${badge.color}`}
                        >
                          {badge.label}
                        </span>
                        <span className="font-sans text-xs text-studio-text font-semibold tabular-nums">
                          Risk: {inc.risk_score.toFixed(1)}%
                        </span>
                        {inc.claimed_contact && (
                          <span className="font-sans text-xs text-studio-muted">
                            Claimed: {inc.claimed_contact}
                          </span>
                        )}
                      </div>

                      <div className="font-sans text-xs text-studio-dim">
                        {new Date(inc.timestamp).toLocaleString()}
                      </div>
                    </div>

                    {/* Transcript & Keywords */}
                    {inc.transcript && (
                      <div className="bg-studio-bg p-3.5 rounded-xl border border-studio-border text-xs font-sans text-studio-text leading-relaxed">
                        <span className="font-sans text-xs text-studio-dim block mb-1 font-medium">
                          Audio Transcript:
                        </span>
                        &ldquo;{inc.transcript}&rdquo;
                      </div>
                    )}

                    {/* Telemetry Summary & Forensic Hash */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs font-sans text-studio-dim">
                      <div className="flex items-center gap-4">
                        <span className="tabular-nums">AI Score: {inc.ai_score?.toFixed(1)}%</span>
                        {inc.voiceprint_match !== null && (
                          <span className="tabular-nums">Voiceprint Match: {inc.voiceprint_match?.toFixed(1)}%</span>
                        )}
                        {inc.matched_keywords && inc.matched_keywords.length > 0 && (
                          <span className="text-threat-amber font-medium">
                            Keywords: {inc.matched_keywords.join(", ")}
                          </span>
                        )}
                      </div>

                      {inc.forensic_hash && (
                        <div className="flex items-center gap-1.5 text-xs text-studio-dim">
                          <Hash className="w-3.5 h-3.5 text-studio-muted shrink-0" />
                          <span className="truncate max-w-[200px] sm:max-w-xs">
                            Forensic Hash: {inc.forensic_hash}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </TiltPanel>
    </div>
  );
};
