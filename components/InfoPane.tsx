"use client";
import type { Cell } from "@/lib/safety";
import Avatar from "./Avatar";
import Glyph from "./Glyph";
import { Icon, P } from "./icons";
import type { Conv, U } from "./types";

export default function InfoPane({ conv, title, peer, safety, trust, meName, onVerify, onAcceptKey, onCall, onClose }: {
  conv: Conv; title: string; peer?: U; safety: { digits: string[]; cells: Cell[] } | null; trust: { verified: boolean; changed: boolean } | null; meName: string;
  onVerify: () => void; onAcceptKey: () => void; onCall: (video: boolean) => void; onClose: () => void;
}) {
  return (
    <aside className="info" aria-label={conv.is_group ? "Group info" : "Contact info"}>
      <header><h3>{conv.is_group ? "Group info" : "Contact info"}</h3><button className="icon" onClick={onClose} aria-label="Close"><Icon d={P.x} /></button></header>
      <div className="hero">
        <Avatar name={title} group={conv.is_group} size={88} src={peer?.avatar_url} ring={trust?.verified} />
        <h2>{title}</h2>
        {peer && <button className="link" onClick={() => onCall(false)}>Voice call</button>}
      </div>

      {conv.is_group ? (
        <section>
          <h4>Members</h4>
          <ul className="members">{conv.participants.map((p) => (
            <li key={p.user_id}><Avatar name={p.users.username} group={false} size={34} src={p.users.avatar_url} />{p.users.username === meName ? "You" : p.users.username}</li>
          ))}</ul>
        </section>
      ) : safety && peer && (
        <section>
          <h4>Safety number</h4>
          <div className="safety">
            <Glyph cells={safety.cells} size={132} />
            <div className="digits">{safety.digits.map((d) => <span key={d}>{d}</span>)}</div>
          </div>
          {trust?.changed ? (
            <div className="note warn"><Icon d={P.shieldAlert} /><span>{peer.username}'s key changed since you last checked. Compare the picture and number with them again before trusting this chat.</span></div>
          ) : trust?.verified ? (
            <div className="note ok"><Icon d={P.shield} /><span>Verified. You compared this with {peer.username}.</span></div>
          ) : (
            <p className="hint">Ask {peer.username} to open this chat and look at the same picture and number. If they match, nobody is listening in.</p>
          )}
          {trust?.changed
            ? <button className="btn-soft" onClick={onAcceptKey}>I checked, trust the new key</button>
            : !trust?.verified && <button className="btn-soft" onClick={onVerify}>They match, mark as verified</button>}
        </section>
      )}
    </aside>
  );
}
