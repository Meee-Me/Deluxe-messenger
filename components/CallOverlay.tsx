"use client";
import { useEffect, useRef } from "react";
import type { Cell } from "@/lib/safety";
import type { CallState } from "@/lib/useCall";
import Glyph from "./Glyph";
import { Icon, P } from "./icons";

function Video({ s, muted }: { s?: MediaStream; muted?: boolean }) {
  const r = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (r.current) r.current.srcObject = s ?? null; }, [s]);
  return <video ref={r} autoPlay playsInline muted={muted} />;
}

export default function CallOverlay({ call, accept, end, safety, verified }: {
  call: CallState; accept: () => void; end: () => void; safety: { digits: string[]; cells: Cell[] } | null; verified: boolean;
}) {
  if (call.status === "idle") return null;
  const label = { incoming: "is calling you", calling: "calling", active: "in call" }[call.status];
  return (
    <div className="call" role="dialog" aria-label="Call">
      <div className="videos">
        <Video s={call.remote} />
        <Video s={call.local} muted />
      </div>
      <div className="callbar">
        <div className="who"><b>{call.peerName ?? "Someone"}</b><span>{label}</span></div>
        {safety && (
          <div className="callsafe" title="Compare with the other person. If it matches, nobody is listening in.">
            <Glyph cells={safety.cells} size={44} />
            <div><span className={verified ? "ok" : ""}>{verified && <Icon d={P.shield} />}{verified ? "Verified" : "Not verified yet"}</span>
              <small>{safety.digits.join(" ")}</small></div>
          </div>
        )}
        <div className="callbtns">
          {call.status === "incoming" && <button onClick={accept}>Accept</button>}
          <button className="danger" onClick={end}>{call.status === "incoming" ? "Decline" : "Hang up"}</button>
        </div>
      </div>
    </div>
  );
}
