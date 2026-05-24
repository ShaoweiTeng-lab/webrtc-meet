import { test, expect, chromium } from "@playwright/test";

const ROOM_ID = `e2e-join-${Date.now()}`;

async function joinRoom(page: import("@playwright/test").Page, username: string, roomId: string, password = "") {
  await page.goto("/");
  await page.getByLabel("你的名稱").fill(username);
  await page.getByLabel("會議代碼").fill(roomId);
  if (password) await page.getByLabel(/密碼/).fill(password);
  await page.getByRole("button", { name: /加入會議/ }).click();
  // 等待房間 UI 出現（控制列可見）
  await expect(page.getByTitle(/靜音|取消靜音/)).toBeVisible({ timeout: 15000 });
}

test.describe("加入房間", () => {
  test("單人進入：控制列顯示", async ({ page }) => {
    await joinRoom(page, "Alice", ROOM_ID);
    await expect(page.getByTitle(/靜音|取消靜音/)).toBeVisible();
    await expect(page.getByTitle(/鏡頭/)).toBeVisible();
  });

  test("兩人進入同一房間：互相看到對方名字", async ({ browser }) => {
    const roomId = `e2e-two-${Date.now()}`;
    const ctxA = await browser.newContext({ ignoreHTTPSErrors: true });
    const ctxB = await browser.newContext({ ignoreHTTPSErrors: true });
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    await joinRoom(pageA, "Alice", roomId);
    await joinRoom(pageB, "Bob", roomId);

    // Bob 出現在 Alice 的畫面
    await expect(pageA.getByText("Bob")).toBeVisible({ timeout: 10000 });
    // Alice 出現在 Bob 的畫面
    await expect(pageB.getByText("Alice")).toBeVisible({ timeout: 10000 });

    await ctxA.close();
    await ctxB.close();
  });

  test("點離開：返回首頁", async ({ page }) => {
    await joinRoom(page, "Alice", `e2e-leave-${Date.now()}`);
    // 行動裝置上按鈕直接顯示，桌機用文字
    const leaveBtn = page.getByTitle("離開通話").first();
    await leaveBtn.click();
    await expect(page).toHaveURL("/", { timeout: 5000 });
  });
});
