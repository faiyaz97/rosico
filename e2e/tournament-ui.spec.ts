import { expect, test } from "@playwright/test";

const groupBase = "/app/groups/10000000-0000-4000-8000-000000000001";

test("tournament bracket keeps navigation and scores usable without overflow", async ({
  page
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto(
    `${groupBase}/competitions/30000000-0000-4000-8000-000000000001/tournaments/70000000-0000-4000-8000-000000000001`
  );

  const backLink = page.getByRole("link", { name: "Tournaments" }).first();
  const hero = page.locator(".tournament-hero");
  await expect(backLink).toBeVisible();
  await expect(backLink).toHaveAttribute(
    "href",
    `${groupBase}/competitions/30000000-0000-4000-8000-000000000001/tournaments`
  );
  const [backBox, heroBox] = await Promise.all([
    backLink.boundingBox(),
    hero.boundingBox()
  ]);
  expect(backBox).not.toBeNull();
  expect(heroBox).not.toBeNull();
  expect(backBox!.x).toBeLessThan(heroBox!.x + 24);

  const bracket = page.getByRole("region", {
    name: "Single elimination bracket"
  });
  await expect(bracket).toBeVisible();
  await expect(
    bracket.getByRole("columnheader", { name: "G1" }).first()
  ).toBeVisible();
  await expect(
    bracket.getByRole("columnheader", { name: "G3" }).first()
  ).toBeVisible();
  await bracket.focus();
  await expect(bracket).toBeFocused();

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
  expect(consoleErrors).toEqual([]);
});

test("player search filters and recovers from an empty result", async ({
  page
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto(`${groupBase}/players`);
  const search = page.getByRole("searchbox", { name: "Search players" });
  await expect(search).toBeVisible();
  await search.fill("elena");
  await expect(page.getByRole("link", { name: /Elena Rossi/ })).toBeVisible();
  await expect(page.locator(".entity-list .entity-row")).toHaveCount(1);

  await search.fill("no such player");
  await expect(page.getByText("No matching players")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(search).toHaveValue("");
  await expect(page.locator(".entity-list .entity-row")).not.toHaveCount(0);

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
  expect(consoleErrors).toEqual([]);
});
