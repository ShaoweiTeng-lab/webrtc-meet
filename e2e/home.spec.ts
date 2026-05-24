import { test, expect } from "@playwright/test";

test.describe("首頁", () => {
  test("頁面載入：顯示 logo 和表單", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("WebRTC Meet")).toBeVisible();
    await expect(page.getByLabel("你的名稱")).toBeVisible();
    await expect(page.getByLabel("會議代碼")).toBeVisible();
  });

  test("表單空白提交：不跳轉", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /加入會議/ }).click();
    await expect(page).toHaveURL("/");
  });

  test("填入後提交：跳轉到房間頁", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("你的名稱").fill("Alice");
    await page.getByLabel("會議代碼").fill("e2e-test-room");
    await page.getByRole("button", { name: /加入會議/ }).click();
    await expect(page).toHaveURL(/\/room\/e2e-test-room/);
  });

  test("隨機產生代碼：格式為 xxx-xxx-xxx", async ({ page }) => {
    await page.goto("/");
    await page.getByTitle("隨機產生").click();
    const val = await page.getByLabel("會議代碼").inputValue();
    expect(val).toMatch(/^[a-z]{3}-[a-z]{3}-[a-z]{3}$/);
  });

  test("建立新會議：代碼被填入後可提交", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /建立新會議/ }).click();
    const val = await page.getByLabel("會議代碼").inputValue();
    expect(val).toMatch(/^[a-z]{3}-[a-z]{3}-[a-z]{3}$/);
  });
});
