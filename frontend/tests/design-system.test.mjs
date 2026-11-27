import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Guards for #50 (design system).

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const css = () => read("../src/lovable-reference.css");

function reducedMotionBlock(text) {
  const start = text.indexOf("@media (prefers-reduced-motion: reduce)");
  assert.notEqual(start, -1, "reduced-motion block missing");
  let depth = 0;
  for (let i = text.indexOf("{", start); i < text.length; i++) {
    if (text[i] === "{") depth++;
    if (text[i] === "}" && --depth === 0) return text.slice(start, i + 1);
  }
  throw new Error("unbalanced reduced-motion block");
}

test("reduced motion also stops transitions and hover movement", () => {
  const block = reducedMotionBlock(css());
  assert.match(block, /animation-duration: 0\.01ms !important/);
  assert.match(block, /transition-duration: 0\.01ms !important/);
  assert.match(block, /\*:hover\s*\{\s*translate: none !important;/);
});

test("every translate in the app is a hover state", () => {
  // The reduced-motion rule cancels translate on :hover only; a layout
  // translate (e.g. centring) would need a different rule.
  const files = [
    "../src/components/ProductSearch.jsx", "../src/components/TryItLive.jsx",
    "../src/pages/LandingPage.jsx", "../src/pages/Overview.jsx",
    "../src/pages/ScoreDetails.jsx", "../src/pages/LaunchFeasibility.jsx",
    "../src/pages/SalesForecastOverview.jsx", "../src/pages/LaunchForecastOverview.jsx",
    "../src/pages/Discover.jsx", "../src/App.jsx",
  ];
  for (const file of files) {
    for (const match of read(file).matchAll(/[\w:-]*translate-[^\s"'`]+/g)) {
      assert.match(match[0], /(^|:)hover:/, `${file}: ${match[0]}`);
    }
  }
});

test("smooth scrolling is not global", () => {
  const rules = css().replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(rules, /scroll-behavior:\s*smooth/);
});

test("the landing page's in-page links scroll themselves", () => {
  const landing = read("../src/pages/LandingPage.jsx");
  assert.match(landing, /behavior: reduceMotion \? "instant" : "smooth"/);
  // Header nav (desktop and mobile) and the hero's "#try" link.
  assert.equal((landing.match(/scrollToSection\(event\)|onClick=\{scrollToSection\}/g) || []).length, 3);
});

test("no template leftovers point at files that do not exist", () => {
  assert.doesNotMatch(css(), /routes\/__root\.tsx/);
});

// ---- shared formatting (src/lib/format.js) ----

test("shared formatters keep each page's output", async () => {
  const f = await import("../src/lib/format.js");
  const { parseNumberInput } = await import("../src/lib/numberInput.js");
  const money = f.formatWith(f.moneyFormat);
  const whole = f.formatWith(f.wholeMoneyFormat);
  const number = f.formatWith(f.numberFormat);
  const compact = f.formatWith(f.compactFormat);
  assert.equal(money(24.99), "$24.99");
  assert.equal(money(129948), "$129,948.00");
  assert.equal(money("23.5"), "$23.50");
  assert.equal(whole(5400.4), "$5,400");
  assert.equal(number(5200.6), "5,201");
  assert.equal(compact(5200), "5.2K");
  assert.equal(money(-1255), "-$1,255.00");
  for (const missing of [null, undefined, "", "abc", Infinity]) {
    assert.equal(money(missing), f.MISSING);
  }
  // With the strict field parser, blank text is missing, not $0.00.
  const strict = f.formatWith(f.moneyFormat, parseNumberInput);
  assert.equal(strict("   "), f.MISSING);
  assert.equal(strict("12.5"), "$12.50");
});

test("number and money formats are defined once", () => {
  for (const file of [
    "../src/pages/LaunchFeasibility.jsx", "../src/pages/LaunchForecastOverview.jsx",
    "../src/pages/SalesForecastOverview.jsx", "../src/pages/Overview.jsx",
  ]) {
    assert.doesNotMatch(read(file), /new Intl\.NumberFormat/, file);
  }
});

// ---- shared UI pieces ----

test("SectionHeading and primaryButton each have one definition", () => {
  for (const file of [
    "../src/components/ProductSearch.jsx", "../src/pages/LaunchFeasibility.jsx",
    "../src/pages/LaunchForecastOverview.jsx", "../src/pages/Overview.jsx",
    "../src/pages/SalesForecastOverview.jsx", "../src/pages/ScoreDetails.jsx",
  ]) {
    const text = read(file);
    assert.doesNotMatch(text, /^function SectionHeading\(/m, file);
    assert.match(text, /import SectionHeading from "(\.\.\/components|\.)\/SectionHeading"/, file);
    assert.doesNotMatch(text, /^const primaryButton =\s*\n\s*"/m, file);
  }
});

test("every shared primary button has a keyboard focus outline", async () => {
  const { primaryButton, focusRing } = await import("../src/lib/buttons.js");
  assert.ok(primaryButton.includes(focusRing));
  assert.match(focusRing, /focus-visible:outline-2/);
});
