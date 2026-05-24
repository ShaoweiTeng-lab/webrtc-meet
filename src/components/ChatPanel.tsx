"use client";

import { useEffect, useRef, useState } from "react";
import { Send, X, Smile, MessageSquare, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  fromId: string;
  username: string;
  message: string;
  timestamp: number;
  imageData?: string;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (message: string, imageData?: string) => void;
  onClose: () => void;
  currentSocketId: string;
}

const EMOJIS = [
  "😀","😂","🥰","😎","🤔","😮","😢","😡","🤣","😊",
  "😍","🥺","😄","😅","😇","🤗","😋","😏","😴","🫠",
  "👍","👎","❤️","🔥","💯","✅","🎉","🙏","💪","⭐",
  "👋","🤝","✌️","🤞","💬","💡","🎵","🚀","🎯","🌟",
];

async function compressImage(blob: Blob): Promise<string | null> {
  if (blob.size > 20 * 1024 * 1024) return null; // reject > 20 MB
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX_PX = 1200;
      let { naturalWidth: w, naturalHeight: h } = img;
      const ratio = Math.min(MAX_PX / w, MAX_PX / h, 1);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

export function ChatPanel({
  messages,
  onSend,
  onClose,
  currentSocketId,
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!showEmoji) return;
    const handler = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmoji(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showEmoji]);

  const handleSend = () => {
    if (!input.trim() && !pendingImage) return;
    onSend(input.trim(), pendingImage ?? undefined);
    setInput("");
    setPendingImage(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const insertEmoji = (emoji: string) => {
    const el = inputRef.current;
    if (!el) { setInput((v) => v + emoji); return; }
    const start = el.selectionStart ?? input.length;
    const end = el.selectionEnd ?? input.length;
    setInput(input.slice(0, start) + emoji + input.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const imageItem = Array.from(e.clipboardData.items).find((it) =>
      it.type.startsWith("image/")
    );
    if (!imageItem) return;
    e.preventDefault();
    const blob = imageItem.getAsFile();
    if (!blob) return;
    const compressed = await compressImage(blob);
    if (compressed) setPendingImage(compressed);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const compressed = await compressImage(file);
    if (compressed) setPendingImage(compressed);
  };

  const canSend = !!(input.trim() || pendingImage);

  return (
    <>
      <div className="flex flex-col w-full h-full bg-white" onPaste={handlePaste}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 shrink-0">
          <h2 className="text-gray-900 text-sm font-semibold">通話訊息</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" suppressHydrationWarning />
          </button>
        </div>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                <MessageSquare className="w-5 h-5 text-gray-400" suppressHydrationWarning />
              </div>
              <div>
                <p className="text-gray-500 text-sm font-medium">還沒有訊息</p>
                <p className="text-gray-400 text-xs mt-1">通話結束後訊息將消失</p>
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            const isOwn = msg.fromId === currentSocketId;
            const hasImage = !!msg.imageData;
            const hasText = !!msg.message;
            return (
              <div key={i} className={cn("flex flex-col gap-1", isOwn && "items-end")}>
                {/* Sender name + time */}
                <div className={cn("flex items-baseline gap-1.5", isOwn && "flex-row-reverse")}>
                  <span className="text-xs font-medium text-gray-700">
                    {isOwn ? "你" : msg.username}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {new Date(msg.timestamp).toLocaleTimeString("zh-TW", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {/* Image bubble */}
                {hasImage && (
                  <button
                    onClick={() => setLightboxSrc(msg.imageData!)}
                    className={cn(
                      "max-w-[240px] overflow-hidden rounded-2xl cursor-pointer",
                      "hover:opacity-90 active:opacity-80 transition-opacity",
                      isOwn ? "rounded-tr-sm" : "rounded-tl-sm"
                    )}
                  >
                    <img
                      src={msg.imageData}
                      alt="圖片"
                      className="w-full h-auto block"
                    />
                  </button>
                )}

                {/* Text bubble */}
                {hasText && (
                  <div
                    className={cn(
                      "max-w-[85%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed",
                      isOwn
                        ? "bg-blue-600 text-white rounded-tr-sm"
                        : "bg-white text-gray-800 rounded-tl-sm border border-gray-100 shadow-sm"
                    )}
                  >
                    {msg.message}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Emoji picker */}
        {showEmoji && (
          <div ref={emojiRef} className="border-t border-gray-100 bg-white p-3 shrink-0">
            <div className="grid grid-cols-10 gap-1">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => insertEmoji(emoji)}
                  className="text-xl p-1.5 rounded-lg hover:bg-gray-100 transition-colors leading-none"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Image preview */}
        {pendingImage && (
          <div className="px-3 pb-1 pt-2 border-t border-gray-100 bg-white shrink-0">
            <div className="relative inline-block">
              <img
                src={pendingImage}
                alt="預覽"
                className="max-h-28 max-w-full rounded-xl border border-gray-200 object-cover"
              />
              <button
                onClick={() => setPendingImage(null)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-800 hover:bg-gray-700 text-white rounded-full flex items-center justify-center shadow"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="px-3 py-3 border-t border-gray-100 bg-white shrink-0">
          <div className="flex gap-1.5 items-center">
            {/* Emoji */}
            <button
              onClick={() => setShowEmoji((v) => !v)}
              className={cn(
                "shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                showEmoji
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              )}
            >
              <Smile className="w-4 h-4" suppressHydrationWarning />
            </button>

            {/* Image upload */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title="傳送圖片（也可直接貼上）"
            >
              <ImageIcon className="w-4 h-4" suppressHydrationWarning />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Text input */}
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={pendingImage ? "加上說明文字（選填）" : "傳送訊息，或貼上圖片"}
              className="flex-1 bg-gray-100 text-gray-900 rounded-full px-6 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200 focus:bg-white border border-transparent focus:border-blue-300 placeholder:text-gray-400 transition-all"
            />

            {/* Send */}
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="w-8 h-8 bg-blue-600 hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-full flex items-center justify-center transition-colors shrink-0"
            >
              <Send className="w-3.5 h-3.5" suppressHydrationWarning />
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-6 animate-fade-in"
          onClick={() => setLightboxSrc(null)}
        >
          <img
            src={lightboxSrc}
            alt="圖片"
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightboxSrc(null)}
            className="absolute top-4 right-4 w-9 h-9 bg-white/15 hover:bg-white/25 rounded-full flex items-center justify-center text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  );
}
