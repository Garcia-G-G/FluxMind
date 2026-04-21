import {
  test,
  expect,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

type ErrorEntry = { page: string; text: string; kind: string };

const CREDENTIALS = {
  email: "tester@fluxmind.test",
  password: "TesterPass123!",
  name: "Test User",
};

const STUDIO_CARDS = [
  "Quiz",
  "Flashcards",
  "Mini-Course",
  "Slide Deck",
  "Infographic",
  "Data Tables",
  "Mind Map",
  "Video Overview",
  "X Thread",
  "Newsletter",
  "Reel Script",
  "Deep Research",
];

const errors: ErrorEntry[] = [];
let sharedContext: BrowserContext;
let page: Page;
let createdNotebookId: string | null = null;

const attachErrorListeners = (p: Page): void => {
  p.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push({ page: p.url(), text: msg.text(), kind: "console" });
    }
  });
  p.on("pageerror", (err) => {
    errors.push({ page: p.url(), text: err.message, kind: "pageerror" });
  });
  p.on("response", (res) => {
    const status = res.status();
    if (status >= 500) {
      errors.push({
        page: p.url(),
        text: `${status} ${res.url()}`,
        kind: "response5xx",
      });
    } else if (status === 404) {
      // Record 404s for reporting (these don't fail the run, but are useful
      // for the report).
      errors.push({
        page: p.url(),
        text: `${status} ${res.url()}`,
        kind: "response404",
      });
    }
  });
};

test.describe.configure({ mode: "serial" });

test.describe("FluxMind smoke", () => {
  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    sharedContext = await browser.newContext();
    page = await sharedContext.newPage();
    attachErrorListeners(page);

    // Go to landing
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Switch to signup mode (login is default)
    const createAccountBtn = page.getByText("Create an account", { exact: true }).first();
    if (await createAccountBtn.isVisible().catch(() => false)) {
      await createAccountBtn.click();
    }

    // Wait until the heading says "Get started"
    await expect(
      page.getByRole("heading", { name: "Get started" }).first(),
    ).toBeVisible({ timeout: 5000 });

    // Fill signup form
    await page.locator("input[type='email']").first().fill(CREDENTIALS.email);
    await page.locator("input[type='password']").first().fill(CREDENTIALS.password);

    // Submit. Button label is "Get started" in signup mode.
    await page.getByRole("button", { name: /^Get started$/ }).first().click();

    // Wait for either dashboard or error message
    try {
      await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    } catch {
      // Maybe user already exists; swap to login
      const signInLink = page.getByText("Sign in", { exact: true }).first();
      if (await signInLink.isVisible().catch(() => false)) {
        await signInLink.click();
        await expect(
          page.getByRole("heading", { name: "Welcome back" }).first(),
        ).toBeVisible({ timeout: 5000 });
        await page.locator("input[type='email']").first().fill(CREDENTIALS.email);
        await page.locator("input[type='password']").first().fill(CREDENTIALS.password);
        await page.getByRole("button", { name: /^Continue$/ }).first().click();
        await page.waitForURL(/\/dashboard/, { timeout: 15000 });
      } else {
        throw new Error(
          "Signup failed and could not find Sign in toggle: " +
            (await page.content()).slice(0, 500),
        );
      }
    }
  });

  test.afterAll(async () => {
    console.log("\n===== ERROR CAPTURE DUMP =====");
    if (errors.length === 0) {
      console.log("(no console/page/5xx errors captured)");
    } else {
      const grouped: Record<string, ErrorEntry[]> = {};
      for (const e of errors) {
        const key = e.page || "<unknown>";
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(e);
      }
      for (const [url, list] of Object.entries(grouped)) {
        console.log(`\n--- ${url} ---`);
        for (const e of list) {
          console.log(`  [${e.kind}] ${e.text}`);
        }
      }
    }
    console.log("===== END ERROR DUMP =====\n");

    await sharedContext?.close();
  });

  test("1. Landing page smoke (incognito)", async ({ browser }) => {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    attachErrorListeners(p);
    try {
      await p.goto("/");
      await p.waitForLoadState("domcontentloaded");

      // Headline: "Think deeper" is a span on the landing
      await expect(p.getByText("Think deeper")).toBeVisible();

      // Capability pills — hover a few known ones
      const pills = ["Cited RAG Chat", "AI Podcasts", "Mind Maps"];
      for (const pill of pills) {
        const el = p.getByText(pill, { exact: true }).first();
        await expect(el).toBeVisible();
        await el.hover();
      }

      // Auth card heading should be "Welcome back" by default
      await expect(
        p.getByRole("heading", { name: "Welcome back" }).first(),
      ).toBeVisible();
      // Click mode toggle → "Get started"
      await p.getByText("Create an account", { exact: true }).first().click();
      await expect(
        p.getByRole("heading", { name: "Get started" }).first(),
      ).toBeVisible();

      // Pricing nav link must route
      await p.getByRole("link", { name: "Pricing", exact: true }).first().click();
      await p.waitForURL(/\/pricing/);
      await expect(p).toHaveURL(/\/pricing/);
    } finally {
      await ctx.close();
    }
  });

  test("2. Dashboard renders", async () => {
    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");

    // Greeting h1 (gradient text via inline style — matches any time-of-day)
    await expect(
      page.getByRole("heading", {
        name: /Good (morning|afternoon|evening)/i,
      }).first(),
    ).toBeVisible({ timeout: 10000 });

    // 4 stat cards. AppShell renders the main content twice (desktop md:flex +
    // mobile md:hidden), so each label appears twice in the DOM. Use .first().
    const statLabels = [
      "Active Notebooks",
      "Sources Added",
      "AI Conversations",
      "Studio Outputs",
    ];
    for (const label of statLabels) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }

    // Quick-actions New Notebook button (there may also be a sidebar one)
    const newNotebookBtns = page.getByRole("button", { name: /New Notebook/ });
    await expect(newNotebookBtns.first()).toBeVisible();
  });

  test("3. Create notebook", async () => {
    // Click the New Notebook button in the quick-actions row (the main button, not sidebar).
    // There is also a sidebar button that dispatches the "fluxmind:create-notebook" event.
    // Either one will open the dialog.
    // Target the dashboard quick-action button (second in DOM — first is sidebar).
    const buttons = page.getByRole("button", { name: /New Notebook/ });
    const count = await buttons.count();
    // Prefer the 2nd button (dashboard quick-actions) so we bypass the
    // sidebar dispatch path, but fall back to first.
    const target = count > 1 ? buttons.nth(1) : buttons.first();
    await target.click();

    // Dialog appears — input is what we actually need
    const titleInput = page.getByPlaceholder("Notebook name...").first();
    await expect(titleInput).toBeVisible({ timeout: 8000 });
    await titleInput.fill("E2E Test Notebook");
    await page.getByRole("button", { name: /^Create$/ }).first().click();

    // After creation, we are navigated to /notebook/<id>
    await page.waitForURL(/\/notebook\/[a-z0-9]+/i, { timeout: 10000 });
    const m = page.url().match(/\/notebook\/([^/?#]+)/);
    createdNotebookId = m?.[1] ?? null;
    expect(createdNotebookId).toBeTruthy();

    // Return to dashboard and verify the card exists in the grid
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "E2E Test Notebook", exact: true }).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test("4. Open notebook", async () => {
    expect(createdNotebookId).toBeTruthy();
    await page.getByRole("heading", { name: "E2E Test Notebook", exact: true }).first().click();
    await page.waitForURL(/\/notebook\/[a-z0-9]+/i, { timeout: 10000 });
    expect(page.url()).toMatch(/\/notebook\//);

    // Tabs (rendered twice: desktop + mobile). Just ensure at least one.
    for (const tab of ["Chat", "Studio", "Canvas"]) {
      await expect(
        page.getByRole("link", { name: tab, exact: true }).first(),
      ).toBeVisible();
    }
  });

  test("5. Studio smoke", async () => {
    await page.getByRole("link", { name: "Studio", exact: true }).first().click();
    await page.waitForURL(/\/studio/, { timeout: 10000 });
    await page.waitForLoadState("domcontentloaded");

    // Every card's title must render
    for (const card of STUDIO_CARDS) {
      const heading = page.getByRole("heading", { name: card, exact: true }).first();
      await expect(heading).toBeVisible({ timeout: 10000 });
    }

    // At least one Generate button must be interactive (enabled)
    const generateBtns = page.getByRole("button", { name: /^Generate$/ });
    const count = await generateBtns.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(generateBtns.nth(i)).toBeEnabled();
    }
  });

  test("6. Canvas smoke", async () => {
    expect(createdNotebookId).toBeTruthy();
    await page.goto(`/notebook/${createdNotebookId}/canvas`);
    await page.waitForLoadState("domcontentloaded");
    // Must not show the server error text
    await expect(page.getByText(/Internal Server Error/i)).toHaveCount(0);
  });

  test("7. Chat smoke", async () => {
    expect(createdNotebookId).toBeTruthy();
    await page.goto(`/notebook/${createdNotebookId}`);
    await page.waitForLoadState("domcontentloaded");

    // The chat textarea (placeholder: "Ask about your sources...")
    await expect(
      page.getByPlaceholder(/Ask about your sources/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test("8. Sidebar nav items", async () => {
    // For each link, navigate to its href directly (sidebar uses Next <Link>
    // which does soft nav and query-string updates — hitting it directly is
    // the most reliable smoke check).
    const navLinks = [
      { label: "Dashboard", href: "/dashboard", urlMatch: /\/dashboard(\?|$)/ },
      { label: "All Notebooks", href: "/dashboard?view=all", urlMatch: /view=all/ },
      { label: "Recent", href: "/dashboard?view=recent", urlMatch: /view=recent/ },
      { label: "Shared with Me", href: "/dashboard?view=shared", urlMatch: /view=shared/ },
      { label: "Starred", href: "/dashboard?view=starred", urlMatch: /view=starred/ },
    ];
    for (const { label, href, urlMatch } of navLinks) {
      // Verify the link exists in the sidebar
      await page.goto("/dashboard");
      const link = page.getByRole("link", { name: label, exact: true }).first();
      await expect(link).toBeVisible();
      // Then navigate directly (more deterministic than soft nav)
      await page.goto(href);
      await page.waitForLoadState("domcontentloaded");
      expect(page.url()).toMatch(urlMatch);
    }
    await page.goto("/dashboard");
  });

  test("9. Settings full walkthrough", async () => {
    await page.goto("/settings");
    await page.waitForLoadState("domcontentloaded");

    // Scope the tab buttons to the settings-page nav <nav> to avoid matching
    // the header bell (aria-label "Notifications") or other header/sidebar
    // buttons sharing these labels.
    const settingsNav = page.locator("nav").filter({
      has: page.getByRole("button", { name: "Profile", exact: true }),
    }).first();

    const tabs = ["Profile", "Appearance", "Notifications", "Billing", "Security"];
    for (const t of tabs) {
      const btn = settingsNav.getByRole("button", { name: t, exact: true });
      await expect(btn).toBeVisible();
      await btn.click();
      await expect(
        page.getByRole("heading", { name: t, exact: true }).first(),
      ).toBeVisible();
    }
    // Appearance: click Dark and Light. Buttons' accessible names are the
    // multi-line paragraph contents; the primary label is lowercased "dark"
    // / "light" (CSS applies `capitalize`).
    await settingsNav.getByRole("button", { name: "Appearance", exact: true }).click();
    await page
      .getByRole("button", { name: /^dark\s*Low-light/i })
      .first()
      .click();
    await page
      .getByRole("button", { name: /^light\s*Warm/i })
      .first()
      .click();
    await page
      .getByRole("button", { name: /^dark\s*Low-light/i })
      .first()
      .click();
  });

  test("10. Header controls", async () => {
    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");
    const themeBtn = page.getByRole("button", { name: "Toggle theme" }).first();
    await expect(themeBtn).toBeVisible();
    await themeBtn.click();
    await themeBtn.click();

    // Notification bell + settings + avatar container
    await expect(
      page.getByRole("button", { name: "Notifications" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Settings", exact: true }).first(),
    ).toBeVisible();
  });

  test("11. Pricing page", async () => {
    await page.goto("/pricing");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.getByText("Simple pricing,").first()).toBeVisible();
    // Three price-card anchors
    await expect(page.getByText("$0").first()).toBeVisible();
    await expect(page.getByText("$15").first()).toBeVisible();
    await expect(page.getByText("$12").first()).toBeVisible();
    for (const cta of ["Get started", "Start 7-day trial", "Contact sales"]) {
      await expect(
        page.getByRole("link", { name: cta, exact: true }).first(),
      ).toBeVisible();
    }
  });

  test("12. Sign out last", async () => {
    await page.goto("/settings");
    await page.waitForLoadState("domcontentloaded");
    const settingsNav = page.locator("nav").filter({
      has: page.getByRole("button", { name: "Profile", exact: true }),
    }).first();
    await settingsNav.getByRole("button", { name: "Security", exact: true }).click();
    await page.getByRole("button", { name: /Sign out/i }).first().click();
    await page.waitForURL(/http:\/\/localhost:4500\/($|\?)/, { timeout: 10000 });
  });

  test("13. No server 500s captured", async () => {
    const fiveHundreds = errors.filter((e) => e.kind === "response5xx");
    if (fiveHundreds.length > 0) {
      console.log("5xx responses:");
      for (const e of fiveHundreds) console.log(`  ${e.text}  (on ${e.page})`);
    }
    expect(fiveHundreds).toEqual([]);
  });
});
