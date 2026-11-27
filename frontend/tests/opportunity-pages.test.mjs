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

test("no opportunity screen shows the model's raw probability", () => {
  // EvaluationSummary paired "92/100" with "Probability: 0.7%"; it was
  // unused and is gone. #22 / PR #34 settled on the score alone.
  assert.equal(
    existsSync(new URL("../src/components/EvaluationSummary.jsx", import.meta.url)),
    false
  );
  for (const path of [
    "../src/pages/Overview.jsx",
    "../src/pages/ScoreDetails.jsx",
  ]) {
    assert.doesNotMatch(source(path), /probability/i, path);
  }
  // LaunchFeasibility mentions it only in a comment explaining why the
  // score is shown alone; nothing renders prediction.probability.
  assert.doesNotMatch(
    source("../src/pages/LaunchFeasibility.jsx"),
    /prediction\??\.probability/
  );
});

test("Overview shows its findings without an extra click", () => {
  const text = source("../src/pages/Overview.jsx");
  assert.doesNotMatch(text, /Explore findings/);
  assert.doesNotMatch(text, /showExplanations/);
});

test("price panels ask for a new price instead of showing zeros", () => {
  const overview = source("../src/pages/Overview.jsx");
  assert.match(overview, /const unchanged =/);
  assert.match(overview, /\{unchanged \? \(/);

  const feasibility = source("../src/pages/LaunchFeasibility.jsx");
  const comparison = feasibility.slice(
    feasibility.indexOf("function ScenarioComparison")
  );
  assert.match(
    comparison,
    /Math\.abs\(adjusted - originalPrice\) < 0\.005/
  );
  assert.match(comparison, /Change the selling price in your/);
});

test("each opportunity page carries one general disclaimer", () => {
  const count = (text) => (text.match(/guarantee/gi) || []).length;

  // ScoreDetails: only the page footer.
  assert.equal(count(source("../src/pages/ScoreDetails.jsx")), 1);

  // Overview: the page footer, plus the About dialog's own explanation,
  // which is only seen on request.
  const overview = source("../src/pages/Overview.jsx");
  const start = overview.indexOf("function AboutScore");
  const end = overview.indexOf("export default function Overview");
  const outsideDialog = overview.slice(0, start) + overview.slice(end);
  assert.equal(count(outsideDialog), 1);
});
