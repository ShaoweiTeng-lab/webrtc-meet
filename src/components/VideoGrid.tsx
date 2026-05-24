"use client";

import { VideoTile } from "./VideoTile";
import { PeerInfo } from "@/hooks/useWebRTC";
import { cn } from "@/lib/utils";
import { Pin, PinOff } from "lucide-react";

interface Participant {
  id: string;
  stream: MediaStream | null;
  username: string;
  isLocal: boolean;
  isMuted: boolean;
  isCameraOff: boolean;
  isSharing: boolean;
}

interface VideoGridProps {
  localStream: MediaStream | null;
  localUsername: string;
  remoteStreams: Map<string, MediaStream>;
  peers: Map<string, PeerInfo>;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  pinnedId?: string | null;
  onSetPin?: (id: string | null) => void;
}

export function VideoGrid({
  localStream,
  localUsername,
  remoteStreams,
  peers,
  isMuted,
  isCameraOff,
  isScreenSharing,
  pinnedId,
  onSetPin,
}: VideoGridProps) {
  const peerList = Array.from(peers.values());

  // ── Screen share layout ──────────────────────────────────────────────────
  const sharingPeer = peerList.find((p) => p.isScreenSharing);
  const anyoneSharing = isScreenSharing || !!sharingPeer;

  if (anyoneSharing) {
    // Flat participant list
    const all: Participant[] = [
      {
        id: "local",
        stream: localStream,
        username: localUsername,
        isLocal: true,
        isMuted,
        isCameraOff,
        isSharing: isScreenSharing,
      },
      ...peerList.map((p) => ({
        id: p.socketId,
        stream: remoteStreams.get(p.socketId) ?? null,
        username: p.username,
        isLocal: false,
        isMuted: !p.audioOn,
        isCameraOff: !p.videoOn,
        isSharing: p.isScreenSharing,
      })),
    ];

    const defaultMainId = isScreenSharing ? "local" : sharingPeer?.socketId ?? null;
    const effectiveMainId = pinnedId ?? defaultMainId;
    const main =
      all.find((p) => p.id === effectiveMainId) ??
      all.find((p) => p.isSharing) ??
      all[0];
    const thumbs = all.filter((p) => p.id !== main?.id);
    const isPinned = pinnedId !== null && pinnedId !== undefined;

    return (
      <div className="flex flex-col h-full bg-[#202124]">
        {/* Main presenter view */}
        <div className="flex-1 min-h-0 p-2 relative">
          <VideoTile
            stream={main?.stream ?? null}
            username={main?.username ?? ""}
            isLocal={main?.isLocal ?? false}
            isMuted={main?.isMuted ?? false}
            isCameraOff={false}
            isScreenSharing={main?.isSharing ?? false}
            objectFit="contain"
            className="h-full w-full"
          />

          {/* Unpin button */}
          {isPinned && onSetPin && (
            <button
              onClick={() => onSetPin(null)}
              className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 hover:bg-black/80 transition-colors"
            >
              <PinOff className="w-3.5 h-3.5" />
              取消固定
            </button>
          )}
        </div>

        {/* Thumbnail strip */}
        {thumbs.length > 0 && (
          <div className="flex gap-2 px-2 pb-2 h-28 shrink-0 overflow-x-auto">
            {thumbs.map((t) => {
              const isThisPinned = pinnedId === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => onSetPin?.(isThisPinned ? null : t.id)}
                  className={cn(
                    "relative w-44 h-full shrink-0 rounded-2xl group",
                    isThisPinned && "ring-2 ring-[#8ab4f8]"
                  )}
                  title="點擊以固定此畫面"
                >
                  <VideoTile
                    stream={t.stream}
                    username={t.username}
                    isLocal={t.isLocal}
                    isMuted={t.isMuted}
                    isCameraOff={t.isCameraOff}
                    className="w-full h-full"
                  />
                  {/* Pin hint overlay */}
                  <div className="absolute inset-0 rounded-2xl bg-white/0 group-hover:bg-white/10 group-active:bg-white/15 transition-colors flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-full p-1.5">
                      <Pin className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Standard grid layout ─────────────────────────────────────────────────
  const totalCount = 1 + peerList.length;

  if (totalCount === 1) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-[#202124] p-3">
        <VideoTile
          stream={localStream}
          username={localUsername}
          isLocal
          isMuted={isMuted}
          isCameraOff={isCameraOff}
          className="w-full max-w-3xl h-full"
        />
      </div>
    );
  }

  const gridClass = cn(
    "grid gap-2 w-full h-full p-2",
    totalCount === 2 && "grid-cols-2",
    totalCount === 3 && "grid-cols-1 sm:grid-cols-2",
    totalCount === 4 && "grid-cols-2",
    totalCount >= 5 && "grid-cols-2 sm:grid-cols-3"
  );

  return (
    <div className={gridClass}>
      <VideoTile
        stream={localStream}
        username={localUsername}
        isLocal
        isMuted={isMuted}
        isCameraOff={isCameraOff}
        isScreenSharing={isScreenSharing}
        className={cn(totalCount === 3 ? "sm:col-span-2" : "")}
      />
      {peerList.map((peer) => (
        <VideoTile
          key={peer.socketId}
          stream={remoteStreams.get(peer.socketId) ?? null}
          username={peer.username}
          isMuted={!peer.audioOn}
          isCameraOff={!peer.videoOn}
        />
      ))}
    </div>
  );
}
