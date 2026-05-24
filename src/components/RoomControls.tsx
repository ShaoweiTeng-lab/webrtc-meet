"use client";

import { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  MessageSquare,
  PhoneOff,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type PresetBg } from "@/lib/virtualBgOptions";

interface RoomControlsProps {
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  virtualBg: PresetBg | null;
  isVirtualBgLoading: boolean;
  isChatOpen: boolean;
  unreadCount: number;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onToggleVirtualBg: () => void;
  onToggleChat: () => void;
  onLeave: () => void;
}

function CircleBtn({
  onClick,
  label,
  danger,
  highlight,
  badge,
  children,
}: {
  onClick: () => void;
  label: string;
  danger?: boolean;
  highlight?: boolean;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative">
        <button
          onClick={onClick}
          title={label}
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-150 active:scale-90",
            danger
              ? "bg-[#ea4335] hover:bg-[#d93025] shadow-md shadow-[#ea4335]/30"
              : highlight
              ? "bg-[#00897b] hover:bg-[#00796b] shadow-md shadow-[#00897b]/30"
              : "bg-[#3c4043] hover:bg-[#4a4d50]"
          )}
        >
          {children}
        </button>
        {badge != null && badge > 0 && (
          <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-[#ea4335] rounded-full flex items-center justify-center px-1 pointer-events-none ring-2 ring-[#1e2022]">
            <span className="text-white text-[10px] font-bold leading-none">
              {badge > 99 ? "99" : badge}
            </span>
          </div>
        )}
      </div>
      {/* Label: hidden on small/landscape screens */}
      <span className="hidden sm:block text-[#9aa0a6] text-[10px] leading-none">{label}</span>
    </div>
  );
}

function useCallTimer() {
  const [elapsed, setElapsed] = useState("00:00");
  const startRef = useRef(Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      const secs = Math.floor((Date.now() - startRef.current) / 1000);
      const m = String(Math.floor(secs / 60)).padStart(2, "0");
      const s = String(secs % 60).padStart(2, "0");
      setElapsed(`${m}:${s}`);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return elapsed;
}

export function RoomControls({
  isMuted,
  isCameraOff,
  isScreenSharing,
  virtualBg,
  isVirtualBgLoading,
  isChatOpen,
  unreadCount,
  onToggleMute,
  onToggleCamera,
  onToggleScreenShare,
  onToggleVirtualBg,
  onToggleChat,
  onLeave,
}: RoomControlsProps) {
  const isVirtualBgOn = virtualBg !== null;
  const elapsed = useCallTimer();

  return (
    <div
      className="shrink-0 bg-[#111213] border-t border-white/[0.05] px-3 pt-2"
      style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-end justify-between gap-2">
        {/* Left: timer — desktop only */}
        <div className="hidden sm:flex flex-col gap-1 pb-1.5 min-w-[64px]">
          <span className="text-[#e8eaed] text-sm font-semibold tabular-nums">{elapsed}</span>
          <span className="text-[#5f6368] text-[11px]">通話時長</span>
        </div>

        {/* Center: all controls */}
        <div className="flex items-end gap-2 sm:gap-3 mx-auto sm:mx-0">
          <CircleBtn
            onClick={onToggleMute}
            label={isMuted ? "取消靜音" : "靜音"}
            danger={isMuted}
          >
            {isMuted ? (
              <MicOff className="w-5 h-5 text-white" />
            ) : (
              <Mic className="w-5 h-5 text-white" />
            )}
          </CircleBtn>

          <CircleBtn
            onClick={onToggleCamera}
            label={isCameraOff ? "開啟鏡頭" : "關閉鏡頭"}
            danger={isCameraOff}
          >
            {isCameraOff ? (
              <VideoOff className="w-5 h-5 text-white" />
            ) : (
              <Video className="w-5 h-5 text-white" />
            )}
          </CircleBtn>

          <CircleBtn
            onClick={onToggleScreenShare}
            label={isScreenSharing ? "停止分享" : "螢幕分享"}
            highlight={isScreenSharing}
          >
            {isScreenSharing ? (
              <MonitorOff className="w-5 h-5 text-white" />
            ) : (
              <Monitor className="w-5 h-5 text-white" />
            )}
          </CircleBtn>

          <CircleBtn
            onClick={onToggleVirtualBg}
            label={isVirtualBgOn ? "關閉虛擬背景" : "虛擬背景"}
            highlight={isVirtualBgOn}
          >
            {isVirtualBgLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5 text-white" />
            )}
          </CircleBtn>

          <CircleBtn
            onClick={onToggleChat}
            label="聊天"
            badge={isChatOpen ? 0 : unreadCount}
          >
            <MessageSquare className="w-5 h-5 text-white" />
          </CircleBtn>

          {/* Leave — inline on mobile */}
          <div className="sm:hidden pb-0.5">
            <button
              onClick={onLeave}
              title="離開通話"
              className="w-12 h-12 bg-[#ea4335] hover:bg-[#d93025] active:scale-90 text-white rounded-full flex items-center justify-center transition-all duration-150 shadow-md shadow-[#ea4335]/30"
            >
              <PhoneOff className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Right: leave — desktop only */}
        <div className="hidden sm:flex justify-end min-w-[64px] pb-1.5">
          <button
            onClick={onLeave}
            title="離開通話"
            className="bg-[#ea4335] hover:bg-[#d93025] active:scale-95 text-white rounded-full px-5 h-12 text-sm font-semibold flex items-center gap-2 transition-all duration-150 shadow-md shadow-[#ea4335]/25"
          >
            <PhoneOff className="w-4 h-4" />
            <span>離開通話</span>
          </button>
        </div>
      </div>
    </div>
  );
}
