"use client";

import React, { useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { setAccessToken } from "@/lib/apiConfig";
import { apiLogin, apiRegister } from "@/lib/api";
import { User } from "@/types";
import { TiltPanel } from "./TiltPanel";
import { MagneticButton } from "./MagneticButton";
import {
  ShieldCheck,
  Lock,
  Mail,
  User as UserIcon,
  ShieldAlert,
  AlertCircle,
  KeyRound,
  CheckCircle2,
} from "lucide-react";

interface AuthViewProps {
  onAuthSuccess: (user: User) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (isRegister && !name.trim()) {
      setErrorMsg("Please enter your full name.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }

    setIsLoading(true);

    try {
      // 1. Primary Authentication Path: Supabase Auth
      if (isSupabaseConfigured && supabase) {
        if (isRegister) {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: name.trim(),
              },
            },
          });

          if (error) {
            throw error;
          }

          if (data.session) {
            setAccessToken(data.session.access_token);
            const userObj: User = {
              id: data.user?.id || `usr_${Date.now()}`,
              name: data.user?.user_metadata?.full_name || name.trim(),
              email: data.user?.email || email,
            };
            onAuthSuccess(userObj);
          } else if (data.user) {
            // Confirmation email sent
            setInfoMsg(
              "Account created! Please check your email to confirm your account, or sign in if confirmation is disabled."
            );
          }
        } else {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) {
            throw error;
          }

          if (data.session && data.user) {
            setAccessToken(data.session.access_token);
            const userObj: User = {
              id: data.user.id,
              name: data.user.user_metadata?.full_name || email.split("@")[0],
              email: data.user.email || email,
            };
            onAuthSuccess(userObj);
          }
        }
      } else {
        // 2. Offline / Self-Hosted Fallback when Supabase keys are not in environment
        if (isRegister) {
          const res = await apiRegister(name, email, password);
          onAuthSuccess(res.user);
        } else {
          const res = await apiLogin(email, password);
          onAuthSuccess(res.user);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 relative select-none">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Architectural Brand Presentation */}
        <div className="lg:col-span-6 space-y-6">
          <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-studio-card border border-studio-border text-xs font-sans text-studio-muted">
            <span className="w-2 h-2 rounded-full bg-threat-emerald animate-pulse" />
            <span className="font-medium text-studio-text">Acoustic Defense Console</span>
          </div>

          <h1 className="font-display font-bold text-4xl sm:text-5xl text-studio-text tracking-tight leading-[1.1]">
            Active Defense Against Voice Cloning Scams.
          </h1>

          <p className="font-sans text-sm sm:text-base text-studio-muted leading-relaxed">
            Real-time deepfake acoustic intercept and biometric speaker verification. Protect your family and organization from synthetic impersonation in live calls and voice notes.
          </p>

          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-lg bg-studio-elevated border border-studio-border flex items-center justify-center shrink-0 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-threat-emerald" />
              </div>
              <div>
                <span className="font-sans text-xs font-semibold text-studio-text block">
                  Sub-300ms Live Call Intercept
                </span>
                <span className="font-sans text-xs text-studio-dim">
                  Direct system audio capture for Windows Phone Link, WhatsApp Web, and browser VoIP calls.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-lg bg-studio-elevated border border-studio-border flex items-center justify-center shrink-0 mt-0.5">
                <ShieldAlert className="w-3.5 h-3.5 text-threat-amber" />
              </div>
              <div>
                <span className="font-sans text-xs font-semibold text-studio-text block">
                  Isolated Biometric Voice Vault
                </span>
                <span className="font-sans text-xs text-studio-dim">
                  Cloud-secured user accounts keep your family voiceprints completely segregated.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: High-Craft Auth Card */}
        <div className="lg:col-span-6">
          <TiltPanel className="p-7 sm:p-9 border border-studio-border bg-studio-card/95 shadow-2xl backdrop-blur-xl">
            {/* Supabase Notice if missing environment credentials */}
            {!isSupabaseConfigured && (
              <div className="mb-5 p-3 rounded-xl bg-studio-elevated border border-studio-border text-xs font-sans text-studio-muted flex items-start gap-2.5">
                <KeyRound className="w-4 h-4 text-threat-amber shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-semibold text-studio-text block">Local Mode Active</span>
                  <span className="text-[11px] text-studio-dim leading-relaxed block">
                    Supabase credentials not detected. Operating with local authentication. Add{" "}
                    <code className="text-studio-muted">NEXT_PUBLIC_SUPABASE_URL</code> to activate cloud auth.
                  </span>
                </div>
              </div>
            )}

            {/* Mode Toggle Header */}
            <div className="flex items-center justify-between pb-6 border-b border-studio-border/60 mb-6">
              <div>
                <h2 className="font-display font-bold text-2xl text-studio-text tracking-tight">
                  {isRegister ? "Create Account" : "Welcome Back"}
                </h2>
                <p className="font-sans text-xs text-studio-muted mt-1">
                  {isRegister
                    ? "Set up your secure biometric console"
                    : "Sign in to access your Voice Vault"}
                </p>
              </div>

              <div className="flex items-center p-1 bg-studio-elevated border border-studio-border rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(false);
                    setErrorMsg(null);
                    setInfoMsg(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-sans font-medium transition-all cursor-pointer ${
                    !isRegister
                      ? "bg-studio-card text-studio-text border border-studio-border/80 shadow-sm"
                      : "text-studio-muted hover:text-studio-text"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(true);
                    setErrorMsg(null);
                    setInfoMsg(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-sans font-medium transition-all cursor-pointer ${
                    isRegister
                      ? "bg-studio-card text-studio-text border border-studio-border/80 shadow-sm"
                      : "text-studio-muted hover:text-studio-text"
                  }`}
                >
                  Register
                </button>
              </div>
            </div>

            {/* Auth Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
                <div className="space-y-1.5">
                  <label className="text-xs font-sans font-medium text-studio-muted block">
                    Full Name
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-studio-dim absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="e.g. Alex Vance"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-studio-elevated border border-studio-border rounded-xl pl-10 pr-4 py-2.5 text-xs font-sans text-studio-text placeholder:text-studio-dim focus:outline-none focus:border-white/20 transition-colors"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-sans font-medium text-studio-muted block">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-studio-dim absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    placeholder="name@organization.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-studio-elevated border border-studio-border rounded-xl pl-10 pr-4 py-2.5 text-xs font-sans text-studio-text placeholder:text-studio-dim focus:outline-none focus:border-white/20 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-sans font-medium text-studio-muted block">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-studio-dim absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-studio-elevated border border-studio-border rounded-xl pl-10 pr-4 py-2.5 text-xs font-sans text-studio-text placeholder:text-studio-dim focus:outline-none focus:border-white/20 transition-colors"
                  />
                </div>
              </div>

              {/* Status & Error Messages */}
              {errorMsg && (
                <div className="p-3 rounded-xl bg-threat-crimson/15 border border-threat-crimson/30 text-threat-crimson text-xs font-sans flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {infoMsg && (
                <div className="p-3 rounded-xl bg-threat-emerald/15 border border-threat-emerald/30 text-threat-emerald text-xs font-sans flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{infoMsg}</span>
                </div>
              )}

              <MagneticButton
                variant="primary"
                disabled={isLoading}
                className="w-full mt-2 text-xs py-3"
              >
                {isLoading
                  ? isRegister
                    ? "Creating Account..."
                    : "Authenticating..."
                  : isRegister
                  ? "Create Account"
                  : "Sign In to VoxShield"}
              </MagneticButton>
            </form>
          </TiltPanel>
        </div>
      </div>
    </div>
  );
};
