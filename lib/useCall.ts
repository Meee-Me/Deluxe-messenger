"use client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

type Sig = { type: "offer" | "answer" | "ice" | "hangup"; from: string; name?: string; video?: boolean; sdp?: RTCSessionDescriptionInit; ice?: RTCIceCandidateInit };
export type CallState = { status: "idle" | "incoming" | "calling" | "active"; peerId?: string; peerName?: string; video?: boolean; local?: MediaStream; remote?: MediaStream };

// shortcut: STUN only (fails behind symmetric NAT), 1-on-1 only; add a TURN server / SFU for groups.
const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

/** 1-on-1 calls. Signaling goes over Supabase Realtime broadcast to each user's `inbox:<id>`; media is peer-to-peer (DTLS-SRTP). */
export function useCall(meId: string, meName: string) {
  const [call, setCall] = useState<CallState>({ status: "idle" });
  const pc = useRef<RTCPeerConnection | null>(null);
  const peer = useRef<string | null>(null);
  const offer = useRef<RTCSessionDescriptionInit | null>(null);
  const queued = useRef<RTCIceCandidateInit[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const out = useRef(new Map<string, Promise<RealtimeChannel>>());

  const send = useCallback(async (to: string, sig: Omit<Sig, "from" | "name">) => {
    let ch = out.current.get(to);
    if (!ch) {
      ch = new Promise<RealtimeChannel>((res) => {
        const c = supabase.channel(`inbox:${to}`);
        c.subscribe((s) => s === "SUBSCRIBED" && res(c));
      });
      out.current.set(to, ch);
    }
    (await ch).send({ type: "broadcast", event: "sig", payload: { ...sig, from: meId, name: meName } });
  }, [meId, meName]);

  const end = useCallback((notify = true) => {
    if (notify && peer.current) send(peer.current, { type: "hangup" });
    pc.current?.close();
    stream.current?.getTracks().forEach((t) => t.stop());
    pc.current = stream.current = peer.current = offer.current = null;
    queued.current = [];
    setCall({ status: "idle" });
  }, [send]);

  const connect = useCallback(async (to: string, video: boolean) => {
    const local = (stream.current = await navigator.mediaDevices.getUserMedia({ audio: true, video }));
    const remote = new MediaStream();
    const p = (pc.current = new RTCPeerConnection(ICE));
    local.getTracks().forEach((t) => p.addTrack(t, local));
    p.ontrack = (e) => e.streams[0]?.getTracks().forEach((t) => remote.addTrack(t));
    p.onicecandidate = (e) => e.candidate && send(to, { type: "ice", ice: e.candidate.toJSON() });
    p.onconnectionstatechange = () => {
      if (p.connectionState === "connected") setCall((c) => ({ ...c, status: "active" }));
      if (p.connectionState === "failed") end();
    };
    setCall((c) => ({ ...c, status: "calling", video, local, remote }));
    return p;
  }, [send, end]);

  const start = useCallback(async (to: string, toName: string, video: boolean) => {
    if (peer.current) return;
    peer.current = to;
    setCall({ status: "calling", peerId: to, peerName: toName, video });
    try {
      const p = await connect(to, video);
      await p.setLocalDescription(await p.createOffer());
      send(to, { type: "offer", sdp: p.localDescription!.toJSON(), video });
    } catch (e) { end(false); alert(`Could not start call: ${(e as Error).message}`); }
  }, [connect, send, end]);

  const accept = useCallback(async () => {
    const to = peer.current!, sdp = offer.current!;
    try {
      const p = await connect(to, !!call.video);
      await p.setRemoteDescription(sdp);
      for (const c of queued.current) await p.addIceCandidate(c);
      queued.current = [];
      await p.setLocalDescription(await p.createAnswer());
      send(to, { type: "answer", sdp: p.localDescription!.toJSON() });
    } catch (e) { end(); alert(`Could not answer call: ${(e as Error).message}`); }
  }, [connect, send, end, call.video]);

  useEffect(() => {
    const ch = supabase.channel(`inbox:${meId}`).on("broadcast", { event: "sig" }, async ({ payload }) => {
      const s = payload as Sig;
      if (s.type === "offer") {
        if (peer.current) return send(s.from, { type: "hangup" }); // busy
        peer.current = s.from; offer.current = s.sdp!;
        setCall({ status: "incoming", peerId: s.from, peerName: s.name, video: s.video });
      } else if (s.from !== peer.current) return;
      else if (s.type === "hangup") end(false);
      else if (s.type === "answer") {
        await pc.current?.setRemoteDescription(s.sdp!);
        for (const c of queued.current) await pc.current?.addIceCandidate(c);
        queued.current = [];
      } else if (s.type === "ice") {
        if (pc.current?.remoteDescription) await pc.current.addIceCandidate(s.ice!);
        else queued.current.push(s.ice!);
      }
    }).subscribe();
    const chans = out.current;
    return () => { supabase.removeChannel(ch); chans.forEach(async (c) => supabase.removeChannel(await c)); chans.clear(); end(false); };
  }, [meId, send, end]);

  return { call, start, accept, end };
}
