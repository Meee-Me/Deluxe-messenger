// Checks a Deluxe Main sign-in token and, if it is real and was made for this app,
// returns a one-use Supabase sign-in. No Supabase code here so it can be tested alone.
export type Deluxe = { id: string; handle: string; name: string };
export type Deps = {
  mainUrl: string; // where Deluxe Main answers, no trailing slash
  app: string; // the Deluxe app id this function accepts, e.g. "messenger"
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  tokenHashFor: (who: Deluxe) => Promise<string>;
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

export async function handle(req: Request, d: Deps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return reply(405, { error: "Use POST." });

  let token: unknown;
  try { token = (await req.json())?.token; } catch { return reply(400, { error: "Send a JSON body with a token." }); }
  // Deluxe Main session tokens are "dm_" and 64 hex characters.
  if (typeof token !== "string" || !/^dm_[0-9a-f]{64}$/.test(token)) return reply(400, { error: "That sign-in token is not valid." });

  let res: Response;
  try {
    res = await d.fetch(`${d.mainUrl}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
  } catch {
    return reply(502, { error: "Could not reach Deluxe Main. Try again." });
  }
  if (res.status === 401) return reply(401, { error: "Sign in with Deluxe Main again." });
  if (!res.ok) return reply(502, { error: "Deluxe Main had a problem. Try again." });

  const me = await res.json().catch(() => null);
  // A token made for another Deluxe website (Docs, Drive...) must never sign anyone in here.
  if (me?.app !== d.app) return reply(403, { error: "That sign-in was not made for this app." });
  const u = me?.user;
  if (!u || typeof u.id !== "string" || !/^[A-Za-z0-9_-]{1,120}$/.test(u.id) || typeof u.handle !== "string" || !u.handle) {
    return reply(502, { error: "Deluxe Main sent something unexpected. Try again." });
  }

  try {
    const token_hash = await d.tokenHashFor({ id: u.id, handle: u.handle, name: typeof u.name === "string" && u.name ? u.name : u.handle });
    return reply(200, { token_hash });
  } catch (e) {
    console.error("deluxe-signin:", e instanceof Error ? e.message : e); // never log the token
    return reply(500, { error: "Could not sign you in. Try again." });
  }
}
