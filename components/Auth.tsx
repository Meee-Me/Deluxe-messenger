"use client";
import type { Provider } from "@supabase/supabase-js";
import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";
import Brand from "./Brand";

// Supabase requires the `custom:` prefix on custom OAuth/OIDC provider identifiers.
const DELUXE_MAIN = "custom:deluxe_main" as Provider;

export default function Auth() {
  const [step, setStep] = useState<"main" | "number" | "code">("main");
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function viaMain() {
    setMsg(""); setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider: DELUXE_MAIN, options: { redirectTo: window.location.origin } });
    if (error) { setMsg(error.message); setBusy(false); } // on success the browser is already leaving for Deluxe Main
  }

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    const p = phone.trim();
    if (!/^\+[1-9]\d{6,14}$/.test(p)) return setMsg("Use the international format, like +14155550123.");
    setMsg(""); setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: p });
    setBusy(false);
    if (error) setMsg(error.message); else { setPhone(p); setStep("code"); }
  }

  async function verify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(""); setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ phone, token: String(new FormData(e.currentTarget).get("token")).trim(), type: "sms" });
    setBusy(false);
    if (error) setMsg(error.message); // on success the session listener in the page takes over
  }

  return (
    <div className="auth">
      <Brand size={52} />
      {step === "main" && <>
        <button className="neon" onClick={viaMain} disabled={busy}>Sign in with Deluxe Main</button>
        <button className="ghost" onClick={() => { setMsg(""); setStep("number"); }}>Continue with Phone Number</button>
      </>}
      {step === "number" && (
        <form onSubmit={sendCode} className="auth-step">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="+14155550123" aria-label="Phone number" autoFocus required />
          <button disabled={busy}>Send code</button>
          <button type="button" className="link" onClick={() => { setMsg(""); setStep("main"); }}>Back</button>
        </form>
      )}
      {step === "code" && (
        <form onSubmit={verify} className="auth-step">
          <p className="hint">We sent a code to {phone}.</p>
          <input name="token" inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" aria-label="Verification code" maxLength={8} autoFocus required />
          <button disabled={busy}>Verify</button>
          <button type="button" className="link" onClick={() => { setMsg(""); setStep("number"); }}>Use a different number</button>
        </form>
      )}
      {msg && <p className="err" role="alert">{msg}</p>}
    </div>
  );
}
