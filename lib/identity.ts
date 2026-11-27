import type { User } from "@supabase/supabase-js";
import { newKeyPair, publicFromSecret } from "./crypto";
import { supabase } from "./supabase";

export type Me = { id: string; username: string; sec: string };

// shortcut: the secret key lives only in this browser's localStorage (no backup/multi-device sync); upgrade to a passphrase-wrapped key backup.
export async function ensureIdentity(user: User): Promise<Me> {
  const slot = `sec:${user.id}`;
  const sec = localStorage.getItem(slot);
  const { data: row } = await supabase.from("users").select("username,public_key").eq("id", user.id).maybeSingle();
  if (row && sec && publicFromSecret(sec) === row.public_key) return { id: user.id, username: row.username, sec };

  if (row && !confirm("This device has no encryption key for your account. Creating one means your old messages can no longer be read. Continue?"))
    throw new Error("Encryption key missing on this device.");

  const kp = newKeyPair();
  const username = row?.username ?? user.user_metadata.username ?? user.email!.split("@")[0];
  const { error } = await supabase.from("users").upsert({ id: user.id, username, public_key: kp.pub });
  if (error) throw error;
  localStorage.setItem(slot, kp.sec);
  return { id: user.id, username, sec: kp.sec };
}
