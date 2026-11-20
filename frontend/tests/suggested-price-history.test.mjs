
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));

const storageKey = "marketlens:current-analysis:v1";

const mockAuthId = "\0mock-firebase-auth";

// ========================================
// MOCK FIREBASE AUTHENTICATION
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
        currentUser: null
      };

      export const firebaseSetupMessage = "";

      export const isFirebaseSetupError = () => false;

      const listeners = new Set();

      window.switchFirebaseUser = (uid) => {
        auth.currentUser = uid
          ? {
              uid,
              email: uid + "@example.com",
              displayName: "",
              metadata: {
                creationTime: new Date().toISOString()
              }
            }
          : null;

        for (const listener of listeners) {
          listener(auth.currentUser);
        }
      };

      export function onAuthStateChanged(auth, listener) {
        listeners.add(listener);
        window.authReady = true;

        return () => listeners.delete(listener);
      }

      export const signOut = async () => {
        window.switchFirebaseUser(null);
      };

      export const signInWithEmailAndPassword =
        async () => {};

      export const createUserWithEmailAndPassword =
        async () => {};

      // Support the Profile page introduced in Issue #26.
      export const updateProfile = async (user, changes) => {
        if (!user) {
          throw new Error("No authenticated user.");
        }

        if (changes.displayName !== undefined) {
          user.displayName = changes.displayName;
        }

        if (changes.photoURL !== undefined) {
          user.photoURL = changes.photoURL;
        }
      };
    `;
  },
};

// ========================================
// RESTORE MOCK ACCOUNT
// ========================================

async function restoreAccount(page, uid, price) {
  await page.evaluate(
    ({ storageKey, uid, price }) => {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          version: 1,
          userId: uid,
          analysis: {
            scoredProduct: {
              title: uid + " product",
              price,
            },
            prediction: {
              opportunity_score: 70,
            },
          },
        })
      );

      window.switchFirebaseUser(uid);
    },
    { storageKey, uid, price }
  );
}

// ========================================
// PRICE HISTORY AND ACCOUNT ISOLATION TEST
// ========================================

test(
  "suggested prices survive same-account history navigation and stay isolated across accounts",
  async () => {
    const cacheDir = await mkdtemp(
      join(tmpdir(), "marketlens-price-history-")
    );

    let server;
    let browser;

    try {
      // ========================================
      // START TEST SERVER
      // ========================================

      server = await createServer({
        root,
        cacheDir,
        plugins: [mockFirebase],
        server: {
          host: "127.0.0.1",
          port: 0,
        },
      });

      await server.listen();

      const { port } = server.httpServer.address();

      // ========================================
      // START BROWSER
      // ========================================

      browser = await chromium.launch({
        executablePath:
          process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      });

      const page = await browser.newPage();

      await page.route("**/api/**", (route) =>
        route.fulfill({ json: [] })
      );

      // Capture browser errors for easier debugging.
      page.on("pageerror", (error) => {
        console.error("Browser error:", error.message);
      });

      await page.goto(
        `http://127.0.0.1:${port}/product-overview`
      );

      await page.waitForFunction(
        () => window.authReady
      );

      // ========================================
      // HELPER: OPEN PRICE SCENARIO
      // ========================================

      async function openScenario(price) {
        await page.locator("#preview-price").fill(price);

        await page
          .getByText("Explore price scenarios", {
            exact: true,
          })
          .click();
      }

      // ========================================
      // HELPER: VERIFY SCENARIO PRICE
      // ========================================

      async function expectScenarioPrice(price) {
        const input = page.locator("#scenario-price");

        await input.waitFor();

        assert.equal(
          await input.inputValue(),
          price
        );
      }

      // ========================================
      // ACCOUNT A
      // ========================================

      await restoreAccount(
        page,
        "account-a",
        45
      );

      await openScenario("123.45");

      await expectScenarioPrice("123.45");

      const savedState = await page.evaluate(
        () => history.state.usr
      );

      // Verify browser history navigation.
      await page.goBack();

      await page.waitForURL(
        "**/product-overview"
      );

      await page.goForward();

      await expectScenarioPrice("123.45");

      // Verify persistence after refresh.
      await page.reload();

      await page.waitForFunction(
        () => window.authReady
      );

      await page.evaluate(
        () => window.switchFirebaseUser("account-a")
      );

      await expectScenarioPrice("123.45");

      // ========================================
      // ACCOUNT B
      // ========================================

      await page
        .getByRole("link", {
          name: "Back to Product Overview",
        })
        .click();

      await restoreAccount(
        page,
        "account-b",
        25
      );

      await page
        .getByRole("heading", {
          name: "account-b product",
        })
        .waitFor();

      await page.goBack();

      await expectScenarioPrice("25");

      // Ensure history stores only the suggested price ID.
      assert.deepEqual(
        Object.keys(savedState),
        ["suggestedPriceId"]
      );

      assert.equal(
        typeof savedState.suggestedPriceId,
        "string"
      );

      await page.goBack();

      await page.waitForURL(
        "**/product-overview"
      );

      await page.goForward();

      await expectScenarioPrice("25");

      // ========================================
      // LEGACY HISTORY COMPATIBILITY
      // ========================================

      await page.evaluate(() => {
        history.replaceState(
          {
            ...history.state,
            usr: {
              suggestedPrice: 123.45,
            },
          },
          ""
        );
      });

      await page.goForward();

      await page.waitForURL(
        "**/product-overview"
      );

      await page.goBack();

      await expectScenarioPrice("25");

      // ========================================
      // MULTIPLE PRICE SUGGESTIONS
      // ========================================

      await page.goForward();

      await openScenario("30");

      await expectScenarioPrice("30");

      // Store only the 20 most recent suggestions.
      for (let i = 1; i <= 25; i += 1) {
        await page
          .getByRole("link", {
            name: "Back to Product Overview",
          })
          .click();

        await openScenario(String(i));

        await expectScenarioPrice(String(i));
      }

      // ========================================
      // VERIFY STORED PRICE HISTORY
      // ========================================

      const stored = await page.evaluate(
        (key) =>
          JSON.parse(
            localStorage.getItem(key)
          ).analysis.suggestedPrices,
        storageKey
      );

      assert.deepEqual(
        Object.values(stored),
        Array.from(
          { length: 20 },
          (_, i) => i + 6
        )
      );
    } finally {
      // ========================================
      // CLEANUP
      // ========================================

      await browser?.close();
      await server?.close();

      await rm(cacheDir, {
        recursive: true,
        force: true,
      });
    }
  }
);
