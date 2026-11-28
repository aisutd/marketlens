import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

// #85: after moving to another page inside the app, focus lands on the new
// page's heading so screen readers announce it. The first load leaves focus
// alone so the skip link stays the first Tab stop.

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
  cacheDir = await mkdtemp(join(tmpdir(), "marketlens-route-focus-"));
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

async function open(path) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    reducedMotion: "reduce",
  });
  await page.route("**/api/**", (route) => route.fulfill({ json: [] }));
  page.on("pageerror", (error) => console.error("Browser error:", error.message));
  await page.addInitScript(
    ({ storageKey, analysis }) => {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ version: 1, userId: "focus-user", analysis })
      );
    },
    { storageKey, analysis }
  );
  await page.goto(baseUrl + path);
  await page.waitForFunction(() => window.authReady);
  await page.waitForLoadState("networkidle");
  return page;
}

// Walks the page with Tab and returns the text boxes whose surroundings
// look the same focused and unfocused.
// Describes the focused element, e.g. "H1 Discover products".
function focused(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    return `${el.tagName} ${el.textContent.trim().replace(/\s+/g, " ").slice(0, 60)}`;
  });
}

async function viaMenu(page, item) {
  await page.getByRole("button", { name: "Open navigation menu" }).click();
  await page.getByRole("navigation", { name: "Main navigation" }).getByText(item, { exact: true }).click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(300);
}

async function headingText(page) {
  return (await page.locator("#main-content h1").first().textContent()).trim().replace(/\s+/g, " ").slice(0, 60);
}

test("first load leaves focus alone; the skip link is the first Tab stop", async () => {
  const page = await open("/product-overview");
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => document.activeElement.tagName), "BODY");
  await page.keyboard.press("Tab");
  assert.match(await focused(page), /^A Skip to content/);
  await page.close();
});

test("Menu → Discover Products moves focus to the Discover heading", async () => {
  const page = await open("/product-overview");
  await viaMenu(page, "Discover Products");
  assert.equal(new URL(page.url()).pathname, "/discover");
  assert.equal(await focused(page), `H1 ${await headingText(page)}`);
  await page.close();
});

test("Menu → New analysis on the overview moves focus to the Discover heading", async () => {
  const page = await open("/product-overview");
  await viaMenu(page, "New analysis");
  assert.equal(new URL(page.url()).pathname, "/discover");
  assert.equal(await focused(page), `H1 ${await headingText(page)}`);
  await page.close();
});

test("each page reached from the Menu gets focus on its heading", async () => {
  const page = await open("/discover");
  for (const [item, path] of [["Saved Products", "/saved-products"], ["Profile", "/profile"], ["Discover Products", "/discover"]]) {
    await viaMenu(page, item);
    assert.equal(new URL(page.url()).pathname, path);
    assert.equal(await focused(page), `H1 ${await headingText(page)}`, path);
  }
  await page.close();
});

test("the focused heading gets no focus outline", async () => {
  const page = await open("/product-overview");
  await viaMenu(page, "Discover Products");
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  assert.equal(outline, "none");
  await page.close();
});
