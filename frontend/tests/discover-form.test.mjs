import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { isBlank, parseNumberInput } from "../src/lib/numberInput.js";
import { nextRadioIndex, radioProps } from "../src/lib/radioGroup.js";

const source = (path) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

// ---- parseNumberInput: the gate type="number" used to be ----

test("plain decimals parse", () => {
  assert.equal(parseNumberInput("24.99"), 24.99);
  assert.equal(parseNumberInput("12"), 12);
  assert.equal(parseNumberInput("12."), 12);
  assert.equal(parseNumberInput(".5"), 0.5);
  assert.equal(parseNumberInput("0"), 0);
  assert.equal(parseNumberInput("  7.5  "), 7.5);
});

test("blank text is not zero", () => {
  assert.equal(parseNumberInput(""), null);
  assert.equal(parseNumberInput("   "), null);
});

test("text a number input would have refused is rejected", () => {
  for (const text of [
    "abc", "1e3", "0x10", "-5", "+5", "$24.99",
    "1,000", "1.2.3", ".", "Infinity", "NaN", "12 5",
  ]) {
    assert.equal(parseNumberInput(text), null, text);
  }
});

test("finite numbers pass through, other values do not", () => {
  assert.equal(parseNumberInput(-1255), -1255);
  assert.equal(parseNumberInput(0), 0);
  assert.equal(parseNumberInput(Number.NaN), null);
  assert.equal(parseNumberInput(Infinity), null);
  assert.equal(parseNumberInput(null), null);
  assert.equal(parseNumberInput(undefined), null);
});

test("isBlank", () => {
  assert.equal(isBlank(""), true);
  assert.equal(isBlank("  "), true);
  assert.equal(isBlank(null), true);
  assert.equal(isBlank(undefined), true);
  assert.equal(isBlank("0"), false);
  assert.equal(isBlank(0), false);
});

// ---- radio group keyboard movement ----

test("arrow keys move and wrap", () => {
  assert.equal(nextRadioIndex(0, 2, "ArrowRight"), 1);
  assert.equal(nextRadioIndex(1, 2, "ArrowRight"), 0);
  assert.equal(nextRadioIndex(0, 2, "ArrowDown"), 1);
  assert.equal(nextRadioIndex(0, 3, "ArrowLeft"), 2);
  assert.equal(nextRadioIndex(2, 3, "ArrowUp"), 1);
});

test("Home and End jump to the ends; other keys do not move", () => {
  assert.equal(nextRadioIndex(1, 3, "Home"), 0);
  assert.equal(nextRadioIndex(0, 3, "End"), 2);
  assert.equal(nextRadioIndex(0, 3, "Tab"), -1);
  assert.equal(nextRadioIndex(0, 3, "Enter"), -1);
  assert.equal(nextRadioIndex(0, 0, "ArrowRight"), -1);
});

test("only the checked option is tabbable", () => {
  assert.deepEqual(radioProps(true, false), {
    role: "radio", "aria-checked": true, tabIndex: 0,
  });
  assert.equal(radioProps(false, true).tabIndex, -1);
  assert.equal(radioProps(false, true, false).tabIndex, 0);
  assert.equal(radioProps(false, false, false).tabIndex, -1);
});

// ---- source guards ----

test("no number inputs remain in the app's forms", () => {
  for (const path of [
    "../src/components/ProductSearch.jsx",
    "../src/pages/LaunchFeasibility.jsx",
    "../src/pages/Overview.jsx",
  ]) {
    // None of these files has a chart axis with type="number", so any
    // match is an input.
    assert.doesNotMatch(source(path), /type="number"/, path);
  }
});

test("single-choice groups use radio semantics, not toggles", () => {
  for (const path of [
    "../src/components/ProductSearch.jsx",
    "../src/components/TryItLive.jsx",
    "../src/pages/Overview.jsx",
    "../src/pages/SalesForecastOverview.jsx",
    "../src/pages/LaunchForecastOverview.jsx",
  ]) {
    const text = source(path);
    assert.doesNotMatch(text, /aria-pressed/, path);
    assert.match(text, /role="radiogroup"/, path);
    assert.match(text, /onKeyDown=\{handleRadioGroupKeyDown\}/, path);
  }
});

test("the Discover form reports its busy state", () => {
  const text = source("../src/components/ProductSearch.jsx");
  assert.match(text, /aria-busy=\{loading \|\| undefined\}/);
  assert.match(text, /<p role="status" className="sr-only">/);
});
