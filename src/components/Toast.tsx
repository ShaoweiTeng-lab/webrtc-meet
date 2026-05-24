"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

interface ToastProps {
  sender: string;
  message: string;
  onDismiss: () => void;
}

export function Toast({ sender, message, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-24 left-4 z-50 animate-slide-up">
      <div className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.45)] border border-black/[0.06] p-4 w-72 flex items-start gap-3">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-[#1a73e8] flex items-center justify-center text-sm font-semibold text-white shrink-0">
          {sender[0]?.toUpperCase()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-[#202124] text-xs font-semibold mb-0.5 truncate">{sender}</p>
          <p className="text-[#5f6368] text-sm leading-snug line-clamp-2">{message}</p>
        </div>

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          className="text-[#9aa0a6] hover:text-[#5f6368] transition-colors shrink-0 mt-0.5"
        >
          <X className="w-4 h-4" suppressHydrationWarning />
        </button>
      </div>
    </div>
  );
}
