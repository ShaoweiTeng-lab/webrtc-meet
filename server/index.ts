import { createServer } from "https";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import forge from "node-forge";
import os from "os";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev });
const handle = app.getRequestHandler();

interface PeerInfo {
  socketId: string;
  username: string;
  audioOn: boolean;
  videoOn: boolean;
  isScreenSharing: boolean;
}

interface RoomState {
  passwordHash: string;
  peers: Map<string, PeerInfo>;
}

const rooms = new Map<string, RoomState>();

function getLocalIPs(): string[] {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const iface of Object.values(interfaces)) {
    for (const addr of iface ?? []) {
      if (addr.family === "IPv4" && !addr.internal) ips.push(addr.address);
    }
  }
  return ips;
}

function generateCert(localIPs: string[]) {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

  const attrs = [{ name: "commonName", value: "localhost" }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    {
      name: "subjectAltName",
      altNames: [
        { type: 2, value: "localhost" },
        { type: 7, ip: "127.0.0.1" },
        ...localIPs.map((ip) => ({ type: 7, ip })),
      ],
    },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  return {
    key: forge.pki.privateKeyToPem(keys.privateKey),
    cert: forge.pki.certificateToPem(cert),
  };
}

const localIPs = getLocalIPs();

console.log("\n🔐 正在產生 HTTPS 憑證，請稍候...");
const { key, cert } = generateCert(localIPs);

app.prepare().then(() => {
  const httpsServer = createServer({ key, cert }, (req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpsServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    maxHttpBufferSize: 8 * 1024 * 1024, // 8 MB — accommodates compressed image base64
  });

  io.on("connection", (socket) => {
    let currentRoom: string | null = null;
    let currentUsername: string | null = null;

    socket.on(
      "join-room",
      ({ roomId, username, passwordHash }: { roomId: string; username: string; passwordHash: string }) => {
        const room = rooms.get(roomId);
        if (room) {
          if (room.passwordHash !== passwordHash) {
            socket.emit("room-error", { message: "密碼錯誤" });
            return;
          }
        } else {
          rooms.set(roomId, { passwordHash, peers: new Map() });
        }

        const targetRoom = rooms.get(roomId)!;
        currentRoom = roomId;
        currentUsername = username;

        socket.emit("room-joined", { existingPeers: Array.from(targetRoom.peers.values()) });
        targetRoom.peers.set(socket.id, { socketId: socket.id, username, audioOn: true, videoOn: true, isScreenSharing: false });
        socket.join(roomId);
        socket.to(roomId).emit("user-joined", { socketId: socket.id, username });
      }
    );

    socket.on("offer", ({ targetId, offer }: { targetId: string; offer: unknown }) => {
      io.to(targetId).emit("offer", { fromId: socket.id, fromUsername: currentUsername, offer });
    });

    socket.on("answer", ({ targetId, answer }: { targetId: string; answer: unknown }) => {
      io.to(targetId).emit("answer", { fromId: socket.id, answer });
    });

    socket.on("ice-candidate", ({ targetId, candidate }: { targetId: string; candidate: unknown }) => {
      io.to(targetId).emit("ice-candidate", { fromId: socket.id, candidate });
    });

    socket.on("chat-message", ({ message, imageData }: { message: string; imageData?: string }) => {
      if (!currentRoom || !currentUsername) return;
      io.to(currentRoom).emit("chat-message", {
        fromId: socket.id,
        username: currentUsername,
        message,
        imageData,
        timestamp: Date.now(),
      });
    });

    socket.on("media-toggle", ({ audioOn, videoOn, isScreenSharing }: { audioOn: boolean; videoOn: boolean; isScreenSharing?: boolean }) => {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (room) {
        const peer = room.peers.get(socket.id);
        if (peer) {
          peer.audioOn = audioOn;
          peer.videoOn = videoOn;
          peer.isScreenSharing = isScreenSharing ?? peer.isScreenSharing;
        }
      }
      socket.to(currentRoom).emit("media-toggle", { fromId: socket.id, audioOn, videoOn, isScreenSharing });
    });

    // Renegotiation relay (needed when addTrack is used for screen share)
    socket.on("renegotiate-offer", ({ targetId, offer }: { targetId: string; offer: unknown }) => {
      io.to(targetId).emit("renegotiate-offer", { fromId: socket.id, offer });
    });

    socket.on("renegotiate-answer", ({ targetId, answer }: { targetId: string; answer: unknown }) => {
      io.to(targetId).emit("renegotiate-answer", { fromId: socket.id, answer });
    });

    socket.on("disconnect", () => {
      if (currentRoom) {
        const room = rooms.get(currentRoom);
        if (room) {
          room.peers.delete(socket.id);
          if (room.peers.size === 0) rooms.delete(currentRoom);
        }
        socket.to(currentRoom).emit("user-left", { socketId: socket.id });
      }
    });
  });

  httpsServer.listen(port, () => {
    console.log(`\n✅ WebRTC Meet 已啟動！\n`);
    console.log(`💻 電腦：https://localhost:${port}`);
    localIPs.forEach((ip) => {
      console.log(`📱 手機（同 WiFi）：https://${ip}:${port}`);
    });
    console.log(`\n⚠️  第一次開啟會有安全性警告，點「進階」→「繼續前往」即可\n`);
  });
});
