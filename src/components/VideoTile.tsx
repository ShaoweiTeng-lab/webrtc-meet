"use client";

import { useEffect, useRef } from "react";
import { MicOff, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

const AVATAR_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#f97316",
];

function getAvatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

interface VideoTileProps {
  stream: MediaStream | null;
  username: string;
  isLocal?: boolean;
  isMuted?: boolean;
  isCameraOff?: boolean;
  isScreenSharing?: boolean;
  objectFit?: "cover" | "contain";
  className?: string;
}

export function VideoTile({
  stream,
  username,
  isLocal = false,
  isMuted = false,
  isCameraOff = false,
  isScreenSharing = false,
  objectFit = "cover",
  className,
}: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream) return;

    el.srcObject = stream;
    el.play().catch(() => {});

    const handleTrackChange = () => {
      el.srcObject = null;
      el.srcObject = stream;
      el.play().catch(() => {});
    };

    stream.addEventListener("addtrack", handleTrackChange);
    stream.addEventListener("removetrack", handleTrackChange);

    return () => {
      stream.removeEventListener("addtrack", handleTrackChange);
      stream.removeEventListener("removetrack", handleTrackChange);
    };
  }, [stream]);

  const initial = username[0]?.toUpperCase() ?? "?";
  const avatarColor = getAvatarColor(username);

  return (
    <div
      className={cn(
        "relative bg-[#18191c] rounded-2xl overflow-hidden flex items-center justify-center",
        className
      )}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={cn(
          "w-full h-full",
          objectFit === "contain" ? "object-contain" : "object-cover",
          isCameraOff && "invisible"
        )}
      />

      {/* Camera-off avatar */}
      {isCameraOff && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white select-none"
            style={{ backgroundColor: avatarColor }}
          >
            {initial}
          </div>
        </div>
      )}

      {/* Bottom gradient */}
      <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

      {/* Name row */}
      <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {isScreenSharing && (
            <Monitor className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          )}
          <span className="text-white text-xs font-medium truncate drop-shadow">
            {username}
            {isLocal && " (你)"}
          </span>
        </div>

        {isMuted && (
          <div className="shrink-0 bg-red-500/90 rounded-full p-1">
            <MicOff className="w-3 h-3 text-white" />
          </div>
        )}
      </div>
    </div>
  );
}
