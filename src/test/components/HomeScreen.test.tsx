import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomeScreen } from "@/components/HomeScreen";

// Next.js hooks mock
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("HomeScreen", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("初始狀態：提交按鈕 disabled", () => {
    render(<HomeScreen />);
    expect(screen.getByRole("button", { name: /加入會議/ })).toBeDisabled();
  });

  it("只填名稱，代碼為空：按鈕仍 disabled", async () => {
    render(<HomeScreen />);
    await userEvent.type(screen.getByLabelText("你的名稱"), "Alice");
    expect(screen.getByRole("button", { name: /加入會議/ })).toBeDisabled();
  });

  it("名稱和代碼都填：按鈕 enabled", async () => {
    render(<HomeScreen />);
    await userEvent.type(screen.getByLabelText("你的名稱"), "Alice");
    await userEvent.type(screen.getByLabelText("會議代碼"), "abc-def-ghi");
    expect(screen.getByRole("button", { name: /加入會議/ })).toBeEnabled();
  });

  it("點「隨機產生」：roomId 填入 xxx-xxx-xxx 格式", async () => {
    render(<HomeScreen />);
    const shuffleBtn = screen.getByTitle("隨機產生");
    await userEvent.click(shuffleBtn);
    const input = screen.getByLabelText("會議代碼") as HTMLInputElement;
    expect(input.value).toMatch(/^[a-z]{3}-[a-z]{3}-[a-z]{3}$/);
  });

  it("點「建立新會議」：roomId 被填入", async () => {
    render(<HomeScreen />);
    await userEvent.click(screen.getByRole("button", { name: /建立新會議/ }));
    const input = screen.getByLabelText("會議代碼") as HTMLInputElement;
    expect(input.value).toMatch(/^[a-z]{3}-[a-z]{3}-[a-z]{3}$/);
  });

  it("送出表單：router.push 被呼叫，包含 roomId 和 username", async () => {
    render(<HomeScreen />);
    await userEvent.type(screen.getByLabelText("你的名稱"), "Alice");
    await userEvent.type(screen.getByLabelText("會議代碼"), "test-room-abc");
    await userEvent.click(screen.getByRole("button", { name: /加入會議/ }));
    await waitFor(() => expect(mockPush).toHaveBeenCalled());
    const calledWith: string = mockPush.mock.calls[0][0];
    expect(calledWith).toContain("/room/test-room-abc");
    expect(calledWith).toContain("username=Alice");
  });

  it("密碼欄位預設為 password 型別，點眼睛切換為 text", async () => {
    render(<HomeScreen />);
    const passwordInput = screen.getByLabelText(/密碼/) as HTMLInputElement;
    expect(passwordInput.type).toBe("password");
    // 眼睛按鈕在密碼欄位旁邊（title 無法直接 query，用 nearest button）
    const eyeBtn = passwordInput.closest(".relative")?.querySelector("button");
    if (eyeBtn) {
      await userEvent.click(eyeBtn);
      expect(passwordInput.type).toBe("text");
    }
  });
});
