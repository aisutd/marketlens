// Fails when a factor the scoring model can report has no explanation in
// the frontend, or when the frontend explains a factor the model no longer
// reports. Run with: npm run check:score-factors
//
// The model's factors are the values of FRIENDLY in
// product_success/predict.py: /reasons returns those values as `label`.

import { readFileSync } from "node:fs";
import process from "node:process";

import { SCORE_FACTORS } from "../src/constants/scoreFactors.js";

const predictFile = new URL(
  "../../product_success/predict.py",
  import.meta.url
);

const source = readFileSync(predictFile, "utf8");
const block = source.match(/^FRIENDLY = \{([\s\S]*?)^\}/m);

if (!block) {
  console.error("Could not find FRIENDLY = { ... } in predict.py.");
  process.exit(1);
}

// Values are the string after each `"key": ` or `: ` inside the dict,
// including the comprehension `{... : "title meaning" for k in ...}`.
const labels = new Set(
  [...block[1].matchAll(/:\s*"([^"]+)"/g)].map((match) => match[1])
);

if (labels.size < 10) {
  console.error(
    `Only ${labels.size} labels parsed from FRIENDLY; the parser is likely out of date.`
  );
  process.exit(1);
}

const keys = Object.keys(SCORE_FACTORS);
const fields = ["name", "means", "up", "down", "action"];

const problems = [
  ...[...labels]
    .filter((label) => !Object.hasOwn(SCORE_FACTORS, label))
    .map((label) => `No explanation for model factor "${label}"`),
  ...keys
    .filter((key) => !labels.has(key))
    .map((key) => `Explained but not a model factor: "${key}"`),
  ...keys.flatMap((key) =>
    fields
      .filter((field) => !String(SCORE_FACTORS[key][field] || "").trim())
      .map((field) => `"${key}" has no ${field}`)
  ),
];

if (problems.length > 0) {
  console.error(`Score factor check failed (${problems.length} problems):`);
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  process.exit(1);
}

console.log(
  `Score factors OK: all ${labels.size} model factors are explained.`
);
