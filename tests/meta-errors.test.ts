import { describe, expect, it } from "vitest";
import { metaErrorMessage } from "../supabase/functions/agent/validation";
describe("actionable and credential-safe Meta errors", () => {
  it("distinguishes hashtag lookup from recent media and preserves the actual reason", () => {
    expect(
      metaErrorMessage(
        "ig_hashtag_search",
        400,
        {
          code: 1,
          error_subcode: 99,
          message: "Application does not have permission for this action",
        },
        "secret",
      ),
    ).toBe(
      "Meta-fout bij hashtag zoeken (1/99): Application does not have permission for this action",
    );
    expect(
      metaErrorMessage(
        "123/recent_media",
        400,
        { code: 100, message: "Unsupported field" },
        "secret",
      ),
    ).toContain("recente posts ophalen (100): Unsupported field");
  });
  it("redacts known raw/encoded tokens and token parameters without serializing extra fields", () => {
    const token = "secret/value";
    const result = metaErrorMessage(
      "ig_hashtag_search",
      400,
      {
        code: 1,
        message: `${token} secret%2Fvalue access_token=another-value Bearer another-token`,
        access_token: "do-not-display",
      },
      token,
    );
    for (const value of [
      token,
      "secret%2Fvalue",
      "another-value",
      "another-token",
      "do-not-display",
    ])
      expect(result).not.toContain(value);
  });
  it("handles malformed errors, limits message length and does not reveal account IDs", () => {
    expect(metaErrorMessage("12345/recent_media", 503, null, "token")).toBe(
      "Meta-fout bij recente posts ophalen (503): Meta heeft de aanvraag geweigerd.",
    );
    expect(
      metaErrorMessage(
        "me/accounts",
        400,
        { message: "x".repeat(2000) },
        "token",
      ).length,
    ).toBeLessThan(700);
  });
});
