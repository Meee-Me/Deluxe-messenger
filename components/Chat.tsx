"use client";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { encryptBytes, FileMeta, newMessageKey, open, Payload, Row, seal } from "@/lib/crypto";
import type { Me } from "@/lib/identity";
import { supabase } from "@/lib/supabase";
import { useCall } from "@/lib/useCall";
import Attachment from "./Attachment";
import CallOverlay from "./CallOverlay";
import Brand, { Mark } from "./Brand";
import AddFriend from "./AddFriend";
import NewChat from "./NewChat";

type U = { id: string; username: string; public_key: string; avatar_url: string | null };
type Conv = { id: string; name: string | null; is_group: boolean; participants: { user_id: string; users: U }[]; messages?: { created_at: string }[] };
type DbMsg = Row & { id: string; sender_id: string; created_at: string };
type Msg = { id: string; sender: string; at: string; payload?: Payload; key?: Uint8Array };

const MAX_FILE = 20 * 1024 * 1024;

const P = {
  updates: "M12 4.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15zm0 5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z",
  calls: "M5 4h4l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z",
  chats: "M4 5.5h16v10.5H9.5L5 19.5V16H4z",
  keys: "M8 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 12h9M18 12v3M15 12v2",
  you: "M12 5.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM5 20c0-4 3-6 7-6s7 2 7 6",
  video: "M4.5 6h10a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 3 16.5v-9A1.5 1.5 0 0 1 4.5 6zM16 10l5-3v10l-5-3",
  clip: "M20 11l-8 8a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8",
  plus: "M12 5v14M5 12h14",
  userPlus: "M9 5.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM2.500 20c0-3.600 2.700-5.500 6.500-5.500s6.500 1.900 6.500 5.500M19 8v6M16 11h6",
  copy: "M9 9h10v10H9zM5 15V5h10",
  check: "M5 12.5l4.5 4.5L19 7.5",
};
const NAV = [["Updates", P.updates], ["Calls", P.calls], ["Chats", P.chats], ["Keys", P.keys], ["You", P.you]] as const;
const Icon = ({ d }: { d: string }) => <svg className="i" viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;

// hand-picked tints, not a generated hue wheel
const TINTS = ["#7c3aed", "#9d4edd", "#5b2a9e", "#0e9f6e", "#2bb673", "#b56cf2"];
function Avatar({ name, group, size = 44, src }: { name: string; group: boolean; size?: number; src?: string | null }) {
  const t = TINTS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % TINTS.length];
  return (
    <span className={`av ${group ? "sq" : ""}`} style={{ width: size, height: size, background: `linear-gradient(150deg, ${t}, #24103f 135%)` }}>
      {src ? <img src={src} alt="" referrerPolicy="no-referrer" /> : name.slice(0, 1).toUpperCase()}
    </span>
  );
}
const fmt = (iso: string) => {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString([], { month: "short", day: "numeric" });
};

export default function Chat({ me }: { me: Me }) {
  const [convs, setConvs] = useState<Conv[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [creating, setCreating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);
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
      .select("id,name,is_group,participants(user_id,users(id,username,public_key,avatar_url)),messages(created_at)")
      .order("created_at", { referencedTable: "messages", ascending: false })
      .limit(1, { referencedTable: "messages" });
    const last = (c: Conv) => c.messages?.[0]?.created_at ?? "";
    setConvs(((data ?? []) as unknown as Conv[]).sort((a, b) => last(b).localeCompare(last(a))));
  }, []);

  useEffect(() => {
    loadConvs();
    const ch = supabase.channel("my-participations")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "participants", filter: `user_id=eq.${me.id}` }, loadConvs)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, loadConvs) // keeps order and times fresh; RLS limits it to my chats
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

  useEffect(() => { bottom.current?.scrollIntoView(); }, [msgs]); // braces: newer browsers return a Promise, which React rejects as a cleanup

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

  function copyCode() {
    navigator.clipboard.writeText(me.friendCode).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 1500); },
      () => window.prompt("Your friend code", me.friendCode), // clipboard blocked: let them copy by hand
    );
  }

  const name = (id: string) => active?.participants.find((p) => p.user_id === id)?.users.username ?? "?";
  const peer = active && !active.is_group ? peerOf(active) : undefined;

  return (
    <div className="app">
      <nav className="rail" aria-label="Main">
        <Mark size={34} />
        {NAV.map(([label, d]) => (
          <button key={label} aria-current={label === "Chats"} disabled={label !== "Chats"} onClick={() => setActiveId(undefined)} title={label === "Chats" ? label : `${label} (coming soon)`}>
            <Icon d={d} /><span>{label}</span>
          </button>
        ))}
      </nav>

      <aside>
        <header>
          <h2>Chats</h2>
          <span>
            <button className="icon" onClick={() => setAdding(true)} aria-label="Add via Friend Code" title="Add via Friend Code"><Icon d={P.userPlus} /></button>
            <button className="icon" onClick={() => setCreating(true)} aria-label="New chat" title="New chat or group"><Icon d={P.plus} /></button>
          </span>
        </header>
        <div className="list">
          {convs.map((c) => (
            <button key={c.id} className="conv" aria-current={c.id === activeId} onClick={() => setActiveId(c.id)}>
              <Avatar name={title(c)} group={c.is_group} src={c.is_group ? null : peerOf(c)?.avatar_url} />
              <span className="who"><b>{title(c)}</b><span>{c.is_group ? `${c.participants.length} members` : "Direct message"}</span></span>
              {c.messages?.[0] && <time>{fmt(c.messages[0].created_at)}</time>}
            </button>
          ))}
          {!convs.length && <p className="empty">No chats yet.</p>}
        </div>
        <footer>
          <Avatar name={me.username} group={false} size={36} src={me.avatarUrl} />
          <span className="me">
            <b>{me.username}</b>
            <button className="code" onClick={copyCode} aria-label={`Copy your friend code, ${me.friendCode}`} title="Copy your friend code">
              Your Code: <strong>{me.friendCode}</strong><Icon d={copied ? P.check : P.copy} />
            </button>
          </span>
          <button className="link" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </footer>
      </aside>

      <main>
        {!active ? (
          <div className="blank">
            <Brand size={60} />
            <p>End-to-end encrypted</p>
            <button className="cta" onClick={() => setCreating(true)}>Start a chat</button>
          </div>
        ) : (
          <>
            <header>
              <Avatar name={title(active)} group={active.is_group} size={38} src={active.is_group ? null : peer?.avatar_url} />
              <strong>{title(active)}</strong>
              {peer && <span>
                <button className="icon" onClick={() => start(peer.id, peer.username, false)} title="Voice call" aria-label="Voice call"><Icon d={P.calls} /></button>
                <button className="icon" onClick={() => start(peer.id, peer.username, true)} title="Video call" aria-label="Video call"><Icon d={P.video} /></button>
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
              <label className="icon attach" title="Attach a file"><Icon d={P.clip} />
                <input type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) send(e as unknown as FormEvent, f); }} />
              </label>
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message" aria-label="Message" />
              <button className="send">Send</button>
            </form>
          </>
        )}
      </main>

      {adding && <AddFriend myCode={me.friendCode} onCancel={() => setAdding(false)}
        onDone={async (id) => { await loadConvs(); setActiveId(id); setAdding(false); }} />}
      {creating && <NewChat meId={me.id} onCancel={() => setCreating(false)}
        onDone={async (id) => { await loadConvs(); setActiveId(id); setCreating(false); }} />}
      <CallOverlay call={call} accept={accept} end={end} />
    </div>
  );
}
