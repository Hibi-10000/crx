import test from "node:test";
//TODO: use assert instead of t.assert in nodeUnit_Test
//import assert from "node:assert/strict";
import type { Test } from "tape";

import { TESTS, TEST_OPTIONS } from "./index.ts";

const tape_Test = (t: test.TestContext): Test => {
  // @ts-expect-error
  return {
    throws: t.assert.throws,
    ok: t.assert.ok,
    pass: (msg: string | undefined) => t.assert.ok(true, msg),
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
        const t_ = tape_Test(t);
        await test(t_, TEST_OPTIONS[key]);
      });
    }
  });
}
