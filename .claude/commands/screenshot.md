使用 Playwright MCP 截取目前 WebRTC Meet 的 UI 畫面。

步驟：

1. 使用 `mcp__plugin_playwright_playwright__browser_navigate` 前往 `https://localhost:3000`
   - 忽略 HTTPS 錯誤（自簽憑證）
   - 如果連線失敗，提示使用者先執行 `npm run dev` 或 `/restart`

2. 等待頁面載入（可用 `mcp__plugin_playwright_playwright__browser_wait_for` 等待 `networkidle`）

3. 使用 `mcp__plugin_playwright_playwright__browser_take_screenshot` 截圖

4. 顯示截圖給使用者，並簡短說明目前畫面的狀態

如果使用者在 `$ARGUMENTS` 指定了路徑（例如 `/room/test-123`），則前往 `https://localhost:3000$ARGUMENTS`。

注意：每次截圖前不需要重新啟動瀏覽器，直接導覽即可。
