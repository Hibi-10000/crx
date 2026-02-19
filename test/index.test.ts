import test from "node:test";
//TODO: use assert instead of t.assert in testWrap
//import assert from "node:assert/strict";

import { TESTS, TEST_OPTIONS, type Test } from "./index.ts";

const testWrap = (t: test.TestContext): Test => {
  return {
    throws: t.assert.throws,
    ok: t.assert.ok,
    pass: (msg?: string) => t.assert.ok(true, msg),
    error: t.assert.fail,
    deepEqual: t.assert.deepEqual,
    equals: t.assert.equal,
  };
};

for (const key of Object.keys(TEST_OPTIONS) as (keyof typeof TEST_OPTIONS)[]) {
  test("crx", async (t) => {
    for (const name in TESTS) {
      const test = TESTS[name];
      await t.test((key === "" ? "default" : key) + " - " + name, async (t) => {
        const t_ = testWrap(t);
        await test(t_, TEST_OPTIONS[key]);
      });
    }
  });
}
