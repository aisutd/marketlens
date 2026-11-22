import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

import { returnPathFrom } from "../src/services/returnPath.js";

const root = fileURLToPath(new URL("..", import.meta.url));

const mockAuthId = "\0mock-firebase-auth";

// ========================================
// MOCK FIREBASE AUTHENTICATION
// ========================================

// Behaves like the real SDK in the two ways that matter here: a listener is
// called with the current user as soon as it subscribes, and signing in or up
// notifies listeners before the returned promise resolves.
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
      const savedUid = sessionStorage.getItem("mock-uid");

      export const auth = {
        currentUser: savedUid ? { uid: savedUid, email: savedUid + "@example.com", metadata: {} } : null
      };

      export const firebaseSetupMessage = "";
      export const isFirebaseSetupError = () => false;

      const listeners = new Set();

      function setUser(uid) {
        if (uid) sessionStorage.setItem("mock-uid", uid);
        else sessionStorage.removeItem("mock-uid");
        auth.currentUser = uid ? { uid, email: uid + "@example.com", metadata: {} } : null;
        for (const listener of listeners) listener(auth.currentUser);
      }

      export function onAuthStateChanged(auth, listener) {
        listeners.add(listener);
        queueMicrotask(() => {
          listener(auth.currentUser);
          window.authReady = true;
        });
        return () => listeners.delete(listener);
      }

      export const signOut = async () => setUser(null);

      export async function signInWithEmailAndPassword(auth, email) {
        setUser(email.split("@")[0]);
        return { user: auth.currentUser };
      }

      export async function createUserWithEmailAndPassword(auth, email) {
        setUser(email.split("@")[0]);
        return { user: auth.currentUser };
      }

      export const updateProfile = async () => {};
    `;
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
  cacheDir = await mkdtemp(join(tmpdir(), "marketlens-login-return-"));

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

async function openPage(path) {
  const page = await browser.newPage();

  await page.route("**/api/**", (route) => route.fulfill({ json: [] }));
  page.on("pageerror", (error) => {
    console.error("Browser error:", error.message);
  });

  await page.goto(baseUrl + path);
  await page.waitForFunction(() => window.authReady);

  return page;
}

function pathOf(page) {
  const url = new URL(page.url());
  return url.pathname + url.search + url.hash;
}

async function logIn(page, uid) {
  await page.locator("#login-email").fill(uid + "@example.com");
  await page.locator("#login-password").fill("secret123");
  await page.getByRole("button", { name: "Sign In" }).click();
}

// ========================================
// SIGN IN RETURNS TO THE REQUESTED PAGE
// ========================================

test("signing in after a redirect lands on the page that was asked for", async () => {
  const page = await openPage("/score-details");

  await page.waitForURL("**/login");
  await logIn(page, "returning-user");

  await page.waitForURL("**/score-details");
  assert.equal(pathOf(page), "/score-details");
  await page.close();
});

test("the query string of the requested page survives sign-in", async () => {
  const page = await openPage("/saved-products?sort=recent");

  await page.waitForURL("**/login");
  await logIn(page, "query-user");

  await page.waitForURL("**/saved-products?sort=recent");
  assert.equal(pathOf(page), "/saved-products?sort=recent");
  await page.close();
});

test("going from login to sign-up keeps the requested page", async () => {
  const page = await openPage("/launch-feasibility");

  await page.waitForURL("**/login");
  await page.getByRole("link", { name: "Create an account" }).click();
  await page.waitForURL("**/signup");

  await page.locator("input[type=email]").fill("new-user@example.com");
  const passwords = page.locator("input[type=password]");
  await passwords.nth(0).fill("secret123");
  await passwords.nth(1).fill("secret123");
  await page.locator("form button[type=submit]").click();

  await page.waitForURL("**/launch-feasibility");
  assert.equal(pathOf(page), "/launch-feasibility");
  await page.close();
});

test("signing in from /login directly lands on Discover", async () => {
  const page = await openPage("/login");

  await logIn(page, "direct-user");

  await page.waitForURL("**/discover");
  assert.equal(pathOf(page), "/discover");
  await page.close();
});

// ========================================
// SIGNED-IN USERS SKIP THE SIGN-IN PAGES
// ========================================

for (const authPage of ["/login", "/signup"]) {
  test(`a signed-in user opening ${authPage} goes to Discover`, async () => {
    const page = await openPage("/");
    await page.evaluate(() => sessionStorage.setItem("mock-uid", "signed-in-user"));

    await page.goto(baseUrl + authPage);
    await page.waitForURL("**/discover");
    assert.equal(pathOf(page), "/discover");
    await page.close();
  });
}

// ========================================
// ONLY IN-APP PATHS ARE ACCEPTED
// ========================================

test("returnPathFrom accepts only in-app paths", () => {
  const from = (location) => ({ from: location });

  assert.equal(returnPathFrom(from({ pathname: "/score-details" })), "/score-details");
  assert.equal(
    returnPathFrom(from({ pathname: "/saved-products", search: "?a=1", hash: "#top" })),
    "/saved-products?a=1#top"
  );

  for (const state of [
    undefined,
    null,
    {},
    { from: null },
    { from: "/score-details" },
    from({}),
    from({ pathname: 42 }),
    from({ pathname: "" }),
    from({ pathname: "https://evil.example/" }),
    from({ pathname: "//evil.example/" }),
    from({ pathname: "/\\evil.example/" }),
    from({ pathname: "javascript:alert(1)" }),
    from({ pathname: "/login" }),
    from({ pathname: "/signup" }),
  ]) {
    assert.equal(returnPathFrom(state), "/discover", JSON.stringify(state));
  }

  // A search or hash that is not one is dropped rather than glued onto the path.
  assert.equal(
    returnPathFrom(from({ pathname: "/discover", search: "//evil.example", hash: 7 })),
    "/discover"
  );
});
