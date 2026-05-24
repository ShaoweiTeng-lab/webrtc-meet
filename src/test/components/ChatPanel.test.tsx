import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatPanel } from "@/components/ChatPanel";

const SOCKET_A = "socket-a";
const SOCKET_B = "socket-b";

const baseMsg = (overrides = {}) => ({
  fromId: SOCKET_B,
  username: "Bob",
  message: "Hello",
  timestamp: Date.now(),
  ...overrides,
});

function setup(props: Partial<Parameters<typeof ChatPanel>[0]> = {}) {
  return render(
    <ChatPanel
      messages={[]}
      onSend={vi.fn()}
      onClose={vi.fn()}
      currentSocketId={SOCKET_A}
      {...props}
    />
  );
}

describe("ChatPanel", () => {
  it("無訊息時顯示空白提示", () => {
    setup();
    expect(screen.getByText("還沒有訊息")).toBeInTheDocument();
  });

  it("輸入為空時傳送按鈕 disabled", () => {
    setup();
    // 最後一個 button 是 send（有 disabled 屬性）
    const sendBtns = screen.getAllByRole("button");
    const sendBtn = sendBtns[sendBtns.length - 1];
    expect(sendBtn).toBeDisabled();
  });

  it("輸入文字後按 Enter：onSend 被呼叫", async () => {
    const onSend = vi.fn();
    setup({ onSend });
    const input = screen.getByPlaceholderText(/傳送訊息/);
    await userEvent.type(input, "Hi there{Enter}");
    expect(onSend).toHaveBeenCalledWith("Hi there", undefined);
  });

  it("輸入文字後點傳送按鈕：onSend 被呼叫", async () => {
    const onSend = vi.fn();
    setup({ onSend });
    const input = screen.getByPlaceholderText(/傳送訊息/);
    await userEvent.type(input, "Hello");
    const sendBtns = screen.getAllByRole("button");
    fireEvent.click(sendBtns[sendBtns.length - 1]);
    expect(onSend).toHaveBeenCalledWith("Hello", undefined);
  });

  it("自己的訊息靠右（bg-blue-600）", () => {
    setup({ messages: [baseMsg({ fromId: SOCKET_A, username: "你" })] });
    const bubble = screen.getByText("Hello").closest("div");
    expect(bubble?.className).toContain("bg-blue-600");
  });

  it("對方訊息靠左（bg-white）", () => {
    setup({ messages: [baseMsg()] });
    const bubble = screen.getByText("Hello").closest("div");
    expect(bubble?.className).toContain("bg-white");
  });

  it("點 header 的關閉按鈕：onClose 被呼叫", () => {
    const onClose = vi.fn();
    setup({ onClose });
    // Header 裡有 w-7 h-7 的關閉按鈕
    const closeBtn = document.querySelector("button.w-7") as HTMLElement;
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it("有圖片訊息：img 顯示在氣泡中", () => {
    setup({ messages: [baseMsg({ imageData: "data:image/jpeg;base64,abc" })] });
    const img = screen.getByRole("img", { name: "圖片" });
    expect(img).toBeInTheDocument();
    expect(img.getAttribute("src")).toBe("data:image/jpeg;base64,abc");
  });

  it("點圖片：燈箱（fixed overlay）打開", async () => {
    setup({ messages: [baseMsg({ imageData: "data:image/jpeg;base64,abc" })] });
    fireEvent.click(screen.getByRole("img", { name: "圖片" }));
    const allImgs = screen.getAllByRole("img");
    const lightboxImg = allImgs.find((el) => el.closest(".fixed"));
    expect(lightboxImg).toBeDefined();
  });
});
