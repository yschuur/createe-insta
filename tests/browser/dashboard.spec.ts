import { test, expect } from "@playwright/test";
test("configuration dashboard works on desktop and mobile without fabricated activity", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Goed spel begint hier." }),
  ).toBeVisible();
  await expect(
    page.getByText("Je werkplek staat klaar voor configuratie."),
  ).toBeVisible();
  await expect(page.locator(".stat-card strong")).toHaveText([
    "0",
    "0",
    "0",
    "0",
  ]);
  await page.getByRole("button", { name: "Instellingen", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Instagram koppelen" }),
  ).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "Ontdekken", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ontdek nieuwe posts" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: "/tmp/createe-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.getByRole("button", { name: "Overzicht", exact: true }).click();
  await page.screenshot({ path: "/tmp/createe-dashboard.png", fullPage: true });
});
