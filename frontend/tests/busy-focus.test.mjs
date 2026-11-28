import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

// #86: buttons that are busy keep focus, and focus never falls to <body>
// when a request fails or a Try again succeeds.
const root = fileURLToPath(new URL("..", import.meta.url));
const storageKey = "marketlens:current-analysis:v1";
const mockAuthId = "\0mock-firebase-auth";

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
        currentUser: { uid: "focus-user", email: "focus-user@example.com", metadata: {}, getIdToken: async () => "t" }
      };
      export const firebaseSetupMessage = "";
      export const isFirebaseSetupError = () => false;
      export function onAuthStateChanged(auth, listener) {
        queueMicrotask(() => { listener(auth.currentUser); window.authReady = true; });
        return () => {};
      }
      export const signOut = async () => {};
      export const signInWithEmailAndPassword = async () => {};
      export const createUserWithEmailAndPassword = async () => {};
      export const updateProfile = async () => {};
    `;
  },
};

const product = {
  title: "Silicone Food Storage Bags",
  category: "270",
  categoryName: "Toys & Games",
  price: 24.99,
  originalPrice: 29.99,
  reviews: 120,
  stars: 4.5,
};
const analysis = {
  product,
  scoredProduct: product,
  prediction: { opportunity_score: 72, probability: 0.2 },
};

let cacheDir;
let server;
let browser;
let baseUrl;

before(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), "marketlens-busy-focus-"));
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

// `api` maps an endpoint (e.g. "/predict") to a list of responses, used in
// turn; the last one repeats. Each is { status, json, delay }. Instead of a
// list, a function gives the response for each call (React's development
// mode runs effects twice, so call counts are not reliable for page loads).
async function open(path, api = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const calls = {};
  await page.route("**/api/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    const list = api[endpoint];
    if (!list) return route.fulfill({ json: [] });
    const n = (calls[endpoint] = (calls[endpoint] ?? 0) + 1);
    const { status = 200, json = {}, delay = 0 } =
      typeof list === "function" ? list() : list[Math.min(n, list.length) - 1];
    if (delay) await new Promise((r) => setTimeout(r, delay));
    await route.fulfill({ status, json }).catch(() => {});
  });
  page.on("pageerror", (error) => console.error("Browser error:", error.message));
  await page.addInitScript(
    ({ storageKey, analysis }) => {
      localStorage.setItem(storageKey, JSON.stringify({ version: 1, userId: "focus-user", analysis }));
    },
    { storageKey, analysis }
  );
  await page.goto(baseUrl + path);
  await page.waitForFunction(() => window.authReady);
  await page.waitForLoadState("networkidle");
  return page;
}

const fail = { status: 500, json: { detail: "Server error" }, delay: 500 };
const categories = { json: [{ id: "270", name: "Toys & Games" }] };

function focused(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    return `${el.tagName} ${(el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40)}`;
  });
}

async function fillOpportunity(page) {
  await page.locator("#field-details-title").fill("Silicone Food Storage Bags");
  await page.locator("#field-details-category").selectOption("270");
  await page.locator("#field-details-price").fill("24.99");
}

test("Analyze opportunity keeps focus while loading and after a failure", async () => {
  const page = await open("/discover", { "/categories": [categories], "/predict": [fail] });
  await fillOpportunity(page);
  const button = page.getByRole("button", { name: "Analyze opportunity" });
  await button.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  assert.match(await focused(page), /^BUTTON Analyzing opportunity/, "while loading");
  await page.getByRole("alert").filter({ hasText: "Unable to complete analysis" }).waitFor();
  assert.match(await focused(page), /^BUTTON Analyze opportunity/, "after the error");
  await page.close();
});

test("sending the form with Enter from a field keeps focus off <body>", async () => {
  const page = await open("/discover", { "/categories": [categories], "/predict": [fail] });
  await fillOpportunity(page);
  await page.locator("#field-details-price").press("Enter");
  await page.waitForTimeout(150);
  assert.match(await focused(page), /^BUTTON Analyzing opportunity/);
  await page.close();
});

test("a busy button ignores presses", async () => {
  const page = await open("/discover", { "/categories": [categories], "/predict": [fail] });
  await fillOpportunity(page);
  let requests = 0;
  page.on("request", (r) => { if (r.url().endsWith("/api/predict")) requests += 1; });
  const button = page.getByRole("button", { name: "Analyze opportunity" });
  await button.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(100);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Space");
  await page.getByRole("alert").filter({ hasText: "Unable to complete analysis" }).waitFor();
  assert.equal(requests, 1);
  await page.close();
});

test("Try again on Discover categories: focus moves to the form once it works", async () => {
  let recovered = false;
  const page = await open("/discover", {
    "/categories": () => (recovered ? { ...categories, delay: 300 } : { status: 500, json: {} }),
  });
  const retry = page.getByRole("button", { name: "Try again" });
  await retry.focus();
  recovered = true;
  await page.keyboard.press("Enter");
  await page.waitForTimeout(100);
  // The notice goes away as soon as the retry starts.
  assert.notEqual(await page.evaluate(() => document.activeElement.tagName), "BODY", "while retrying");
  await page.getByRole("alert").filter({ hasText: "Categories unavailable" }).waitFor({ state: "detached" });
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => document.activeElement.tagName), "FORM");
  await page.close();
});

test("Run simulation keeps focus while loading and after a failure; Try again lands on the result", async () => {
  const ok = { json: { opportunity_score: 70, probability: 0.2, simulations: [] } };
  const page = await open("/launch-feasibility", { "/rescore": [fail, ok], "/what-if": [fail, { json: [] }] });
  const run = page.getByRole("button", { name: "Run simulation" });
  await run.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  assert.match(await focused(page), /^BUTTON Simulating/, "while loading");
  const notice = page.getByRole("alert").filter({ hasText: "Price simulation unavailable" });
  await notice.waitFor();
  assert.match(await focused(page), /^BUTTON Run simulation/, "after the error");

  await notice.getByRole("button", { name: "Try again" }).focus();
  await page.keyboard.press("Enter");
  await notice.waitFor({ state: "detached" });
  await page.waitForTimeout(150);
  assert.notEqual(await page.evaluate(() => document.activeElement.tagName), "BODY");
  await page.close();
});

test("Try again on Overview findings keeps focus in the findings", async () => {
  const reasons = { json: { reasons_up: [], reasons_down: [] }, delay: 300 };
  let recovered = false;
  const page = await open("/product-overview", {
    "/reasons": () => (recovered ? reasons : { status: 500, json: {} }),
  });
  const retry = page.getByRole("button", { name: "Try again" });
  await retry.focus();
  recovered = true;
  await page.keyboard.press("Enter");
  await page.waitForTimeout(100);
  assert.notEqual(await page.evaluate(() => document.activeElement.tagName), "BODY", "while loading");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(150);
  const where = await page.evaluate(() => {
    const el = document.activeElement;
    return { tag: el.tagName, inFindings: Boolean(el.closest("section")?.textContent.includes("What should you know?")) };
  });
  assert.notEqual(where.tag, "BODY");
  assert.equal(where.inFindings, true);
  await page.close();
});
