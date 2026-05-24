import { vi } from "vitest";
import "@testing-library/jest-dom";

// ── RTCPeerConnection ────────────────────────────────────────────────────────
class FakeRTCPeerConnection {
  localDescription = null;
  remoteDescription = null;
  iceConnectionState = "new";
  signalingState = "stable";
  onicecandidate = null;
  ontrack = null;
  onnegotiationneeded = null;

  createOffer() { return Promise.resolve({ type: "offer", sdp: "" }); }
  createAnswer() { return Promise.resolve({ type: "answer", sdp: "" }); }
  setLocalDescription() { return Promise.resolve(); }
  setRemoteDescription() { return Promise.resolve(); }
  addIceCandidate() { return Promise.resolve(); }
  addTrack() { return { replaceTrack: vi.fn().mockResolvedValue(undefined) } as unknown as RTCRtpSender; }
  getSenders() { return []; }
  close() {}
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() { return true; }
}
global.RTCPeerConnection = FakeRTCPeerConnection as unknown as typeof RTCPeerConnection;

// ── MediaStream / MediaStreamTrack ───────────────────────────────────────────
class FakeMediaStreamTrack {
  kind: string;
  readyState = "live";
  enabled = true;
  constructor(kind: string) { this.kind = kind; }
  stop() { this.readyState = "ended"; }
  addEventListener() {}
  removeEventListener() {}
}

class FakeMediaStream {
  private tracks: FakeMediaStreamTrack[] = [];
  constructor(tracks?: FakeMediaStreamTrack[]) {
    this.tracks = tracks ?? [
      new FakeMediaStreamTrack("audio"),
      new FakeMediaStreamTrack("video"),
    ];
  }
  getTracks() { return this.tracks; }
  getAudioTracks() { return this.tracks.filter((t) => t.kind === "audio"); }
  getVideoTracks() { return this.tracks.filter((t) => t.kind === "video"); }
  addTrack(t: FakeMediaStreamTrack) { this.tracks.push(t); }
  removeTrack(t: FakeMediaStreamTrack) {
    this.tracks = this.tracks.filter((x) => x !== t);
  }
  addEventListener() {}
  removeEventListener() {}
}
global.MediaStream = FakeMediaStream as unknown as typeof MediaStream;

// ── navigator.mediaDevices ───────────────────────────────────────────────────
Object.defineProperty(global.navigator, "mediaDevices", {
  value: {
    getUserMedia: vi.fn().mockResolvedValue(new FakeMediaStream()),
    getDisplayMedia: vi.fn().mockResolvedValue(new FakeMediaStream()),
  },
  writable: true,
});

// ── AudioContext (sounds.ts) ─────────────────────────────────────────────────
const fakeAudioNode = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  frequency: { value: 0 },
  gain: { value: 0 },
};
global.AudioContext = vi.fn().mockImplementation(() => ({
  createOscillator: vi.fn().mockReturnValue(fakeAudioNode),
  createGain: vi.fn().mockReturnValue(fakeAudioNode),
  destination: {},
  currentTime: 0,
})) as unknown as typeof AudioContext;

// ── HTMLCanvasElement (image compression in ChatPanel) ───────────────────────
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  drawImage: vi.fn(),
}) as unknown as typeof HTMLCanvasElement.prototype.getContext;

HTMLCanvasElement.prototype.toDataURL = vi
  .fn()
  .mockReturnValue("data:image/jpeg;base64,fakeImageData");

// ── URL.createObjectURL / revokeObjectURL ────────────────────────────────────
global.URL.createObjectURL = vi.fn().mockReturnValue("blob:fake-url");
global.URL.revokeObjectURL = vi.fn();

// ── DOM methods not in jsdom ─────────────────────────────────────────────────
Element.prototype.scrollIntoView = vi.fn();
