import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Guards for #49: the landing page does not ship the other pages, and
// the forecasting catalogue is fetched only when the search is used.

const source = (path) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

test("only the landing page is imported eagerly by App", () => {
  const app = source("../src/App.jsx");
  const eagerPages = [...app.matchAll(/^import \w+ from "\.\/pages\/(\w+)"/gm)]
    .map((match) => match[1]);
  assert.deepEqual(eagerPages, ["LandingPage"]);

  for (const page of [
    "Discover", "Overview", "SalesForecastOverview",
    "LaunchForecastOverview", "ScoreDetails", "LaunchFeasibility",
    "SignUp", "Login", "SavedProducts", "Profile",
  ]) {
    assert.match(
      app,
      new RegExp(String.raw`lazy\(\(\) =>\s*import\("\./pages/${page}"\)`),
      page
    );
  }
  assert.match(app, /<Suspense fallback=\{<PageLoading \/>\}>/);
});

test("the catalogue is fetched only after the product search is focused", () => {
  const text = source("../src/components/ProductSearch.jsx");
  // The fetch effect bails out until catalogueWanted is set...
  assert.match(
    text,
    /!isExisting \|\|\s*!catalogueWanted \|\|\s*products\.length > 0/
  );
  // ...and only the search box's onFocus sets it.
  const setters = text.match(/setCatalogueWanted\(true\)/g) || [];
  assert.equal(setters.length, 1);
  const focus = text.slice(text.indexOf("onFocus={() => {"));
  assert.match(focus.slice(0, 80), /setCatalogueWanted\(true\)/);
});
