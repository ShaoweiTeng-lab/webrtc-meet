export type BlurBg  = { id: "blur-light" | "blur-strong"; type: "blur";  label: string; radius: number };
export type ColorBg = { id: string; type: "color"; label: string; color: string };
export type ImageBg = { id: string; type: "image"; label: string; src: string };
export type PresetBg = BlurBg | ColorBg | ImageBg;

export const PRESET_BG_OPTIONS: readonly PresetBg[] = [
  { id: "blur-light",    type: "blur",  label: "輕微模糊", radius: 8  },
  { id: "blur-strong",   type: "blur",  label: "強力模糊", radius: 20 },
  { id: "img-office-1",  type: "image", label: "辦公室 1", src: "/backgrounds/office-1.jpg" },
  { id: "img-office-2",  type: "image", label: "辦公室 2", src: "/backgrounds/office-2.jpg" },
  { id: "img-beach-1",   type: "image", label: "海邊 1",   src: "/backgrounds/beach-1.jpg"  },
  { id: "img-beach-2",   type: "image", label: "海邊 2",   src: "/backgrounds/beach-2.jpg"  },
  { id: "color-space",   type: "color", label: "太空黑",   color: "#0d0d0d" },
  { id: "color-ocean",   type: "color", label: "深海藍",   color: "#03045e" },
  { id: "color-forest",  type: "color", label: "森林綠",   color: "#1b4332" },
  { id: "color-purple",  type: "color", label: "星空紫",   color: "#1a0533" },
  { id: "color-studio",  type: "color", label: "工作室",   color: "#1f2937" },
  { id: "color-warm",    type: "color", label: "咖啡棕",   color: "#3d1f00" },
] as const;
