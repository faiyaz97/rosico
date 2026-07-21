import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function logInAsDemoAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("alex@rosica.test");
  await page.getByLabel("Password").fill("RosicaDemo!2026");
  await Promise.all([
    page.waitForURL(/\/app(?:\/|$)/),
    page.getByRole("button", { name: "Log in" }).click()
  ]);
}

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
  test.slow();
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
  await Promise.all([
    page.waitForURL(/leaders=30000000-0000-4000-8000-000000000002/),
    page.getByRole("option", { name: "Chess" }).click()
  ]);
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

test("Games navigation and overview match history open the history page", async ({
  page
}) => {
  const groupId = "10000000-0000-4000-8000-000000000001";
  const overview = `/app/groups/${groupId}`;
  const history = `${overview}/games`;

  await page.goto(overview);
  const visiblePrimaryNavigation = page.locator(
    'nav[aria-label="Primary navigation"]:visible'
  );
  await Promise.all([
    page.waitForURL(new RegExp(`${history}$`)),
    visiblePrimaryNavigation.getByRole("link", { name: "Games" }).click()
  ]);
  await expect(
    page.getByRole("heading", { level: 1, name: "Match history" })
  ).toBeVisible();

  await page.goto(overview);
  await Promise.all([
    page.waitForURL(new RegExp(`${history}$`)),
    page.getByRole("link", { name: "Match history" }).click()
  ]);
  await expect(
    page.getByRole("heading", { level: 1, name: "Match history" })
  ).toBeVisible();
});

test("legacy public links redirect and private groups stay unavailable", async ({
  page
}) => {
  test.slow();
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

test("public nested records remain available without an account", async ({
  page
}) => {
  test.slow();
  const base = "/app/groups/10000000-0000-4000-8000-000000000001";
  const gamePath = `${base}/games/80000000-0000-4000-8000-000000000001`;

  await page.goto(base);
  await Promise.all([
    page.waitForURL(new RegExp(`${gamePath}$`)),
    page.locator(`a[href="${gamePath}"]:visible`).click()
  ]);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Elena Rossi vs Marco Bianchi"
    })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "This page is unavailable" })
  ).toHaveCount(0);

  const competitionPath = `${base}/competitions/30000000-0000-4000-8000-000000000001`;
  const tournamentListPath = `${competitionPath}/tournaments`;
  const tournamentPath = `${tournamentListPath}/70000000-0000-4000-8000-000000000001`;
  await page.goto(competitionPath);
  await Promise.all([
    page.waitForURL(new RegExp(`${tournamentListPath}$`)),
    page.getByRole("link", { name: "Tournaments", exact: true }).click()
  ]);
  await Promise.all([
    page.waitForURL(new RegExp(`${tournamentPath}$`)),
    page.getByRole("link", { name: /Summer knockout/ }).click()
  ]);
  await expect(
    page.getByRole("heading", { level: 1, name: "Summer knockout" })
  ).toBeVisible();

  const routes = [
    {
      path: gamePath,
      heading: "Elena Rossi vs Marco Bianchi"
    },
    {
      path: `${base}/players/60000000-0000-4000-8000-000000000001`,
      heading: "Elena Rossi"
    },
    {
      path: `${base}/competitions/30000000-0000-4000-8000-000000000002/ranking`,
      heading: "Chess ranking"
    },
    {
      path: `${base}/competitions/30000000-0000-4000-8000-000000000001/games`,
      heading: "Table football games"
    },
    {
      path: `${base}/competitions/30000000-0000-4000-8000-000000000001/tournaments`,
      heading: "Table football tournaments"
    },
    {
      path: `${base}/competitions/30000000-0000-4000-8000-000000000001/tournaments/70000000-0000-4000-8000-000000000001`,
      heading: "Summer knockout"
    }
  ];

  for (const route of routes) {
    await page.goto(route.path);
    await expect(
      page.getByRole("heading", { level: 1, name: route.heading })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "This page is unavailable" })
    ).toHaveCount(0);
  }
});

test("administrator creation and settings routes render", async ({ page }) => {
  test.slow();
  const base = "/app/groups/10000000-0000-4000-8000-000000000001";
  await logInAsDemoAdmin(page);

  const recordResultPath = `${base}/games/new`;
  await page.goto(base);
  const recordResultLink = page.locator(
    `a[href="${recordResultPath}"]:visible`
  );
  await expect(recordResultLink).toBeVisible();
  await Promise.all([
    page.waitForURL(new RegExp(`${recordResultPath}$`)),
    recordResultLink.click()
  ]);
  await expect(
    page.getByRole("heading", { level: 1, name: "Record a result" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "This page is unavailable" })
  ).toHaveCount(0);

  const routes = [
    { path: recordResultPath, heading: "Record a result" },
    {
      path: `${base}/competitions/catalog`,
      heading: "Choose a competition"
    },
    {
      path: `${base}/competitions/30000000-0000-4000-8000-000000000002/settings`,
      heading: "Competition settings"
    },
    {
      path: `${base}/competitions/30000000-0000-4000-8000-000000000001/tournaments/new`,
      heading: "Create a tournament"
    }
  ];

  for (const route of routes) {
    await page.goto(route.path);
    await expect(
      page.getByRole("heading", { level: 1, name: route.heading })
    ).toBeVisible();
  }
});

test("tournament filters and participant picker respond to user input", async ({
  page
}) => {
  test.slow();
  const base =
    "/app/groups/10000000-0000-4000-8000-000000000001/competitions/30000000-0000-4000-8000-000000000001/tournaments";
  await logInAsDemoAdmin(page);

  await page.goto(base);
  const statusFilter = page.getByRole("combobox", { name: "Status" });
  await statusFilter.click();
  await Promise.all([
    page.waitForURL(new RegExp(`${base}\\?status=draft$`)),
    page.getByRole("option", { name: "Draft", exact: true }).click()
  ]);
  await expect(
    page.getByRole("heading", { name: "No draft tournaments" })
  ).toBeVisible();
  await expect(page.getByText("0 tournaments")).toBeVisible();

  await page.getByRole("combobox", { name: "Status" }).click();
  await Promise.all([
    page.waitForURL(new RegExp(`${base}\\?status=active$`)),
    page.getByRole("option", { name: "Active", exact: true }).click()
  ]);
  await expect(
    page.getByRole("heading", { name: "Summer knockout" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Office league" })
  ).toBeVisible();

  await page.goto(`${base}/new`);
  const participantSearch = page.getByRole("combobox", {
    name: "Add players"
  });
  await participantSearch.click();
  await page.getByRole("option", { name: "Amina Farah" }).click();
  await participantSearch.click();
  await page.getByRole("option", { name: "Elena Rossi" }).click();
  await expect(page.getByLabel("2 selected")).toBeVisible();
  await page.getByRole("button", { name: "Remove Amina Farah" }).click();
  await expect(page.getByLabel("1 selected")).toBeVisible();
});

test("competition settings keep validation inline and refresh saved rules", async ({
  page
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile-chromium",
    "One deterministic rule-version mutation is sufficient."
  );
  const settingsPath =
    "/app/groups/10000000-0000-4000-8000-000000000001/competitions/30000000-0000-4000-8000-000000000002/settings";
  await logInAsDemoAdmin(page);
  await page.goto(settingsPath);

  const name = page.getByRole("textbox", { name: "Name" });
  await name.fill("X");
  await page.getByRole("button", { name: "Save identity" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "between 2 and 100" })
  ).toBeVisible();
  await expect(name).toHaveValue("X");

  await name.fill("Chess");
  await page.getByRole("button", { name: "Save identity" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "identity updated" })
  ).toBeVisible();

  const version = page.getByText(/^Version \d+$/);
  const previousVersion = Number(
    (await version.textContent())?.replace(/\D/g, "")
  );

  const scoreType = page.getByRole("combobox", { name: "Score type" });
  await scoreType.click();
  await page.getByRole("option", { name: "Ordered values" }).click();
  const orderedValues = page.getByRole("textbox", {
    name: "Ordered values"
  });
  await orderedValues.fill("Only one");
  await page.getByRole("button", { name: "Save new rule version" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(scoreType).toHaveText("Ordered values");
  await expect(orderedValues).toHaveValue("Only one");

  await page.reload();
  await expect(
    page.getByRole("heading", { level: 1, name: "Competition settings" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Save new rule version" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "rule version was saved" })
  ).toBeVisible();
  await expect(version).toHaveText(`Version ${previousVersion + 1}`);
});

test("best-of-three result entry stops after two wins", async ({ page }) => {
  const resultPath =
    "/app/groups/10000000-0000-4000-8000-000000000001/games/new?competition=30000000-0000-4000-8000-000000000001&tournament=70000000-0000-4000-8000-000000000001&match=73000000-0000-4000-8000-000000000001";
  await logInAsDemoAdmin(page);
  await page.goto(resultPath);

  const sideA = page.getByRole("textbox", { name: "Elena Rossi score" });
  const sideB = page.getByRole("textbox", { name: "Luca Romano score" });
  await sideA.nth(0).fill("10");
  await sideB.nth(0).fill("8");
  await sideA.nth(1).fill("10");
  await sideB.nth(1).fill("6");

  await expect(page.getByRole("group", { name: "Game 3 of 3" })).toContainText(
    "Not needed"
  );
  await expect(
    page.getByRole("button", { name: "Save 2 results" })
  ).toBeEnabled();
});
