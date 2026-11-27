import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// #39: a Content-Type header on a GET forces a CORS preflight once the
// frontend calls the APIs without the dev proxy. Only requests with a
// body may set it.

const source = (path) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

test("forecastingApi sets Content-Type only for requests with a body", () => {
  const text = source("../src/services/forecastingApi.js");
  const sets = [...text.matchAll(/headers\.set\("Content-Type"/g)];
  assert.equal(sets.length, 1);

  const before = text.slice(0, sets[0].index);
  const guard = before.slice(before.lastIndexOf("if ("));
  assert.match(guard, /options\.body !== undefined && options\.body !== null/);
});

test("marketlensApi sets Content-Type only in the JSON body options", () => {
  const text = source("../src/services/marketlensApi.js");
  const matches = [...text.matchAll(/"Content-Type"/g)];
  assert.equal(matches.length, 1);
  const fn = text.slice(text.lastIndexOf("function ", matches[0].index));
  assert.match(fn, /^function jsonOptions\(payload\)/);
  assert.match(fn.slice(0, 300), /body: JSON\.stringify\(payload\)/);
});
