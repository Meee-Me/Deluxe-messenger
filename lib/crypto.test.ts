import assert from "node:assert/strict";
import { decryptBytes, encryptBytes, newKeyPair, newMessageKey, open, publicFromSecret, seal } from "./crypto";

const [a, b, c] = [newKeyPair(), newKeyPair(), newKeyPair()];
assert.equal(publicFromSecret(a.sec), a.pub);

const key = newMessageKey();
const row = seal({ text: "héllo 🔐" }, key, { A: a.pub, B: b.pub }, a.sec);
assert.equal(open(row, "A", a.sec, a.pub)?.payload.text, "héllo 🔐"); // sender reads own message
assert.equal(open(row, "B", b.sec, a.pub)?.payload.text, "héllo 🔐"); // recipient reads it
assert.equal(open(row, "C", c.sec, a.pub), null); // outsider: no key entry
assert.equal(open(row, "B", b.sec, c.pub), null); // wrong claimed sender
assert.equal(open({ ...row, ciphertext: row.ciphertext.replace(/^./, "A") }, "B", b.sec, a.pub), null); // tampered

const file = encryptBytes(new Uint8Array([1, 2, 3]), key);
assert.deepEqual([...decryptBytes(file.data, file.nonce, key)!], [1, 2, 3]);
console.log("crypto ok");
