"use client";
import { useEffect, useReducer, useRef, useState } from "react";
import type { Cell } from "@/lib/safety";
import type { CallState } from "@/lib/useCall";
import { tintOf } from "./Avatar";
import Glyph from "./Glyph";
import { Icon, P } from "./icons";

// The same stage, tiles and controls as Deluxe Meet, for voice calls and video calls alike.

/** True while the person is talking: a quick level check on their audio. */
function useSpeaking(stream: MediaStream | undefined, on: boolean, audioTracks: number) {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    if (!stream || !on || !audioTracks) { setSpeaking(false); return; }
    const ctx = new AudioContext();
    const an = ctx.createAnalyser();
    an.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(an);
    ctx.resume().catch(() => {});
    const buf = new Uint8Array(an.fftSize);
    const t = setInterval(() => {
      an.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) { const d = (v - 128) / 128; sum += d * d; }
      setSpeaking(Math.sqrt(sum / buf.length) > 0.03);
    }, 120);
    return () => { clearInterval(t); ctx.close().catch(() => {}); };
  }, [stream, on, audioTracks]); // audioTracks: the remote audio arrives after the stream object does
  return speaking;
}

function Timer({ since }: { since?: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = since ? Math.max(0, Math.floor((now - since) / 1000)) : 0;
  const h = Math.floor(s / 3600), m = String(Math.floor((s % 3600) / 60)).padStart(2, "0"), ss = String(s % 60).padStart(2, "0");
  return <time>{h ? `${h}:` : ""}{m}:{ss}</time>;
}

function Tile({ stream, name, src, self, showVideo, micOn, ringing, note }: {
  stream?: MediaStream; name: string; src?: string | null; self?: boolean; showVideo: boolean; micOn: boolean; ringing?: boolean; note?: string;
}) {
  const v = useRef<HTMLVideoElement>(null);
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (v.current) v.current.srcObject = stream ?? null;
    stream?.addEventListener("addtrack", bump); // the remote stream gains its tracks after the call is set up
    return () => stream?.removeEventListener("addtrack", bump);
  }, [stream]);
  const hasVideo = showVideo && !!stream?.getVideoTracks().length;
  const speaking = useSpeaking(stream, micOn, stream?.getAudioTracks().length ?? 0);
  return (
    <div className={`ctile${self ? " self mirror" : ""}${hasVideo ? "" : " no-video"}${speaking ? " speaking" : ""}${ringing ? " ringing" : ""}`}
      style={{ "--av": `linear-gradient(150deg, ${tintOf(name)}, #24103f 140%)` } as React.CSSProperties}>
      <video ref={v} autoPlay playsInline muted={self} />
      <div className="cav">{src ? <img src={src} alt="" referrerPolicy="no-referrer" /> : name.slice(0, 1).toUpperCase()}</div>
      {note && <p className="cnote">{note}</p>}
      <span className="clabel">{!micOn && <span className="off"><Icon d={P.micOff} /></span>}<span>{self ? "You" : name}</span></span>
    </div>
  );
}

export default function CallOverlay({ call, accept, end, toggle, safety, verified, onVerify, meName, meAvatar, peerAvatar }: {
  call: CallState; accept: () => void; end: () => void; toggle: (kind: "mic" | "cam") => void;
  safety: { digits: string[]; cells: Cell[] } | null; verified: boolean; onVerify: () => void;
  meName: string; meAvatar?: string | null; peerAvatar?: string | null;
}) {
  const [safeOpen, setSafeOpen] = useState(false);
  useEffect(() => { if (call.status === "idle") setSafeOpen(false); }, [call.status]);
  useEffect(() => { if (call.status === "incoming") navigator.vibrate?.([220, 120, 220]); }, [call.status]);
  if (call.status === "idle") return null;

  const peer = call.peerName ?? "Someone", kind = call.video ? "Video call" : "Voice call";
  const incoming = call.status === "incoming", calling = call.status === "calling";
  return (
    <div className="call" role="dialog" aria-label={`${kind} with ${peer}`}>
      <div className={`stage${incoming ? " solo" : ""}`}>
        <div className="callmeta">
          <span>{kind}</span>
          {call.status === "active" && <span className="clock"><Timer since={call.since} /></span>}
          {safety && !incoming && <span className={verified ? "ok" : ""}>{verified ? "Verified" : "Not verified yet"}</span>}
        </div>
        <Tile stream={call.remote} name={peer} src={peerAvatar} showVideo={!!call.video && call.peerCam} micOn={call.peerMic}
          ringing={incoming || calling} note={incoming ? `${peer} is calling you` : calling ? "Calling…" : undefined} />
        {!incoming && <Tile stream={call.local} name={meName} src={meAvatar} self showVideo={!!call.video && call.cam} micOn={call.mic} />}
      </div>

      <div className="cbar">
        <div className="bar-left">{call.status === "active" ? <Timer since={call.since} /> : <span>{calling ? "Calling" : "Ringing"}</span>}<span className="sep" aria-hidden="true">|</span><span className="who">{peer}</span></div>
        <div className="bar-mid">
          {incoming ? <>
            <button className="round leave" onClick={end} aria-label="Decline"><Icon d={P.leave} /></button>
            <button className="round accept" onClick={accept} aria-label="Accept"><Icon d={call.video ? P.video : P.calls} /></button>
          </> : <>
            <button className="round" aria-pressed={call.mic} onClick={() => toggle("mic")} title={call.mic ? "Mute" : "Unmute"} aria-label={call.mic ? "Mute microphone" : "Unmute microphone"}><Icon d={call.mic ? P.mic : P.micOff} /></button>
            {call.video && <button className="round" aria-pressed={call.cam} onClick={() => toggle("cam")} title={call.cam ? "Turn camera off" : "Turn camera on"} aria-label={call.cam ? "Turn camera off" : "Turn camera on"}><Icon d={call.cam ? P.video : P.camOff} /></button>}
            {safety && (
              <span className="pop-wrap">
                <button className={`round${verified ? " ok" : ""}`} aria-expanded={safeOpen} onClick={() => setSafeOpen(!safeOpen)} title="Safety number" aria-label="Safety number"><Icon d={P.shield} /></button>
                {safeOpen && (
                  <div className="safecard" role="group" aria-label="Safety number">
                    <Glyph cells={safety.cells} size={84} />
                    <div className="digits">{safety.digits.map((d) => <span key={d}>{d}</span>)}</div>
                    <p>{verified ? "Verified. This is who you think it is." : `Ask ${peer} to open the same picture. If it matches, nobody is listening in.`}</p>
                    {!verified && <button className="btn-soft" onClick={onVerify}>They match, mark as verified</button>}
                  </div>
                )}
              </span>
            )}
            <button className="round leave" onClick={end} aria-label="Leave call"><Icon d={P.leave} /></button>
          </>}
        </div>
        <div className="bar-right" />
      </div>
    </div>
  );
}
