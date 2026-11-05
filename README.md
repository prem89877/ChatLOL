# chatLOL

Simple AI chat website. Next.js (App Router) + TypeScript + Tailwind CSS.
The browser talks only to `/api/chat`; the server calls the AI provider, so your API key never reaches the client.

## 1. Choose an AI provider

Any provider with an OpenAI-compatible `/chat/completions` API works. You need three values:

| Variable | What it is |
| --- | --- |
| `AI_API_KEY` | Secret API key from the provider |
| `AI_BASE_URL` | Provider API base URL, e.g. `https://api.openai.com/v1` |
| `AI_MODEL` | Model name from the provider's model list |

Where to get a key (create an account, open the API keys page, create a key):

- OpenAI: https://platform.openai.com/api-keys (base URL `https://api.openai.com/v1`)
- Groq: https://console.groq.com/keys (base URL `https://api.groq.com/openai/v1`)
- OpenRouter: https://openrouter.ai/keys (base URL `https://openrouter.ai/api/v1`)

Check the provider's docs for current model names and any free-tier limits.

## 2. Configure locally

1. Copy `.env.example` to `.env.local` (same folder as `package.json`).
2. Replace the placeholder values with your real key, base URL and model.
3. `.env.local` is git-ignored. Never commit it.

## 3. Run

```bash
npm install
npm run dev
```

Environment variables are read when the server starts. After you create or change `.env.local`, stop the server (Ctrl+C) and run `npm run dev` again.

Open http://localhost:3000 and send a message.

## Deploy on Vercel

Add all five variables (`AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) in Project Settings > Environment Variables (Production, and Preview if you use previews), then **redeploy**. `NEXT_PUBLIC_*` values are baked in at build time, so an old deployment will not see new values. Without the two Supabase variables the app refuses to serve pages (503) instead of running unprotected.

## Scripts

- `npm run dev` – dev server
- `npm run build` – production build
- `npm run start` – run production build
- `npm run typecheck` – TypeScript check
- `npm run lint` – ESLint
- `npm test` – unit tests (Vitest)

## Accounts and conversation history

Login, signup, password reset and logout use **Supabase Auth** (no custom auth, passwords are never handled by this app). Conversations and messages are stored in Supabase and protected by **Row Level Security**: every request runs as the signed-in user, so Postgres itself only returns/changes that user's rows. Changing an id in a request cannot reach another user's data. The AI route (`/api/chat`) and every page are also checked on the server (`src/middleware.ts` + the route), not only in the UI.

### Setup (once)

1. **Project.** Use the Supabase project made for chatLOL (never the Blisscco one). Open it in the Supabase dashboard.
2. **Keys.** Project Settings > API: copy the *Project URL* and the *anon* (or *publishable*) key into `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (local: `.env.local`; Vercel: Environment Variables). Do not copy the `service_role`/secret key anywhere.
3. **Database.** SQL Editor > New query > paste the whole file `supabase/migrations/20261105000000_chat_history.sql` > Run. (Or with the CLI: `supabase link` then `supabase db push`.) It creates `conversations` and `messages` with RLS on, and can be re-run safely. Check: Table Editor shows both tables with "RLS enabled".
4. **Auth URLs.** Authentication > URL Configuration:
   - Site URL: `https://chatlol-tau.vercel.app`
   - Redirect URLs (add all): `http://localhost:3000/auth/callback`, `https://chatlol-tau.vercel.app/auth/callback` (optional for Vercel previews: `https://*-<your-team>.vercel.app/auth/callback`).
5. **Email sign-in.** Authentication > Sign In / Providers > Email: enabled. Keep **Confirm email** ON for real testing (the app handles both ON and OFF). Set the minimum password length to 8 to match the app. (Menu names can differ slightly between dashboard versions.)
6. **Email sending.** Supabase's built-in email sender is heavily rate-limited and may only deliver to your own team members' addresses. To test with any email address, add your own SMTP provider in Authentication > SMTP Settings (Resend, Brevo, SendGrid, ...).
7. **Optional, works across browsers.** The default email links need to be opened in the *same browser* that requested them. To make links work from any device, edit the templates in Authentication > Email Templates (note: `{{ .SiteURL }}` uses the Site URL above):
   - Confirm signup link: `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup&next=/`
   - Reset password link: `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`
8. **Vercel.** Add the two Supabase variables, then Deployments > latest > Redeploy (or push to git).

### Manual test checklist

Use two different real email inboxes (User A, User B). Run `npm run dev` (http://localhost:3000) or test on the deployed site.

1. Open `/` while logged out: you land on `/login`.
2. Sign up as A on `/signup`: with Confirm email ON you see "Check your email"; open the link and you are logged in on `/`.
3. Sign up again with A's email: "An account with this email already exists."
4. Log out (sidebar bottom, or Settings). Log in with a wrong password: "Incorrect email or password." Log in correctly: back in the chat. While logged in, opening `/login` sends you to `/`.
5. Send a message: the AI replies, the chat appears in the sidebar. Reload the page: you are still logged in and the chat is still there. Click it to reopen.
6. Delete a chat, reload: it stays deleted.
7. `/forgot-password`: enter A's email, open the email link, choose a new password at `/reset-password`, then log in with it. Opening an old/used reset link shows "invalid or expired".
8. Log out, sign up/log in as B: B's sidebar is empty and shows none of A's chats.
9. Isolation check (Supabase Dashboard > Table Editor): both users' rows exist with different `user_id` values. Optional hard test: in the browser console as B, query A's conversation id with the Supabase client; it returns no rows.
10. Session expiry: in Authentication > Sessions/JWT settings use a short JWT expiry on a test project, or delete the session in the dashboard (Authentication > Users > user > sign out), then send a message: you are sent to `/login` with "Your session expired."
11. Disconnect your network and send a message: you get an error message, the Stop/Retry controls work, and nothing stays stuck on "loading".

### Conversations saved before accounts

Earlier versions kept chats in this browser's localStorage. Those chats cannot be assigned to an owner automatically (there was no login then, and a shared device could hold chats of someone else). So they are never moved silently: after login the app shows "Found N older chats saved in this browser. Import them to your account?". **Import** copies them into the logged-in account; **Not now** hides the prompt. The browser copy is never deleted or changed, and signed-in chats are no longer written to localStorage. Only import on a device you trust: whoever clicks Import on that browser gets those chats.

### Tests

- `npm test`: unit tests for route protection rules, redirect safety, form validation, error messages, history mapping and the `/api/chat` login check.
- RLS policies: `supabase/tests/rls_isolation.sql` proves user B cannot read, change, delete or add to user A's data and that anonymous users get nothing. It runs on a throwaway local PostgreSQL after `supabase/tests/00_local_stub.sql` (a stand-in for Supabase's `auth` schema) and the migration. It never touches a real project.

## Sponsored ads from Blisscco (controlled pilot)

Off by default. When `BLISSCCO_ADS_ENABLED=true`, each question you send also triggers one separate, non-blocking ad lookup. The ad appears in a labelled "Sponsored" box **after** the AI answer. If anything about the ad fails (timeout, 401, 503, no ad, bad data) nothing is shown and the chat is unaffected.

**Flow:** question -> `POST /api/ads` (ChatLOL server, login required) -> topic slugs derived from the question (`src/lib/ads/topic.ts`) -> `POST {BLISSCCO_API_BASE_URL}/api/v1/ads/match` -> sanitized ad -> shown under the answer -> `POST /api/ads/impression` (ChatLOL server) -> `POST /api/v1/ads/impression` at Blisscco.

**Sent to Blisscco:** topic slugs (max 3), ids of ads already shown, a random idempotency key, and the publisher key in the `Authorization` header. **Never sent:** question text, conversation, user id, email, session. Sensitive subjects (health, politics, religion, etc.) send no request at all.

**Impression meaning:** an impression is reported when the sponsored box is rendered. It is not a viewability measurement. Blisscco counts only the first report per ad serve; repeats answer `duplicate`.

### Automated tests (mocked, no network, no real key)

```
npm run typecheck
npm test
npm run lint
```
New files: `tests/ads-topic.test.ts`, `ads-blisscco.test.ts`, `ads-handlers.test.ts`, `ads-client.test.ts` (shared fake in `ads-test-helpers.ts`). Scenario map: 1 relevant ad, 2 gaming question asks for gaming (not food), 3 no-fill, 4 Blisscco down/timeout, 5 invalid key, 6 duplicate impression, 7 several questions with `exclude_ad_ids`. These use a fake Blisscco. Which ad Blisscco itself selects is tested in the Blisscco repo (`tests/ads/*`), not here.

### Manual real-world test (all steps PENDING until you do them)

Use only a TEST advertiser, TEST campaign and your own test ChatLOL account. Blisscco counts spend when an ad is handed out, so every fill spends from the test campaign budget.

**Blisscco setup (needs the Blisscco owner; do not touch Production data):**
1. Test advertiser account with one campaign: category `gaming`, status Active, started, one APPROVED creative with an https destination you control, very small budget and daily cap, no real payment method.
2. A second test campaign in category `food`, same way (for test M3).
3. Test publisher account approved by hand, property approved, one API key created on the Publisher page (shown once). Server side Blisscco needs `AD_TRACKING_SECRET` set, otherwise no tracking token is issued.
4. Blisscco gives you the base URL. There is no published staging host.

**ChatLOL setup (Vercel Preview or local, never Production for the first run):**
`BLISSCCO_ADS_ENABLED=true`, `BLISSCCO_API_BASE_URL`, `BLISSCCO_PUBLISHER_API_KEY`. Redeploy after changing env vars on Vercel. Log in with the test account.

| # | Steps | Expected |
|---|-------|----------|
| M1 | Ask: "Suggest some good gaming laptops." | AI answer first, then a "Sponsored" box with the gaming test ad. No ad text inside the answer. |
| M2 | Open browser dev tools > Network, repeat M1 | `/api/ads` and `/api/ads/impression` responses contain no key. Request body of `/api/ads` has only your question and ids. |
| M3 | Ask: "Give me an easy dinner recipe." | Food test ad, not the gaming one. |
| M4 | Ask: "Hello, how are you?" | No sponsored box, no error, normal answer. |
| M5 | Ask about a health topic | No sponsored box. |
| M6 | Ask 3 gaming questions in one chat | Never the same ad twice in a row while another eligible ad exists; chat answers unaffected. |
| M7 | Reload the page and open the chat | Old answers load; sponsored boxes are not saved (by design). |
| M8 | Click the ad link | Opens your https test page in a new tab. (Click tracking is NOT implemented in ChatLOL.) |
| M9 | Set a wrong `BLISSCCO_PUBLISHER_API_KEY`, redeploy, ask a gaming question | No ad, no error, chat works. Restore the correct key afterwards. |
| M10 | Set `BLISSCCO_API_BASE_URL` to an unreachable host, ask | No ad appears within about 3 seconds extra, chat works. Restore afterwards. |
| M11 | Check the Blisscco test publisher/advertiser pages (and only those) | Serves and impressions for your test campaign increased by the number of ads you saw. Impressions must not exceed serves; repeating M1 on the same ad must not double count. |

**Cleanup:** pause or delete the test campaigns, revoke the test publisher key on the Publisher page, remove the three env vars (or set `BLISSCCO_ADS_ENABLED=false`) and redeploy, delete test conversations in ChatLOL.

**Known blockers / unverified:** no live run has been done; the UI components (`SponsoredAd`, `MessageList`) have no render test and were only syntax-checked outside a real Next build; click tracking and viewability are not implemented; topic matching is keyword based, so loosely related questions may get no ad; Blisscco publishes no staging host; the Blisscco `AD_TRACKING_SECRET`, base URL and approved test data must exist before M1 can pass.

## Notes and limits

- Replies stream in as they are generated. If a provider does not support streaming, the full reply appears at once.
- Server limits: 12,000 characters per message, the latest 40 messages (max 60,000 characters) are sent as context, 20 requests per minute per user.
- The sidebar loads the 100 most recently updated conversations.
- The rate limit is per signed-in user, in memory and best-effort (it resets when the server restarts and is per server instance on serverless hosting).
- Authentication is Supabase Auth (email + password). No payments.
