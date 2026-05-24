import { describe, it, expect } from "vitest";
import { hashPassword } from "@/lib/crypto";

describe("hashPassword", () => {
  it("回傳 64 字元 hex 字串", async () => {
    const result = await hashPassword("test");
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it("相同輸入產生相同雜湊（deterministic）", async () => {
    const a = await hashPassword("hello");
    const b = await hashPassword("hello");
    expect(a).toBe(b);
  });

  it("不同輸入產生不同雜湊", async () => {
    const a = await hashPassword("abc");
    const b = await hashPassword("ABC");
    expect(a).not.toBe(b);
  });

  it("空字串回傳空字串（不做雜湊）", async () => {
    const result = await hashPassword("");
    expect(result).toBe("");
  });
});
