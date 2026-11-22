"use client";

import React, { useRef, useState } from "react";
import { motion } from "framer-motion";

interface MagneticButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: "primary" | "secondary" | "danger" | "tab";
  active?: boolean;
  disabled?: boolean;
}

export const MagneticButton: React.FC<MagneticButtonProps> = ({
  children,
  onClick,
  className = "",
  variant = "primary",
  active = false,
  disabled = false,
}) => {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || !btnRef.current) return;
    const { clientX, clientY } = e;
    const { left, top, width, height } = btnRef.current.getBoundingClientRect();
    const x = (clientX - (left + width / 2)) * 0.28;
    const y = (clientY - (top + height / 2)) * 0.28;
    setPosition({ x, y });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
    setIsHovered(false);
  };

  const getVariantStyles = () => {
    switch (variant) {
      case "primary":
        return "bg-studio-text text-studio-bg hover:bg-white border border-transparent font-medium shadow-lg shadow-white/5";
      case "danger":
        return "bg-threat-crimson text-white hover:bg-red-600 border border-transparent font-semibold shadow-lg shadow-red-500/10";
      case "tab":
        return active
          ? "bg-white/10 text-studio-text border border-white/20 font-semibold"
          : "bg-transparent text-studio-muted hover:text-studio-text hover:bg-white/5 border border-transparent font-normal";
      case "secondary":
      default:
        return "bg-studio-card text-studio-text hover:bg-studio-elevated border border-studio-border font-medium";
    }
  };

  return (
    <motion.button
      ref={btnRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: "spring", stiffness: 220, damping: 16, mass: 0.2 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      disabled={disabled}
      className={`relative inline-flex items-center justify-center px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-sans tracking-normal transition-colors overflow-hidden select-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${getVariantStyles()} ${className}`}
    >
      {/* Vertical Text Slot-Roll Container */}
      <span className="relative inline-block overflow-hidden h-[1.4em]">
        <motion.span
          animate={{ y: isHovered && !disabled ? "-100%" : "0%" }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="inline-block"
        >
          {children}
        </motion.span>
        <motion.span
          aria-hidden="true"
          animate={{ y: isHovered && !disabled ? "0%" : "100%" }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 inline-block"
        >
          {children}
        </motion.span>
      </span>
    </motion.button>
  );
};
