# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (HTTPS on port 3000, generates self-signed cert)
npm run build    # Next.js production build
npm run start    # Start production server
npm run lint     # ESLint via next lint
npx tsc --noEmit # Type-check without building
```

**Important:** There is no separate `next dev`. The custom server (`server/index.ts`) runs both Next.js and Socket.io on the same HTTPS port. Always use `npm run dev`.

On first load, the browser will show a self-signed cert warning — click "Advanced → Proceed" to continue.

## Architecture

### Server (`server/index.ts`)
A single Node.js process that:
1. Generates a self-signed TLS certificate at startup using `node-forge` (includes all local IPs in SAN so mobile devices on the same Wi-Fi can connect).
2. Serves the Next.js app via HTTPS.
3. Runs Socket.io on the same HTTPS server as the signaling relay.

Room state lives in an in-memory `Map<roomId, { passwordHash, peers: Map<socketId, PeerInfo> }>` — it is not persisted and resets on server restart. The first peer to join a room sets its password hash.

### Signaling flow
All WebRTC signaling goes through Socket.io. The server is a **pure relay** — it never inspects offer/answer SDP. Password is SHA-256 hashed on the client (`src/lib/crypto.ts`) before being sent.

Socket events the server handles: `join-room`, `offer`, `answer`, `ice-candidate`, `chat-message`, `media-toggle`, `renegotiate-offer`, `renegotiate-answer`, `disconnect`.

### `room-joined` race condition and `initialPeers` pattern
`useWebRTC` does **not** listen for the `room-joined` socket event. Instead, `RoomClient` handles `room-joined`, captures the `existingPeers` array, stores it in React state (`initialPeers`), and passes it down as a prop to `useWebRTC`. A separate `useEffect` in `useWebRTC` keyed on `initialPeers` then creates the peer connections.

This split exists because `useWebRTC` receives `socket` as a React state prop — meaning its socket effect runs one render cycle after the socket is set. On mobile, `room-joined` can arrive from the server before that effect mounts, causing the event to be missed. `RoomClient` has a direct reference to the socket object from `getSocket()` so it never misses the event.

### WebRTC (`src/hooks/useWebRTC.ts`)
Implements a **P2P Mesh** topology — every peer opens a direct `RTCPeerConnection` to every other peer. For N peers there are N*(N-1)/2 connections.

Key implementation details:
- **`waitForStream`**: Before sending an offer, the hook polls `localStreamRef` (100ms interval, 5s timeout) because `getUserMedia` may not have resolved yet when `room-joined` fires.
- **iOS Safari `ontrack`**: `event.streams[0]` is empty on iOS. The fallback accumulates tracks into a new `MediaStream` and triggers React state update via `new MediaStream(existing.getTracks())`.
- **Screen sharing**: Uses `replaceTrack` when a video sender already exists (normal case). Falls back to `addTrack` + SDP renegotiation via `renegotiate-offer`/`renegotiate-answer` when no video sender exists. Audio from the screen is mixed with mic audio using the Web Audio API (`AudioContext`). Senders must be collected **before** modifying `localStream` to avoid referencing detached tracks.
- **`onnegotiationneeded` is intentionally absent** — it caused race conditions with the `handleOffer` path and was removed.
- **Camera toggle on mobile**: tracks can reach `readyState === "ended"` after being disabled on some mobile browsers; `toggleCamera` restarts `getUserMedia` in that case and calls `replaceTrack` on all senders.

### Client socket (`src/lib/socket-client.ts`)
A module-level singleton — `getSocket()` creates the socket once and reuses it. The URL is omitted so it connects to whatever origin served the page (works for both `localhost` and LAN IP). `useSocket.ts` exists but is unused — `RoomClient` calls `getSocket()` directly.

### Room page split
`src/app/room/[roomId]/page.tsx` is an async server component (awaits `params`). It wraps `RoomClient` in `<Suspense>` because `RoomClient` calls `useSearchParams()`, which requires a Suspense boundary in Next.js 15 App Router.

### `pinnedId` and screen-share layout
`RoomClient` owns `pinnedId: string | null` state. When anyone is screen sharing (`isScreenSharing` from `useWebRTC`, or any peer's `isScreenSharing` flag), `VideoGrid` switches to a large-main + thumbnail-strip layout. Clicking a thumbnail pins that participant as the main view. `pinnedId` is automatically reset to `null` when no one is sharing (via a `useEffect` watching `anyoneSharing`).

### Sound effects (`src/lib/sounds.ts`)
`playJoinSound` and `playLeaveSound` synthesize chimes using the Web Audio API — no audio files needed. Called from `RoomClient` on `user-joined` / `user-left` socket events.

### Toast notifications (`src/components/Toast.tsx`)
Shown in `RoomClient` when a `chat-message` arrives while the chat panel is closed. Auto-dismisses after 4 seconds. `isChatOpenRef` (a ref kept in sync with `isChatOpen` state) is used inside the socket event handler closure to avoid stale state.

### Mobile chat layout
On mobile (`< sm`), the chat panel renders as an `absolute inset-0` overlay covering the full screen. On desktop (`sm+`), it renders as a `relative w-80` side panel that pushes the video grid left.

### Hydration and browser extensions
`suppressHydrationWarning` is set on `<html>`, `<body>`, all `<form>` and `<input>` elements, and on Lucide icon components that appear in SSR'd pages. This suppresses mismatches injected by Dark Reader and Chrome's password manager before React hydrates.

### Styling
Tailwind CSS v4 (`@import "tailwindcss"` in `globals.css`). Arbitrary values (`bg-[#202124]`) are used throughout to match the Google Meet color palette:
- Main background: `#202124`
- Tile / surface: `#3c4043`
- Blue accent: `#8ab4f8`
- Danger / muted: `#ea4335`

Custom animation classes (`animate-slide-up`, `animate-slide-in-right`, `animate-fade-in`) are defined in `globals.css` and used for the chat panel slide-in and toast notification.

### `tsconfig.json`
The `server/` directory is excluded from Next.js type-checking to avoid conflicts between Node.js and browser types. The server is compiled at runtime by `tsx`.
