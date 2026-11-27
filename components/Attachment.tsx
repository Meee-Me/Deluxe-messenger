"use client";
import { useEffect, useState } from "react";
import { decryptBytes, FileMeta } from "@/lib/crypto";
import { supabase } from "@/lib/supabase";

async function fetchPlain(f: FileMeta, key: Uint8Array) {
  const { data, error } = await supabase.storage.from("attachments").download(f.path);
  if (error) throw error;
  const plain = decryptBytes(new Uint8Array(await data.arrayBuffer()), f.nonce, key);
  if (!plain) throw new Error("decrypt failed");
  return URL.createObjectURL(new Blob([plain as BlobPart], { type: f.type }));
}

export default function Attachment({ file, k }: { file: FileMeta; k: Uint8Array }) {
  const isImg = file.type.startsWith("image/");
  const [url, setUrl] = useState("");
  const [err, setErr] = useState(false);
  const load = () => fetchPlain(file, k).then(setUrl, () => setErr(true));

  useEffect(() => { if (isImg) load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  if (err) return <em>⚠ attachment unavailable</em>;
  if (isImg) return url ? <img src={url} alt={file.name} className="img" /> : <em>loading image…</em>;
  return url
    ? <a href={url} download={file.name}>📎 {file.name} (save)</a>
    : <button className="link" onClick={load}>📎 {file.name} ({Math.ceil(file.size / 1024)} KB) – download</button>;
}
