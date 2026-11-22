"use client";

import React, { useState, useRef } from "react";
import { enrollContact, deleteContact } from "@/lib/api";
import { Contact, ThreatState } from "@/types";
import { TiltPanel } from "@/components/TiltPanel";
import { MagneticButton } from "@/components/MagneticButton";
import { Users, Fingerprint, Trash2, Plus, CheckCircle2 } from "lucide-react";

interface VoiceVaultTabProps {
  contacts: Contact[];
  onRefreshContacts: () => void;
  threatState: ThreatState;
}

export const VoiceVaultTab: React.FC<VoiceVaultTabProps> = ({
  contacts,
  onRefreshContacts,
}) => {
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !relation.trim() || !file) {
      setErrorMsg("Please fill in contact name, relationship, and choose a reference audio file.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await enrollContact(name, relation, file);
      setName("");
      setRelation("");
      setFile(null);
      setSuccessMsg(`Successfully registered voiceprint for ${name}.`);
      onRefreshContacts();
    } catch (err: unknown) {
      setErrorMsg(`Enrollment failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (contactId: string) => {
    if (!confirm("Are you sure you want to remove this biometric voiceprint from the vault?")) return;
    try {
      await deleteContact(contactId);
      onRefreshContacts();
    } catch (err: unknown) {
      alert(`Deletion failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="space-y-8 select-none">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Enrollment Form */}
        <div className="lg:col-span-5">
          <TiltPanel className="p-6 sm:p-8">
            <div className="flex items-center gap-2 font-sans text-xs font-semibold text-studio-muted uppercase tracking-wider mb-2">
              <Plus className="w-3.5 h-3.5 text-studio-muted" />
              <span>Trusted Voices</span>
            </div>
            <h2 className="font-display font-bold text-2xl text-studio-text tracking-normal mb-2">
              Register Trusted Voice
            </h2>
            <p className="font-sans text-xs text-studio-muted font-normal leading-relaxed mb-6">
              Extracts a biometric vocal embedding to defend against human impersonators and AI clones.
            </p>

            <form onSubmit={handleEnroll} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-sans font-medium text-studio-muted block">
                  Contact Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Maya Chen"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-studio-elevated border border-studio-border rounded-xl px-4 py-2.5 text-xs font-sans text-studio-text focus:outline-none focus:border-white/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-sans font-medium text-studio-muted block">
                  Relationship or Role
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chief Financial Officer, Sister"
                  value={relation}
                  onChange={(e) => setRelation(e.target.value)}
                  className="w-full bg-studio-elevated border border-studio-border rounded-xl px-4 py-2.5 text-xs font-sans text-studio-text focus:outline-none focus:border-white/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-sans font-medium text-studio-muted block">
                  Reference Audio Sample
                </label>
                <p className="text-[11px] font-sans text-studio-dim mb-1">
                  Upload a 10–20 second clear voice note of your family member (e.g. from WhatsApp, Voice Memos, or recordings).
                </p>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-4 border border-dashed border-studio-border hover:border-white/20 rounded-xl bg-studio-bg text-center cursor-pointer transition-colors"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*,.wav,.mp3,.ogg,.m4a"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setFile(e.target.files[0]);
                    }}
                  />
                  <div className="font-sans text-xs text-studio-text font-medium">
                    {file ? file.name : "Select voice note (WhatsApp .ogg, .m4a, .mp3, .wav)"}
                  </div>
                  <div className="font-sans text-xs text-studio-dim mt-0.5 font-normal">
                    {file ? `${(file.size / 1024).toFixed(1)} KB` : "Click to browse audio files"}
                  </div>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-lg bg-threat-crimson/15 border border-threat-crimson/30 text-threat-crimson text-xs font-sans">
                  {errorMsg}
                </div>
              )}

              {successMsg && (
                <div className="p-3 rounded-lg bg-threat-emerald/15 border border-threat-emerald/30 text-threat-emerald text-xs font-sans">
                  {successMsg}
                </div>
              )}

              <MagneticButton
                variant="primary"
                disabled={isSubmitting}
                className="w-full mt-2 text-sm"
              >
                {isSubmitting ? "Registering Voiceprint..." : "Register Voiceprint"}
              </MagneticButton>
            </form>
          </TiltPanel>
        </div>

        {/* Right Column: Registered Contacts Vault */}
        <div className="lg:col-span-7">
          <TiltPanel className="p-6 sm:p-8">
            <div className="flex items-center justify-between pb-4 border-b border-studio-border mb-6">
              <div>
                <span className="text-xs font-sans text-studio-dim font-medium uppercase tracking-wider">
                  Biometric Vault
                </span>
                <h3 className="font-display font-bold text-2xl text-studio-text mt-0.5 tracking-normal">
                  Enrolled Contacts ({contacts.length})
                </h3>
              </div>
              <div className="font-sans text-xs text-studio-muted flex items-center gap-1.5">
                <Fingerprint className="w-4 h-4 text-studio-muted" />
                <span>Voice Verification</span>
              </div>
            </div>

            {contacts.length === 0 ? (
              <div className="py-16 text-center border border-dashed border-studio-border rounded-xl text-studio-dim font-sans text-xs">
                No voiceprints enrolled yet. Register trusted contacts on the left to activate impersonation protection.
              </div>
            ) : (
              <div className="space-y-3">
                {contacts.map((c) => (
                  <div
                    key={c.id}
                    className="p-4 rounded-xl bg-studio-elevated border border-studio-border flex items-center justify-between gap-4 group hover:border-white/20 transition-colors"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-studio-card border border-studio-border flex items-center justify-center text-studio-text font-display font-bold">
                        {c.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-sans font-bold text-sm text-studio-text">
                          {c.name}
                        </div>
                        <div className="font-sans text-xs text-studio-muted">
                          {c.relation}
                        </div>
                        <div className="font-sans text-xs text-studio-dim mt-0.5">
                          Enrolled {new Date(c.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded bg-threat-emerald/15 text-threat-emerald font-sans text-xs font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Biometrics Active
                      </span>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="w-8 h-8 rounded-lg bg-studio-card border border-studio-border text-studio-dim hover:text-threat-crimson hover:border-threat-crimson/40 flex items-center justify-center cursor-pointer transition-colors"
                        title="Delete contact"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TiltPanel>
        </div>
      </div>
    </div>
  );
};
