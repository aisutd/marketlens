import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

// #75: every text box reached with Tab must look different when focused.
// Tabbing into a text box selects its value, and the selection highlight
// alone would pass a before/after comparison, so the caret is moved to
// the end first: what is left is the box's own focus style.

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
  cacheDir = await mkdtemp(join(tmpdir(), "marketlens-focus-visible-"));
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
async function textBoxesWithoutFocusStyle(page) {
  const checked = [];
  const unchanged = [];

  for (let i = 0; i < 120; i += 1) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      // Mark elements rather than keying them by position: the sticky
      // header moves with the scroll the checks below cause.
      const seen = el.hasAttribute("data-focus-walk");
      el.setAttribute("data-focus-walk", "");
      return {
        seen,
        isTextBox:
          el.tagName === "TEXTAREA" ||
          (el.tagName === "INPUT" &&
            ["text", "search", "email", "password", "number", "tel", "url"].includes(el.type)),
        name: el.id || el.name || el.getAttribute("aria-label") || el.outerHTML.slice(0, 60),
      };
    });
    if (!stop) continue;
    if (stop.seen) break;
    if (!stop.isTextBox) continue;

    await page.keyboard.press("End");
    const clip = await page.evaluate(() => {
      const el = document.activeElement;
      el.scrollIntoView({ block: "center", behavior: "instant" });
      const box = (el.closest("label, div") || el).getBoundingClientRect();
      const pad = 8;
      const x = Math.max(0, box.left - pad);
      const y = Math.max(0, box.top - pad);
      return {
        x,
        y,
        width: Math.min(innerWidth - x, box.width + 2 * pad),
        height: Math.min(innerHeight - y, box.height + 2 * pad),
      };
    });
    const focused = await page.screenshot({ clip });
    await page.evaluate(() => {
      window.__lastFocus = document.activeElement;
      document.activeElement.blur();
    });
    const blurred = await page.screenshot({ clip });
    await page.evaluate(() =>
      window.__lastFocus.focus({ focusVisible: true, preventScroll: true })
    );

    checked.push(stop.name);
    if (focused.equals(blurred)) unchanged.push(stop.name);
  }

  return { checked, unchanged };
}

for (const path of ["/discover", "/product-overview", "/launch-feasibility"]) {
  test(`text boxes on ${path} show a focus style`, async () => {
    const page = await open(path);
    const { checked, unchanged } = await textBoxesWithoutFocusStyle(page);
    await page.close();

    assert.ok(checked.length > 0, `no text boxes reached with Tab on ${path}`);
    assert.deepEqual(unchanged, [], `no visible focus on ${path}`);
  });
}

test("the Overview price box is among the boxes checked", async () => {
  const page = await open("/product-overview");
  const { checked } = await textBoxesWithoutFocusStyle(page);
  await page.close();
  assert.ok(checked.includes("preview-price"), checked.join(", "));
});
