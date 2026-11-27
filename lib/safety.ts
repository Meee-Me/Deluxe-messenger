import nacl from "tweetnacl";
import { decodeBase64 as unb64 } from "tweetnacl-util";

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

/** Short stable id of someone's public key, used to notice when it changes. */
export const keyId = (pub: string) => hex(nacl.hash(unb64(pub))).slice(0, 16);

export type Cell = { x: number; y: number; hue: 0 | 1 };

/** Both people get the same six number groups and picture, made from the two public keys. */
export function safety(pubA: string, pubB: string) {
  const h = nacl.hash(new TextEncoder().encode([pubA, pubB].sort().join("|")));
  const digits = Array.from({ length: 6 }, (_, i) =>
    String((((h[i * 4] << 24) | (h[i * 4 + 1] << 16) | (h[i * 4 + 2] << 8) | h[i * 4 + 3]) >>> 0) % 100000).padStart(5, "0"));
  const cells: Cell[] = [];
  for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) {
    if (h[24 + y * 3 + x] < 115) continue; // about 55% of cells are filled
    const hue = (h[40 + y * 3 + x] & 1) as 0 | 1;
    cells.push({ x, y, hue }); if (x < 2) cells.push({ x: 4 - x, y, hue }); // mirrored
  }
  return { digits, cells };
}

// Local trust: remember the key we first saw for someone, and the key we verified.
const slot = (me: string, peer: string, what: string) => `trust:${what}:${me}:${peer}`;
export function trust(me: string, peer: string, pub: string) {
  const id = keyId(pub);
  try {
    const seen = localStorage.getItem(slot(me, peer, "seen"));
    if (!seen) localStorage.setItem(slot(me, peer, "seen"), id);
    const verified = localStorage.getItem(slot(me, peer, "verified"));
    return { verified: verified === id, changed: !!seen && seen !== id };
  } catch { return { verified: false, changed: false }; }
}
export function markVerified(me: string, peer: string, pub: string) {
  try { localStorage.setItem(slot(me, peer, "verified"), keyId(pub)); localStorage.setItem(slot(me, peer, "seen"), keyId(pub)); } catch {}
}
export function acceptNewKey(me: string, peer: string, pub: string) {
  try { localStorage.setItem(slot(me, peer, "seen"), keyId(pub)); localStorage.removeItem(slot(me, peer, "verified")); } catch {}
}
