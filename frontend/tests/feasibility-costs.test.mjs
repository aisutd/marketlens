import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

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
        currentUser: { uid: "feasibility-user", email: "feasibility-user@example.com", metadata: {} }
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
// A SCORED PRODUCT AT THE THREE PRICES FROM #40
// ========================================

const PRICES = [15, 40, 200];

function analysisAt(price) {
  const product = {
    title: `Test product at $${price}`,
    category: 1,
    price,
  };

  return {
    product,
    scoredProduct: product,
    prediction: { opportunity_score: 55, probability: 0.2 },
  };
}

// ========================================
// TEST SERVER AND BROWSER
// ========================================

let cacheDir;
let server;
let browser;
let baseUrl;

before(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), "marketlens-feasibility-costs-"));

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

async function openFeasibility(price) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.route("**/api/**", (route) => route.fulfill({ json: [] }));
  page.on("pageerror", (error) => {
    console.error("Browser error:", error.message);
  });

  // Seed the saved analysis before any app code runs, so nothing overwrites it.
  await page.addInitScript(
    ({ storageKey, analysis }) => {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ version: 1, userId: "feasibility-user", analysis })
      );
    },
    { storageKey, analysis: analysisAt(price) }
  );

  await page.goto(baseUrl + "/launch-feasibility");
  await page.waitForFunction(() => window.authReady);
  await page.getByRole("heading", { level: 1 }).first().waitFor();

  if (screenshotDir) {
    await page.screenshot({ path: join(screenshotDir, `feasibility-${price}.png`), fullPage: true });
  }

  return page;
}

async function mainText(page) {
  return page.locator("main").first().innerText();
}

// ========================================
// NOTHING IS CALCULATED BEFORE THE USER ENTERS COSTS
// ========================================

for (const price of PRICES) {
  test(`at $${price} the page shows no profit or loss until costs are entered`, async () => {
    const page = await openFeasibility(price);
    const text = await mainText(page);

    assert.match(text, /Enter your costs to see profit and margin/);
    assert.doesNotMatch(text, /Not calculated/);
    assert.doesNotMatch(text, /-\$[\d,]/, "no loss shown");
    assert.doesNotMatch(text, /Enter valid assumptions/, "blank isn't an error");

    // Units and costs are empty, not prefilled.
    for (const id of ["units", "manufacturing", "shipping", "amazonFees", "advertising"]) {
      assert.equal(await page.locator(`#scenario-${id}`).inputValue(), "", `${id} starts empty`);
    }

    // The price simulation only needs a price.
    assert.equal(await page.getByRole("button", { name: /Run simulation/ }).isDisabled(), false);
    await page.close();
  });
}

// ========================================
// ENTERED COSTS GIVE THE MATCHING RESULT
// ========================================

test("profit and break-even price follow the costs the user enters", async () => {
  const page = await openFeasibility(40);

  await page.locator("#scenario-units").fill("100");
  await page.locator("#scenario-manufacturing").fill("12");
  await page.locator("#scenario-shipping").fill("3");
  await page.locator("#scenario-amazonFees").fill("6");
  await page.locator("#scenario-advertising").fill("4");

  // $40 price - $25 costs = $15 a unit, x 100 units.
  const text = await mainText(page);
  assert.match(text, /\$1,500\.00/, "profit after variable costs");
  assert.match(text, /Break-even price\s+\$25\.00/, "break-even price equals the cost per unit");
  assert.doesNotMatch(text, /Enter your costs to see profit and margin/);
  await page.close();
});
