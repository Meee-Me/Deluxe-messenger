"use client";
import { FormEvent, Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { encryptBytes, FileMeta, newMessageKey, open, Payload, publicFromSecret, seal } from "@/lib/crypto";
import type { Me } from "@/lib/identity";
import { acceptNewKey, markVerified, safety as safetyOf, trust as trustOf } from "@/lib/safety";
import { supabase } from "@/lib/supabase";
import { useCall } from "@/lib/useCall";
import AddFriend from "./AddFriend";
import Avatar, { tintOf } from "./Avatar";
import Bubble, { Reaction } from "./Bubble";
import Brand, { Mark } from "./Brand";
import CallOverlay from "./CallOverlay";
import { Icon, NAV, P } from "./icons";
import InfoPane from "./InfoPane";
import NewChat from "./NewChat";
import type { Conv, DbMsg, Msg } from "./types";

const MAX_FILE = 20 * 1024 * 1024;

const fmt = (iso: string) => {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString([], { month: "short", day: "numeric" });
};
const dayLabel = (iso: string) => {
  const d = new Date(iso), today = new Date(), yest = new Date(Date.now() - 864e5);
  return d.toDateString() === today.toDateString() ? "Today" : d.toDateString() === yest.toDateString() ? "Yesterday"
    : d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric", ...(d.getFullYear() !== today.getFullYear() && { year: "numeric" }) });
};

export default function Chat({ me }: { me: Me }) {
  const [convs, setConvs] = useState<Conv[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Payload["reply"] | null>(null);
  const [whisper, setWhisper] = useState(false);
  const [info, setInfo] = useState(false);
  const [trustTick, setTrustTick] = useState(0);
  const [creating, setCreating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const { call, start, accept, end, toggle, notice } = useCall(me.id, me.username);
  const myPub = useMemo(() => publicFromSecret(me.sec), [me.sec]);

  const active = convs.find((c) => c.id === activeId);
  const activeRef = useRef(active);
  activeRef.current = active;
  const peerOf = (c: Conv) => c.participants.find((p) => p.user_id !== me.id)?.users;
  const title = (c: Conv) => c.name ?? (c.is_group ? "Group" : peerOf(c)?.username ?? "Chat");
  const peer = active && !active.is_group ? peerOf(active) : undefined;

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
    setMsgs([]); setReplyTo(null); setWhisper(false);
    const dec = (r: DbMsg, fresh = false): Msg => {
      const pub = activeRef.current?.participants.find((p) => p.user_id === r.sender_id)?.users.public_key ?? "";
      return { id: r.id, sender: r.sender_id, at: r.created_at, once: r.once, burned: !!r.burned_at, fresh, ...open(r, me.id, me.sec, pub) };
    };
    supabase.from("messages").select("*").eq("conversation_id", activeId).order("created_at").limit(200)
      .then(({ data }) => live && setMsgs(((data ?? []) as DbMsg[]).map((r) => dec(r))));
    const ch = supabase.channel(`msgs:${activeId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        (p) => { const r = p.new as DbMsg; setMsgs((m) => (m.some((x) => x.id === r.id) ? m : [...m, dec(r, r.sender_id === me.id)])); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        (p) => { const r = p.new as DbMsg; setMsgs((m) => m.map((x) => (x.id === r.id ? dec(r) : x))); }) // a whisper was opened
      .subscribe();
    return () => { live = false; supabase.removeChannel(ch); };
  }, [activeId, me.id, me.sec]);

  // Reactions travel as small encrypted messages; fold them onto the message they point at.
  const { visible, reactionsOf } = useMemo(() => {
    const byTarget = new Map<string, Map<string, string>>();
    const visible: Msg[] = [];
    for (const m of msgs) {
      const r = m.payload?.react;
      if (!r) { visible.push(m); continue; }
      if (!byTarget.has(r.to)) byTarget.set(r.to, new Map());
      byTarget.get(r.to)!.set(m.sender, r.emoji); // each person's latest reaction wins
    }
    const reactionsOf = (id: string): Reaction[] => {
      const counts = new Map<string, Reaction>();
      for (const [who, emoji] of byTarget.get(id) ?? []) {
        if (!emoji) continue;
        const c = counts.get(emoji) ?? { emoji, count: 0, mine: false };
        c.count++; c.mine ||= who === me.id; counts.set(emoji, c);
      }
      return [...counts.values()];
    };
    return { visible, reactionsOf };
  }, [msgs, me.id]);

  useEffect(() => { const el = scroller.current; if (el) el.scrollTop = el.scrollHeight; }, [visible.length, activeId]);

  async function post(payload: Payload, { file, once = false }: { file?: File; once?: boolean } = {}) {
    if (!active) return false;
    setErr("");
    try {
      const key = newMessageKey();
      if (file) {
        if (file.size > MAX_FILE) throw new Error("File too large (20 MB max).");
        const enc = encryptBytes(new Uint8Array(await file.arrayBuffer()), key);
        const path = `${active.id}/${crypto.randomUUID()}`;
        const up = await supabase.storage.from("attachments").upload(path, enc.data, { contentType: "application/octet-stream" });
        if (up.error) throw up.error;
        payload.file = { path, nonce: enc.nonce, name: file.name, type: file.type || "application/octet-stream", size: file.size } satisfies FileMeta;
      }
      const recipients = Object.fromEntries(active.participants.map((p) => [p.user_id, p.users.public_key]));
      const { error } = await supabase.from("messages").insert({ conversation_id: active.id, sender_id: me.id, once, ...seal(payload, key, recipients, me.sec) });
      if (error) throw error;
      return true;
    } catch (x) { setErr((x as Error).message); return false; }
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    const payload: Payload = { text: t };
    if (replyTo && !whisper) payload.reply = replyTo;
    if (await post(payload, { once: whisper && !!peer })) { setText(""); setReplyTo(null); setWhisper(false); }
  }

  const name = (id: string) => (id === me.id ? "You" : active?.participants.find((p) => p.user_id === id)?.users.username ?? "?");
  const reply = (m: Msg) => setReplyTo({ id: m.id, who: name(m.sender), text: (m.payload?.text ?? (m.payload?.file ? `File: ${m.payload.file.name}` : "")).slice(0, 90) });
  const react = (m: Msg, emoji: string) => { post({ react: { to: m.id, emoji } }); };
  async function opened(m: Msg) {
    const { error } = await supabase.rpc("burn_message", { p_id: m.id });
    if (error) setErr(error.message);
    else setMsgs((all) => all.map((x) => (x.id === m.id ? { ...x, burned: true, payload: undefined, key: undefined } : x)));
  }
  function jump(id: string) {
    const el = document.getElementById(`m-${id}`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1400);
  }
  function copyCode() {
    navigator.clipboard.writeText(me.friendCode).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 1500); },
      () => window.prompt("Your friend code", me.friendCode), // clipboard blocked: let them copy by hand
    );
  }

  const safety = useMemo(() => (peer ? safetyOf(myPub, peer.public_key) : null), [myPub, peer]);
  const trust = useMemo(() => (peer ? trustOf(me.id, peer.id, peer.public_key) : null), [me.id, peer, trustTick]); // eslint-disable-line react-hooks/exhaustive-deps
  const verifiedPeers = useMemo(() => new Set(convs.filter((c) => !c.is_group).map((c) => ({ c, p: peerOf(c) })).filter(({ p }) => p && trustOf(me.id, p.id, p.public_key).verified).map(({ c }) => c.id)), [convs, me.id, trustTick]); // eslint-disable-line react-hooks/exhaustive-deps
  const callPeer = call.peerId ? convs.flatMap((c) => c.participants).find((p) => p.user_id === call.peerId)?.users : undefined;
  const callSafety = callPeer ? safetyOf(myPub, callPeer.public_key) : null;
  const callVerified = callPeer ? trustOf(me.id, callPeer.id, callPeer.public_key).verified : false;

  let prevDay = "", prevSender = "";
  return (
    <div className={`app${info && active ? " has-info" : ""}${active ? " in-chat" : ""}`}>
      <nav className="rail" aria-label="Main">
        <Mark size={34} />
        {NAV.map(([label, d]) => (
          <button key={label} aria-current={label === "Chats"} disabled={label !== "Chats"} onClick={() => setActiveId(undefined)} title={label === "Chats" ? label : `${label} (coming soon)`}>
            <Icon d={d} /><span>{label}</span>
          </button>
        ))}
      </nav>

      <aside className="side">
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
              <Avatar name={title(c)} group={c.is_group} src={c.is_group ? null : peerOf(c)?.avatar_url} ring={verifiedPeers.has(c.id)} />
              <span className="who"><b>{title(c)}</b><span>{c.is_group ? `${c.participants.length} members` : verifiedPeers.has(c.id) ? "Verified" : "Direct message"}</span></span>
              {c.messages?.[0] && <time>{fmt(c.messages[0].created_at)}</time>}
            </button>
          ))}
          {!convs.length && <p className="empty">No chats yet. Add a friend with their code.</p>}
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
            <button className="cta" onClick={() => setAdding(true)}>Add a friend</button>
          </div>
        ) : (
          <>
            <header className="thead">
              <button className="icon back" onClick={() => setActiveId(undefined)} aria-label="Back to chats"><Icon d={P.back} /></button>
              <Avatar name={title(active)} group={active.is_group} size={40} src={peer?.avatar_url} ring={trust?.verified} />
              <button className="who-btn" onClick={() => setInfo(!info)} aria-label="Contact info">
                <strong>{title(active)}</strong>
                <span className={trust?.verified ? "ok" : ""}>{active.is_group ? `${active.participants.length} members` : trust?.verified ? "Verified, end-to-end encrypted" : "End-to-end encrypted"}</span>
              </button>
              {peer && <>
                <button className="icon" onClick={() => start(peer.id, peer.username, false)} title="Voice call" aria-label="Voice call"><Icon d={P.calls} /></button>
                <button className="icon" onClick={() => start(peer.id, peer.username, true)} title="Video call" aria-label="Video call"><Icon d={P.video} /></button>
              </>}
              <button className="icon info-btn" onClick={() => setInfo(!info)} aria-label="Contact info" aria-pressed={info} title="Contact info"><Icon d={P.info} /></button>
            </header>

            {trust?.changed && peer && (
              <div className="banner" role="alert"><Icon d={P.shieldAlert} />
                <span>{peer.username}'s key changed. They may have a new device. Compare your safety number again.</span>
                <button onClick={() => setInfo(true)}>Review</button>
              </div>
            )}

            <div className="msgs" ref={scroller}>
              <p className="lockline"><Icon d={P.lock} />Messages and calls here are end-to-end encrypted.</p>
              {visible.map((m) => {
                const day = dayLabel(m.at), showDay = day !== prevDay, first = showDay || m.sender !== prevSender;
                prevDay = day; prevSender = m.sender;
                return (
                  <Fragment key={m.id}>
                    {showDay && <div className="sep">{day}</div>}
                    <Bubble m={m} mine={m.sender === me.id} first={first} group={active.is_group} who={name(m.sender)} tint={tintOf(name(m.sender))}
                      reactions={reactionsOf(m.id)} onReply={reply} onReact={react} onOpened={opened} onJump={jump} />
                  </Fragment>
                );
              })}
            </div>

            {err && <p className="err" role="alert">{err}</p>}
            <div className={`composer${whisper ? " whisper" : ""}`}>
              {replyTo && !whisper && (
                <div className="replybar"><span><b>{replyTo.who}</b> {replyTo.text || "Attachment"}</span>
                  <button className="icon" onClick={() => setReplyTo(null)} aria-label="Cancel reply"><Icon d={P.x} /></button></div>
              )}
              <form onSubmit={send}>
                {!whisper && (
                  <label className="icon attach" title="Attach a file"><Icon d={P.clip} />
                    <input type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) post({}, { file: f }); }} />
                  </label>
                )}
                {peer && (
                  <button type="button" className={`icon whisper-btn${whisper ? " on" : ""}`} aria-pressed={whisper} onClick={() => setWhisper(!whisper)}
                    title="Whisper: read once, then gone" aria-label="Whisper: read once, then gone"><Icon d={P.ghost} /></button>
                )}
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder={whisper ? "Write a whisper" : "Message"} aria-label="Message" />
                <button className="send">{whisper ? "Seal it" : "Send"}</button>
              </form>
              {whisper && peer && <p className="whisper-note">{peer.username} holds to read it once. When they let go, it's gone for both of you.</p>}
            </div>
          </>
        )}
      </main>

      {info && active && (
        <InfoPane conv={active} title={title(active)} peer={peer} safety={safety} trust={trust} meName={me.username}
          onVerify={() => { if (peer) { markVerified(me.id, peer.id, peer.public_key); setTrustTick((t) => t + 1); } }}
          onAcceptKey={() => { if (peer) { acceptNewKey(me.id, peer.id, peer.public_key); setTrustTick((t) => t + 1); } }}
          onCall={(video) => peer && start(peer.id, peer.username, video)} onClose={() => setInfo(false)} />
      )}

      {adding && <AddFriend myCode={me.friendCode} onCancel={() => setAdding(false)}
        onDone={async (id) => { await loadConvs(); setActiveId(id); setAdding(false); }} />}
      {creating && <NewChat meId={me.id} onCancel={() => setCreating(false)}
        onDone={async (id) => { await loadConvs(); setActiveId(id); setCreating(false); }} />}
      {notice && <p className="err callerr" role="alert">{notice}</p>}
      <CallOverlay call={call} accept={accept} end={end} toggle={toggle} safety={callSafety} verified={callVerified} meName={me.username} meAvatar={me.avatarUrl} peerAvatar={callPeer?.avatar_url}
        onVerify={() => { if (callPeer) { markVerified(me.id, callPeer.id, callPeer.public_key); setTrustTick((t) => t + 1); } }} />
    </div>
  );
}
