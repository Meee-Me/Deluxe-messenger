import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { Deluxe } from "./handler.ts";

// Finds (or creates, on first sign-in) the Supabase user for a Deluxe Main account and
// returns a one-use token the browser trades for a session with verifyOtp.
// The link is stored by Deluxe account id in our own table, not by email, so a user
// changing their email later cannot lose the link or claim someone else's.
export function tokenHashFor(admin: SupabaseClient) {
  const linked = async (id: string) =>
    (await admin.from("deluxe_accounts").select("user_id").eq("deluxe_id", id).maybeSingle()).data?.user_id as string | undefined;

  return async (who: Deluxe): Promise<string> => {
    let userId = await linked(who.id);
    if (!userId) {
      const made = await admin.auth.admin.createUser({
        email: `${crypto.randomUUID()}@deluxe-main.invalid`, // placeholder: Deluxe accounts have no email
        email_confirm: true,
        user_metadata: { preferred_username: who.handle, name: who.name },
        app_metadata: { deluxe_id: who.id },
      });
      if (made.error) throw made.error;
      const link = await admin.from("deluxe_accounts").insert({ deluxe_id: who.id, user_id: made.data.user.id });
      if (link.error) {
        // A parallel first sign-in won the race: use theirs and drop ours.
        await admin.auth.admin.deleteUser(made.data.user.id);
        userId = await linked(who.id);
        if (!userId) throw link.error;
      } else userId = made.data.user.id;
    }
    const user = await admin.auth.admin.getUserById(userId);
    if (user.error || !user.data.user.email) throw user.error ?? new Error("user has no email");
    const out = await admin.auth.admin.generateLink({ type: "magiclink", email: user.data.user.email });
    if (out.error) throw out.error;
    return out.data.properties.hashed_token;
  };
}
