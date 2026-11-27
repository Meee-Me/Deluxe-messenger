import assert from "node:assert/strict";
import { keyId, safety } from "./safety";
import { newKeyPair } from "./crypto";

const [a, b, c] = [newKeyPair().pub, newKeyPair().pub, newKeyPair().pub];
const ab = safety(a, b), ba = safety(b, a);
assert.deepEqual(ab, ba, "both people see the same number and picture");
assert.equal(ab.digits.length, 6);
assert.ok(ab.digits.every((d) => /^\d{5}$/.test(d)));
assert.ok(ab.cells.length > 0 && ab.cells.every((c) => c.x >= 0 && c.x < 5 && c.y >= 0 && c.y < 5));
assert.ok(ab.cells.every((c) => ab.cells.some((m) => m.y === c.y && m.x === 4 - c.x)), "picture is mirrored");
assert.notDeepEqual(safety(a, c).digits, ab.digits, "a different key gives a different number");
assert.equal(keyId(a), keyId(a)); assert.notEqual(keyId(a), keyId(b));
console.log("safety ok");
