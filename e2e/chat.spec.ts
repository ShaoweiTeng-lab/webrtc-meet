import { test, expect } from "@playwright/test";

async function joinRoom(page: import("@playwright/test").Page, username: string, roomId: string) {
  await page.goto("/");
  await page.getByLabel("你的名稱").fill(username);
  await page.getByLabel("會議代碼").fill(roomId);
  await page.getByRole("button", { name: /加入會議/ }).click();
  await expect(page.getByTitle(/靜音|取消靜音/)).toBeVisible({ timeout: 15000 });
}

async function openChat(page: import("@playwright/test").Page) {
  await page.getByTitle("聊天").click();
  await expect(page.getByText("通話訊息")).toBeVisible();
}

test.describe("聊天", () => {
  test("傳送訊息：訊息出現在自己畫面", async ({ page }) => {
    const roomId = `e2e-chat-${Date.now()}`;
    await joinRoom(page, "Alice", roomId);
    await openChat(page);
    await page.getByPlaceholder(/傳送訊息/).fill("Hello World");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Hello World")).toBeVisible();
  });

  test("兩人聊天：雙向訊息傳遞", async ({ browser }) => {
    const roomId = `e2e-chat2-${Date.now()}`;
    const ctxA = await browser.newContext({ ignoreHTTPSErrors: true });
    const ctxB = await browser.newContext({ ignoreHTTPSErrors: true });
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    await joinRoom(pageA, "Alice", roomId);
    await joinRoom(pageB, "Bob", roomId);

    // Alice 傳訊息
    await openChat(pageA);
    await pageA.getByPlaceholder(/傳送訊息/).fill("Hi Bob!");
    await pageA.keyboard.press("Enter");

    // Bob 端出現 toast 通知
    await expect(pageB.getByText("Hi Bob!")).toBeVisible({ timeout: 8000 });

    // Bob 打開聊天回覆
    await openChat(pageB);
    await pageB.getByPlaceholder(/傳送訊息/).fill("Hey Alice!");
    await pageB.keyboard.press("Enter");

    // Alice 看到 Bob 的訊息
    await expect(pageA.getByText("Hey Alice!")).toBeVisible({ timeout: 8000 });

    await ctxA.close();
    await ctxB.close();
  });

  test("關閉聊天再收到訊息：badge 顯示未讀數", async ({ browser }) => {
    const roomId = `e2e-unread-${Date.now()}`;
    const ctxA = await browser.newContext({ ignoreHTTPSErrors: true });
    const ctxB = await browser.newContext({ ignoreHTTPSErrors: true });
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    await joinRoom(pageA, "Alice", roomId);
    await joinRoom(pageB, "Bob", roomId);

    // Bob 送訊息（Alice 的聊天面板是關閉的）
    await openChat(pageB);
    await pageB.getByPlaceholder(/傳送訊息/).fill("ping");
    await pageB.keyboard.press("Enter");

    // Alice 的聊天按鈕上應出現 badge "1"
    await expect(pageA.getByText("1")).toBeVisible({ timeout: 8000 });

    await ctxA.close();
    await ctxB.close();
  });
});
