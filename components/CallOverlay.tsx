"use client";
import { useEffect, useRef } from "react";
import type { CallState } from "@/lib/useCall";

function Video({ s, muted }: { s?: MediaStream; muted?: boolean }) {
  const r = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (r.current) r.current.srcObject = s ?? null; }, [s]);
  return <video ref={r} autoPlay playsInline muted={muted} />;
}

export default function CallOverlay({ call, accept, end }: { call: CallState; accept: () => void; end: () => void }) {
  if (call.status === "idle") return null;
  const label = { incoming: "is calling you…", calling: "calling…", active: "in call" }[call.status];
  return (
    <div className="call">
      <p>{call.peerName ?? "Someone"} {label}</p>
      <div className="videos">
        <Video s={call.remote} />
        <Video s={call.local} muted />
      </div>
      {call.status === "incoming" && <button onClick={accept}>Accept</button>}
      <button className="danger" onClick={end}>{call.status === "incoming" ? "Decline" : "Hang up"}</button>
    </div>
  );
}
