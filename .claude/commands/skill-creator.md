根據使用者的描述，在 `.claude/commands/` 建立新的 Claude Code slash command skill 檔案。

用法：`/skill-creator <skill名稱>: <這個 skill 要做什麼>`

範例：
- `/skill-creator deploy: 建置專案並部署到 Vercel`
- `/skill-creator db-reset: 重置本地開發資料庫並填入測試資料`

步驟：

1. 從 `$ARGUMENTS` 解析：
   - **skill 名稱**：冒號（`:`）之前的第一個詞，全小寫、用連字號
   - **功能說明**：冒號之後的描述文字

2. 讀取 `.claude/commands/` 目錄下的現有 skill 作為格式參考

3. 用 Write 工具建立 `.claude/commands/<skill名稱>.md`，內容要包含：
   - 第一行：一句話說明這個 skill 做什麼
   - 步驟：清楚的執行步驟（繁體中文）
   - 判斷標準：成功 / 失敗各回報什麼
   - 如果需要用到 `$ARGUMENTS`，說明參數格式

4. 回報：
   ```
   ✅ Skill 已建立：.claude/commands/<skill名稱>.md
   使用方式：/<skill名稱>
   ```

格式規範：
- 純繁體中文撰寫
- 不要加 YAML frontmatter 或 Markdown 標題（`#`）
- 步驟用數字清單，判斷標準用條件句
- 參考同資料夾的其他 .md 保持風格一致
