"use client";

import React, { useState } from "react";
import { apiLogin, apiRegister } from "@/lib/api";
import { User } from "@/types";
import { TiltPanel } from "./TiltPanel";
import { MagneticButton } from "./MagneticButton";
import { ShieldCheck, Lock, Mail, User as UserIcon, ArrowRight, ShieldAlert, Sparkles } from "lucide-react";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

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
      if (isRegister) {
        const res = await apiRegister(name, email, password);
        onAuthSuccess(res.user);
      } else {
        const res = await apiLogin(email, password);
        onAuthSuccess(res.user);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
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
                  Private per-user account storage keeps your family voiceprints completely segregated.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: High-Craft Auth Card */}
        <div className="lg:col-span-6">
          <TiltPanel className="p-7 sm:p-9 border border-studio-border bg-studio-card/95 shadow-2xl backdrop-blur-xl">
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
                      placeholder="e.g. Santhosh"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-studio-elevated border border-studio-border rounded-xl pl-10 pr-4 py-2.5 text-xs font-sans text-studio-text focus:outline-none focus:border-white/30 transition-colors"
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
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-studio-elevated border border-studio-border rounded-xl pl-10 pr-4 py-2.5 text-xs font-sans text-studio-text focus:outline-none focus:border-white/30 transition-colors"
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
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-studio-elevated border border-studio-border rounded-xl pl-10 pr-4 py-2.5 text-xs font-sans text-studio-text focus:outline-none focus:border-white/30 transition-colors"
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-threat-crimson/15 border border-threat-crimson/30 text-threat-crimson text-xs font-sans">
                  {errorMsg}
                </div>
              )}

              <div className="pt-2">
                <MagneticButton
                  variant="primary"
                  disabled={isLoading}
                  className="w-full text-sm py-3 justify-center"
                >
                  <span className="flex items-center justify-center gap-2">
                    <span>{isLoading ? "Authenticating..." : isRegister ? "Create Account" : "Access Console"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </MagneticButton>
              </div>
            </form>
          </TiltPanel>
        </div>
      </div>
    </div>
  );
};
