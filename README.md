# WebRTC Meet

瀏覽器原生的多人視訊通話應用。P2P 直連、無需帳號、即開即用。

---

## 功能

- **視訊 / 音訊通話** — 多人同時通話（P2P Mesh）
- **螢幕分享** — 支援混合麥克風音訊
- **聊天室** — 即時文字訊息 + 表情符號
- **房間密碼** — SHA-256 雜湊保護，密碼不傳伺服器
- **行動裝置** — 支援 iOS Safari、Android Chrome，同 Wi-Fi 下可用 LAN IP 連線
- **點對點加密** — 媒體流不經過伺服器

## 技術棧

| 項目 | 版本 |
|------|------|
| Next.js | 15 (App Router) |
| React | 19 |
| Socket.io | 4.8 |
| Tailwind CSS | v4 |
| node-forge | 1.4（自簽 TLS）|

---

## 快速開始

### 環境需求

- Node.js 18+
- npm 9+

### 安裝與啟動

```bash
# 安裝依賴
npm install

# 啟動開發伺服器（HTTPS，port 3000）
npm run dev
```

開啟 `https://localhost:3000`，瀏覽器會顯示自簽憑證警告，點擊「進階 → 繼續前往」即可。

### 同一 Wi-Fi 的行動裝置連線

伺服器啟動時會自動偵測所有本機 IP 並加入憑證 SAN，只需用手機開啟 `https://<你的電腦 IP>:3000` 即可。

### 其他指令

```bash
npm run build    # 正式環境建置
npm run start    # 啟動正式伺服器
npm run lint     # ESLint 檢查
npx tsc --noEmit # 型別檢查
```

---

## 架構說明

### 伺服器（`server/index.ts`）

單一 Node.js 行程，同時提供 HTTPS 和 Socket.io 信令服務。

- 啟動時用 `node-forge` 生成自簽 TLS 憑證（含所有本機 IP 的 SAN）
- Socket.io 為**純轉發**，不儲存 SDP、不儲存媒體
- 房間狀態存於記憶體，重啟後清空

### WebRTC 拓撲

**P2P Mesh**：每個人與其他所有人直連，N 人通話有 N(N-1)/2 條連線。

```
A ─── B
│ ╲ ╱ │
│  ╳  │
│ ╱ ╲ │
C ─── D
```

### 信令流程

```
加入者A        伺服器        加入者B
   │── join-room ──►│              │
   │◄─ room-joined ─┤              │
   │                │◄─ join-room ─┤
   │◄─ user-joined ─┤              │
   │── offer ───────►──────────────►│
   │◄──────────── answer ───────────┤
   │      [ICE candidates 交換]     │
   │◄══════ P2P 直連媒體串流 ════════►│
```

---

## 目錄結構

```
.
├── server/
│   └── index.ts          # 自訂 HTTPS + Socket.io 伺服器
├── src/
│   ├── app/
│   │   ├── page.tsx               # 首頁
│   │   ├── layout.tsx
│   │   └── room/[roomId]/
│   │       ├── page.tsx           # 房間頁（Server Component）
│   │       └── RoomClient.tsx     # 房間主元件（Client）
│   ├── components/
│   │   ├── HomeScreen.tsx         # 首頁 UI
│   │   ├── VideoGrid.tsx          # 影像格子佈局
│   │   ├── VideoTile.tsx          # 單個影像格
│   │   ├── RoomControls.tsx       # 底部控制列
│   │   ├── ChatPanel.tsx          # 聊天側面板
│   │   └── Toast.tsx              # 新訊息 toast
│   ├── hooks/
│   │   └── useWebRTC.ts           # WebRTC 核心 hook
│   └── lib/
│       ├── socket-client.ts       # Socket.io 單例
│       ├── crypto.ts              # SHA-256 密碼雜湊
│       └── sounds.ts              # Web Audio API 音效
├── PRD.md                         # 產品需求文件
└── CLAUDE.md                      # AI 協作指引
```

---

## 已知限制

- **超過 6 人**效能下降（P2P Mesh 頻寬隨人數平方增長）
- **伺服器重啟**後房間歷史消失
- 無錄影、虛擬背景、白板功能

## 授權

MIT
