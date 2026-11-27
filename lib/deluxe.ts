import { supabase } from "./supabase";

// Sign in with Deluxe Main. This is the same handoff deluxe.js does, written here on purpose:
// a script loaded from another site could read the encryption keys kept in this browser.
const MAIN = "https://deluxe-main.vercel.app";
const APP = "messenger"; // must match the entry in Deluxe Main's worker/apps.js

/** Sends the person to Deluxe Main; they come back here with a one-use code in the URL. */
export function startDeluxeSignIn() {
  location.href = `${MAIN}/connect?${new URLSearchParams({ return: location.href.replace(/#.*$/, ""), app: APP })}`;
}

/**
 * Call on page load. Does nothing (returns undefined) unless we just came back from Deluxe Main.
 * Otherwise returns null once signed in, or a message to show.
 */
export async function finishDeluxeSignIn(): Promise<string | null | undefined> {
  const code = /(?:^#|&)deluxe_code=([0-9a-f]{48})/.exec(location.hash)?.[1];
  if (!code) return undefined;
  history.replaceState(history.state, "", location.pathname + location.search); // a code works once; keep it out of history

  try {
    const res = await fetch(`${MAIN}/api/connect/exchange`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }), credentials: "omit",
    });
    const sent = await res.json().catch(() => ({}));
    if (!res.ok || typeof sent.token !== "string") return sent.error ?? "Deluxe Main sign-in failed. Try again.";

    const { data, error } = await supabase.functions.invoke("deluxe-signin", { body: { token: sent.token } });
    // Done with Deluxe's key either way: we only needed it to prove who this is.
    fetch(`${MAIN}/api/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${sent.token}` }, credentials: "omit" }).catch(() => {});
    if (error) return (await (error as { context?: Response }).context?.json().catch(() => null))?.error ?? error.message;

    const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: "email" });
    return verifyError ? verifyError.message : null;
  } catch {
    return "Could not reach Deluxe Main. Check your connection and try again.";
  }
}
