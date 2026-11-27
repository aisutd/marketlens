import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

// #50: no text renders below 12px. Measured in the browser, so SVG chart
// labels count at their on-screen size (font-size times the SVG's scale),
// at a desktop width and two phone widths.

const root = fileURLToPath(new URL("..", import.meta.url));
const storageKey = "marketlens:current-analysis:v1";
const mockAuthId = "\0mock-firebase-auth";
const MIN_PX = 12;
const WIDTHS = [1280, 390, 320];

const mockFirebase = {
  name: "mock-firebase-auth",
  enforce: "pre",
  resolveId(id) {
    if (id === "firebase/auth" || id.endsWith("/services/firebase") || id === "./firebase") {
      return mockAuthId;
    }
  },
  load(id) {
    if (id !== mockAuthId) return;
    return `
      export const auth = {
        currentUser: { uid: "text-size-user", email: "text-size-user@example.com", metadata: {} }
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

const metric = (value, unit, range = null) => ({ value, unit, range, plus_minus: null });

const product = { title: "Travel cable organiser", category: 1, price: 24.99 };
const scored = {
  product,
  scoredProduct: product,
  prediction: { opportunity_score: 55, probability: 0.2 },
};

const salesForecast = {
  forecast: {
    type: "existing",
    productId: "B0TEST",
    monthly: {
      product_id: "B0TEST", product_name: "Test adapter", month: "2026-10", notes: [],
      predictions: {
        avg_price: metric(24.49, "USD", [23, 26]), units_sold: metric(430, "units", [380, 480]),
        demand_units: metric(510, "units", [450, 570]), gross_revenue: metric(10530, "USD", [9300, 11800]),
        net_profit: metric(1580, "USD", [1100, 2000]), profit_margin_pct: metric(15, "%", [12, 18]),
        roi_pct: metric(1.2, "%", [0.9, 1.5]),
      },
    },
    yearly: {
      product_id: "B0TEST", product_name: "Test adapter", year: 2026, notes: [],
      predictions: {
        avg_price: metric(24.99, "USD"), units_sold: metric(5200, "units"),
        gross_revenue: metric(129948, "USD"), net_profit: metric(19500, "USD"),
        profit_margin_pct: metric(15, "%"), roi_year_pct: metric(15.28, "%"),
      },
    },
  },
};

const launchForecast = {
  forecast: {
    type: "launch",
    product: { name: "Travel cable organiser", category: "Electronics", price: 24.99 },
    launch: {
      notes: [],
      predictions: {
        revenue_12m: metric(61074, "USD"), revenue_24m: metric(131544, "USD"),
        profit_12m: metric(5400, "USD"), profit_24m: metric(12900, "USD"),
        margin_pct_12m: metric(8.8, "%"), roi_pct_12m: metric(17.9, "%"),
        units_sold_12m: metric(2600, "units"), break_even_months: metric(14, "months"),
      },
    },
  },
};

let cacheDir;
let server;
let browser;
let baseUrl;

before(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), "marketlens-text-size-"));
  server = await createServer({
    root,
    cacheDir,
    plugins: [mockFirebase],
    server: { host: "127.0.0.1", port: 0 },
    logLevel: "silent",
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

async function open(path, width, analysis) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
  await page.route("**/api/**", (route) => route.fulfill({ json: [] }));
  page.on("pageerror", (error) => console.error("Browser error:", error.message));
  if (analysis) {
    await page.addInitScript(
      ({ storageKey, analysis }) => {
        localStorage.setItem(storageKey, JSON.stringify({ version: 1, userId: "text-size-user", analysis }));
      },
      { storageKey, analysis }
    );
  }
  await page.goto(baseUrl + path);
  await page.waitForFunction(() => window.authReady);
  await page.getByRole("heading", { level: 1 }).first().waitFor();
  return page;
}

// Every visible element with its own text, rendered smaller than MIN_PX.
function tooSmall(page) {
  return page.evaluate((minPx) => {
    const found = [];
    for (const el of document.body.querySelectorAll("*")) {
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!hasText) continue;
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height) continue;
      let size = parseFloat(getComputedStyle(el).fontSize);
      const svg = el instanceof SVGElement ? el.closest("svg") : null;
      if (svg) size *= svg.getScreenCTM().a;
      if (size < minPx - 0.01) found.push(`${size.toFixed(2)}px "${el.textContent.trim().slice(0, 30)}"`);
    }
    return found;
  }, MIN_PX);
}

for (const width of WIDTHS) {
  test(`landing page and the Try It Live result at ${width}px`, async () => {
    const page = await open("/", width);
    const form = page.locator("#try form");
    await form.scrollIntoViewIfNeeded();
    await form.locator('button[type="submit"]').click();
    // The price chart is the part that scales: its labels must be measured.
    const chart = page.getByRole("img", { name: /preview score at different selling prices/ });
    await chart.waitFor();
    assert.deepEqual(await tooSmall(page), []);
    // Bigger labels on phones still fit inside the chart, not past its edges.
    const outside = await chart.evaluate((svg) => {
      const box = svg.getBoundingClientRect();
      return [...svg.querySelectorAll("text")]
        .map((t) => [t.textContent, t.getBoundingClientRect()])
        .filter(([, r]) => r.left < box.left - 0.5 || r.right > box.right + 0.5 || r.bottom > box.bottom + 0.5)
        .map(([text]) => text);
    });
    assert.deepEqual(outside, []);
    await page.close();
  });

  test(`launch feasibility with costs entered at ${width}px`, async () => {
    const page = await open("/launch-feasibility", width, scored);
    for (const [id, value] of [["scenario-units", "500"], ["scenario-manufacturing", "6"], ["scenario-shipping", "2"], ["scenario-amazonFees", "4"], ["scenario-advertising", "1.5"]]) {
      await page.locator("#" + id).fill(value);
    }
    assert.deepEqual(await tooSmall(page), []);
    await page.close();
  });

  for (const [name, analysis] of [["sales", salesForecast], ["launch", launchForecast]]) {
    test(`${name} forecast at ${width}px`, async () => {
      const page = await open("/sales-forecast-overview", width, analysis);
      assert.deepEqual(await tooSmall(page), []);
      await page.close();
    });
  }
}
