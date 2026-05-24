# WebRTC Meet — Product Requirements Document

> 最後更新：2026-05-24

---

## 1. 產品概述

**WebRTC Meet** 是一個瀏覽器原生的多人視訊通話應用程式，基於 WebRTC P2P（點對點）技術，無需帳號、無需安裝，所有媒體串流直接在用戶之間傳輸，不經過伺服器儲存。

### 核心定位
- **私密**：媒體流不經過伺服器，密碼 SHA-256 雜湊後才傳送
- **即開即用**：輸入名稱和會議代碼即可加入
- **跨裝置**：支援桌機、手機、平板；自簽 TLS 憑證含所有 LAN IP（SAN），支援同一 Wi-Fi 下行動裝置連線

---

## 2. 技術架構

| 層級 | 技術 |
|------|------|
| 前端框架 | Next.js 15 App Router（React Server Components + Client Components）|
| 信令伺服器 | Socket.io（純轉發，不inspect SDP）|
| 媒體傳輸 | WebRTC P2P Mesh（N*(N-1)/2 連線）|
| TLS | node-forge 自簽憑證，含所有本地 IP 的 SAN |
| 樣式 | Tailwind CSS v4 |
| 執行環境 | Node.js + tsx（server/ 目錄）|

### 伺服器架構（`server/index.ts`）
單一 Node.js 行程同時提供：
1. HTTPS（含 Next.js App）
2. Socket.io 信令（同 port）

房間狀態為記憶體內 `Map<roomId, { passwordHash, peers }>`，重啟後清空。

---

## 3. 功能清單

### ✅ 已實作

#### 3.1 首頁（HomeScreen）
- 輸入名稱、會議代碼、選填密碼
- 隨機產生會議代碼（xxx-xxx-xxx 格式）
- 「建立新會議」快捷按鈕（自動產生代碼）
- 響應式版面（手機/桌機）

#### 3.2 會議室

**媒體控制**
- 靜音 / 取消靜音（麥克風）
- 關閉 / 開啟鏡頭
- 螢幕分享（`replaceTrack` 優先，fallback `addTrack` + SDP 重新協商）
- 螢幕分享時混合麥克風音訊（Web Audio API）

**視訊格子（VideoGrid）**
- 1 人：大圖置中
- 2 人：並排 2 欄
- 3 人：桌機 2+1 佈局（本地佔整行），手機垂直堆疊
- 4 人：2x2 格子
- 5+ 人：手機 2 欄、桌機 3 欄
- 螢幕分享時切換為「主畫面 + 縮圖條」佈局，支援點擊固定主畫面

**聊天面板（ChatPanel）**
- 即時文字訊息（Socket.io 廣播）
- **圖片分享**：本地上傳（圖片按鈕）或貼上（Ctrl+V）
- 圖片傳送前自動壓縮（Canvas API，最大 1200px，JPEG 0.8）
- 點擊圖片開啟燈箱（全螢幕預覽）
- 訊息氣泡（自己藍色 / 對方灰色）
- 表情符號選擇器（40 個）
- 未讀訊息計數 badge
- 新訊息 toast 通知（聊天面板關閉時）

**虛擬背景（Virtual Background）**
- 背景模糊（MediaPipe Selfie Segmentation，從 CDN 動態載入）
- Canvas API 即時合成：人像清晰、背景 16px blur
- 輸出透過 `canvas.captureStream(30)` 替換 WebRTC 視訊 track（遠端可見）
- 開啟螢幕分享或關閉鏡頭時自動停用
- 控制列 ✨ 按鈕切換，啟用時顯示綠色（`highlight` 樣式）

**房間控制列（RoomControls）**
- 圓形控制按鈕：靜音、鏡頭、螢幕分享、虛擬背景、聊天
- 通話計時器（桌機顯示）
- 離開通話按鈕

**其他**
- 加入/離開音效（Web Audio API 合成，無需音訊檔）
- 房間密碼保護（錯誤密碼顯示錯誤畫面）
- 連線中 loading 畫面
- 媒體權限錯誤提示橫幅

#### 3.3 行動裝置支援
- iOS Safari `ontrack` fallback（累積 tracks 到新 MediaStream）
- 鏡頭 toggle 在行動裝置上重新啟動 `getUserMedia`（tracks 可能 `readyState === "ended"`）
- 聊天面板在手機上為全螢幕 overlay，桌機為右側側欄

---

## 4. 已知限制 / 待改善

| 項目 | 說明 |
|------|------|
| P2P Mesh 擴展性 | 超過 6 人頻寬消耗大（N² 連線），未實作 SFU |
| 房間持久性 | 伺服器重啟後房間狀態消失 |
| 無錄影功能 | 目前無法錄製會議 |
| 虛擬背景限制 | 需從 CDN 下載 ML 模型（首次啟用約 2–3 秒載入），離線環境無法使用 |
| 無白板/共享文件 | 僅支援螢幕分享 |

---

## 5. UI 設計規範

### 色彩系統

**首頁（白色主題）**
- 背景：`#ffffff`
- 邊框：`#e5e7eb`（gray-200）
- 主要文字：`#111827`（gray-900）
- 次要文字：`#6b7280`（gray-500）
- 藍色 accent：`#2563eb`（blue-600）

**通話室（深色主題）**
- 背景：`#202124`
- Tile 背景：`#18191c`
- 控制列背景：`#111213`
- 聊天面板：`#ffffff`（白色，與深色影像區形成對比）

**頭像顏色**（依用戶名稱 hash 決定）
`#3b82f6` / `#10b981` / `#f59e0b` / `#ef4444` / `#8b5cf6` / `#ec4899` / `#06b6d4` / `#f97316`

### 元件規格
- 輸入框圓角：`rounded-xl`（12px）
- 卡片圓角：`rounded-2xl`（16px）
- Tile 圓角：`rounded-2xl`
- 動畫：`slide-up`（toast）、`slide-in-right`（聊天面板）

---

## 6. 主要信令流程

```
Client A                 Server               Client B
   │                        │                      │
   ├── join-room ──────────►│                      │
   │◄─ room-joined ─────────┤                      │
   │  (existingPeers: [])   │                      │
   │                        │                      │
   │                        │◄── join-room ────────┤
   │◄─ user-joined ─────────┤                      │
   │                        ├── user-joined ──────►│
   │                        ├── room-joined ──────►│
   │                        │   (existingPeers: [A])|
   │                        │                      │
   ├── offer ──────────────►│                      │
   │                        ├── offer ────────────►│
   │                        │◄── answer ───────────┤
   │◄─ answer ──────────────┤                      │
   │   [ICE candidates exchange]                   │
   │◄══════════ P2P 直連建立 ═════════════════════►│
```

---

## 7. 已解決的架構問題

| 問題 | 解法 |
|------|------|
| `room-joined` 在行動裝置上早於 socket effect 到達 | `RoomClient` 直接監聽事件，傳 `initialPeers` prop 給 `useWebRTC` |
| `onnegotiationneeded` 與 `handleOffer` 路徑衝突 | 完全移除 `onnegotiationneeded`，改用明確的 `renegotiate-offer`/`renegotiate-answer` 事件 |
| iOS Safari `ontrack` 回傳空 `streams[0]` | 手動累積 tracks 到新 `MediaStream` |
| `getUserMedia` 尚未 resolve 就送出 offer | `waitForStream` polling（100ms interval，5s timeout）|
| Dark Reader / 密碼管理器造成 SSR hydration mismatch | `suppressHydrationWarning` 加在 `<html>`、`<body>`、表單元素、Lucide icon |
