import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { build, preview } from "vite";

// #84: signed-in pages must not jump while the session check runs and the
// page code loads. The total layout shift (CLS) has to stay under 0.1.

const root = fileURLToPath(new URL("..", import.meta.url));
const mockAuthId = "\0mock-firebase-auth";

// The session check answers after a delay, like real Firebase does.
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
      const user = { uid: "cls-user", email: "cls-user@example.com", metadata: {}, getIdToken: async () => "t" };
      export const auth = { currentUser: null };
      export const firebaseSetupMessage = "";
      export const isFirebaseSetupError = () => false;
      export function onAuthStateChanged(a, listener) {
        setTimeout(() => { auth.currentUser = user; listener(user); window.authReady = true; }, 600);
        return () => {};
      }
      export const signOut = async () => {};
      export const signInWithEmailAndPassword = async () => {};
      export const createUserWithEmailAndPassword = async () => {};
      export const updateProfile = async () => {};
    `;
  },
};

let outDir;
let server;
let browser;
let baseUrl;

before(async () => {
  outDir = await mkdtemp(join(tmpdir(), "marketlens-cls-"));
  await build({
    root,
    plugins: [mockFirebase],
    build: { outDir, emptyOutDir: true },
    logLevel: "silent",
  });
  server = await preview({
    root,
    build: { outDir },
    preview: { host: "127.0.0.1", port: 0 },
    logLevel: "silent",
  });
  baseUrl = server.resolvedUrls.local[0].replace(/\/$/, "");
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  });
});

after(async () => {
  await browser?.close();
  await new Promise((resolve) => server?.httpServer.close(resolve));
  await rm(outDir, { recursive: true, force: true });
});

async function layoutShift(path, viewport) {
  const page = await browser.newPage({ viewport });
  await page.route("**/api/**", (route) => route.fulfill({ json: [] }));
  // Web fonts arrive at a random time and can re-wrap text; leave them out so
  // the test measures only the app's own layout.
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.abort());
  // Slow the page code down so the "Loading..." state shows too.
  await page.route("**/assets/*.js", async (route) => {
    await new Promise((r) => setTimeout(r, 150));
    await route.continue();
  });
  await page.addInitScript(() => {
    window.__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__cls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto(baseUrl + path);
  await page.waitForFunction(() => window.authReady);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  const cls = await page.evaluate(() => window.__cls);
  await page.close();
  return cls;
}

const pages = ["/discover", "/product-overview", "/launch-feasibility", "/sales-forecast-overview"];
const viewports = {
  desktop: { width: 1280, height: 900 },
  mobile: { width: 390, height: 844 },
};

for (const [name, viewport] of Object.entries(viewports)) {
  test(`signed-in pages keep layout shift under 0.1 (${name})`, async () => {
    for (const path of pages) {
      const cls = await layoutShift(path, viewport);
      assert.ok(cls < 0.1, `${path} on ${name}: CLS ${cls.toFixed(3)}`);
    }
  });
}
