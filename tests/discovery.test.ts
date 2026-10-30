import { describe, expect, it } from "vitest";
import {
  defaultFilters,
  parseFilters,
  matchesFilters,
  filterPosts,
  hashtagsFor,
} from "../supabase/functions/agent/discovery";
const now = Date.parse("2026-10-30T12:00:00Z");
const post = {
  id: "1",
  category: "Golf",
  timestamp: "2026-10-30T10:00:00Z",
  media_type: "IMAGE",
  caption: "Golf training #golf #padel",
  detected_language: "en",
  analysis: "Some analysis",
  relevance: 80,
  like_count: 30,
  comments_count: 5,
  drafts: [],
};
const fresh = () => structuredClone(defaultFilters);
describe("switchable discovery filters", () => {
  it("disabled filters do not exclude posts with unknown metadata", () =>
    expect(matchesFilters({ caption: "" }, fresh(), now)).toBe(true));
  it("enforces age, excludes unknown dates and future timestamps, and can switch off", () => {
    const f = fresh();
    f.age = { on: true, hours: 6 };
    expect(matchesFilters(post, f, now)).toBe(true);
    for (const timestamp of [
      null,
      "invalid",
      "2026-10-29T10:00:00Z",
      "2026-10-31T10:00:00Z",
    ])
      expect(matchesFilters({ ...post, timestamp }, f, now)).toBe(false);
    f.age.on = false;
    expect(matchesFilters({ ...post, timestamp: null }, f, now)).toBe(true);
  });
  it("combines categories and media selection", () => {
    const f = fresh();
    f.categories = { on: true, values: ["Golf"] };
    f.media = { on: true, values: ["VIDEO"] };
    expect(matchesFilters(post, f, now)).toBe(false);
    f.media.on = false;
    expect(matchesFilters(post, f, now)).toBe(true);
    expect(matchesFilters({ ...post, category: "Padel" }, f, now)).toBe(false);
  });
  it("requires any included keyword and excludes any excluded word, case-insensitively", () => {
    const f = fresh();
    f.keywords = {
      on: true,
      include: "TRAINING,tournament",
      exclude: "giveaway,winactie",
    };
    expect(matchesFilters(post, f, now)).toBe(true);
    expect(
      matchesFilters({ ...post, caption: post.caption + " winactie" }, f, now),
    ).toBe(false);
    expect(matchesFilters({ ...post, caption: "Different text" }, f, now)).toBe(
      false,
    );
  });
  it("matches whole hashtags rather than substrings, deduplicates and normalizes", () => {
    const f = fresh();
    f.hashtags = { on: true, value: "#GOLF, golf" };
    expect(hashtagsFor(f, "padel")).toEqual(["golf"]);
    expect(matchesFilters(post, f, now)).toBe(true);
    expect(matchesFilters({ ...post, caption: "#golfhumor" }, f, now)).toBe(
      false,
    );
  });
  it("excludes unknown engagement rather than assuming zero", () => {
    const f = fresh();
    f.engagement = { on: true, minLikes: 20, maxComments: 10 };
    expect(matchesFilters(post, f, now)).toBe(true);
    for (const patch of [
      { like_count: null },
      { comments_count: null },
      { like_count: 10 },
      { comments_count: 11 },
    ])
      expect(matchesFilters({ ...post, ...patch }, f, now)).toBe(false);
  });
  it("requires completed analysis for AI relevance and language, without applying them on import", () => {
    const f = fresh();
    f.relevance = { on: true, minimum: 70 };
    f.language = { on: true, value: "en" };
    expect(matchesFilters(post, f, now)).toBe(true);
    expect(matchesFilters({ ...post, analysis: null }, f, now)).toBe(false);
    expect(
      matchesFilters({ ...post, detected_language: "unknown" }, f, now),
    ).toBe(false);
    expect(
      matchesFilters(
        { ...post, analysis: null, detected_language: "unknown" },
        f,
        now,
        true,
      ),
    ).toBe(true);
  });
  it("hides posts with drafts only when enabled", () => {
    const f = fresh();
    f.handled.on = true;
    expect(
      matchesFilters({ ...post, drafts: [{ status: "approved" }] }, f, now),
    ).toBe(false);
    expect(matchesFilters(post, f, now)).toBe(true);
  });
  it("sorts without mutating input and keeps unknown engagement below measured values", () => {
    const f = fresh();
    f.sort = "engagement";
    const rows = [
      { ...post, id: "unknown", like_count: null },
      { ...post, id: "measured" },
    ];
    expect(filterPosts(rows, f, now).map((p) => p.id)).toEqual([
      "measured",
      "unknown",
    ]);
    expect(rows[0].id).toBe("unknown");
  });
  it("rejects malformed server payloads, out-of-range numbers and excessive hashtags", () => {
    for (const patch of [
      { age: { on: true, hours: -1 } },
      { language: { on: true, value: "bad" } },
      { sort: "bad" },
      { engagement: { on: true, minLikes: NaN, maxComments: 10 } },
      { hashtags: { on: true, value: "one,two,three,four,five,six" } },
      { hashtags: { on: true, value: "https://evil.test" } },
      { media: { on: true, values: ["bad"] } },
    ])
      expect(() => parseFilters({ ...fresh(), ...patch })).toThrow();
  });
});

describe("AI selection before persistence", () => {
  it("does not run paid AI for candidates rejected by cheap criteria", async () => {
    const { selectForPlayfield } =
      await import("../supabase/functions/agent/discovery");
    let calls = 0;
    const f = fresh();
    f.media = { on: true, values: ["VIDEO"] };
    f.relevance.on = true;
    const result = await selectForPlayfield(
      post,
      f,
      false,
      async () => {
        calls++;
        return { analysis: "No", relevance: 100, language: "en" };
      },
      now,
    );
    expect(result.selected).toBe(false);
    expect(calls).toBe(0);
  });
  it("analyzes a new unanalysed candidate and rejects it below the required score", async () => {
    const { selectForPlayfield } =
      await import("../supabase/functions/agent/discovery");
    const f = fresh();
    f.relevance = { on: true, minimum: 70 };
    let calls = 0;
    const result = await selectForPlayfield(
      { ...post, analysis: null, relevance: undefined },
      f,
      false,
      async () => {
        calls++;
        return { analysis: "Not relevant", relevance: 20, language: "en" };
      },
      now,
    );
    expect(calls).toBe(1);
    expect(result.selected).toBe(false);
  });
  it("selects only candidates matching both AI language and relevance", async () => {
    const { selectForPlayfield } =
      await import("../supabase/functions/agent/discovery");
    const f = fresh();
    f.language = { on: true, value: "nl" };
    f.relevance = { on: true, minimum: 70 };
    expect(
      (
        await selectForPlayfield(
          post,
          f,
          false,
          async () => ({ analysis: "Pass", relevance: 90, language: "nl" }),
          now,
        )
      ).selected,
    ).toBe(true);
    expect(
      (
        await selectForPlayfield(
          post,
          f,
          false,
          async () => ({
            analysis: "Wrong language",
            relevance: 90,
            language: "en",
          }),
          now,
        )
      ).selected,
    ).toBe(false);
  });
  it("does not pay for analysis of handled posts and propagates AI failures instead of accepting", async () => {
    const { selectForPlayfield } =
      await import("../supabase/functions/agent/discovery");
    const f = fresh();
    f.handled.on = true;
    f.relevance.on = true;
    let calls = 0;
    const analyze = async () => {
      calls++;
      throw new Error("AI unavailable");
    };
    expect(
      (await selectForPlayfield(post, f, true, analyze, now)).selected,
    ).toBe(false);
    expect(calls).toBe(0);
    await expect(
      selectForPlayfield(post, f, false, analyze, now),
    ).rejects.toThrow("AI unavailable");
  });
});
