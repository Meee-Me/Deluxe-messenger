import type { User } from "@supabase/supabase-js";
import { newKeyPair, publicFromSecret } from "./crypto";
import { supabase } from "./supabase";

export type Me = { id: string; username: string; sec: string; friendCode: string; avatarUrl: string | null };

const str = (m: Record<string, unknown>, keys: string[]) => keys.map((k) => m[k]).find((v): v is string => typeof v === "string" && v.trim() !== "");
const isUrl = (s?: string) => (s && /^https?:\/\//.test(s) ? s : null);

// shortcut: the secret key lives only in this browser's localStorage (no backup/multi-device sync); upgrade to a passphrase-wrapped key backup.
export async function ensureIdentity(user: User): Promise<Me> {
  const meta = user.user_metadata ?? {};
  const avatar = isUrl(str(meta, ["avatar_url", "picture"]));
  const slot = `sec:${user.id}`;
  const sec = localStorage.getItem(slot);
  const { data: row } = await supabase.from("users").select("username,public_key,avatar_url,friend_code").eq("id", user.id).maybeSingle();

  if (row && sec && publicFromSecret(sec) === row.public_key) {
    // Returning user: keep the sign-in provider's photo current.
    if (avatar && avatar !== row.avatar_url) await supabase.from("users").update({ avatar_url: avatar }).eq("id", user.id);
    return { id: user.id, username: row.username, sec, friendCode: row.friend_code, avatarUrl: avatar ?? row.avatar_url };
  }

  if (row && !confirm("This device has no encryption key for your account. Creating one means your old messages can no longer be read. Continue?"))
    throw new Error("Encryption key missing on this device.");

  const kp = newKeyPair();
  let me: Pick<Me, "username" | "friendCode" | "avatarUrl">;
  if (row) {
    const { error } = await supabase.from("users").update({ public_key: kp.pub, avatar_url: avatar ?? row.avatar_url }).eq("id", user.id);
    if (error) throw error;
    me = { username: row.username, friendCode: row.friend_code, avatarUrl: avatar ?? row.avatar_url };
  } else {
    // First login: save the provider's profile; the database assigns the friend code.
    const base = str(meta, ["preferred_username", "user_name", "username", "name"]) ?? user.email?.split("@")[0] ?? "user";
    const save = (username: string) =>
      supabase.from("users").insert({ id: user.id, username, public_key: kp.pub, avatar_url: avatar }).select("friend_code").single();
    let username = base.trim().slice(0, 32).padEnd(2, "_");
    let res = await save(username);
    if (res.error?.code === "23505") { // username taken
      username = `${username.slice(0, 28)}${Math.floor(100 + Math.random() * 900)}`;
      res = await save(username);
    }
    if (res.error) throw res.error;
    me = { username, friendCode: res.data.friend_code, avatarUrl: avatar };
  }
  localStorage.setItem(slot, kp.sec);
  return { id: user.id, sec: kp.sec, ...me };
}
