// Fails when the forecast category map and the scoring API's category list
// disagree. Run with: npm run check:categories

import { readFileSync } from "node:fs";
import process from "node:process";

import {
  FORECAST_CATEGORIES,
  FORECAST_CATEGORY_BY_SCORING_NAME,
} from "../src/constants/forecastCategoryMap.js";

const categoriesFile = new URL(
  "../../product_success/api/categories.json",
  import.meta.url
);

const names = JSON.parse(readFileSync(categoriesFile, "utf8")).map(
  (category) => category.name
);
const known = new Set(names);
const allowed = new Set(FORECAST_CATEGORIES);
const entries = Object.entries(FORECAST_CATEGORY_BY_SCORING_NAME);

const problems = [
  ...names
    .filter((name) => !Object.hasOwn(FORECAST_CATEGORY_BY_SCORING_NAME, name))
    .map((name) => `Missing from the map: "${name}"`),
  ...entries
    .filter(([name]) => !known.has(name))
    .map(([name]) => `In the map but not in categories.json: "${name}"`),
  ...entries
    .filter(([, value]) => value !== null && !allowed.has(value))
    .map(
      ([name, value]) =>
        `"${name}" maps to ${JSON.stringify(value)}, which is neither null nor a forecast category`
    ),
];

if (problems.length > 0) {
  console.error(`Category map check failed (${problems.length} problems):`);
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  process.exit(1);
}

const covered = entries.filter(([, value]) => value !== null).length;
console.log(
  `Category map OK: ${names.length} scoring categories, ` +
    `${covered} mapped, ${names.length - covered} not covered.`
);
