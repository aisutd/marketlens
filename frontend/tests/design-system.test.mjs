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
