"use client";
import { useEffect, useRef, useState } from "react";
import Attachment from "./Attachment";
import { Icon, P } from "./icons";
import type { Msg } from "./types";

export type Reaction = { emoji: string; count: number; mine: boolean };
const QUICK = ["👍", "❤️", "😂", "😮", "🙏"];
const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const linkify = (t: string) => t.split(/(https?:\/\/[^\s<]+)/g).map((p, i) => /^https?:\/\//.test(p) ? <a key={i} href={p} target="_blank" rel="noopener noreferrer">{p}</a> : p);

// A sent message resolves out of scrambled characters, as if it were being sealed.
function scramble(el: HTMLElement, text: string, done: () => void) {
  const g = "▒░▓#%&@$*?", step = Math.max(1, Math.ceil(text.length / 9));
  let k = 0;
  const t = setInterval(() => {
    k += step;
    el.textContent = text.slice(0, k) + [...text.slice(k)].map((c) => (/\s/.test(c) ? c : g[Math.floor(Math.random() * g.length)])).join("");
    if (k >= text.length) { clearInterval(t); done(); }
  }, 30);
  return () => clearInterval(t);
}

/** An unopened whisper: hold to read, let go and it is destroyed for both people. */
function Sealed({ text, onOpened }: { text: string; onOpened: () => void }) {
  const [showing, setShowing] = useState(false);
  const spent = useRef(false);
  const release = () => { if (!showing || spent.current) return; spent.current = true; setShowing(false); onOpened(); };
  return (
    <button type="button" className={`sealed${showing ? " open" : ""}`}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); setShowing(true); }}
      onPointerUp={release} onPointerCancel={release}
      onKeyDown={(e) => { if (!e.repeat && (e.key === " " || e.key === "Enter")) { e.preventDefault(); setShowing(true); } }}
      onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") release(); }}>
      {showing ? <span className="tx">{text}</span> : <>
        <Icon d={P.ghost} />
        <span><b>Whisper</b><small>Hold to read. When you let go, it's gone for both of you.</small></span>
      </>}
    </button>
  );
}

export default function Bubble({ m, mine, first, group, who, tint, reactions, onReply, onReact, onOpened, onJump }: {
  m: Msg; mine: boolean; first: boolean; group: boolean; who: string; tint: string; reactions: Reaction[];
  onReply: (m: Msg) => void; onReact: (m: Msg, emoji: string) => void; onOpened: (m: Msg) => void; onJump: (id: string) => void;
}) {
  const [selected, setSelected] = useState(false);
  const text = m.payload?.text;
  const [shown, setShown] = useState(!m.fresh || !text);
  const tx = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (shown || !text || !tx.current) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(true); return; }
    return scramble(tx.current, text, () => setShown(true));
  }, [shown, text]);

  const side = mine ? "mine" : "recv";
  if (m.burned) return (
    <div className={`row ${side} first`}><div className="bub gone"><Icon d={P.ghost} />
      <span>{mine ? "Opened and gone" : "You opened this whisper. It's gone."}</span></div></div>
  );

  const quote = m.payload?.reply;
  return (
    <div id={`m-${m.id}`} className={`row ${side}${first ? " first" : ""}`}>
      <div className="col">
        <div className={`bub${first ? " tail" : ""}${m.once ? " whisper" : ""}`} tabIndex={0} role="button" aria-label="Message options"
          onClick={() => !m.once && setSelected(!selected)} onKeyDown={(e) => { if (e.key === "Enter" && !m.once) setSelected(!selected); }}>
          {group && !mine && first && <span className="name" style={{ color: tint }}>{who}</span>}
          {!m.payload ? <em>Can't decrypt this message</em>
            : m.once && !mine ? <Sealed text={text ?? ""} onOpened={() => onOpened(m)} />
            : <>
              {quote && <button type="button" className="quote" onClick={(e) => { e.stopPropagation(); onJump(quote.id); }}><b>{quote.who}</b>{quote.text}</button>}
              {text && <span className="tx" ref={tx}>{shown ? linkify(text) : ""}</span>}
              {m.payload.file && <Attachment file={m.payload.file} k={m.key!} />}
            </>}
          <span className="meta">{m.once && <Icon d={P.ghost} />}{clock(m.at)}</span>
        </div>
        {reactions.length > 0 && (
          <div className="reacts">{reactions.map((r) => (
            <button key={r.emoji} type="button" className={r.mine ? "mine" : ""} onClick={() => onReact(m, r.mine ? "" : r.emoji)}
              aria-label={`${r.emoji} ${r.count}${r.mine ? ", yours. Tap to remove" : ""}`}>{r.emoji}{r.count > 1 && <i>{r.count}</i>}</button>
          ))}</div>
        )}
        {selected && (
          <div className="acts">
            <button type="button" onClick={() => { onReply(m); setSelected(false); }}><Icon d={P.reply} />Reply</button>
            {QUICK.map((e) => <button key={e} type="button" aria-label={`React ${e}`} onClick={() => { onReact(m, e); setSelected(false); }}>{e}</button>)}
          </div>
        )}
      </div>
    </div>
  );
}
