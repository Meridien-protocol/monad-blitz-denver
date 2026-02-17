"use client";

import { useEffect, useState } from "react";

interface ToastProps {
  message: string;
  type?: "success" | "error" | "info";
  duration?: number;
  onDismiss: () => void;
}

export function Toast({ message, type = "info", duration = 4000, onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  const borderColor = type === "success"
    ? "border-yes/50"
    : type === "error"
      ? "border-no/50"
      : "border-meridian-gold/50";

  const textColor = type === "success"
    ? "text-yes"
    : type === "error"
      ? "text-no"
      : "text-meridian-gold";

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 rounded-lg border bg-meridian-surface px-4 py-3 shadow-lg transition-all duration-300 ${borderColor} ${
        visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      <p className={`text-sm ${textColor}`}>{message}</p>
    </div>
  );
}
