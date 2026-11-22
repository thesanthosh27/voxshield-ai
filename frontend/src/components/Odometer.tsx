"use client";

import React, { useEffect, useState } from "react";
import { useMotionValue, useSpring } from "framer-motion";

interface OdometerProps {
  value: number;
  decimals?: number;
  suffix?: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export const Odometer: React.FC<OdometerProps> = ({
  value,
  decimals = 0,
  suffix = "",
  className = "",
  size = "md",
}) => {
  const safeValue = typeof value === "number" && !isNaN(value) ? Math.max(0, value) : 0;
  const motionVal = useMotionValue(safeValue);
  const springVal = useSpring(motionVal, {
    stiffness: 120,
    damping: 24,
    mass: 0.8,
  });

  const [displayValue, setDisplayValue] = useState<string>(() =>
    safeValue.toFixed(decimals)
  );

  useEffect(() => {
    const target = typeof value === "number" && !isNaN(value) ? Math.max(0, value) : 0;
    motionVal.set(target);
  }, [value, motionVal]);

  useEffect(() => {
    const unsubscribe = springVal.on("change", (latest) => {
      setDisplayValue(Math.max(0, latest).toFixed(decimals));
    });
    return () => unsubscribe();
  }, [springVal, decimals]);

  const getNumberSizeClass = () => {
    switch (size) {
      case "sm":
        return "text-lg font-bold tracking-tight";
      case "xl":
        return "text-4xl font-bold tracking-tight";
      case "md":
      case "lg":
      default:
        return "text-2xl font-bold tracking-tight";
    }
  };

  const getUnitSizeClass = () => {
    switch (size) {
      case "sm":
        return "text-xs font-medium opacity-75";
      case "xl":
        return "text-xl font-medium opacity-75";
      case "md":
      case "lg":
      default:
        return "text-base font-medium opacity-75";
    }
  };

  const isPercent = suffix.trim() === "%";
  const unitSpacing = isPercent ? "ml-0.5" : "ml-1.5";

  return (
    <span
      className={`inline-flex items-baseline flex-nowrap whitespace-nowrap leading-none tabular-nums select-none ${className}`}
    >
      <span className={getNumberSizeClass()}>{displayValue}</span>
      {suffix && (
        <span className={`${getUnitSizeClass()} ${unitSpacing} select-none`}>
          {suffix}
        </span>
      )}
    </span>
  );
};
