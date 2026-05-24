停止佔用 port 3000 的行程，然後在背景重新啟動 dev server。

步驟：
1. 用 PowerShell 找出 port 3000 的 PID 並強制終止：
   `Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue).OwningProcess -Force -ErrorAction SilentlyContinue`
2. 等待 1 秒
3. 在背景執行 `npm run dev`（run_in_background: true）
4. 告知使用者伺服器正在啟動，可在 https://localhost:3000 訪問
