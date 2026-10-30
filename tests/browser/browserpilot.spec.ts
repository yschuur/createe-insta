import { test, expect, chromium } from "@playwright/test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
test("local extension loads with the approved-file and consent gates closed", async () => {
  let blocked = false;
  try {
    const policy = JSON.parse(
      await readFile("/etc/chromium/policies/managed/extensions.json", "utf8"),
    );
    blocked = policy.ExtensionInstallBlocklist?.includes("*");
  } catch {}
  test.skip(
    blocked,
    "Managed Chromium policy blocks installing extensions; live installation must be tested locally.",
  );
  const profile = await mkdtemp(join(tmpdir(), "createe-pilot-test-"));
  const extension = resolve("browserpilot");
  const context = await chromium.launchPersistentContext(profile, {
    headless: true,
    executablePath: "/usr/bin/chromium",
    ignoreDefaultArgs: ["--disable-extensions"],
    args: [
      "--no-sandbox",
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  try {
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent("serviceworker");
    const id = new URL(worker.url()).host;
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`chrome-extension://${id}/popup.html`);
    await expect(
      page.getByRole("button", { name: "Plaats deze goedgekeurde reactie" }),
    ).toBeDisabled();
    await page.locator("#file").setInputFiles({
      name: "draft.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          version: 1,
          status: "draft",
          text: "Not approved",
          username: "createe",
        }),
      ),
    });
    await expect(page.getByRole("status")).toContainText(
      "goedgekeurde reactie",
    );
    await expect(
      page.getByRole("button", {
        name: "Plaats deze goedgekeurde reactie",
        exact: true,
      }),
    ).toBeDisabled();
    await page.locator("#file").setInputFiles({
      name: "approved.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          version: 1,
          status: "approved",
          draftId: "d1",
          text: "Putt happens.",
          username: "createe",
          permalink: "https://www.instagram.com/p/test/",
        }),
      ),
    });
    await expect(
      page.getByRole("button", {
        name: "Plaats deze goedgekeurde reactie",
        exact: true,
      }),
    ).toBeDisabled();
    await page.getByRole("checkbox").check();
    await expect(
      page.getByRole("button", {
        name: "Plaats deze goedgekeurde reactie",
        exact: true,
      }),
    ).toBeEnabled();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test("popup validates approval and requires a separate user confirmation (mocked Chrome API)", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.assign(window.chrome || (window.chrome = {} as any), {
      storage: { local: { get: async () => ({}) } },
      runtime: {
        sendMessage: async () => ({
          status: "blocked",
          message: "Explicit test fixture: nothing published",
        }),
      },
    });
  });
  await page.goto("/browserpilot/popup.html");
  await expect(
    page.getByRole("button", {
      name: "Plaats deze goedgekeurde reactie",
      exact: true,
    }),
  ).toBeDisabled();
  await page.locator("#file").setInputFiles({
    name: "draft.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        version: 1,
        status: "draft",
        text: "Not approved",
        username: "createe",
      }),
    ),
  });
  await expect(page.getByRole("status")).toContainText("goedgekeurde reactie");
  await expect(
    page.getByRole("button", {
      name: "Plaats deze goedgekeurde reactie",
      exact: true,
    }),
  ).toBeDisabled();
  await page.locator("#file").setInputFiles({
    name: "approved.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        version: 1,
        status: "approved",
        draftId: "d1",
        text: "Putt happens.",
        username: "createe",
        permalink: "https://www.instagram.com/p/test/",
      }),
    ),
  });
  await expect(
    page.getByRole("button", {
      name: "Plaats deze goedgekeurde reactie",
      exact: true,
    }),
  ).toBeDisabled();
  await page.getByRole("checkbox").check();
  await expect(
    page.getByRole("button", {
      name: "Plaats deze goedgekeurde reactie",
      exact: true,
    }),
  ).toBeEnabled();
  await page
    .getByRole("button", {
      name: "Plaats deze goedgekeurde reactie",
      exact: true,
    })
    .click();
  await expect(page.getByRole("status")).toContainText("nothing published");
  await page
    .locator("#file")
    .setInputFiles({
      name: "another.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          version: 1,
          status: "approved",
          draftId: "d2",
          text: "Another approved comment",
          username: "createe",
          permalink: "https://www.instagram.com/p/test/",
        }),
      ),
    });
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await expect(
    page.getByRole("button", {
      name: "Plaats deze goedgekeurde reactie",
      exact: true,
    }),
  ).toBeDisabled();
});
