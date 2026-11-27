"use client";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { encryptBytes, FileMeta, newMessageKey, open, Payload, Row, seal } from "@/lib/crypto";
import type { Me } from "@/lib/identity";
import { supabase } from "@/lib/supabase";
import { useCall } from "@/lib/useCall";
import Attachment from "./Attachment";
import CallOverlay from "./CallOverlay";
import NewChat from "./NewChat";

type U = { id: string; username: string; public_key: string };
type Conv = { id: string; name: string | null; is_group: boolean; participants: { user_id: string; users: U }[] };
type DbMsg = Row & { id: string; sender_id: string; created_at: string };
type Msg = { id: string; sender: string; at: string; payload?: Payload; key?: Uint8Array };

const MAX_FILE = 20 * 1024 * 1024;

export default function Chat({ me }: { me: Me }) {
  const [convs, setConvs] = useState<Conv[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const { call, start, accept, end } = useCall(me.id, me.username);

  const active = convs.find((c) => c.id === activeId);
  const activeRef = useRef(active);
  activeRef.current = active;
  const peerOf = (c: Conv) => c.participants.find((p) => p.user_id !== me.id)?.users;
  const title = (c: Conv) => c.name ?? (c.is_group ? "Group" : peerOf(c)?.username ?? "Chat");

  const loadConvs = useCallback(async () => {
    const { data } = await supabase.from("conversations")
      .select("id,name,is_group,participants(user_id,users(id,username,public_key))")
      .order("created_at", { ascending: false });
    setConvs((data ?? []) as unknown as Conv[]);
  }, []);

  useEffect(() => {
    loadConvs();
    const ch = supabase.channel("my-participations")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "participants", filter: `user_id=eq.${me.id}` }, loadConvs)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [me.id, loadConvs]);

  useEffect(() => {
    if (!activeId) return;
    let live = true;
    setMsgs([]);
    const dec = (r: DbMsg): Msg => {
      const pub = activeRef.current?.participants.find((p) => p.user_id === r.sender_id)?.users.public_key ?? "";
      return { id: r.id, sender: r.sender_id, at: r.created_at, ...open(r, me.id, me.sec, pub) };
    };
    supabase.from("messages").select("*").eq("conversation_id", activeId).order("created_at").limit(200)
      .then(({ data }) => live && setMsgs(((data ?? []) as DbMsg[]).map(dec)));
    const ch = supabase.channel(`msgs:${activeId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        (p) => setMsgs((m) => (m.some((x) => x.id === p.new.id) ? m : [...m, dec(p.new as DbMsg)])))
      .subscribe();
    return () => { live = false; supabase.removeChannel(ch); };
  }, [activeId, me.id, me.sec]);

  useEffect(() => bottom.current?.scrollIntoView(), [msgs]);

  async function send(e: FormEvent, file?: File) {
    e.preventDefault();
    if (!active || (!text.trim() && !file)) return;
    setErr("");
    try {
      const key = newMessageKey();
      const payload: Payload = {};
      if (text.trim()) payload.text = text.trim();
      if (file) {
        if (file.size > MAX_FILE) throw new Error("File too large (20 MB max).");
        const enc = encryptBytes(new Uint8Array(await file.arrayBuffer()), key);
        const path = `${active.id}/${crypto.randomUUID()}`;
        const up = await supabase.storage.from("attachments").upload(path, enc.data, { contentType: "application/octet-stream" });
        if (up.error) throw up.error;
        payload.file = { path, nonce: enc.nonce, name: file.name, type: file.type || "application/octet-stream", size: file.size } satisfies FileMeta;
      }
      const recipients = Object.fromEntries(active.participants.map((p) => [p.user_id, p.users.public_key]));
      const { error } = await supabase.from("messages").insert({ conversation_id: active.id, sender_id: me.id, ...seal(payload, key, recipients, me.sec) });
      if (error) throw error;
      setText("");
    } catch (x) { setErr((x as Error).message); }
  }

  const name = (id: string) => active?.participants.find((p) => p.user_id === id)?.users.username ?? "?";
  const peer = active && !active.is_group ? peerOf(active) : undefined;

  return (
    <div className="app">
      <aside>
        <header>
          <strong>{me.username}</strong>
          <button className="link" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </header>
        <button onClick={() => setCreating(true)}>+ New chat</button>
        {convs.map((c) => (
          <div key={c.id} className={`conv ${c.id === activeId ? "on" : ""}`} onClick={() => setActiveId(c.id)}>
            {c.is_group ? "👥 " : ""}{title(c)}
          </div>
        ))}
      </aside>

      <main>
        {!active ? <p className="empty">Select or start a chat.</p> : (
          <>
            <header>
              <strong>{title(active)}</strong>
              {peer && <span>
                <button onClick={() => start(peer.id, peer.username, false)} title="Voice call">📞</button>
                <button onClick={() => start(peer.id, peer.username, true)} title="Video call">🎥</button>
              </span>}
            </header>
            <div className="msgs">
              {msgs.map((m) => (
                <div key={m.id} className={`msg ${m.sender === me.id ? "mine" : ""}`}>
                  <small>{m.sender === me.id ? "You" : name(m.sender)} · {new Date(m.at).toLocaleTimeString()}</small>
                  {!m.payload ? <em>🔒 can't decrypt this message</em> : <>
                    {m.payload.text && <p>{m.payload.text}</p>}
                    {m.payload.file && <Attachment file={m.payload.file} k={m.key!} />}
                  </>}
                </div>
              ))}
              <div ref={bottom} />
            </div>
            {err && <p className="err">{err}</p>}
            <form className="composer" onSubmit={send}>
              <label className="attach">📎
                <input type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) send(e as unknown as FormEvent, f); }} />
              </label>
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message (end-to-end encrypted)" />
              <button>Send</button>
            </form>
          </>
        )}
      </main>

      {creating && <NewChat meId={me.id} onCancel={() => setCreating(false)}
        onDone={async (id) => { await loadConvs(); setActiveId(id); setCreating(false); }} />}
      <CallOverlay call={call} accept={accept} end={end} />
    </div>
  );
}
