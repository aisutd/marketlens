import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

import { formatPercent } from "../src/services/formatPercent.js";

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

// ========================================
// TEST SERVER AND BROWSER
// ========================================

let cacheDir;
let server;
let browser;
let baseUrl;

before(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), "marketlens-forecast-numbers-"));

  server = await createServer({
    root,
    cacheDir,
    plugins: [mockFirebase],
    server: { host: "127.0.0.1", port: 0 },
  });
  await server.listen();
  baseUrl = `http://127.0.0.1:${server.httpServer.address().port}`;

  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  });
});

after(async () => {
  await browser?.close();
  await server?.close();
  await rm(cacheDir, { recursive: true, force: true });
});

async function openForecast(forecast, name) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.route("**/api/**", (route) => route.fulfill({ json: [] }));
  page.on("pageerror", (error) => {
    console.error("Browser error:", error.message);
  });

  // Seed the saved analysis before any app code runs, so nothing overwrites it.
  await page.addInitScript(
    ({ storageKey, forecast }) => {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          version: 1,
          userId: "forecast-user",
          analysis: { forecast },
        })
      );
    },
    { storageKey, forecast }
  );

  await page.goto(baseUrl + "/sales-forecast-overview");
  await page.waitForFunction(() => window.authReady);
  await page.getByRole("heading", { level: 1 }).first().waitFor();

  if (screenshotDir) {
    await page.screenshot({ path: join(screenshotDir, `${name}.png`), fullPage: true });
  }

  return page;
}

async function mainText(page) {
  return page.locator("main").first().innerText();
}

// ========================================
// EXISTING PRODUCT PAGE
// ========================================

test("the existing-product page shows no cumulative return next to its yearly ROI", async () => {
  const page = await openForecast(existingForecast, "existing-yearly");
  const text = await mainText(page);

  assert.match(text, /15\.28%/, "the yearly ROI is still shown");
  assert.doesNotMatch(text, /cumulative/i);
  assert.doesNotMatch(text, /4,?309/);

  // Nor in the "Returns" detail group.
  await page.getByRole("radio", { name: "Returns", exact: true }).click();
  const returns = await mainText(page);
  assert.match(returns, /annual return on investment/i);
  assert.doesNotMatch(returns, /cumulative/i);
  await page.close();
});

test("the existing-product page shows a tiny category share as under 0.01%", async () => {
  const page = await openForecast(existingForecast, "existing-yearly-share");

  // The share sits in the "Demand" detail group.
  await page.getByRole("radio", { name: "Demand", exact: true }).click();
  const text = await mainText(page);

  assert.match(text, /under 0\.01%/);
  assert.doesNotMatch(text, /(?<![\d.])0\.00%/);
  assert.doesNotMatch(text, /under 0\.01% – under 0\.01%/);
  await page.close();
});

// ========================================
// LAUNCH PAGE
// ========================================

test("the launch page shows prices to the cent and no 0.0% metric", async () => {
  const page = await openForecast(launchForecast, "launch");

  // The prices sit in the collapsed "Product and pricing details" panel.
  await page.getByRole("button", { name: /Product and pricing details/ }).click();
  const text = await mainText(page);

  assert.match(text, /\$24\.99/, "planned price to the cent");
  assert.match(text, /\$23\.49/, "average selling price to the cent");
  assert.doesNotMatch(text, /\$25(?![\d.,])/, "planned price not rounded up");

  assert.match(text, /under 0\.1%/, "the tiny share is labelled, not 0.0%");
  assert.doesNotMatch(text, /(?<![\d.])0\.0%/);
  assert.doesNotMatch(text, /under 0\.1% – under 0\.1%/);

  // Large totals keep whole dollars.
  assert.match(text, /\$5,400(?!\.)/);
  await page.close();
});

// ========================================
// PERCENT FORMATTING
// ========================================

test("formatPercent never rounds a non-zero value to a bare zero", () => {
  assert.equal(formatPercent(0.01, 1), "under 0.1%");
  assert.equal(formatPercent(0.049, 1), "under 0.1%");
  assert.equal(formatPercent(0.05, 1), "0.1%");
  assert.equal(formatPercent(0.003, 2), "under 0.01%");
  assert.equal(formatPercent(0.005, 2), "0.01%");
  assert.equal(formatPercent(-0.01, 1), "just under 0.0%");
  assert.equal(formatPercent(0, 1), "0.0%");
  assert.equal(formatPercent(15.28, 2), "15.28%");
  assert.equal(formatPercent(-16.7, 1), "-16.7%");
});
