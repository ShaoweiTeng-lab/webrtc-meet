import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { RoomControls } from "@/components/RoomControls";
import { PRESET_BG_OPTIONS } from "@/lib/virtualBgOptions";

const defaultProps = {
  isMuted: false,
  isCameraOff: false,
  isScreenSharing: false,
  virtualBg: null,
  isVirtualBgLoading: false,
  isChatOpen: false,
  unreadCount: 0,
  onToggleMute: vi.fn(),
  onToggleCamera: vi.fn(),
  onToggleScreenShare: vi.fn(),
  onToggleVirtualBg: vi.fn(),
  onToggleChat: vi.fn(),
  onLeave: vi.fn(),
};

describe("RoomControls", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

  it("點靜音按鈕：onToggleMute 被呼叫", () => {
    const onToggleMute = vi.fn();
    render(<RoomControls {...defaultProps} onToggleMute={onToggleMute} />);
    fireEvent.click(screen.getByTitle(/靜音|取消靜音/));
    expect(onToggleMute).toHaveBeenCalledOnce();
  });

  it("點鏡頭按鈕：onToggleCamera 被呼叫", () => {
    const onToggleCamera = vi.fn();
    render(<RoomControls {...defaultProps} onToggleCamera={onToggleCamera} />);
    fireEvent.click(screen.getByTitle(/鏡頭/));
    expect(onToggleCamera).toHaveBeenCalledOnce();
  });

  it("isMuted=true：靜音按鈕背景為紅色", () => {
    render(<RoomControls {...defaultProps} isMuted={true} />);
    const btn = screen.getByTitle("取消靜音");
    expect(btn.className).toContain("bg-[#ea4335]");
  });

  it("isCameraOff=true：鏡頭按鈕背景為紅色", () => {
    render(<RoomControls {...defaultProps} isCameraOff={true} />);
    const btn = screen.getByTitle("開啟鏡頭");
    expect(btn.className).toContain("bg-[#ea4335]");
  });

  it("unreadCount=3：badge 顯示 3", () => {
    render(<RoomControls {...defaultProps} unreadCount={3} isChatOpen={false} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("unreadCount=0：不顯示 badge", () => {
    render(<RoomControls {...defaultProps} unreadCount={0} />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("計時器初始顯示 00:00", () => {
    render(<RoomControls {...defaultProps} />);
    expect(screen.getByText("00:00")).toBeInTheDocument();
  });

  it("1 秒後計時器顯示 00:01", () => {
    render(<RoomControls {...defaultProps} />);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText("00:01")).toBeInTheDocument();
  });

  it("點虛擬背景按鈕：onToggleVirtualBg 被呼叫", () => {
    const onToggleVirtualBg = vi.fn();
    render(<RoomControls {...defaultProps} onToggleVirtualBg={onToggleVirtualBg} />);
    fireEvent.click(screen.getByTitle(/虛擬背景/));
    expect(onToggleVirtualBg).toHaveBeenCalledOnce();
  });

  it("virtualBg 已設定：虛擬背景按鈕顯示綠色（highlight）", () => {
    render(<RoomControls {...defaultProps} virtualBg={PRESET_BG_OPTIONS[0]} />);
    const btn = screen.getByTitle("關閉虛擬背景");
    expect(btn.className).toContain("bg-[#00897b]");
  });

  it("點離開按鈕：onLeave 被呼叫", () => {
    const onLeave = vi.fn();
    render(<RoomControls {...defaultProps} onLeave={onLeave} />);
    fireEvent.click(screen.getAllByTitle("離開通話")[0]);
    expect(onLeave).toHaveBeenCalledOnce();
  });
});
