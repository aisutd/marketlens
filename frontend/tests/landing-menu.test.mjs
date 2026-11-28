import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

// #89: the landing page's mobile menu closes on Escape (focus back on the
// toggle) and on a press outside it, like the app's own Menu.

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
      const user = { uid: "menu-user", email: "menu-user@example.com", metadata: {}, getIdToken: async () => "t" };
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
  cacheDir = await mkdtemp(join(tmpdir(), "marketlens-landing-menu-"));
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

async function openMenu({ signedOut }) {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, reducedMotion: "reduce" });
  await page.route("**/api/**", (route) => route.fulfill({ json: [] }));
  await page.addInitScript((signedOut) => {
    if (signedOut) window.__signedOut = true;
  }, signedOut);
  await page.goto(baseUrl + "/");
  await page.waitForFunction(() => window.authReady);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Open menu" }).focus();
  await page.keyboard.press("Enter");
  await page.locator("#landing-mobile-menu").waitFor();
  return page;
}

const toggleState = (page) =>
  page.evaluate(() => {
    const toggle = document.querySelector('[aria-controls="landing-mobile-menu"]');
    return {
      open: Boolean(document.getElementById("landing-mobile-menu")),
      expanded: toggle.getAttribute("aria-expanded"),
      label: toggle.getAttribute("aria-label"),
      toggleFocused: document.activeElement === toggle,
    };
  });

for (const signedOut of [true, false]) {
  const who = signedOut ? "signed out" : "signed in";

  test(`${who}: Escape closes the menu and focuses the toggle`, async () => {
    const page = await openMenu({ signedOut });
    // Escape from inside the menu, not only from the toggle.
    await page.keyboard.press("Tab");
    await page.keyboard.press("Escape");
    assert.deepEqual(await toggleState(page), {
      open: false, expanded: "false", label: "Open menu", toggleFocused: true,
    });
    await page.close();
  });

  test(`${who}: a tap outside the menu closes it`, async () => {
    const page = await openMenu({ signedOut });
    await page.mouse.click(5, 600);
    assert.equal((await toggleState(page)).open, false);
    await page.close();
  });

  test(`${who}: taps inside the menu and on the toggle still work`, async () => {
    const page = await openMenu({ signedOut });
    const box = await page.locator("#landing-mobile-menu").boundingBox();
    await page.mouse.click(box.x + box.width - 5, box.y + box.height - 5);
    assert.equal((await toggleState(page)).open, true, "empty space in the menu keeps it open");
    await page.getByRole("button", { name: "Close menu" }).click();
    assert.equal((await toggleState(page)).open, false, "the toggle closes it");
    await page.getByRole("button", { name: "Open menu" }).click();
    assert.equal((await toggleState(page)).open, true, "the toggle opens it again");
    await page.close();
  });
}
