import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { build, preview } from "vite";

// #91: the chart library loads only when a chart comes near the screen,
// so the pages' text never waits for it, and the charts still draw.

const root = fileURLToPath(new URL("..", import.meta.url));

const storageKey = "marketlens:current-analysis:v1";

const mockAuthId = "\0mock-firebase-auth";

// Optional: SCREENSHOT_DIR=<folder> saves a full-page screenshot of each page.
const screenshotDir = process.env.SCREENSHOT_DIR;

// ========================================
// MOCK FIREBASE AUTHENTICATION (ALWAYS SIGNED IN)
// ========================================

const mockFirebase = {
  name: "mock-firebase-auth",
  enforce: "pre",

  resolveId(id) {
    if (
      id === "firebase/auth" ||
      id.endsWith("/services/firebase") ||
      id === "./firebase"
    ) {
      return mockAuthId;
    }
  },

  load(id) {
    if (id !== mockAuthId) return;

    return `
      export const auth = {
        currentUser: { uid: "forecast-user", email: "forecast-user@example.com", metadata: {} }
      };
      export const firebaseSetupMessage = "";
      export const isFirebaseSetupError = () => false;
      export function onAuthStateChanged(auth, listener) {
        queueMicrotask(() => {
          listener(auth.currentUser);
          window.authReady = true;
        });
        return () => {};
      }
      export const signOut = async () => {};
      export const signInWithEmailAndPassword = async () => {};
      export const createUserWithEmailAndPassword = async () => {};
      export const updateProfile = async () => {};
    `;
  },
};

// ========================================
// FORECASTS WITH THE VALUES REPORTED IN #41
// ========================================

const metric = (value, unit, range = null) => ({
  value,
  unit,
  range,
  plus_minus: null,
});

// Yearly forecast for B002PD61Y4: 15.28% ROI next to a 4,309.45% cumulative
// return, and a category share too small to show at two decimals.
const existingForecast = {
  type: "existing",
  productId: "B002PD61Y4",
  monthly: null,
  yearly: {
    product_id: "B002PD61Y4",
    product_name: "D-Link USB adapter",
    year: 2026,
    notes: [],
    predictions: {
      avg_price: metric(24.99, "USD", [23.5, 26.1]),
      units_sold: metric(5200, "units", [4800, 5600]),
      demand_units: metric(6100, "units", [5600, 6600]),
      demand_share_pct: metric(0.003, "%", [0.001, 0.004]),
      gross_revenue: metric(129948, "USD", [120000, 140000]),
      net_profit: metric(19500, "USD", [15000, 24000]),
      profit_margin_pct: metric(15.0, "%", [12.0, 18.0]),
      roi_year_pct: metric(15.28, "%", [11.97, 18.59]),
      roi_cum_pct: metric(4309.45, "%", [4306.14, 4312.76]),
    },
  },
};

// Launch forecast with a $24.99 planned price and demand_share_pct_12m = 0.01.
const launchForecast = {
  type: "launch",
  product: {
    name: "Travel cable organiser",
    category: "Electronics",
    price: 24.99,
  },
  launch: {
    notes: [],
    predictions: {
      demand_units_12m: metric(3400, "units", [2900, 3900]),
      avg_monthly_demand_12m: metric(283, "units", [242, 325]),
      demand_share_pct_12m: metric(0.01, "%", [0.004, 0.02]),
      avg_price_12m: metric(23.49, "USD", [22.1, 24.9]),
      units_sold_12m: metric(2600, "units", [2200, 3000]),
      revenue_12m: metric(61074, "USD", [52000, 70000]),
      profit_12m: metric(5400, "USD", [2100, 8700]),
      margin_pct_12m: metric(8.8, "%", [3.4, 12.4]),
      roi_pct_12m: metric(17.9, "%", [7.0, 28.8]),
      units_sold_24m: metric(5600, "units", [4700, 6500]),
      revenue_24m: metric(131544, "USD", [110000, 150000]),
      profit_24m: metric(12900, "USD", [6000, 19800]),
      margin_pct_24m: metric(9.8, "%", [4.6, 13.2]),
      roi_pct_24m: metric(42.6, "%", [19.8, 65.4]),
      break_even_months: metric(14, "months", [10, 20]),
      never_breaks_even: metric(0.02, "%", null),
    },
  },
};

const product = { title: "Silicone Food Storage Bags", category: "270", categoryName: "Toys & Games", price: 24.99, originalPrice: 29.99, reviews: 120, stars: 4.5 };
const feasibility = { product, scoredProduct: product, prediction: { opportunity_score: 72, probability: 0.2 } };

// Feasibility draws its revenue chart once costs are entered.
async function enterCosts(page) {
  for (const [id, value] of [["units", "100"], ["manufacturing", "12"], ["shipping", "3"], ["amazonFees", "6"], ["advertising", "4"]]) {
    await page.locator(`#scenario-${id}`).fill(value);
  }
}

const pages = [
  ["Sales forecast", "/sales-forecast-overview", { forecast: existingForecast }],
  ["Launch forecast", "/sales-forecast-overview", { forecast: launchForecast }],
  ["Launch feasibility", "/launch-feasibility", feasibility, enterCosts],
];

// A chart box: the labelled role="img" element that LazyChart draws into.
const chartBoxes = (page) => page.locator('[role="img"]:has(> div.h-full.w-full)');

let outDir;
let server;
let browser;
let baseUrl;

before(async () => {
  outDir = await mkdtemp(join(tmpdir(), "marketlens-lazy-charts-"));
  await build({ root, plugins: [mockFirebase], build: { outDir, emptyOutDir: true }, logLevel: "silent" });
  server = await preview({ root, build: { outDir }, preview: { host: "127.0.0.1", port: 0 }, logLevel: "silent" });
  baseUrl = server.resolvedUrls.local[0].replace(/\/$/, "");
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
});

after(async () => {
  await browser?.close();
  await new Promise((resolve) => server?.httpServer.close(resolve));
  await rm(outDir, { recursive: true, force: true });
});

async function open(path, analysis, { blockCharts = false } = {}) {
  const page = await browser.newPage({ viewport: { width: 412, height: 823 } });
  const chartRequests = [];
  await page.route("**/api/**", (route) => route.fulfill({ json: [] }));
  await page.route("**/assets/chartLibrary-*.js", (route) => {
    chartRequests.push(route.request().url());
    return blockCharts ? route.abort() : route.continue();
  });
  await page.addInitScript(({ storageKey, analysis }) => {
    localStorage.setItem(storageKey, JSON.stringify({ version: 1, userId: "forecast-user", analysis }));
    window.__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value;
    }).observe({ type: "layout-shift", buffered: true });
  }, { storageKey, analysis });
  await page.goto(baseUrl + path);
  await page.waitForFunction(() => window.authReady);
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  await page.waitForLoadState("networkidle");
  return { page, chartRequests };
}

for (const [name, path, analysis] of pages) {
  test(`${name}: the page shows its content even if the chart code never arrives`, async () => {
    const { page } = await open(path, analysis, { blockCharts: true });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    const h1 = (await page.locator("#main-content h1").first().textContent()).trim();
    assert.ok(h1.length > 0, "the heading shows");
    assert.ok((await page.locator("main").first().innerText()).length > 500, "the page text shows");
    await page.close();
  });
}

test("Launch feasibility: no chart code is downloaded on load", async () => {
  const { page, chartRequests } = await open("/launch-feasibility", feasibility);
  await page.waitForTimeout(300);
  assert.equal(chartRequests.length, 0);
  await page.close();
});

for (const [name, path, analysis, prepare] of pages) {
  test(`${name}: each chart draws once it is scrolled to, without moving the page`, async () => {
    const { page, chartRequests } = await open(path, analysis);
    await prepare?.(page);

    const boxes = chartBoxes(page);
    const count = await boxes.count();
    assert.ok(count > 0);
    for (let i = 0; i < count; i += 1) {
      await boxes.nth(i).scrollIntoViewIfNeeded();
    }
    for (let i = 0; i < count; i += 1) {
      await boxes.nth(i).locator("svg.recharts-surface").first().waitFor({ timeout: 5000 });
    }
    assert.equal(chartRequests.length, 1, "the chart code is downloaded once");

    const cls = await page.evaluate(() => window.__cls);
    assert.ok(cls < 0.1, `layout shift ${cls.toFixed(3)}`);
    await page.close();
  });
}
