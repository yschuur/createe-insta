import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  analysisRecord,
  draftStatusToDb,
  humorToDb,
  languageToDb,
  draftView,
  postView,
  settingsView,
} from "../supabase/functions/agent/schema";
const rows = readFileSync(
  new URL("./fixtures/supabase-columns.csv", import.meta.url),
  "utf8",
)
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((line) => line.split(","));
describe("adapter for user-supplied Supabase column export", () => {
  it("resolves category IDs, publication dates and latest analysis without synthetic columns", () => {
    const row = { id: "p1", category_id: "c1", published_at: null };
    const result = postView(
      row,
      [{ id: "c1", name: "Golf" }],
      [{ post_id: "p1", summary: "Caption only", relevance_score: 82 }],
      [
        {
          id: "d1",
          post_id: "p1",
          generated_text: "Original",
          edited_text: "Edited",
          humor_type: "Speels",
          status: "approved",
        },
      ],
    );
    expect(result).toMatchObject({
      category: "Golf",
      timestamp: null,
      analysis: "Caption only",
      relevance: 82,
      drafts: [{ text: "Edited", style: "Speels", status: "approved" }],
    });
  });
  it("retains generated text separately and respects an intentionally empty edit", () => {
    expect(
      draftView({ generated_text: "Original", edited_text: null }).text,
    ).toBe("Original");
    expect(
      draftView({ generated_text: "Original", edited_text: "" }).text,
    ).toBe("");
  });
  it("does not re-enable all categories when the user disabled every category", () => {
    expect(
      settingsView({ default_humor_level: 32, preferred_language: "Engels" }, [
        { name: "Golf", enabled: false },
      ]),
    ).toMatchObject({
      editor: { humor: 32, language: "Engels" },
      categories: [],
    });
  });
  it("writes analysis only to existing columns and satisfies non-null fields", () => {
    const record = analysisRecord(
      "u1",
      "p1",
      { analysis: "Only supplied frame", relevance: 67 },
      true,
    );
    const cols = rows.filter((r) => r[0] === "post_analyses");
    expect(
      Object.keys(record).every(
        (key) => key === "detected_language" || cols.some((r) => r[1] === key),
      ),
    ).toBe(true);
    for (const [, column, , nullable] of cols)
      if (nullable === "NO")
        expect(record[column as keyof typeof record]).not.toBeNull();
    expect(record.analysis_sources).toEqual(["caption", "image"]);
    expect(record.analysis_limitations).toContain("geen volledige video");
  });
  it("clearly records caption-only limitations", () =>
    expect(
      analysisRecord("u", "p", { analysis: "Text", relevance: 0 }, false),
    ).toMatchObject({
      analysis_sources: ["caption"],
      analysis_limitations: "Alleen caption; geen beeld of video bekeken.",
    }));
});

describe("compatibility with inspected status constraints and defaults", () => {
  it("maps publication both ways using the real allowed database value", () => {
    const entries = JSON.parse(
      readFileSync(
        new URL("./fixtures/supabase-access.json", import.meta.url),
        "utf8",
      ),
    );
    const constraint = entries.find(
      (r: any) => r.name === "comment_drafts_status_check",
    ).details;
    const allowed = Array.from(
      constraint.matchAll(/'([^']+)'::text/g),
      (m: any) => m[1],
    );
    for (const status of ["draft", "approved", "published"])
      expect(allowed).toContain(draftStatusToDb(status));
    expect(draftStatusToDb("published")).toBe("posted");
    expect(() => draftStatusToDb("invalid")).toThrow();
    expect(
      draftView({ status: "posted", humor_type: "playful" }),
    ).toMatchObject({ status: "published", style: "Speels" });
  });
  it("normalizes existing auto/nl/en preferences to valid editor choices", () => {
    expect(
      settingsView({ preferred_language: "auto" }, []).editor.language,
    ).toBe("Nederlands");
    expect(settingsView({ preferred_language: "en" }, []).editor.language).toBe(
      "Engels",
    );
    expect(languageToDb("Nederlands")).toBe("nl");
    expect(languageToDb("Engels")).toBe("en");
  });
  it("preserves canonical humor values on writes and readable labels on reads", () => {
    for (const [label, key] of [
      ["Speels", "playful"],
      ["Sarcastisch", "sarcastic"],
      ["Woordgrap", "pun"],
    ]) {
      expect(humorToDb(label)).toBe(key);
      expect(draftView({ humor_type: key }).style).toBe(label);
    }
  });
});
