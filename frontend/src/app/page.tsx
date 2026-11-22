"use client";

import React, { useState, useEffect, useCallback } from "react";
import { fetchContacts, apiGetMe, apiLogout, getAuthToken, setAuthToken } from "@/lib/api";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { setAccessToken } from "@/lib/apiConfig";
import { Contact, ThreatState, AnalysisResult, User } from "@/types";
import { CurtainPreloader } from "@/components/CurtainPreloader";
import { StudioHeader, StudioTab } from "@/components/StudioHeader";
import { KineticHero } from "@/components/KineticHero";
import { KineticMarquee } from "@/components/KineticMarquee";
import { LiveShieldTab } from "@/components/tabs/LiveShieldTab";
import { ForensicLabTab } from "@/components/tabs/ForensicLabTab";
import { VoiceVaultTab } from "@/components/tabs/VoiceVaultTab";
import { ThreatOverlay } from "@/components/ThreatOverlay";
import { AuthView } from "@/components/AuthView";

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<StudioTab>("LIVE_CALL_SHIELD");

  const [threatState, setThreatState] = useState<ThreatState>("STANDBY");
  const [riskScore, setRiskScore] = useState<number>(0);
  const [aiScore, setAiScore] = useState<number | null>(null);
  const [voiceprintMatch, setVoiceprintMatch] = useState<number | null>(null);
  const [matchedKeywords, setMatchedKeywords] = useState<string[]>([]);
  const [challenges, setChallenges] = useState<string[]>([]);
  const [forensicHash, setForensicHash] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [claimedContactName, setClaimedContactName] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isOverlayDismissed, setIsOverlayDismissed] = useState(false);

  const handleLocalStateReset = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    setContacts([]);
    setThreatState("STANDBY");
    setRiskScore(0);
    setAiScore(null);
    setVoiceprintMatch(null);
    setMatchedKeywords([]);
    setChallenges([]);
    setForensicHash(null);
    setTranscript("");
    setClaimedContactName(null);
  }, []);

  const loadContacts = useCallback(async () => {
    try {
      const data = await fetchContacts();
      setContacts(data);
    } catch {
      setContacts([]);
    }
  }, []);

  // Initialize Auth (Supabase session or local fallback)
  useEffect(() => {
    let isMounted = true;

    if (isSupabaseConfigured && supabase) {
      // 1. Initial session retrieval
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!isMounted) return;
        if (session?.user) {
          setAccessToken(session.access_token);
          const currentUser: User = {
            id: session.user.id,
            name:
              session.user.user_metadata?.full_name ||
              session.user.email?.split("@")[0] ||
              "User",
            email: session.user.email || "",
          };
          setUser(currentUser);
          loadContacts();
        } else {
          setUser(null);
          setAccessToken(null);
        }
        setAuthLoading(false);
      });

      // 2. Continuous live session subscription
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (!isMounted) return;
        if (
          (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") &&
          session?.user
        ) {
          setAccessToken(session.access_token);
          const currentUser: User = {
            id: session.user.id,
            name:
              session.user.user_metadata?.full_name ||
              session.user.email?.split("@")[0] ||
              "User",
            email: session.user.email || "",
          };
          setUser(currentUser);
          loadContacts();
        } else if (event === "SIGNED_OUT") {
          handleLocalStateReset();
        }
      });

      return () => {
        isMounted = false;
        subscription.unsubscribe();
      };
    } else {
      // Local self-hosted backend auth fallback
      const token = getAuthToken();
      if (!token) {
        if (isMounted) setAuthLoading(false);
        return;
      }
      apiGetMe()
        .then((currentUser) => {
          if (isMounted) {
            setUser(currentUser);
            loadContacts();
          }
        })
        .catch(() => {
          setAuthToken(null);
          if (isMounted) setUser(null);
        })
        .finally(() => {
          if (isMounted) setAuthLoading(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [loadContacts, handleLocalStateReset]);

  const handleAuthSuccess = async (authenticatedUser: User) => {
    setUser(authenticatedUser);
    setActiveTab("LIVE_CALL_SHIELD");
    await loadContacts();
  };

  const handleSignOut = async () => {
    try {
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.signOut();
      } else {
        await apiLogout();
      }
    } catch {}
    handleLocalStateReset();
  };

  const handleLiveStateUpdate = (
    state: ThreatState,
    score: number,
    ai: number | null,
    vp: number | null,
    keywords: string[],
    chall: string[],
    hash: string | null,
    lat: number,
    claimed: string | null,
    liveTranscript?: string
  ) => {
    setThreatState(state);
    setRiskScore(score);
    setAiScore(ai);
    setVoiceprintMatch(vp);
    setMatchedKeywords(keywords);
    setChallenges(chall);
    setForensicHash(hash);
    setLatencyMs(lat);
    setClaimedContactName(claimed);

    if (liveTranscript !== undefined && liveTranscript !== "") {
      setTranscript(liveTranscript);
    }

    if (state === "CRITICAL_AI_CLONE" || state === "IMPERSONATION_MIMICRY_WARNING") {
      setIsOverlayDismissed(false);
    }
  };

  const handleAnalysisComplete = (res: AnalysisResult) => {
    setThreatState(res.threat_state);
    setRiskScore(res.risk_score);
    setAiScore(res.ai_clone_detection.peak_score);
    setVoiceprintMatch(res.voiceprint_verification.similarity_pct);
    setMatchedKeywords(res.scam_intent.matched_keywords);
    setChallenges(res.active_prevention.liveness_challenges);
    setForensicHash(res.active_prevention.forensic_hash);
    setTranscript(res.scam_intent.transcript);
    setLatencyMs(res.latency_ms);
    setClaimedContactName(res.voiceprint_verification.claimed_contact_name);

    if (
      res.threat_state === "CRITICAL_AI_CLONE" ||
      res.threat_state === "IMPERSONATION_MIMICRY_WARNING"
    ) {
      setIsOverlayDismissed(false);
    }
  };

  // Ambient atmosphere tint based on threat state
  const getAtmosphereGlow = () => {
    switch (threatState) {
      case "CRITICAL_AI_CLONE":
        return "shadow-[inset_0_0_120px_rgba(255,46,67,0.18)]";
      case "IMPERSONATION_MIMICRY_WARNING":
        return "shadow-[inset_0_0_90px_rgba(245,158,11,0.14)]";
      case "VERIFIED_SAFE":
        return "shadow-[inset_0_0_80px_rgba(16,185,129,0.1)]";
      default:
        return "shadow-none";
    }
  };

  return (
    <div
      className={`min-h-screen bg-studio-bg text-studio-text relative transition-shadow duration-1000 ${getAtmosphereGlow()}`}
    >
      {/* Signature Weighted Theatre Curtain Preloader */}
      <CurtainPreloader />

      {/* Sticky Studio Navigation Header */}
      <StudioHeader
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        threatState={threatState}
        user={user}
        onSignOut={handleSignOut}
        onServerReconnected={loadContacts}
      />

      {/* Kinetic Hero Section */}
      <KineticHero />

      {/* Opposing Dual-Track Infinite Marquee */}
      <KineticMarquee threatState={threatState} />

      {/* Main Workspace Stage */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-10 relative z-10">
        {authLoading ? (
          <div className="min-h-[400px] flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-studio-border border-t-studio-text animate-spin" />
          </div>
        ) : !user ? (
          <AuthView onAuthSuccess={handleAuthSuccess} />
        ) : (
          <>
            {activeTab === "LIVE_CALL_SHIELD" && (
              <LiveShieldTab
                contacts={contacts}
                threatState={threatState}
                riskScore={riskScore}
                aiScore={aiScore}
                voiceprintMatch={voiceprintMatch}
                matchedKeywords={matchedKeywords}
                transcript={transcript}
                challenges={challenges}
                forensicHash={forensicHash}
                latencyMs={latencyMs}
                onUpdateState={handleLiveStateUpdate}
              />
            )}

            {activeTab === "AUDIO_LAB" && (
              <ForensicLabTab
                contacts={contacts}
                threatState={threatState}
                onAnalysisComplete={handleAnalysisComplete}
              />
            )}

            {activeTab === "VOICE_VAULT" && (
              <VoiceVaultTab
                contacts={contacts}
                threatState={threatState}
                onRefreshContacts={loadContacts}
              />
            )}
          </>
        )}
      </main>

      {/* Floating Active Threat Overlay */}
      {!isOverlayDismissed && user && (
        <ThreatOverlay
          threatState={threatState}
          riskScore={riskScore}
          challenges={challenges}
          forensicHash={forensicHash}
          claimedContactName={claimedContactName}
          onDismiss={() => setIsOverlayDismissed(true)}
        />
      )}

      {/* Studio Minimal Footer */}
      <footer className="border-t border-studio-border/60 py-8 px-4 sm:px-8 mt-20 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 font-sans text-xs text-studio-muted">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-sm text-studio-text tracking-normal">
              VoxShield
            </span>
            <span className="text-studio-dim">•</span>
            <span>Real-Time Acoustic Forensics & Voice Defense</span>
          </div>
          <div className="text-studio-dim">Continuous multi-layer neural audio verification</div>
        </div>
      </footer>
    </div>
  );
}
