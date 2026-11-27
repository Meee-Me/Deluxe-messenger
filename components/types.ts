import type { Payload, Row } from "@/lib/crypto";

export type U = { id: string; username: string; public_key: string; avatar_url: string | null };
export type Conv = { id: string; name: string | null; is_group: boolean; participants: { user_id: string; users: U }[]; messages?: { created_at: string }[] };
export type DbMsg = Row & { id: string; sender_id: string; created_at: string; once: boolean; burned_at: string | null };
export type Msg = { id: string; sender: string; at: string; once: boolean; burned: boolean; fresh: boolean; payload?: Payload; key?: Uint8Array };
