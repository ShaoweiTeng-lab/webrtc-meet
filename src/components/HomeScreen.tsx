"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Shuffle, ArrowRight, Plus } from "lucide-react";
import { hashPassword } from "@/lib/crypto";
import { cn } from "@/lib/utils";

export function HomeScreen() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !roomId.trim()) return;
    setLoading(true);
    const passwordHash = await hashPassword(password);
    const params = new URLSearchParams({ username: username.trim(), passwordHash });
    router.push(`/room/${encodeURIComponent(roomId.trim())}?${params}`);
  };

  const generateRoomId = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz";
    const seg = () =>
      Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    setRoomId(`${seg()}-${seg()}-${seg()}`);
  };

  return (
    <div className="h-full overflow-y-auto bg-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="3" width="10" height="10" rx="1.5" fill="white" />
              <path d="M11 6l4-2.5v9L11 10V6z" fill="white" fillOpacity="0.8" />
            </svg>
          </div>
          <span className="font-semibold text-gray-900 text-sm">WebRTC Meet</span>
        </div>
        <span className="text-xs text-gray-400 font-medium">點對點加密</span>
      </header>

      {/* Main */}
      <main className="flex flex-1 flex-col md:flex-row items-center justify-center gap-16 px-8 py-14 max-w-5xl mx-auto w-full">
        {/* Left: Hero */}
        <div className="flex-1 max-w-md space-y-7 text-center md:text-left">
          <div className="space-y-4">
            <h1 className="text-[2.5rem] font-bold text-gray-900 leading-[1.2] tracking-tight">
              即時視訊通話，<br />無需帳號
            </h1>
            <p className="text-gray-500 text-base leading-relaxed">
              透過瀏覽器直接建立 P2P 連線。<br />
              所有資料點對點傳輸，不經過伺服器儲存。
            </p>
          </div>

          <div className="flex flex-col gap-3 items-center md:items-start">
            {[
              { color: "bg-blue-500", text: "P2P 直連 · 資料不經伺服器" },
              { color: "bg-green-500", text: "房間密碼保護 · 安全可靠" },
              { color: "bg-purple-500", text: "無需安裝 · 跨裝置使用" },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-2.5">
                <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", f.color)} />
                <span className="text-sm text-gray-600">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Form card */}
        <div className="w-full max-w-sm">
          <div className="border border-gray-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-gray-900 text-sm font-semibold mb-5">加入或建立會議</h2>

            <form onSubmit={handleJoin} className="space-y-3.5" suppressHydrationWarning>
              {/* Username */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600 block" htmlFor="username">
                  你的名稱
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="輸入名稱"
                  required
                  maxLength={20}
                  suppressHydrationWarning
                  className="w-full h-10 rounded-xl border border-gray-200 bg-gray-50 px-6 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:ring-3 focus:ring-blue-100 transition-all"
                />
              </div>

              {/* Room ID */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600 block" htmlFor="roomId">
                  會議代碼
                </label>
                <div className="relative">
                  <input
                    id="roomId"
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    placeholder="輸入或產生代碼"
                    required
                    maxLength={30}
                    suppressHydrationWarning
                    className="w-full h-10 rounded-xl border border-gray-200 bg-gray-50 px-6 pr-10 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:ring-3 focus:ring-blue-100 transition-all"
                  />
                  <button
                    type="button"
                    onClick={generateRoomId}
                    title="隨機產生"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-500 transition-colors"
                  >
                    <Shuffle className="w-4 h-4" suppressHydrationWarning />
                  </button>
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-600 block" htmlFor="password">
                  密碼 <span className="text-gray-400 font-normal">（選填）</span>
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="設定房間密碼"
                    maxLength={50}
                    suppressHydrationWarning
                    className="w-full h-10 rounded-xl border border-gray-200 bg-gray-50 px-6 pr-10 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:ring-3 focus:ring-blue-100 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" suppressHydrationWarning />
                    ) : (
                      <Eye className="w-4 h-4" suppressHydrationWarning />
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-gray-400">
                  第一位進入者設定密碼，後續加入者須輸入相同密碼
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !username.trim() || !roomId.trim()}
                className={cn(
                  "w-full h-10 rounded-xl text-sm font-semibold transition-all duration-150 flex items-center justify-center gap-2 mt-1",
                  "bg-blue-600 text-white",
                  "hover:bg-blue-700 active:scale-[0.98]",
                  "disabled:opacity-40 disabled:cursor-not-allowed"
                )}
              >
                {loading ? (
                  "連接中..."
                ) : (
                  <>
                    加入會議
                    <ArrowRight className="w-4 h-4" suppressHydrationWarning />
                  </>
                )}
              </button>
            </form>

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-gray-400 text-xs">或</span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            <button
              type="button"
              onClick={generateRoomId}
              className={cn(
                "w-full h-10 rounded-xl text-sm font-medium transition-all duration-150",
                "border border-gray-200 text-gray-700 bg-white",
                "hover:bg-gray-50 hover:border-gray-300 active:scale-[0.98]",
                "flex items-center justify-center gap-2"
              )}
            >
              <Plus className="w-4 h-4" suppressHydrationWarning />
              建立新會議
            </button>
          </div>
        </div>
      </main>

      <footer className="text-center text-gray-400 text-xs py-4 border-t border-gray-100 shrink-0">
        WebRTC Meet · 點對點加密傳輸 · 無需帳號
      </footer>
    </div>
  );
}
