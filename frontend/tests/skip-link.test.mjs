import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

// #76: the skip link's target id exists once per page, and following the
// link moves focus past the page's header into its main content.

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
      const user = { uid: "skip-user", email: "skip-user@example.com", metadata: {}, getIdToken: async () => "t" };
      export const auth = { get currentUser() { return window.__signedOut ? null : user; } };
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

const product = { title: "Silicone Food Storage Bags", category: "270", price: 24.99 };
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
  cacheDir = await mkdtemp(join(tmpdir(), "marketlens-skip-link-"));
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

async function open(path, { signedOut = false } = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.route("**/api/**", (route) => route.fulfill({ json: [] }));
  page.on("pageerror", (error) => console.error("Browser error:", error.message));
  await page.addInitScript(
    ({ storageKey, analysis, signedOut }) => {
      if (signedOut) window.__signedOut = true;
      localStorage.setItem(
        storageKey,
        JSON.stringify({ version: 1, userId: "skip-user", analysis })
      );
    },
    { storageKey, analysis, signedOut }
  );
  await page.goto(baseUrl + path);
  await page.waitForFunction(() => window.authReady);
  await page.waitForLoadState("networkidle");
  return page;
}

// Follows the skip link with the keyboard and reports where the next Tab
// lands, relative to the page's header and main landmark.
async function followSkipLink(page) {
  await page.keyboard.press("Tab");
  const skip = await page.evaluate(() => ({
    text: document.activeElement.textContent.trim(),
    href: document.activeElement.getAttribute("href"),
  }));
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  return {
    skip,
    next: await page.evaluate(() => {
      const el = document.activeElement;
      return {
        text: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40),
        inHeader: Boolean(el.closest("header")),
        inMain: Boolean(el.closest("main")),
      };
    }),
    targets: await page.evaluate(() =>
      [...document.querySelectorAll("#main-content")].map((el) => el.tagName)
    ),
  };
}

const pages = [
  ["/", { signedOut: true }],
  ["/", {}],
  ["/discover", {}],
  ["/product-overview", {}],
];

for (const [path, options] of pages) {
  const label = `${path}${options.signedOut ? " (signed out)" : ""}`;

  test(`skip link on ${label} lands in the main content`, async () => {
    const page = await open(path, options);
    const { skip, next, targets } = await followSkipLink(page);
    await page.close();

    assert.equal(skip.href, "#main-content", "first Tab stop is the skip link");
    assert.equal(targets.length, 1, `#main-content appears ${targets.length} times`);
    assert.equal(next.inHeader, false, `next Tab went to the header: "${next.text}"`);
    assert.equal(next.inMain, true, `next Tab is outside <main>: "${next.text}"`);
  });
}
