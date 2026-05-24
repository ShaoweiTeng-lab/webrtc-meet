import { test, expect } from "@playwright/test";

test.describe("房間密碼", () => {
  test("錯誤密碼：顯示錯誤訊息", async ({ browser }) => {
    const roomId = `e2e-pw-${Date.now()}`;

    // Alice 建立有密碼的房間
    const ctxA = await browser.newContext({ ignoreHTTPSErrors: true });
    const pageA = await ctxA.newPage();
    await pageA.goto("/");
    await pageA.getByLabel("你的名稱").fill("Alice");
    await pageA.getByLabel("會議代碼").fill(roomId);
    await pageA.getByLabel(/密碼/).fill("secret");
    await pageA.getByRole("button", { name: /加入會議/ }).click();
    await expect(pageA.getByTitle(/靜音|取消靜音/)).toBeVisible({ timeout: 15000 });

    // Bob 用錯誤密碼加入
    const ctxB = await browser.newContext({ ignoreHTTPSErrors: true });
    const pageB = await ctxB.newPage();
    await pageB.goto("/");
    await pageB.getByLabel("你的名稱").fill("Bob");
    await pageB.getByLabel("會議代碼").fill(roomId);
    await pageB.getByLabel(/密碼/).fill("wrong");
    await pageB.getByRole("button", { name: /加入會議/ }).click();
    await expect(pageB.getByText("密碼錯誤")).toBeVisible({ timeout: 10000 });

    await ctxA.close();
    await ctxB.close();
  });

  test("正確密碼：成功進入房間", async ({ browser }) => {
    const roomId = `e2e-pw2-${Date.now()}`;

    // Alice 建立
    const ctxA = await browser.newContext({ ignoreHTTPSErrors: true });
    const pageA = await ctxA.newPage();
    await pageA.goto("/");
    await pageA.getByLabel("你的名稱").fill("Alice");
    await pageA.getByLabel("會議代碼").fill(roomId);
    await pageA.getByLabel(/密碼/).fill("correct");
    await pageA.getByRole("button", { name: /加入會議/ }).click();
    await expect(pageA.getByTitle(/靜音|取消靜音/)).toBeVisible({ timeout: 15000 });

    // Bob 用正確密碼加入
    const ctxB = await browser.newContext({ ignoreHTTPSErrors: true });
    const pageB = await ctxB.newPage();
    await pageB.goto("/");
    await pageB.getByLabel("你的名稱").fill("Bob");
    await pageB.getByLabel("會議代碼").fill(roomId);
    await pageB.getByLabel(/密碼/).fill("correct");
    await pageB.getByRole("button", { name: /加入會議/ }).click();
    await expect(pageB.getByTitle(/靜音|取消靜音/)).toBeVisible({ timeout: 15000 });

    await ctxA.close();
    await ctxB.close();
  });
});
