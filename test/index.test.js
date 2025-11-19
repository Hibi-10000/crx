import test from "node:test";
//TODO: use assert instead of t.assert in nodeUnit_Test
//import assert from "node:assert/strict";

import { TESTS, TEST_OPTIONS } from "./index.js";

/** @type {(t: import("node:test").TestContext, resolve: (value?: never) => void, reject: (reason?: any) => void) => import("tape").Test & { isPlanned: () => boolean }} */
const tape_Test = (t, resolve, reject) => {
  let planned = false;
  // @ts-expect-error
  return {
    isPlanned: () => planned,
    plan: () => {
      planned = true;
    },
    throws: t.assert.throws,
    end: (e) => {
      if (e) {
        reject(e);
      }
      else {
        resolve();
      }
    },
    ok: t.assert.ok,
    pass: () => t.assert.ok(true),
    error: t.assert.fail,
    deepEqual: t.assert.deepEqual,
    equals: t.assert.equal,
  };
};

for (const key in TEST_OPTIONS) {
  test("crx", async (t) => {
    for (const name in TESTS) {
      const test = TESTS[name];
      await t.test((key === "" ? "default" : key) + " - " + name, async (t) => {
        await new Promise((resolve, reject) => {
          const t_ = tape_Test(t, resolve, reject);
          test(t_, TEST_OPTIONS[key]);
          if (t_.isPlanned()) {
            resolve();
          }
        });
      });
    }
  });
}
