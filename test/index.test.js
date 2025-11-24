import test from "node:test";
//TODO: use assert instead of t.assert in nodeUnit_Test
//import assert from "node:assert/strict";

import { TESTS, TEST_OPTIONS } from "./index.js";

/** @type {(t: import("node:test").TestContext, resolve: (value?: never) => void, reject: (reason?: any) => void) => import("tape").Test} */
const tape_Test = (t, resolve, reject) => {
  let plan = -1;
  let current = 0;
  const countAssert = (func) => {
    return (...args) => {
      func.apply(null, args);
      current++;
      if (plan !== -1 && plan === current) {
        resolve();
      }
    };
  };
  // @ts-expect-error
  return {
    plan: (n) => {
      plan = n;
    },
    throws: countAssert(t.assert.throws),
    end: (e) => {
      if (e) {
        reject(e);
      }
      else {
        resolve();
      }
    },
    ok: countAssert(t.assert.ok),
    pass: countAssert((msg) => t.assert.ok(true, msg)),
    error: countAssert(t.assert.fail),
    deepEqual: countAssert(t.assert.deepEqual),
    equals: countAssert(t.assert.equal),
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
        });
      });
    }
  });
}
