"use client";

import React, { useState, useEffect } from "react";
import { getApiBaseUrl, setApiBaseUrl } from "@/lib/apiConfig";
import { checkHealth } from "@/lib/api";
import { Globe, Check, RotateCcw, X, ExternalLink, Activity } from "lucide-react";
import { MagneticButton } from "./MagneticButton";

interface ServerConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReconnected?: () => void;
}

export const ServerConnectionModal: React.FC<ServerConnectionModalProps> = ({
  isOpen,
  onClose,
  onReconnected,
}) => {
  const [urlInput, setUrlInput] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setUrlInput(getApiBaseUrl());
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveAndReconnect = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setTestResult({ ok: false, message: "Please provide a valid backend URL." });
      return;
    }

    setTesting(true);
    setTestResult(null);

    // Save active URL
    setApiBaseUrl(trimmed);

    // Immediate health probe
    try {
      const res = await checkHealth();
      setTestResult({
        ok: true,
        message: `Successfully connected to backend (${res.service || "VoxShield AI Engine"}).`,
      });
      if (onReconnected) onReconnected();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestResult({
        ok: false,
        message: `Connection failed: ${msg}. Check URL and CORS/Tunnel status.`,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleResetDefault = async () => {
    setTesting(true);
    setTestResult(null);
    setApiBaseUrl(null);
    const def = getApiBaseUrl();
    setUrlInput(def);

    try {
      const res = await checkHealth();
      setTestResult({
        ok: true,
        message: `Reset to default (${def}). Connection healthy.`,
      });
      if (onReconnected) onReconnected();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestResult({
        ok: false,
        message: `Reset to default (${def}), but server returned: ${msg}`,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div
        className="w-full max-w-lg bg-studio-card border border-studio-border rounded-2xl shadow-2xl overflow-hidden p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-studio-border/70 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-studio-elevated border border-studio-border flex items-center justify-center text-studio-text">
              <Globe className="w-4 h-4 text-threat-emerald" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-studio-text tracking-normal">
                Server Connection
              </h3>
              <p className="font-sans text-xs text-studio-muted">
                Cloudflare Tunnel & Backend Endpoint Router
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-studio-muted hover:text-studio-text hover:bg-studio-elevated transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Instructions */}
        <p className="font-sans text-xs text-studio-muted leading-relaxed mb-4">
          Connect your frontend to local development or a remote Cloudflare Tunnel without redeploying.
          The WebSocket link (<code className="text-studio-text font-mono">/ws/live-analyze</code>) adapts automatically.
        </p>

        {/* Input */}
        <div className="space-y-2 mb-4">
          <label className="text-xs font-sans font-medium text-studio-muted flex items-center justify-between">
            <span>Backend HTTP URL</span>
            <span className="text-[11px] text-studio-dim">e.g. https://xxxx.trycloudflare.com</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="http://localhost:8000 or https://xxx.trycloudflare.com"
              className="w-full bg-studio-elevated border border-studio-border rounded-xl px-3.5 py-2.5 text-xs font-mono text-studio-text focus:outline-none focus:border-white/20 transition-colors"
            />
          </div>
        </div>

        {/* Feedback / Status */}
        {testResult && (
          <div
            className={`p-3 rounded-xl border text-xs font-sans mb-4 flex items-start gap-2.5 ${
              testResult.ok
                ? "bg-threat-emerald/15 border-threat-emerald/30 text-threat-emerald"
                : "bg-threat-crimson/15 border-threat-crimson/30 text-threat-crimson"
            }`}
          >
            {testResult.ok ? (
              <Check className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <Activity className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <span className="leading-relaxed flex-1">{testResult.message}</span>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-studio-border/60">
          <button
            type="button"
            onClick={handleResetDefault}
            disabled={testing}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-sans text-studio-muted hover:text-studio-text hover:bg-studio-elevated transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Default</span>
          </button>

          <div className="w-full sm:w-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-sans text-studio-muted hover:text-studio-text hover:bg-studio-elevated transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <MagneticButton
              variant="primary"
              onClick={handleSaveAndReconnect}
              disabled={testing}
              className="flex-1 sm:flex-none text-xs px-4 py-2"
            >
              {testing ? "Testing..." : "Save & Reconnect"}
            </MagneticButton>
          </div>
        </div>
      </div>
    </div>
  );
};
