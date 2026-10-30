// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// Plain JavaScript is intentional: Chrome injects this self-contained function.
// @ts-expect-error browser extension source is tested directly, not part of the TS app.
import { runApprovedComment } from "../browserpilot/automation.js";
const job = {
  version: 1,
  status: "approved",
  draftId: "d1",
  username: "createe",
  permalink: "https://www.instagram.com/p/test/",
  text: "Putt happens.",
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("location", {
    hostname: "www.instagram.com",
    origin: "https://www.instagram.com",
    pathname: "/p/test/",
  });
  document.body.innerHTML =
    '<nav><a href="/createe/">Profile</a></nav><article><ul></ul><form><textarea aria-label="Add a comment"></textarea><button type="submit">Post</button></form></article>';
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});
async function complete(promise: Promise<any>) {
  await vi.runAllTimersAsync();
  return promise;
}
describe("local browserpilot against explicit synthetic DOM fixtures", () => {
  it("fills and submits once, and confirms only an exact comment by the expected account", async () => {
    let submits = 0;
    document.querySelector("form")!.addEventListener("submit", (e) => {
      e.preventDefault();
      submits++;
      document.querySelector("ul")!.innerHTML =
        '<li><a href="/createe/">createe</a><span>Putt happens.</span></li>';
      document.querySelector("textarea")!.value = "";
    });
    const result = await complete(runApprovedComment(job));
    expect(result.status).toBe("observed");
    expect(submits).toBe(1);
  });
  it("blocks if the account cannot be confirmed, without entering or submitting text", async () => {
    document.querySelector("nav a")!.setAttribute("href", "/another-account/");
    const click = vi.spyOn(document.querySelector("button")!, "click");
    expect((await complete(runApprovedComment(job))).status).toBe("blocked");
    expect(click).not.toHaveBeenCalled();
    expect(document.querySelector("textarea")!.value).toBe("");
  });
  it("never submits twice on an ambiguous outcome", async () => {
    let submits = 0;
    document.querySelector("form")!.addEventListener("submit", (e) => {
      e.preventDefault();
      submits++;
    });
    expect((await complete(runApprovedComment(job))).status).toBe("uncertain");
    expect(submits).toBe(1);
  });
  it("does not overwrite an existing draft or submit an already visible comment", async () => {
    document.querySelector("textarea")!.value = "My unfinished draft";
    expect((await complete(runApprovedComment(job))).status).toBe("blocked");
    document.querySelector("textarea")!.value = "";
    document.querySelector("ul")!.innerHTML =
      '<li><a href="/createe/">createe</a><span>Putt happens.</span></li>';
    const click = vi.spyOn(document.querySelector("button")!, "click");
    expect((await complete(runApprovedComment(job))).status).toBe(
      "already_present",
    );
    expect(click).not.toHaveBeenCalled();
  });
  it("refuses a different post or a login screen", async () => {
    expect(
      (
        await complete(
          runApprovedComment({
            ...job,
            permalink: "https://www.instagram.com/p/other/",
          }),
        )
      ).status,
    ).toBe("blocked");
    document.body.innerHTML = '<input type="password">';
    expect((await complete(runApprovedComment(job))).status).toBe("blocked");
  });
  it("does not treat a matching text by another author as a confirmed publication", async () => {
    document.querySelector("form")!.addEventListener("submit", (e) => {
      e.preventDefault();
      document.querySelector("ul")!.innerHTML =
        '<li><a href="/someone-else/">Other</a><span>Putt happens.</span></li>';
      document.querySelector("textarea")!.value = "";
    });
    expect((await complete(runApprovedComment(job))).status).toBe("uncertain");
  });
  it("does not treat a mention of the expected account as the author", async () => {
    document.querySelector("form")!.addEventListener("submit", (e) => {
      e.preventDefault();
      document.querySelector("ul")!.innerHTML =
        '<li><a href="/someone-else/">Other</a><a href="/createe/">Tagged account</a><span>Putt happens.</span></li>';
      document.querySelector("textarea")!.value = "";
    });
    expect((await complete(runApprovedComment(job))).status).toBe("uncertain");
  });
});
