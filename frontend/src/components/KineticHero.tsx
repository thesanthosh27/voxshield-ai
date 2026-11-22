"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";

const CYCLING_PHRASES = [
  { text: "AI Voice Clone.", color: "text-threat-crimson" },
  { text: "Mimicry Scam.", color: "text-threat-amber" },
  { text: "Deepfake Call.", color: "text-threat-crimson" },
  { text: "Spoofed Note.", color: "text-studio-text" },
];

export const KineticHero: React.FC = () => {
  const [index, setIndex] = useState(0);
  const { scrollY } = useScroll();
  const watermarkX = useTransform(scrollY, [0, 800], ["0%", "-30%"]);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % CYCLING_PHRASES.length);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative pt-10 pb-8 sm:pt-16 sm:pb-12 overflow-hidden select-none">
      {/* Background Parallax Typography Watermark */}
      <motion.div
        style={{ x: watermarkX }}
        className="absolute top-0 left-0 whitespace-nowrap text-[18vw] font-display font-bold text-white/[0.02] tracking-normal leading-none pointer-events-none select-none z-0"
      >
        ACOUSTIC FORENSICS VOXSHIELD
      </motion.div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6">
        {/* Minimal Human Studio Badge */}
        <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-studio-card border border-studio-border text-xs font-sans text-studio-muted mb-6">
          <span className="w-2 h-2 rounded-full bg-threat-emerald animate-pulse" />
          <span className="text-studio-text font-semibold">Real-Time Voice Protection</span>
          <span className="text-studio-dim">•</span>
          <span>Instant Audio Forensics</span>
        </div>

        {/* Masked Editorial Headline with Smooth Vertical Text Cycling */}
        <h1 className="font-display font-bold text-5xl sm:text-7xl lg:text-8xl text-studio-text tracking-normal leading-[1.08]">
          <span>Catch every </span>
          <span className="inline-block relative h-[1.18em] overflow-hidden align-top">
            <AnimatePresence mode="wait">
              <motion.span
                key={index}
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: "0%", opacity: 1 }}
                exit={{ y: "-100%", opacity: 0 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className={`inline-block ${CYCLING_PHRASES[index].color}`}
              >
                {CYCLING_PHRASES[index].text}
              </motion.span>
            </AnimatePresence>
          </span>
        </h1>

        {/* Human, sharp, non-AI copy */}
        <p className="font-sans text-base sm:text-xl text-studio-muted mt-5 max-w-2xl font-normal leading-relaxed">
          Real voice, or synthetic clone? Know in two seconds. Stream your live mic or drop any WhatsApp voice note, voice memo, or recording for instant forensic audit.
        </p>
      </div>
    </section>
  );
};
