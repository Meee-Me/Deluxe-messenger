"use client";
import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type U = { id: string; username: string };

// Lists only people you already share a chat with (the database hides everyone else); add new people with a friend code.
export default function NewChat({ meId, onDone, onCancel }: { meId: string; onDone: (id: string) => void; onCancel: () => void }) {
  const [users, setUsers] = useState<U[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    supabase.from("users").select("id,username").neq("id", meId).order("username").then(({ data }) => setUsers(data ?? []));
  }, [meId]);

  async function create(e: FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase.rpc("create_conversation", { p_name: name, p_members: picked });
    if (error) setErr(error.message); else onDone(data as string);
  }

  return (
    <form className="modal" onSubmit={create}>
      <h3>New chat</h3>
      <div className="users">
        {users.map((u) => (
          <label key={u.id}>
            <input type="checkbox" checked={picked.includes(u.id)}
              onChange={(e) => setPicked(e.target.checked ? [...picked, u.id] : picked.filter((x) => x !== u.id))} />
            {u.username}
          </label>
        ))}
        {!users.length && <em>No friends yet. Add someone with their friend code first.</em>}
      </div>
      {picked.length > 1 && <input placeholder="Group name" value={name} onChange={(e) => setName(e.target.value)} />}
      {err && <p className="err">{err}</p>}
      <button disabled={!picked.length}>{picked.length > 1 ? "Create group" : "Start chat"}</button>
      <button type="button" className="link" onClick={onCancel}>Cancel</button>
    </form>
  );
}
