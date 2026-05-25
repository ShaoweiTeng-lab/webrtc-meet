"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSocket } from "@/lib/socket-client";
import { useWebRTC, type PeerInfo } from "@/hooks/useWebRTC";
import { VideoGrid } from "@/components/VideoGrid";
import { RoomControls } from "@/components/RoomControls";
import { VirtualBgPanel } from "@/components/VirtualBgPanel";
import { ChatPanel } from "@/components/ChatPanel";
import { Toast } from "@/components/Toast";
import { playJoinSound, playLeaveSound } from "@/lib/sounds";
import { Socket } from "socket.io-client";

interface ChatMessage {
  fromId: string;
  username: string;
  message: string;
  timestamp: number;
  imageData?: string;
}

export function RoomClient({ roomId }: { roomId: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const username = searchParams.get("username") || "訪客";
  const passwordHash = searchParams.get("passwordHash") || "";

  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketId, setSocketId] = useState("");
  const [error, setError] = useState("");
  const [joined, setJoined] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isBgPanelOpen, setIsBgPanelOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [initialPeers, setInitialPeers] = useState<PeerInfo[]>([]);
  const [toast, setToast] = useState<{ sender: string; message: string } | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);

  const joinedRef = useRef(false);
  const isChatOpenRef = useRef(false);

  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
  }, [isChatOpen]);

  useEffect(() => {
    const s = getSocket();
    setSocket(s);

    const onConnect = () => {
      setSocketId(s.id ?? "");
      if (!joinedRef.current) {
        joinedRef.current = true;
        s.emit("join-room", { roomId, username, passwordHash });
      }
    };

    const onRoomJoined = ({ existingPeers }: { existingPeers: PeerInfo[] }) => {
      setJoined(true);
      setInitialPeers(existingPeers); // passed to useWebRTC so it can create offers safely
    };
    const onRoomError = ({ message }: { message: string }) => setError(message);
    const onUserJoined = () => playJoinSound();
    const onUserLeft = () => playLeaveSound();
    const onChatMessage = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
      if (!isChatOpenRef.current && msg.fromId !== s.id) {
        setUnreadCount((c) => c + 1);
        setToast({ sender: msg.username, message: msg.message });
      }
    };

    s.on("connect", onConnect);
    s.on("room-joined", onRoomJoined);
    s.on("room-error", onRoomError);
    s.on("user-joined", onUserJoined);
    s.on("user-left", onUserLeft);
    s.on("chat-message", onChatMessage);

    if (s.connected && !joinedRef.current) {
      joinedRef.current = true;
      setSocketId(s.id ?? "");
      s.emit("join-room", { roomId, username, passwordHash });
    }

    return () => {
      s.off("connect", onConnect);
      s.off("room-joined", onRoomJoined);
      s.off("room-error", onRoomError);
      s.off("user-joined", onUserJoined);
      s.off("user-left", onUserLeft);
      s.off("chat-message", onChatMessage);
    };
  }, [roomId, username, passwordHash]);

  const {
    localStream,
    remoteStreams,
    peers,
    isMuted,
    isCameraOff,
    isScreenSharing,
    virtualBg,
    isVirtualBgLoading,
    vbOutputCanvas,
    mediaError,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    applyVirtualBg,
  } = useWebRTC({ roomId, username, socket, initialPeers });

  // Reset pin when no one is sharing
  const anyoneSharing = isScreenSharing || Array.from(peers.values()).some((p) => p.isScreenSharing);
  useEffect(() => {
    if (!anyoneSharing) setPinnedId(null);
  }, [anyoneSharing]);

  const handleSendMessage = (message: string, imageData?: string) => {
    socket?.emit("chat-message", { message, imageData });
  };

  const handleLeave = () => {
    localStream?.getTracks().forEach((t) => t.stop());
    router.push("/");
  };

  const handleToggleChat = () => {
    setIsChatOpen((v) => {
      if (!v) setUnreadCount(0);
      return !v;
    });
  };

  // ── Error ──────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="h-dvh bg-[#202124] flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="text-5xl">🔒</div>
          <h2 className="text-[#e8eaed] text-xl font-medium">無法加入房間</h2>
          <p className="text-[#ea4335] text-sm">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="bg-[#8ab4f8] hover:bg-[#93bbf9] text-[#202124] px-6 py-2.5 rounded-full font-medium text-sm transition-colors"
          >
            返回首頁
          </button>
        </div>
      </div>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────
  if (!joined) {
    return (
      <div className="h-dvh bg-[#202124] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-2 border-[#8ab4f8] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-[#bdc1c6] text-sm">正在加入 {roomId}...</p>
        </div>
      </div>
    );
  }

  // ── Room ───────────────────────────────────────────────────────────────
  return (
    <div className="h-dvh bg-[#202124] flex flex-col overflow-hidden relative">
      {mediaError && (
        <div className="bg-yellow-500/15 border-b border-yellow-500/30 px-4 py-2 text-yellow-300 text-xs text-center shrink-0">
          ⚠️ {mediaError}
        </div>
      )}

      {/* Video area + chat */}
      <div className="flex flex-1 min-h-0 relative">
        {/* Video grid */}
        <div className="flex-1 min-w-0 relative">
          <VideoGrid
            localStream={localStream}
            localUsername={username}
            remoteStreams={remoteStreams}
            peers={peers}
            isMuted={isMuted}
            isCameraOff={isCameraOff}
            isScreenSharing={isScreenSharing}
            pinnedId={pinnedId}
            onSetPin={setPinnedId}
            localVbCanvas={vbOutputCanvas}
          />

          {/* Floating room info — top left */}
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-black/50 backdrop-blur-md rounded-full px-3 py-1.5 pointer-events-none">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[#e8eaed] text-xs font-medium truncate max-w-[120px]">
              {roomId}
            </span>
            <span className="text-[#5f6368] text-xs">·</span>
            <span className="text-[#bdc1c6] text-xs">{1 + peers.size} 人</span>
          </div>
        </div>

        {/* Chat panel
            Mobile:  absolute overlay covering full screen
            Desktop: side panel pushing video left */}
        {isChatOpen && (
          <div
            className={[
              // Mobile: full-screen overlay
              "absolute inset-0 z-30",
              // Desktop (sm+): side panel
              "sm:relative sm:inset-auto sm:z-auto sm:w-80 sm:shrink-0 sm:border-l sm:border-[#3c4043]",
              "animate-slide-in-right",
            ].join(" ")}
          >
            <ChatPanel
              messages={messages}
              onSend={handleSendMessage}
              onClose={handleToggleChat}
              currentSocketId={socketId}
            />
          </div>
        )}
      </div>

      {/* Virtual background panel overlay */}
      {isBgPanelOpen && (
        <div
          className="absolute inset-0 z-40"
          onClick={() => setIsBgPanelOpen(false)}
        >
          <div
            className="absolute bottom-20 left-1/2 -translate-x-1/2"
            onClick={(e) => e.stopPropagation()}
          >
            <VirtualBgPanel
              activeBg={virtualBg}
              isLoading={isVirtualBgLoading}
              onSelect={applyVirtualBg}
              onClose={() => setIsBgPanelOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Controls bar */}
      <RoomControls
        isMuted={isMuted}
        isCameraOff={isCameraOff}
        isScreenSharing={isScreenSharing}
        virtualBg={virtualBg}
        isVirtualBgLoading={isVirtualBgLoading}
        isChatOpen={isChatOpen}
        unreadCount={unreadCount}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
        onToggleScreenShare={toggleScreenShare}
        onToggleVirtualBg={() => setIsBgPanelOpen((v) => !v)}
        onToggleChat={handleToggleChat}
        onLeave={handleLeave}
      />

      {/* Toast notification */}
      {toast && (
        <Toast
          sender={toast.sender}
          message={toast.message}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
