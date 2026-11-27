# Deluxe Messenger

Next.js + Supabase messenger: realtime 1-on-1/group chat, file & image sharing, WebRTC voice/video (1-on-1), end-to-end encryption with TweetNaCl.

## Setup
1. Create a Supabase project; run `supabase/migrations/0001_init.sql` in the SQL editor (or `supabase db push`).
2. Auth → Providers → Email. For quick testing, turn off "Confirm email".
3. `cp .env.example .env.local` and fill in the project URL + publishable key.
4. `npm install && npm run dev` · `npm test` runs the crypto self-check.

## Deploy
Import the repo in Vercel, set the two `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` env vars. HTTPS (Vercel default) is required for camera/mic.

## Sign in
- **Deluxe Main:** the button sends people to Deluxe Main and back with a one-use code. The browser trades it for a short-lived Deluxe key and hands that to the `deluxe-signin` Edge Function (`supabase/functions/deluxe-signin`), which asks Deluxe Main who it belongs to, refuses keys made for other Deluxe sites, finds or creates the Supabase user (linked by Deluxe account id in `deluxe_accounts`) and returns a one-use sign-in. The messenger is a registered site in Deluxe Main's `worker/apps.js` (id `messenger`). `deluxe.js` is deliberately not loaded here: a script from another site could read the encryption keys kept in this browser.
- **Phone:** Supabase phone sign-in; needs an SMS provider enabled in Supabase.
- To run locally, Deluxe Main must accept `http://localhost:3000` (set `ALLOW_LOCALHOST=1` on its Worker).

## Whispers and safety numbers
- **Whisper:** in a 1-on-1 chat, tap the ghost button to send a message that stays sealed until the other person holds it. When they let go it is wiped for both of you (the server clears the ciphertext, see `burn_message` in migration 0009) and a tombstone stays. It is a promise between two people, not a lock: a recipient can still screenshot it.
- **Safety number:** a picture and six number groups made from both people's public keys, the same on both screens. Compare them, tick "Verified", and the avatar gets a green ring. If that person's key ever changes, a banner asks you to check again. Verification is remembered in this browser only.

## How E2EE works
- Each user gets a NaCl box keypair in the browser; the public key is in `users`, the secret key stays in `localStorage`.
- Each message gets a random secretbox key that encrypts the text and any file; that key is boxed to every participant (`messages.keys`). The server stores only ciphertext. Files are encrypted before upload to the private `attachments` bucket.

## Known limits
- Secret key is per-browser: clearing site data or using a new device means old messages are unreadable (no backup).
- Participants are fixed at creation; calls are 1-on-1, STUN only (add TURN for strict NATs), and the callee must be online with the app open.
- Metadata (who talks to whom, when, file sizes) is visible to the server; no key verification, so a malicious server could swap public keys.
- Call signaling channels are public Realtime broadcast (SDP only; media is DTLS-SRTP); use private channels with RLS to harden.
