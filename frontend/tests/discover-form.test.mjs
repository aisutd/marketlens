import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { nextRadioIndex, radioProps } from "../src/lib/radioGroup.js";

const source = (path) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

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
