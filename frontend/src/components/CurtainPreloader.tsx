"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CurtainPreloaderProps {
  onComplete?: () => void;
}

export const CurtainPreloader: React.FC<CurtainPreloaderProps> = ({ onComplete }) => {
  const [count, setCount] = useState(0);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    // Fast numeric counter from 0 to 100 in ~900ms
    const interval = setInterval(() => {
      setCount((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsDone(true);
            onComplete?.();
          }, 200);
          return 100;
        }
        const step = Math.floor(Math.random() * 14) + 6;
        return Math.min(100, prev + step);
      });
    }, 45);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {!isDone && (
        <motion.div
          key="curtain-stage"
          initial={{ y: 0 }}
          exit={{
            y: "-100%",
            transition: {
              duration: 1.05,
              ease: [0.76, 0, 0.24, 1],
            },
          }}
          className="fixed inset-0 z-50 bg-[#050608] flex flex-col justify-between p-8 sm:p-12 pointer-events-auto select-none overflow-hidden"
        >
          {/* Top header bar */}
          <div className="flex items-center justify-between text-studio-muted font-sans text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-threat-emerald animate-pulse" />
              <span className="font-medium text-studio-text">VoxShield Audio Forensics</span>
            </div>
            <div className="text-studio-dim">System Ready</div>
          </div>

          {/* Center Brand Reveal with Masked Motion */}
          <div className="my-auto space-y-4">
            <div className="overflow-hidden">
              <motion.h1
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="font-display font-bold text-6xl sm:text-9xl text-studio-text tracking-normal"
              >
                VoxShield
              </motion.h1>
            </div>
            <p className="font-sans text-sm sm:text-base text-studio-muted max-w-md font-normal">
              Real-time neural voice clone detection and forensic mimicry verification.
            </p>
          </div>

          {/* Bottom Precision Counter */}
          <div className="flex items-end justify-between border-t border-white/10 pt-6">
            <span className="font-sans text-xs text-studio-dim font-medium">
              Loading Protection Engine
            </span>
            <div className="font-display font-bold text-5xl sm:text-7xl text-studio-text tabular-nums">
              {String(count).padStart(2, "0")}
              <span className="text-xl sm:text-2xl text-studio-dim font-sans ml-1 font-normal">%</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
