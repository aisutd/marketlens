import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

// #78: before a preview has run, Try It Live shows a faded ghost dial.
// Only the drawing may be faded: no text in the empty state is drawn at
// reduced opacity, and the ghost announces no score.

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
      export const auth = { currentUser: null };
      export const firebaseSetupMessage = "";
      export const isFirebaseSetupError = () => false;
      export function onAuthStateChanged(auth, listener) {
        queueMicrotask(() => { listener(null); window.authReady = true; });
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
  cacheDir = await mkdtemp(join(tmpdir(), "marketlens-try-it-live-empty-"));
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

async function openLanding() {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    reducedMotion: "reduce",
  });
  await page.route("**/api/**", (route) => route.fulfill({ json: [] }));
  page.on("pageerror", (error) => console.error("Browser error:", error.message));
  await page.goto(baseUrl + "/");
  await page.waitForFunction(() => window.authReady);
  await page.waitForLoadState("networkidle");
  return page;
}

const resultPanel = (page) =>
  page.locator("[aria-live=polite]").filter({ hasText: "will show up here" });

test("no text in the empty state is faded", async () => {
  const page = await openLanding();
  const panel = resultPanel(page);
  assert.equal(await panel.count(), 1, "empty result panel found");

  const faded = await panel.evaluate((root) => {
    const out = [];
    for (const el of root.querySelectorAll("*")) {
      const text = [...el.childNodes]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent.trim())
        .join("");
      if (!text) continue;
      let opacity = 1;
      for (let e = el; e; e = e.parentElement) {
        opacity *= parseFloat(getComputedStyle(e).opacity);
      }
      if (opacity < 1) out.push(`${text} (opacity ${opacity.toFixed(2)})`);
    }
    return out;
  });
  await page.close();

  assert.deepEqual(faded, []);
});

test("the ghost dial announces no score; a real preview does", async () => {
  const page = await openLanding();
  const panel = resultPanel(page);

  assert.equal(
    await page.getByRole("img", { name: /preview score/i }).count(),
    0,
    "the empty state exposes a score image"
  );
  assert.match(await panel.innerText(), /awaiting preview/i);

  await page.getByRole("button", { name: /preview the score/i }).click();
  const dial = page.getByRole("img", { name: /Illustrative preview score: \d+ out of 100/ });
  await dial.waitFor();
  assert.equal(await dial.count(), 1);
  await page.close();
});
