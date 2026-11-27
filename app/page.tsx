"use client";
import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import Auth from "@/components/Auth";
import Chat from "@/components/Chat";
import { ensureIdentity, Me } from "@/lib/identity";
import { supabase } from "@/lib/supabase";

export default function Page() {
  const [session, setSession] = useState<Session | null | undefined>();
  const [me, setMe] = useState<Me>();
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const uid = session?.user.id;
  useEffect(() => {
    setMe(undefined); setErr("");
    if (session) ensureIdentity(session.user).then(setMe, (e) => setErr(e.message));
  }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  if (session === undefined) return null;
  if (!session) return <Auth />;
  if (err) return <div className="auth"><p className="err">{err}</p><button onClick={() => supabase.auth.signOut()}>Sign out</button></div>;
  return me ? <Chat me={me} /> : null;
}
