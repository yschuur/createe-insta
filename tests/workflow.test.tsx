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
  localStorage.clear();
  mocks.getSession.mockResolvedValue({
    data: { session: { user: { id: "u1", email: "studio@example.com" } } },
  });
  mocks.api.mockImplementation(async (action: string) => {
    if (action === "list")
      return {
        posts: [initial],
        connected: true,
        capabilities: { playfieldSelection: true },
      };
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
      if (action === "list")
        return {
          posts: [initial],
          connected: true,
          capabilities: { playfieldSelection: true },
        };
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

describe("discovery filters and partial results", () => {
  it("switches filters on and off, persists them and resets them", async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Een putt naast de hole");
    expect(
      screen.queryByRole("switch", { name: "Ouderdom filter" }),
    ).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Instellingen", exact: true }),
    );
    const toggle = screen.getByRole("switch", { name: "Ouderdom filter" });
    await user.click(toggle);
    expect(
      screen.getByLabelText("Maximale leeftijd").matches(":disabled"),
    ).toBe(false);
    await user.click(toggle);
    expect(
      screen.getByLabelText("Maximale leeftijd").matches(":disabled"),
    ).toBe(true);
    await user.click(
      screen.getByRole("button", { name: "Instellingen opslaan" }),
    );
    await waitFor(() =>
      expect(mocks.api).toHaveBeenCalledWith(
        "saveSettings",
        expect.objectContaining({
          settings: expect.objectContaining({
            discoveryFilters: expect.objectContaining({
              age: { on: false, hours: 24 },
            }),
          }),
        }),
      ),
    );
    await user.click(screen.getByRole("button", { name: "Filters resetten" }));
    expect((toggle as HTMLInputElement).checked).toBe(false);
  });
  it("calls one category per request and continues after a failure", async () => {
    const user = userEvent.setup();
    let active = 0,
      maxActive = 0;
    mocks.api.mockImplementation(async (action: string, payload: any) => {
      if (action === "list")
        return {
          posts: [initial],
          connected: true,
          capabilities: { playfieldSelection: true },
          settings: { categories: ["Golf", "Padel"] },
        };
      if (action === "discover") {
        active++;
        maxActive = Math.max(active, maxActive);
        await Promise.resolve();
        active--;
        if (payload.categories[0] === "Golf") throw new Error("Meta timeout");
        return { imported: 2 };
      }
      return { ok: true };
    });
    render(<App />);
    await screen.findByText("Een putt naast de hole");
    await user.click(screen.getByRole("button", { name: "Posts ontdekken" }));
    await screen.findByText(/2 nieuwe posts opgeslagen/);
    const calls = mocks.api.mock.calls.filter((c) => c[0] === "discover");
    expect(calls).toHaveLength(2);
    expect(calls.map((c) => c[1].categories)).toEqual([["Golf"], ["Padel"]]);
    expect(maxActive).toBe(1);
    expect(screen.getByRole("status").textContent).toContain(
      "Eerder opgeslagen resultaten blijven bewaard",
    );
  });
  it("does not count copying and opening Instagram as a publication", async () => {
    const user = userEvent.setup();
    const popup = { opener: {}, location: { href: "" }, close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
    render(<App />);
    await screen.findByText("Een putt naast de hole");
    await user.click(screen.getByRole("button", { name: /Open studio/ }));
    await user.click(
      screen.getByRole("button", { name: "Genereer drie reacties" }),
    );
    await screen.findByRole("textbox", { name: "Speels reactie" });
    await user.click(screen.getAllByRole("button", { name: "Goedkeuren" })[0]);
    await screen.findByRole("button", { name: "Als geplaatst markeren" });
    await user.click(
      screen.getByRole("button", { name: /Kopiëren en openen op Instagram/ }),
    );
    await waitFor(() => expect(popup.location.href).toBe(initial.permalink));
    expect(mocks.api.mock.calls.some((c) => c[1]?.status === "published")).toBe(
      false,
    );
    vi.restoreAllMocks();
  });
});

describe("saved playfield controls selection rather than hiding existing posts", () => {
  it("runs candidate selection one at a time and preserves results after one candidate fails", async () => {
    const user = userEvent.setup();
    mocks.api.mockImplementation(async (action: string) => {
      if (action === "list")
        return {
          posts: [initial],
          connected: true,
          capabilities: { playfieldSelection: true },
          settings: {
            categories: ["Golf"],
            discoveryFilters: {
              categories: { on: true, values: ["Golf"] },
              age: { on: false, hours: 24 },
              media: { on: false, values: ["IMAGE"] },
              hashtags: { on: false, value: "" },
              keywords: { on: false, include: "", exclude: "" },
              language: { on: false, value: "nl" },
              relevance: { on: true, minimum: 95 },
              engagement: { on: false, minLikes: 0, maxComments: 100 },
              handled: { on: false },
              sort: "newest",
            },
          },
        };
      if (action === "discover")
        return {
          imported: 0,
          candidates: [{ id: "a" }, { id: "b" }],
          criteria: "saved-filter-stamp",
        };
      if (action === "selectCandidate") {
        const count = mocks.api.mock.calls.filter(
          (c) => c[0] === "selectCandidate",
        ).length;
        if (count === 1) throw new Error("AI quota");
        return { selected: true, imported: 1 };
      }
      return { ok: true };
    });
    render(<App />);
    await screen.findByText("Een putt naast de hole");
    await user.click(screen.getByRole("button", { name: "Posts ontdekken" }));
    await screen.findByText(/1 nieuwe posts opgeslagen/);
    const calls = mocks.api.mock.calls.filter(
      (c) => c[0] === "selectCandidate",
    );
    expect(calls).toHaveLength(2);
    expect(calls[1][1]).toMatchObject({ criteria: "saved-filter-stamp" });
    expect(screen.getByText("Een putt naast de hole")).toBeTruthy();
  });
});

describe("server upgrade compatibility", () => {
  it("does not claim to apply playfield criteria against an older server", async () => {
    mocks.api.mockImplementation(async () => ({
      posts: [initial],
      connected: true,
    }));
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("Een putt naast de hole");
    expect(
      (
        screen.getByRole("button", {
          name: "Posts ontdekken",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    await user.click(
      screen.getByRole("button", { name: "Instellingen", exact: true }),
    );
    expect(
      screen.getByText(/Supabase-server moet nog worden bijgewerkt/),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Instellingen opslaan",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
