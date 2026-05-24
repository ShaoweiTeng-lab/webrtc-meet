分析目前的 git 變更，自動產生 commit 訊息並完成提交。

步驟：

1. 執行 `git status` 確認有變更可提交，若無變更則回報「沒有需要提交的變更」並停止

2. 執行 `git diff HEAD`（含 staged）查看具體內容

3. 根據變更內容，自動判斷 commit 訊息：
   - 格式：`<類型>: <簡短說明>`
   - 類型：`feat`（新功能）、`fix`（修 bug）、`refactor`、`test`、`docs`、`chore`
   - 說明用繁體中文，50 字以內
   - 若有多個面向，可加 body 說明

4. 執行 `git add -A` 暫存所有變更

5. 執行 git commit，附上產生的訊息

6. 回報：
   ```
   ✅ 已提交
   Hash：<short hash>
   訊息：<commit message>
   ```

注意：若 `$ARGUMENTS` 有提供訊息，直接用它作為 commit 訊息，跳過第 2-3 步。
