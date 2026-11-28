import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

// #93: the live results panel reads out a short summary (profit and
// margin) once input pauses, not all four metrics on every change.

const root = fileURLToPath(new URL("..", import.meta.url));

const storageKey = "marketlens:current-analysis:v1";

const mockAuthId = "\0mock-firebase-auth";


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
  cacheDir = await mkdtemp(join(tmpdir(), "marketlens-live-results-"));

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

  return page;
}

// Records every text the screen-reader summary shows, in order.
async function watchSummary(page) {
  await page.evaluate(() => {
    window.__said = [];
    const region = document.querySelector('aside [role="status"].sr-only');
    new MutationObserver(() => window.__said.push(region.textContent)).observe(region, {
      childList: true, characterData: true, subtree: true,
    });
  });
}

test("the four metrics are no longer one live region", async () => {
  const page = await openFeasibility(40);
  const live = await page.locator("aside [aria-live]:not([role=status])").count();
  assert.equal(live, 0);
  assert.equal(await page.locator("aside [aria-atomic]").count(), 0);
  await page.close();
});

test("nothing is read out on page load", async () => {
  const page = await openFeasibility(40);
  await page.waitForTimeout(1300);
  assert.equal(await page.locator('aside [role="status"].sr-only').textContent(), "");
  await page.close();
});

test("typing costs digit by digit gives one short summary after a pause", async () => {
  const page = await openFeasibility(40);
  await watchSummary(page);

  await page.locator("#scenario-units").pressSequentially("100", { delay: 60 });
  for (const [id, value] of [["manufacturing", "12"], ["shipping", "3"], ["amazonFees", "6"], ["advertising", "4"]]) {
    await page.locator(`#scenario-${id}`).pressSequentially(value, { delay: 60 });
  }
  // The visible values update straight away.
  assert.match(await page.locator("aside").first().innerText(), /\$1,500\.00/);
  assert.deepEqual(await page.evaluate(() => window.__said), [], "nothing while typing");

  await page.waitForTimeout(1300);
  assert.deepEqual(await page.evaluate(() => window.__said), [
    "Profit after variable costs $1,500.00, profit margin 37.5%.",
  ]);
  await page.close();
});

test("dragging a slider gives one summary, not one per step", async () => {
  const page = await openFeasibility(40);
  for (const [id, value] of [["units", "100"], ["manufacturing", "12"], ["shipping", "3"], ["amazonFees", "6"], ["advertising", "4"]]) {
    await page.locator(`#scenario-${id}`).fill(value);
  }
  await page.waitForTimeout(1300);
  await watchSummary(page);

  const slider = page.getByRole("slider", { name: "Monthly units sold slider" });
  await slider.focus();
  for (let i = 0; i < 10; i += 1) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(1300);
  const said = await page.evaluate(() => window.__said);
  assert.equal(said.length, 1, said.join(" | "));
  assert.match(said[0], /^Profit after variable costs \$[\d,.]+, profit margin 37\.5%\.$/);
  await page.close();
});
