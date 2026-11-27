import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

// #77: an address with no page shows a not-found page, signed in or out,
// and keeps the address, instead of redirecting to Discover or the login.

const root = fileURLToPath(new URL("..", import.meta.url));
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
      const user = { uid: "nf-user", email: "nf-user@example.com", metadata: {}, getIdToken: async () => "t" };
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

let cacheDir;
let server;
let browser;
let baseUrl;

before(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), "marketlens-not-found-"));
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

async function visit(path, { signedOut = false } = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.route("**/api/**", (route) => route.fulfill({ json: [] }));
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript((signedOut) => {
    if (signedOut) window.__signedOut = true;
  }, signedOut);
  await page.goto(baseUrl + path);
  await page.waitForFunction(() => window.authReady);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(200);

  const result = {
    path: new URL(page.url()).pathname,
    title: await page.title(),
    h1: (await page.locator("h1").allTextContents()).map((t) => t.trim()),
    hasHeader: (await page.locator("header").count()) > 0,
    links: (await page.locator("main a").allTextContents()).map((t) => t.trim()),
    targets: await page.locator("#main-content").count(),
    errors,
  };
  await page.close();
  return result;
}

test("signed out: an unknown address shows the not-found page and stays put", async () => {
  const r = await visit("/no-such-page", { signedOut: true });
  assert.equal(r.path, "/no-such-page");
  assert.deepEqual(r.h1, ["Page not found."]);
  assert.equal(r.title, "Page not found · MarketLens");
  assert.equal(r.hasHeader, false, "no app header (it would redirect to /login)");
  assert.deepEqual(r.links, ["Back to home", "Log in"]);
  assert.equal(r.targets, 1, "skip link target exists once");
  assert.deepEqual(r.errors, []);
});

test("signed in: an unknown address shows the not-found page with the app header", async () => {
  const r = await visit("/saved-product/123");
  assert.equal(r.path, "/saved-product/123");
  assert.deepEqual(r.h1, ["Page not found."]);
  assert.equal(r.title, "Page not found · MarketLens");
  assert.equal(r.hasHeader, true);
  assert.deepEqual(r.links, ["Go to Discover", "Back to home"]);
  assert.equal(r.targets, 1);
  assert.deepEqual(r.errors, []);
});

test("known pages are not mistaken for unknown ones", async () => {
  // The router ignores case and a trailing slash; so must the not-found check.
  for (const path of ["/discover", "/Discover/", "/profile/"]) {
    const r = await visit(path);
    assert.notDeepEqual(r.h1, ["Page not found."], path);
    assert.notEqual(r.title, "Page not found · MarketLens", path);
    assert.equal(r.hasHeader, true, path);
  }

  const r = await visit("/discover", { signedOut: true });
  assert.equal(r.path, "/login", "protected pages still send signed-out visitors to log in");
});
