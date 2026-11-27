"use client";
import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AddFriend({ myCode, onDone, onCancel }: { myCode: string; onDone: (id: string) => void; onCancel: () => void }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    setErr("");
    if (code === myCode) return setErr("That's your own code.");
    setBusy(true);
    const { data, error } = await supabase.rpc("add_friend_by_code", { p_code: code });
    setBusy(false);
    if (error) setErr(error.message); else if (!data) setErr("Code not found"); else onDone(data as string);
  }

  return (
    <form className="modal" onSubmit={add}>
      <h3>Add via Friend Code</h3>
      <input className="code-input" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
        inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder="0000" aria-label="4-digit friend code" autoComplete="off" autoFocus />
      {err && <p className="err" role="alert">{err}</p>}
      <button disabled={code.length !== 4 || busy}>Add friend</button>
      <button type="button" className="link" onClick={onCancel}>Cancel</button>
    </form>
  );
}
