"use client";

import { useRef } from "react";
import { X, Upload, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRESET_BG_OPTIONS, type PresetBg, type BlurBg, type ColorBg } from "@/lib/virtualBgOptions";

const blurOptions = PRESET_BG_OPTIONS.filter((o): o is BlurBg  => o.type === "blur");
const colorOptions = PRESET_BG_OPTIONS.filter((o): o is ColorBg => o.type === "color");

function Checkmark() {
  return (
    <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-[#8ab4f8] flex items-center justify-center">
      <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-[#202124]" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M2 6l3 3 5-5" />
      </svg>
    </div>
  );
}

function Tile({
  selected,
  onClick,
  title,
  children,
  className,
  style,
}: {
  selected: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      onClick={onClick}
      title={title}
      style={style}
      className={cn(
        "relative aspect-video rounded-lg cursor-pointer overflow-hidden border-2 transition-colors",
        selected ? "border-[#8ab4f8]" : "border-transparent hover:border-white/30",
        className
      )}
    >
      {children}
      {selected && <Checkmark />}
    </div>
  );
}

interface VirtualBgPanelProps {
  activeBg: PresetBg | null;
  isLoading: boolean;
  onSelect: (option: PresetBg | null) => void;
  onClose: () => void;
}

export function VirtualBgPanel({ activeBg, isLoading, onSelect, onClose }: VirtualBgPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const src = URL.createObjectURL(file);
    onSelect({ id: `custom-${Date.now()}`, type: "image", label: "自訂", src });
    e.target.value = "";
  };

  return (
    <div className="bg-[#2d2e30] rounded-2xl p-4 w-72 shadow-2xl border border-white/[0.08]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[#e8eaed] text-sm font-semibold">虛擬背景</span>
        <button onClick={onClose} className="text-[#9aa0a6] hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex items-center gap-2 text-[#9aa0a6] text-xs mb-3 bg-white/5 rounded-lg px-3 py-2">
          <div className="w-3 h-3 border-2 border-[#8ab4f8] border-t-transparent rounded-full animate-spin shrink-0" />
          <span>載入 AI 模型中，請稍候...</span>
        </div>
      )}

      {/* Off */}
      <section className="mb-4">
        <p className="text-[#9aa0a6] text-[10px] uppercase tracking-wider mb-2">關閉效果</p>
        <div className="grid grid-cols-3 gap-2">
          <Tile selected={activeBg === null} onClick={() => onSelect(null)} title="關閉虛擬背景"
            className="bg-[#3c4043]">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
              <X className="w-4 h-4 text-white/50" />
              <span className="text-[9px] text-white/40">關閉</span>
            </div>
          </Tile>
        </div>
      </section>

      {/* Blur */}
      <section className="mb-4">
        <p className="text-[#9aa0a6] text-[10px] uppercase tracking-wider mb-2">模糊背景</p>
        <div className="grid grid-cols-3 gap-2">
          {blurOptions.map((opt) => (
            <Tile key={opt.id} selected={activeBg?.id === opt.id} onClick={() => onSelect(opt)} title={opt.label}
              className="bg-[#3c4043]">
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                <Camera
                  className="w-5 h-5 text-white/60"
                  style={{ filter: `blur(${opt.radius / 5}px)` }}
                />
                <span className="text-[9px] text-white/40">{opt.label}</span>
              </div>
            </Tile>
          ))}
        </div>
      </section>

      {/* Colors */}
      <section className="mb-4">
        <p className="text-[#9aa0a6] text-[10px] uppercase tracking-wider mb-2">純色背景</p>
        <div className="grid grid-cols-4 gap-2">
          {colorOptions.map((opt) => (
            <Tile key={opt.id} selected={activeBg?.id === opt.id} onClick={() => onSelect(opt)} title={opt.label}
              style={{ backgroundColor: opt.color }}>
              <div />
            </Tile>
          ))}
        </div>
      </section>

      {/* Custom upload */}
      <section>
        <p className="text-[#9aa0a6] text-[10px] uppercase tracking-wider mb-2">自訂圖片</p>
        <label
          className={cn(
            "relative aspect-video w-16 rounded-lg cursor-pointer overflow-hidden border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors bg-[#3c4043]",
            activeBg?.type === "image" ? "border-[#8ab4f8] border-solid" : "border-white/20 hover:border-white/40"
          )}
        >
          <Upload className="w-3.5 h-3.5 text-white/50" />
          <span className="text-[9px] text-white/40">上傳</span>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          {activeBg?.type === "image" && <Checkmark />}
        </label>
      </section>
    </div>
  );
}
