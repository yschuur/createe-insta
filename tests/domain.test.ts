import { describe, expect, it } from "vitest";
import { instagramUrl, stats, type Post } from "../src/lib/domain";
import {
  postUrl,
  editor,
  validateCategory,
} from "../supabase/functions/agent/validation";
describe("Instagram URL validation on client and server", () => {
  it.each([
    "https://instagram.com/p/abc_123/?igsh=123",
    "https://www.instagram.com/reel/ABC-12/",
  ])("normalizes supported links: %s", (input) => {
    const clean = instagramUrl(input);
    expect(clean).toMatch(/^https:\/\/www.instagram.com\/(p|reel)\//);
    expect(postUrl(input)).toBe(clean);
  });
  it.each([
    "https://instagram.com.evil.test/p/123/",
    "javascript:alert(1)",
    "http://instagram.com/p/123/",
    "https://instagram.com/direct/inbox/",
    "https://127.0.0.1/p/123/",
    "https://instagram.com/p/abc/extra",
  ])("rejects unsupported and unsafe links: %s", (input) => {
    expect(instagramUrl(input)).toBeNull();
    expect(() => postUrl(input)).toThrow();
  });
});
describe("manual publication accounting", () => {
  it("counts only explicit published drafts, not approvals or generations", () => {
    const posts: Post[] = [
      {
        id: "1",
        permalink: "",
        caption: "",
        category: "Golf",
        timestamp: null,
        analysis: "Available caption only",
        drafts: [
          { id: "a", text: "a", style: "Speels", status: "draft" },
          { id: "b", text: "b", style: "Sarcastisch", status: "approved" },
          { id: "c", text: "c", style: "Woordgrap", status: "published" },
        ],
      },
    ];
    expect(stats(posts)).toEqual([1, 1, 3, 1]);
    expect(stats([])).toEqual([0, 0, 0, 0]);
  });
});
describe("server input contract", () => {
  const valid = {
    humor: 65,
    style: "Alle drie",
    length: "Kort",
    language: "Nederlands",
    instructions: "",
  };
  it("accepts intended settings", () => expect(editor(valid)).toEqual(valid));
  it.each([
    { humor: 101 },
    { humor: -1 },
    { humor: "65" },
    { style: "bad" },
    { language: "bad" },
    { length: "bad" },
    { instructions: "x".repeat(2001) },
  ])("rejects malformed settings %j", (patch) =>
    expect(() => editor({ ...valid, ...patch })).toThrow(),
  );
  it("rejects unconfigured categories", () => {
    expect(validateCategory("Golf")).toBe("Golf");
    expect(() => validateCategory("spam")).toThrow();
  });
});
