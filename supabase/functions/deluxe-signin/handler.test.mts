import assert from "node:assert/strict";
import { handle, type Deps } from "./handler.ts";

const GOOD = "dm_" + "a".repeat(64);
const post = (body: unknown, method = "POST") => new Request("http://x/", { method, body: method === "POST" ? JSON.stringify(body) : undefined });
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const calls: string[] = [];
const deps = (over: Partial<Deps> = {}): Deps => ({
  mainUrl: "https://main.test", app: "messenger",
  fetch: async (url, init) => { calls.push(`${url} ${(init?.headers as Record<string, string>)?.Authorization}`); return json(200, { app: "messenger", user: { id: "acct_1", name: "Shivad S", handle: "shivad.s" } }); },
  tokenHashFor: async (who) => `hash-for-${who.id}-${who.handle}-${who.name}`,
  ...over,
});
const run = async (req: Request, d = deps()) => { const r = await handle(req, d); return [r.status, await r.json().catch(() => null)] as const; };

assert.equal((await handle(post(null, "OPTIONS"), deps())).status, 204); // CORS preflight
assert.equal((await run(post(null, "GET")))[0], 405);
assert.equal((await run(new Request("http://x/", { method: "POST", body: "not json" })))[0], 400);
for (const bad of [undefined, "", "dm_short", "x".repeat(67), GOOD.toUpperCase(), `${GOOD}\n`, 5]) assert.equal((await run(post({ token: bad })))[0], 400, `rejects ${String(bad)}`);
assert.equal(calls.length, 0, "bad tokens never reach Deluxe Main");

let [s, b] = await run(post({ token: GOOD }));
assert.equal(s, 200); assert.equal(b.token_hash, "hash-for-acct_1-shivad.s-Shivad S");
assert.equal(calls[0], `https://main.test/api/auth/me Bearer ${GOOD}`);

[s] = await run(post({ token: GOOD }), deps({ fetch: async () => json(401, {}) })); assert.equal(s, 401); // expired or revoked
[s] = await run(post({ token: GOOD }), deps({ fetch: async () => json(500, {}) })); assert.equal(s, 502);
[s] = await run(post({ token: GOOD }), deps({ fetch: async () => { throw new Error("down"); } })); assert.equal(s, 502);
[s, b] = await run(post({ token: GOOD }), deps({ fetch: async () => json(200, { app: "docs", user: { id: "acct_1", handle: "h" } }) }));
assert.equal(s, 403, "a Deluxe Docs token cannot sign into the messenger");
[s] = await run(post({ token: GOOD }), deps({ fetch: async () => json(200, { app: "main", user: { id: "acct_1", handle: "h" } }) })); assert.equal(s, 403);
for (const user of [null, { handle: "h" }, { id: "bad id!", handle: "h" }, { id: "a", handle: "" }, { id: "../x", handle: "h" }]) {
  [s] = await run(post({ token: GOOD }), deps({ fetch: async () => json(200, { app: "messenger", user }) })); assert.equal(s, 502, `rejects ${JSON.stringify(user)}`);
}
[s, b] = await run(post({ token: GOOD }), deps({ fetch: async () => json(200, { app: "messenger", user: { id: "a1", handle: "only.handle" } }) }));
assert.equal(b.token_hash, "hash-for-a1-only.handle-only.handle", "name falls back to handle");
[s, b] = await run(post({ token: GOOD }), deps({ tokenHashFor: async () => { throw new Error("db down"); } }));
assert.equal(s, 500); assert.ok(!JSON.stringify(b).includes("db down"), "internal errors are not leaked");
console.log("deluxe-signin handler ok");
