import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { resolveApiBase } from "../src/services/apiBase.js";

// #39: a production build calls the APIs cross-origin at configured
// base URLs; development keeps the Vite proxy paths.

test("unset or blank falls back to the dev proxy path", () => {
  assert.equal(resolveApiBase(undefined, "/api"), "/api");
  assert.equal(resolveApiBase("", "/api"), "/api");
  assert.equal(resolveApiBase("   ", "/api/forecasting"), "/api/forecasting");
});

test("an https base URL is used as given, without trailing slashes", () => {
  assert.equal(
    resolveApiBase("https://scoring-abc.a.run.app", "/api"),
    "https://scoring-abc.a.run.app"
  );
  assert.equal(
    resolveApiBase(" https://scoring-abc.a.run.app/ ", "/api"),
    "https://scoring-abc.a.run.app"
  );
  assert.equal(
    resolveApiBase("https://example.com/v2//", "/api"),
    "https://example.com/v2"
  );
});

test("plain http is accepted only for a local host", () => {
  assert.equal(resolveApiBase("http://localhost:8000", "/api"), "http://localhost:8000");
  assert.equal(resolveApiBase("http://127.0.0.1:8091", "/api"), "http://127.0.0.1:8091");
  assert.throws(() => resolveApiBase("http://scoring.example.com", "/api"), /https/);
});

test("malformed or unsafe values throw instead of being used", () => {
  for (const value of [
    "scoring.example.com",
    "/relative/path",
    "ftp://example.com",
    "javascript:alert(1)",
    "https://user:pass@example.com",
    "https://example.com/?x=1",
    "https://example.com/#top",
  ]) {
    assert.throws(() => resolveApiBase(value, "/api"), Error, value);
  }
});

test("both API clients read their base from the build settings", () => {
  const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
  assert.match(
    read("../src/services/marketlensApi.js"),
    /resolveApiBase\(\s*import\.meta\.env\.VITE_MARKETLENS_API_URL,\s*"\/api"\s*\)/
  );
  assert.match(
    read("../src/services/forecastingApi.js"),
    /resolveApiBase\(\s*import\.meta\.env\.VITE_FORECASTING_API_URL,\s*"\/api\/forecasting"\s*\)\}\/api\/v1/
  );
});
