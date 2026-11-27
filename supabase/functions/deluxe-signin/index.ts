import { createClient } from "npm:@supabase/supabase-js@2";
import { tokenHashFor } from "./admin.ts";
import { handle } from "./handler.ts";

// Runs with the project's service key (provided by Supabase, never sent to browsers).
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

Deno.serve((req) =>
  handle(req, {
    mainUrl: (Deno.env.get("DELUXE_MAIN_URL") ?? "https://deluxe-main.vercel.app").replace(/\/+$/, ""),
    app: Deno.env.get("DELUXE_APP") ?? "messenger",
    fetch,
    tokenHashFor: tokenHashFor(admin),
  })
);
