"use client";
import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";
import Brand from "./Brand";

export default function Auth() {
  const [signup, setSignup] = useState(false);
  const [msg, setMsg] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = f.get("email") as string, password = f.get("password") as string;
    const { data, error } = signup
      ? await supabase.auth.signUp({ email, password, options: { data: { username: f.get("username") } } })
      : await supabase.auth.signInWithPassword({ email, password });
    if (error) setMsg(error.message);
    else if (signup && !data.session) setMsg("Check your email to confirm, then sign in.");
  }

  return (
    <form className="auth" onSubmit={submit}>
      <Brand size={48} />
      {signup && <input name="username" placeholder="Username" minLength={2} maxLength={32} required />}
      <input name="email" type="email" placeholder="Email" required />
      <input name="password" type="password" placeholder="Password" minLength={6} required />
      <button>{signup ? "Sign up" : "Sign in"}</button>
      <button type="button" className="link" onClick={() => { setSignup(!signup); setMsg(""); }}>
        {signup ? "Have an account? Sign in" : "New here? Sign up"}
      </button>
      {msg && <p className="err">{msg}</p>}
    </form>
  );
}
