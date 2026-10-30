// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const mocks = vi.hoisted(() => ({ api: vi.fn(), getSession: vi.fn() }));
vi.mock("../src/lib/api", () => ({
  api: mocks.api,
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      signOut: vi.fn(),
    },
  },
}));
import App from "../src/App";
const initial = {
  id: "p1",
  permalink: "https://www.instagram.com/p/test/",
  caption: "Een putt naast de hole",
  category: "Golf",
  timestamp: "2026-10-29T12:00:00Z",
  drafts: [],
};
beforeEach(() => {
  mocks.getSession.mockResolvedValue({
    data: { session: { user: { id: "u1", email: "studio@example.com" } } },
  });
  mocks.api.mockImplementation(async (action: string) => {
    if (action === "list") return { posts: [initial], connected: true };
    if (action === "generate")
      return {
        analysis: "Alleen caption geanalyseerd.",
        drafts: [
          {
            id: "d1",
            text: "Die hole had andere plannen.",
            style: "Speels",
            status: "draft",
          },
          {
            id: "d2",
            text: "Perfect gemikt. Bijna.",
            style: "Sarcastisch",
            status: "draft",
          },
          {
            id: "d3",
            text: "Putt happens.",
            style: "Woordgrap",
            status: "draft",
          },
        ],
      };
    return { ok: true };
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe("authenticated workflow using an explicit mocked service", () => {
  it("opens a post, generates three comments, edits and approves without counting as published", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Een putt naast de hole");
    await user.click(screen.getByRole("button", { name: /Open studio/ }));
    await user.click(
      screen.getByRole("button", { name: "Genereer drie reacties" }),
    );
    const draft = await screen.findByRole("textbox", {
      name: "Speels reactie",
    });
    expect((draft as HTMLTextAreaElement).value).toBe(
      "Die hole had andere plannen.",
    );
    await user.clear(draft);
    await user.type(draft, "Mooi naast gemikt.");
    await user.click(screen.getAllByRole("button", { name: "Goedkeuren" })[0]);
    await waitFor(() =>
      expect(mocks.api).toHaveBeenCalledWith("saveDraft", {
        id: "d1",
        text: "Mooi naast gemikt.",
        status: "approved",
      }),
    );
    expect(
      screen.getByRole("button", { name: "Als geplaatst markeren" }),
    ).toBeTruthy();
    expect(mocks.api.mock.calls.some((c) => c[1]?.status === "published")).toBe(
      false,
    );
  });
  it("rejects an invalid manual URL before calling the backend", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Een putt naast de hole");
    await user.click(screen.getByRole("button", { name: "Post toevoegen" }));
    await user.type(
      screen.getByRole("textbox", { name: "Post- of Reel-link" }),
      "https://evil.test/p/a/",
    );
    await user.click(screen.getByRole("button", { name: "Post opslaan" }));
    expect(await screen.findByRole("status")).toHaveProperty(
      "textContent",
      expect.stringContaining("Gebruik een geldige"),
    );
    expect(mocks.api.mock.calls.some((c) => c[0] === "addPost")).toBe(false);
  });
  it("surfaces provider errors and allows retry", async () => {
    const user = userEvent.setup();
    mocks.api.mockImplementation(async (action: string) => {
      if (action === "list") return { posts: [initial], connected: true };
      throw new Error("OpenAI quotum bereikt");
    });
    render(<App />);
    await screen.findByText("Een putt naast de hole");
    await user.click(screen.getByRole("button", { name: /Open studio/ }));
    await user.click(
      screen.getByRole("button", { name: "Genereer drie reacties" }),
    );
    expect((await screen.findByRole("status")).textContent).toContain(
      "OpenAI quotum bereikt",
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Genereer drie reacties",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });
});
