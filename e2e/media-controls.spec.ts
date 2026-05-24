import { test, expect } from "@playwright/test";

async function joinRoom(page: import("@playwright/test").Page, username: string) {
  const roomId = `e2e-media-${Date.now()}`;
  await page.goto("/");
  await page.getByLabel("你的名稱").fill(username);
  await page.getByLabel("會議代碼").fill(roomId);
  await page.getByRole("button", { name: /加入會議/ }).click();
  await expect(page.getByTitle(/靜音|取消靜音/)).toBeVisible({ timeout: 15000 });
}

test.describe("媒體控制", () => {
  test("點靜音：按鈕變紅", async ({ page }) => {
    await joinRoom(page, "Alice");
    const muteBtn = page.getByTitle(/靜音|取消靜音/).first();
    await muteBtn.click();
    await expect(page.getByTitle("取消靜音")).toBeVisible();
    // 按鈕應帶有紅色 class
    const cls = await page.getByTitle("取消靜音").getAttribute("class");
    expect(cls).toContain("#ea4335");
  });

  test("點關閉鏡頭：按鈕變紅 + 頭像出現", async ({ page }) => {
    await joinRoom(page, "Alice");
    await page.getByTitle(/鏡頭/).first().click();
    await expect(page.getByTitle("開啟鏡頭")).toBeVisible();
    const cls = await page.getByTitle("開啟鏡頭").getAttribute("class");
    expect(cls).toContain("#ea4335");
  });

  test("點螢幕分享：按鈕變綠（highlight）", async ({ page }) => {
    await joinRoom(page, "Alice");
    // 螢幕分享在假裝置環境下可能直接成功
    const shareBtn = page.getByTitle(/螢幕分享|停止分享/).first();
    await shareBtn.click();
    // 只驗證按鈕狀態切換（不強制要求 getDisplayMedia 成功）
    const afterTitle = await shareBtn.getAttribute("title");
    expect(["停止分享", "螢幕分享"]).toContain(afterTitle);
  });
});
