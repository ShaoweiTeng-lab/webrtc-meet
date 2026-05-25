"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { RTC_CONFIG } from "@/lib/webrtc-config";
import { type PresetBg } from "@/lib/virtualBgOptions";
import { type BgDrawConfig } from "@/lib/virtualBackground";

export interface PeerInfo {
  socketId: string;
  username: string;
  audioOn: boolean;
  videoOn: boolean;
  isScreenSharing: boolean;
}

interface UseWebRTCProps {
  roomId: string;
  username: string;
  socket: Socket | null;
  initialPeers: PeerInfo[]; // from room-joined, handled in RoomClient to avoid race condition
}

async function waitForStream(ref: React.MutableRefObject<MediaStream | null>): Promise<MediaStream | null> {
  if (ref.current) return ref.current;
  return new Promise((resolve) => {
    const id = setInterval(() => {
      if (ref.current) {
        clearInterval(id);
        resolve(ref.current);
      }
    }, 100);
    // Give up after 5s
    setTimeout(() => { clearInterval(id); resolve(null); }, 5000);
  });
}

export function useWebRTC({ roomId, username, socket, initialPeers }: UseWebRTCProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [peers, setPeers] = useState<Map<string, PeerInfo>>(new Map());
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [virtualBg, setVirtualBg] = useState<PresetBg | null>(null);
  const [isVirtualBgLoading, setIsVirtualBgLoading] = useState(false);
  const [vbOutputCanvas, setVbOutputCanvas] = useState<HTMLCanvasElement | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vbProcessorRef = useRef<any>(null);
  const vbTrackRef = useRef<MediaStreamTrack | null>(null);

  // Initialize local media
  useEffect(() => {
    let mounted = true;

    async function initMedia() {
      const attempts: MediaStreamConstraints[] = [
        { video: true, audio: true },
        { video: false, audio: true },
      ];

      for (const constraints of attempts) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return; }
          localStreamRef.current = stream;
          cameraVideoTrackRef.current = stream.getVideoTracks()[0] ?? null;
          setLocalStream(stream);
          if (!constraints.video) setIsCameraOff(true);
          return;
        } catch {
          // try next
        }
      }

      if (mounted) {
        setMediaError("找不到鏡頭或麥克風，以純文字模式加入");
        setIsMuted(true);
        setIsCameraOff(true);
      }
    }

    initMedia();
    return () => {
      mounted = false;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const createPeerConnection = useCallback(
    (peerId: string): RTCPeerConnection => {
      const existing = peerConnections.current.get(peerId);
      if (existing) return existing;

      const pc = new RTCPeerConnection(RTC_CONFIG);

      localStreamRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });

      // iOS Safari: event.streams may be empty — fall back to event.track
      pc.ontrack = (event) => {
        const incomingStream = event.streams?.[0];

        if (incomingStream) {
          setRemoteStreams((prev) => new Map(prev).set(peerId, incomingStream));
        } else {
          // iOS Safari fallback: accumulate tracks into a stable MediaStream
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            const existing = next.get(peerId);
            if (existing) {
              if (!existing.getTrackById(event.track.id)) {
                existing.addTrack(event.track);
              }
              // Return a new MediaStream instance so React detects the change
              next.set(peerId, new MediaStream(existing.getTracks()));
            } else {
              next.set(peerId, new MediaStream([event.track]));
            }
            return next;
          });
        }

        // Ensure peer entry exists even if user-joined arrived late
        setPeers((prev) => {
          if (!prev.has(peerId)) {
            return new Map(prev).set(peerId, {
              socketId: peerId,
              username: "unknown",
              audioOn: true,
              videoOn: true,
              isScreenSharing: false,
            });
          }
          return prev;
        });
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit("ice-candidate", {
            targetId: peerId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log(`[WebRTC] ${peerId} connection: ${pc.connectionState}`);
        if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
          setRemoteStreams((prev) => { const n = new Map(prev); n.delete(peerId); return n; });
          setPeers((prev) => { const n = new Map(prev); n.delete(peerId); return n; });
          peerConnections.current.delete(peerId);
        }
      };


      peerConnections.current.set(peerId, pc);
      return pc;
    },
    [socket]
  );

  // Handle existing peers once both socket AND initialPeers are ready.
  // This lives outside the socket event-listener effect to avoid the race condition
  // where room-joined fires before the useEffect has a chance to register the handler.
  useEffect(() => {
    if (!socket || initialPeers.length === 0) return;

    setPeers(
      new Map(initialPeers.map((p) => [p.socketId, { ...p, isScreenSharing: p.isScreenSharing ?? false }]))
    );

    const connect = async () => {
      await waitForStream(localStreamRef);
      for (const peer of initialPeers) {
        const pc = createPeerConnection(peer.socketId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("offer", { targetId: peer.socketId, offer });
      }
    };
    connect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, initialPeers]); // createPeerConnection intentionally omitted — it is stable when socket is set

  useEffect(() => {
    if (!socket) return;

    const handleUserJoined = ({ socketId, username: uname }: { socketId: string; username: string }) => {
      setPeers((prev) =>
        new Map(prev).set(socketId, { socketId, username: uname, audioOn: true, videoOn: true, isScreenSharing: false })
      );
    };

    const handleOffer = async ({
      fromId,
      fromUsername,
      offer,
    }: {
      fromId: string;
      fromUsername: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      setPeers((prev) => {
        if (!prev.has(fromId)) {
          return new Map(prev).set(fromId, { socketId: fromId, username: fromUsername, audioOn: true, videoOn: true, isScreenSharing: false });
        }
        return prev;
      });

      // Wait for local stream so we can add tracks before answering
      await waitForStream(localStreamRef);

      const pc = createPeerConnection(fromId);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("answer", { targetId: fromId, answer });
    };

    const handleAnswer = async ({ fromId, answer }: { fromId: string; answer: RTCSessionDescriptionInit }) => {
      const pc = peerConnections.current.get(fromId);
      if (pc && pc.signalingState !== "stable") {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    };

    const handleIceCandidate = async ({ fromId, candidate }: { fromId: string; candidate: RTCIceCandidateInit }) => {
      const pc = peerConnections.current.get(fromId);
      if (pc) {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
      }
    };

    const handleUserLeft = ({ socketId }: { socketId: string }) => {
      peerConnections.current.get(socketId)?.close();
      peerConnections.current.delete(socketId);
      setRemoteStreams((prev) => { const n = new Map(prev); n.delete(socketId); return n; });
      setPeers((prev) => { const n = new Map(prev); n.delete(socketId); return n; });
    };

    const handleMediaToggle = ({ fromId, audioOn, videoOn, isScreenSharing: sharing }: { fromId: string; audioOn: boolean; videoOn: boolean; isScreenSharing?: boolean }) => {
      setPeers((prev) => {
        const next = new Map(prev);
        const peer = next.get(fromId);
        if (peer) next.set(fromId, { ...peer, audioOn, videoOn, isScreenSharing: sharing ?? peer.isScreenSharing });
        return next;
      });
    };

    // Renegotiation handlers (for screen share when no video sender exists)
    const handleRenegotiateOffer = async ({ fromId, offer }: { fromId: string; offer: RTCSessionDescriptionInit }) => {
      const pc = peerConnections.current.get(fromId);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        if (pc.signalingState === "have-remote-offer") {
          await pc.setLocalDescription(answer);
          socket.emit("renegotiate-answer", { targetId: fromId, answer });
        }
      } catch (e) {
        console.warn("[renegotiate] offer handling failed:", e);
      }
    };

    const handleRenegotiateAnswer = async ({ fromId, answer }: { fromId: string; answer: RTCSessionDescriptionInit }) => {
      const pc = peerConnections.current.get(fromId);
      if (pc && pc.signalingState !== "stable") {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    };

    socket.on("user-joined", handleUserJoined);
    socket.on("offer", handleOffer);
    socket.on("answer", handleAnswer);
    socket.on("ice-candidate", handleIceCandidate);
    socket.on("user-left", handleUserLeft);
    socket.on("media-toggle", handleMediaToggle);
    socket.on("renegotiate-offer", handleRenegotiateOffer);
    socket.on("renegotiate-answer", handleRenegotiateAnswer);

    return () => {
      socket.off("user-joined", handleUserJoined);
      socket.off("offer", handleOffer);
      socket.off("answer", handleAnswer);
      socket.off("ice-candidate", handleIceCandidate);
      socket.off("user-left", handleUserLeft);
      socket.off("media-toggle", handleMediaToggle);
      socket.off("renegotiate-offer", handleRenegotiateOffer);
      socket.off("renegotiate-answer", handleRenegotiateAnswer);
    };
  }, [socket, createPeerConnection]);

  useEffect(() => {
    return () => {
      peerConnections.current.forEach((pc) => pc.close());
      peerConnections.current.clear();
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioContextRef.current?.close().catch(() => {});
      vbProcessorRef.current?.stop();
    };
  }, []);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const newMuted = !isMuted;
    localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = !newMuted; });
    setIsMuted(newMuted);
    socket?.emit("media-toggle", { audioOn: !newMuted, videoOn: !isCameraOff });
  }, [isMuted, isCameraOff, socket]);

  const toggleCamera = useCallback(async () => {
    const newOff = !isCameraOff;

    if (newOff) {
      // Stop VB before turning off camera
      if (vbProcessorRef.current) {
        vbProcessorRef.current.stop();
        vbProcessorRef.current = null;
        vbTrackRef.current = null;
        setVirtualBg(null);
        setVbOutputCanvas(null);
      }
      // Turn camera off — just disable track
      localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = false; });
      setIsCameraOff(true);
      socket?.emit("media-toggle", { audioOn: !isMuted, videoOn: false });
    } else {
      // Turn camera on — re-enable or restart if track ended
      const stream = localStreamRef.current;
      const existingTrack = stream?.getVideoTracks()[0];

      if (existingTrack && existingTrack.readyState !== "ended") {
        existingTrack.enabled = true;
        setIsCameraOff(false);
        socket?.emit("media-toggle", { audioOn: !isMuted, videoOn: true });
      } else {
        // Track ended (common on mobile) — request new camera stream
        try {
          const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
          const newTrack = newStream.getVideoTracks()[0];
          cameraVideoTrackRef.current = newTrack;

          if (stream) {
            if (existingTrack) stream.removeTrack(existingTrack);
            stream.addTrack(newTrack);
            setLocalStream(new MediaStream(stream.getTracks()));
          }

          // Await replaceTrack in each peer connection
          for (const pc of peerConnections.current.values()) {
            const sender = pc.getSenders().find((s) => s.track?.kind === "video");
            if (sender) { try { await sender.replaceTrack(newTrack); } catch {} }
          }

          setIsCameraOff(false);
          socket?.emit("media-toggle", { audioOn: !isMuted, videoOn: true });
        } catch {
          // Camera unavailable — stay off
        }
      }
    }
  }, [isCameraOff, isMuted, socket]);

  const toggleScreenShare = useCallback(async () => {
    // Check browser support
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setMediaError("此裝置/瀏覽器不支援螢幕分享");
      setTimeout(() => setMediaError(null), 3000);
      return;
    }

    if (isScreenSharing) {
      // --- Stop screen sharing ---
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;

      // Close audio mixer
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }

      const cameraTrack = cameraVideoTrackRef.current;

      // Collect senders BEFORE modifying local stream
      const videoSenders: RTCRtpSender[] = [];
      const audioSenders: RTCRtpSender[] = [];
      for (const pc of peerConnections.current.values()) {
        const vs = pc.getSenders().find((s) => s.track?.kind === "video");
        const as = pc.getSenders().find((s) => s.track?.kind === "audio");
        if (vs) videoSenders.push(vs);
        if (as) audioSenders.push(as);
      }

      // Restore local stream display
      const stream = localStreamRef.current;
      if (stream) {
        stream.getVideoTracks().forEach((t) => stream.removeTrack(t));
        if (cameraTrack) stream.addTrack(cameraTrack);
        setLocalStream(new MediaStream(stream.getTracks()));
      }

      // Restore video track
      for (const sender of videoSenders) {
        try { await sender.replaceTrack(cameraTrack ?? null); } catch {}
      }
      // Restore original mic audio
      const micTrack = localStreamRef.current?.getAudioTracks()[0] ?? null;
      for (const sender of audioSenders) {
        try { await sender.replaceTrack(micTrack); } catch {}
      }

      setIsScreenSharing(false);
      socket?.emit("media-toggle", { audioOn: !isMuted, videoOn: !isCameraOff, isScreenSharing: false });
    } else {
      // --- Start screen sharing ---
      try {
        // Stop VB if active — screen share replaces video track
        if (vbProcessorRef.current) {
          vbProcessorRef.current.stop();
          vbProcessorRef.current = null;
          vbTrackRef.current = null;
          setVirtualBg(null);
          setVbOutputCanvas(null);
        }

        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 30 } },
          audio: true, // Request system audio (user can choose to include it)
        });
        screenStreamRef.current = screenStream;
        const screenVideoTrack = screenStream.getVideoTracks()[0];
        const screenAudioTrack = screenStream.getAudioTracks()[0] ?? null;

        // Collect senders BEFORE modifying local stream
        const videoSenders: RTCRtpSender[] = [];
        const audioSenders: RTCRtpSender[] = [];
        for (const pc of peerConnections.current.values()) {
          const vs = pc.getSenders().find((s) => s.track?.kind === "video");
          const as = pc.getSenders().find((s) => s.track?.kind === "audio");
          if (vs) videoSenders.push(vs);
          if (as) audioSenders.push(as);
        }

        // Update local stream display
        const stream = localStreamRef.current;
        if (stream) {
          const currentVideoTrack = stream.getVideoTracks()[0];
          if (currentVideoTrack) {
            cameraVideoTrackRef.current = currentVideoTrack;
            stream.removeTrack(currentVideoTrack);
          }
          stream.addTrack(screenVideoTrack);
          setLocalStream(new MediaStream(stream.getTracks()));
        }

        // Replace video track
        if (videoSenders.length > 0) {
          for (const sender of videoSenders) {
            try { await sender.replaceTrack(screenVideoTrack); } catch {}
          }
        } else {
          for (const [peerId, pc] of peerConnections.current.entries()) {
            pc.addTrack(screenVideoTrack, localStreamRef.current!);
            try {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              socket?.emit("renegotiate-offer", { targetId: peerId, offer });
            } catch {}
          }
        }

        // Mix screen audio + mic audio and replace audio sender
        if (screenAudioTrack && audioSenders.length > 0) {
          try {
            const ctx = new AudioContext();
            audioContextRef.current = ctx;

            const micStream = localStreamRef.current;
            const destination = ctx.createMediaStreamDestination();

            // Mix mic audio
            if (micStream && micStream.getAudioTracks().length > 0) {
              const micSource = ctx.createMediaStreamSource(micStream);
              micSource.connect(destination);
            }
            // Mix screen audio
            const screenAudioStream = new MediaStream([screenAudioTrack]);
            const screenSource = ctx.createMediaStreamSource(screenAudioStream);
            screenSource.connect(destination);

            const mixedTrack = destination.stream.getAudioTracks()[0];
            for (const sender of audioSenders) {
              try { await sender.replaceTrack(mixedTrack); } catch {}
            }
          } catch {
            // Audio mixing failed — continue with video only
          }
        }

        setIsScreenSharing(true);
        socket?.emit("media-toggle", { audioOn: !isMuted, videoOn: true, isScreenSharing: true });

        screenVideoTrack.onended = () => toggleScreenShare();
      } catch {
        // User cancelled or permission denied
      }
    }
  }, [isScreenSharing, isMuted, isCameraOff, socket]);

  const applyVirtualBg = useCallback(async (option: PresetBg | null) => {
    if (isCameraOff) return;

    if (option === null) {
      // Turn off VB — restore original camera track
      vbProcessorRef.current?.stop();
      vbProcessorRef.current = null;
      const originalTrack = cameraVideoTrackRef.current;
      // Create a new stream instead of mutating the existing one — mutating fires
      // removetrack/addtrack events that cause srcObject = null flashes on iOS WebKit
      if (localStreamRef.current) {
        const newStream = new MediaStream([
          ...localStreamRef.current.getAudioTracks(),
          ...(originalTrack ? [originalTrack] : []),
        ]);
        localStreamRef.current = newStream;
        setLocalStream(newStream);
      }
      for (const pc of peerConnections.current.values()) {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender && originalTrack) {
          try { await sender.replaceTrack(originalTrack); } catch {}
        }
      }
      vbTrackRef.current = null;
      setVbOutputCanvas(null);
      setVirtualBg(null);
      return;
    }

    // Build the draw config for this background
    let drawConfig: BgDrawConfig;
    if (option.type === "blur") {
      drawConfig = { type: "blur", radius: option.radius };
    } else if (option.type === "color") {
      drawConfig = { type: "color", color: option.color };
    } else {
      // image — load it first
      const img = new Image();
      img.src = option.src;
      img.crossOrigin = "anonymous";
      try {
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Image load failed"));
          setTimeout(() => reject(new Error("Image timeout")), 10_000);
        });
      } catch {
        setMediaError("圖片載入失敗");
        setTimeout(() => setMediaError(null), 3000);
        return;
      }
      drawConfig = { type: "image", img };
    }

    // If VB is already running, hot-swap the background instantly (no model reload)
    if (vbProcessorRef.current) {
      vbProcessorRef.current.setBgConfig(drawConfig);
      setVirtualBg(option);
      return;
    }

    // Pre-check browser support before loading the model
    const testCanvas = document.createElement("canvas");
    const hasCaptureStream = typeof (testCanvas as unknown as { captureStream?: unknown }).captureStream === "function";
    const hasTrackGenerator = typeof (globalThis as unknown as { MediaStreamTrackGenerator?: unknown }).MediaStreamTrackGenerator !== "undefined";
    if (!hasCaptureStream && !hasTrackGenerator) {
      setMediaError("此裝置的瀏覽器不支援虛擬背景，請改用 Chrome（電腦或 Android）");
      setTimeout(() => setMediaError(null), 5000);
      return;
    }

    const originalTrack = cameraVideoTrackRef.current;
    if (!originalTrack || originalTrack.readyState === "ended") return;

    setIsVirtualBgLoading(true);
    try {
      const { VirtualBackgroundProcessor } = await import("@/lib/virtualBackground");
      const processor = new VirtualBackgroundProcessor();

      // Set error handler BEFORE start() — the render loop begins inside start() and
      // can fail before start() returns (e.g. consecutive inference errors on iOS WebGL)
      processor.onError = () => {
        vbProcessorRef.current = null;
        vbTrackRef.current = null;
        setVbOutputCanvas(null);
        setVirtualBg(null);
        setMediaError("虛擬背景執行發生錯誤，已自動關閉");
        setTimeout(() => setMediaError(null), 5000);
        if (localStreamRef.current) {
          const origTrack = cameraVideoTrackRef.current;
          const newStream = new MediaStream([
            ...localStreamRef.current.getAudioTracks(),
            ...(origTrack ? [origTrack] : []),
          ]);
          localStreamRef.current = newStream;
          setLocalStream(newStream);
        }
      };

      const processedTrack = await processor.start(originalTrack, drawConfig);

      // outputCanvas is null if stop() was called during startup (onError already cleaned up)
      if (!processor.outputCanvas) return;

      vbProcessorRef.current = processor;
      vbTrackRef.current = processedTrack;
      setVbOutputCanvas(processor.outputCanvas);

      // Create a new stream instead of mutating — avoids removetrack/addtrack events
      // that trigger srcObject = null flashes in VideoTile, breaking playback on iOS
      if (localStreamRef.current) {
        const newStream = new MediaStream([
          ...localStreamRef.current.getAudioTracks(),
          processedTrack,
        ]);
        localStreamRef.current = newStream;
        setLocalStream(newStream);
      }
      for (const pc of peerConnections.current.values()) {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) {
          try { await sender.replaceTrack(processedTrack); } catch {}
        }
      }
      setVirtualBg(option);
    } catch (e) {
      const isUnsupported = e instanceof Error &&
        (e.message === "UNSUPPORTED" || e.message === "TIMEOUT");
      const msg = isUnsupported
        ? "此裝置的瀏覽器不支援虛擬背景，請改用 Chrome（電腦或 Android）"
        : "虛擬背景載入失敗，請確認網路連線後再試";
      console.warn("[VB] failed to start:", e);
      setMediaError(msg);
      setTimeout(() => setMediaError(null), 5000);
    } finally {
      setIsVirtualBgLoading(false);
    }
  }, [isCameraOff]);

  return {
    localStream,
    remoteStreams,
    peers,
    isMuted,
    isCameraOff,
    isScreenSharing,
    virtualBg,
    isVirtualBgOn: virtualBg !== null,
    isVirtualBgLoading,
    vbOutputCanvas,
    mediaError,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    applyVirtualBg,
  };
}
