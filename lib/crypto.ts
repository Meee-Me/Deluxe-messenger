import nacl from "tweetnacl";
import { decodeBase64 as unb64, decodeUTF8, encodeBase64 as b64, encodeUTF8 } from "tweetnacl-util";

export type FileMeta = { path: string; nonce: string; name: string; type: string; size: number };
export type Payload = { text?: string; file?: FileMeta };
export type Row = { ciphertext: string; nonce: string; keys: Record<string, { n: string; c: string }> };

export function newKeyPair() {
  const k = nacl.box.keyPair();
  return { pub: b64(k.publicKey), sec: b64(k.secretKey) };
}
export const publicFromSecret = (sec: string) => b64(nacl.box.keyPair.fromSecretKey(unb64(sec)).publicKey);

// Each message gets a fresh symmetric key; it encrypts the text and any file.
export const newMessageKey = () => nacl.randomBytes(nacl.secretbox.keyLength);

export function encryptBytes(data: Uint8Array, key: Uint8Array) {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  return { data: nacl.secretbox(data, nonce, key), nonce: b64(nonce) };
}
export const decryptBytes = (data: Uint8Array, nonce: string, key: Uint8Array) =>
  nacl.secretbox.open(data, unb64(nonce), key);

/** Encrypt payload with `key`, and box `key` to every recipient (sender included). */
export function seal(payload: Payload, key: Uint8Array, recipients: Record<string, string>, mySec: string): Row {
  const { data, nonce } = encryptBytes(decodeUTF8(JSON.stringify(payload)), key);
  const keys: Row["keys"] = {};
  for (const [uid, pub] of Object.entries(recipients)) {
    const n = nacl.randomBytes(nacl.box.nonceLength);
    keys[uid] = { n: b64(n), c: b64(nacl.box(key, n, unb64(pub), unb64(mySec))) };
  }
  return { ciphertext: b64(data), nonce, keys };
}

/** Returns null if this user can't decrypt (no key entry, wrong sender key, tampering). */
export function open(row: Row, myId: string, mySec: string, senderPub: string) {
  const w = row.keys[myId];
  if (!w || !senderPub) return null;
  const key = nacl.box.open(unb64(w.c), unb64(w.n), unb64(senderPub), unb64(mySec));
  const plain = key && decryptBytes(unb64(row.ciphertext), row.nonce, key);
  return plain ? { payload: JSON.parse(encodeUTF8(plain)) as Payload, key: key! } : null;
}
