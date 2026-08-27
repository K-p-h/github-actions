const { test } = require("node:test");
const assert = require("node:assert");
const { add } = require("../lib/math");

test("add() adds two numbers", () => {
  assert.strictEqual(add(1, 2), 3);
});