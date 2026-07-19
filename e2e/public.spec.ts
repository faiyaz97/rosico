import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("landing page presents the product and primary actions", async ({
  page
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    /scoreboard/i
  );
  await expect(
    page.getByRole("link", { name: /create|start|get/i }).first()
  ).toBeVisible();

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test("registration is usable at mobile width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/register");
  await expect(page.getByLabel("Display name")).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await expect(page.getByLabel(/^Password/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create account" })
  ).toBeVisible();
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
});

test("public groups use the canonical read-only application layout", async ({
  page
}) => {
  const groupId = "10000000-0000-4000-8000-000000000001";
  await page.goto(`/app/groups/${groupId}`);

  await expect(
    page.getByRole("heading", { level: 1, name: "Google Milano" })
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/app/groups/${groupId}$`));
  await expect(page.getByRole("link", { name: /record result/i })).toHaveCount(
    0
  );
  await expect(page.getByRole("link", { name: /group settings/i })).toHaveCount(
    0
  );
  await expect(page.locator(".context-tabs")).toHaveCount(0);

  const visiblePrimaryNavigation = page.locator(
    'nav[aria-label="Primary navigation"]:visible'
  );
  await expect(visiblePrimaryNavigation).toBeVisible();
  await expect(
    visiblePrimaryNavigation.getByRole("link", { name: "Overview" })
  ).toHaveAttribute("aria-current", "page");
  for (const destination of ["Players", "Competitions", "Games"]) {
    await expect(
      visiblePrimaryNavigation.getByRole("link", { name: destination })
    ).toBeVisible();
  }

  const leaderboardCompetition = page.getByLabel("Leaderboard competition");
  const leaderboardTable = page.getByRole("table");
  const marcoRankingRow = leaderboardTable.getByRole("row", {
    name: /Marco Bianchi/
  });
  await expect(leaderboardCompetition).toHaveText("All competitions");
  await expect(marcoRankingRow).toBeVisible();
  await expect(page.getByText("All time · All competitions")).toBeVisible();
  await leaderboardCompetition.click();
  await page.getByRole("option", { name: "Chess" }).click();
  await expect(page).toHaveURL(/leaders=30000000-0000-4000-8000-000000000002/);
  await expect(marcoRankingRow).toHaveCount(0);
  await expect(
    leaderboardTable.getByRole("row", { name: /Elena Rossi/ })
  ).toBeVisible();
  await expect(page.getByText("All time · Chess")).toBeVisible();

  await page.getByRole("button", { name: "Switch active group" }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  await page
    .getByRole("menu")
    .getByRole("menuitem", { name: /Google Milano/ })
    .click();
  await expect(page.getByRole("menu")).toBeHidden();
});

test("legacy public links redirect and private groups stay unavailable", async ({
  page
}) => {
  const publicId = "10000000-0000-4000-8000-000000000001";
  const privateId = "10000000-0000-4000-8000-000000000002";

  await page.goto(`/g/${publicId}`);
  await expect(page).toHaveURL(new RegExp(`/app/groups/${publicId}$`));

  await page.goto(
    `/g/${publicId}/tournaments/70000000-0000-4000-8000-000000000001`
  );
  await expect(page).toHaveURL(
    new RegExp(
      `/app/groups/${publicId}/competitions/30000000-0000-4000-8000-000000000001/tournaments/70000000-0000-4000-8000-000000000001$`
    )
  );
  await expect(
    page.getByRole("heading", { level: 1, name: "Summer knockout" })
  ).toBeVisible();

  await page.goto(
    `/app/groups/${publicId}/competitions/30000000-0000-4000-8000-000000000003/tournaments/70000000-0000-4000-8000-000000000001`
  );
  await expect(
    page.getByRole("heading", { name: "This page is unavailable" })
  ).toBeVisible();
  await expect(page.getByText("Summer knockout")).toHaveCount(0);

  const response = await page.goto(`/app/groups/${privateId}`);
  expect(response?.status()).toBe(404);
});
