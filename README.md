# Deluxe Messenger

Next.js + Supabase messenger: realtime 1-on-1/group chat, file & image sharing, WebRTC voice/video (1-on-1), end-to-end encryption with TweetNaCl.

## Setup
1. Create a Supabase project; run `supabase/migrations/0001_init.sql` in the SQL editor (or `supabase db push`).
2. Auth → Providers → Email. For quick testing, turn off "Confirm email".
3. `cp .env.example .env.local` and fill in the project URL + publishable key.
4. `npm install && npm run dev` · `npm test` runs the crypto self-check.

## Deploy
Import the repo in Vercel, set the two `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` env vars. HTTPS (Vercel default) is required for camera/mic.

## How E2EE works
- Each user gets a NaCl box keypair in the browser; the public key is in `users`, the secret key stays in `localStorage`.
- Each message gets a random secretbox key that encrypts the text and any file; that key is boxed to every participant (`messages.keys`). The server stores only ciphertext. Files are encrypted before upload to the private `attachments` bucket.

## Known limits
- Secret key is per-browser: clearing site data or using a new device means old messages are unreadable (no backup).
- Participants are fixed at creation; calls are 1-on-1, STUN only (add TURN for strict NATs), and the callee must be online with the app open.
- Metadata (who talks to whom, when, file sizes) is visible to the server; no key verification, so a malicious server could swap public keys.
- Call signaling channels are public Realtime broadcast (SDP only; media is DTLS-SRTP); use private channels with RLS to harden.
