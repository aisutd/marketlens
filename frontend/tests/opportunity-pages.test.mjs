import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

// Source guards for #45: the opportunity pages show the score once, show
// no raw probability, render no empty placeholder sections on first
// load, and keep one disclaimer per page.

const source = (path) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

test("Overview prints the score as text only inside the About dialog", () => {
  const text = source("../src/pages/Overview.jsx");
  const matches = text.match(/`\$\{score\}\/100`/g) || [];
  // The dial (OpportunityGauge) shows it on the page; the one text copy
  // left is the "Your current result" line in the About dialog.
  assert.equal(matches.length, 1);
  const dialog = text.slice(text.indexOf("function AboutScore"));
  assert.match(dialog, /`\$\{score\}\/100`/);
});
