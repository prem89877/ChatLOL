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

Add the same three variables in Project Settings > Environment Variables, then redeploy.

## Scripts

- `npm run dev` – dev server
- `npm run build` – production build
- `npm run start` – run production build
- `npm run typecheck` – TypeScript check

## Conversation history

**What works now (no Supabase needed):** conversations are saved in your browser's localStorage, on this device only.

- A conversation is created when you send your first message; its title is that message.
- The assistant's reply is saved when it finishes (or the text received so far if you press Stop).
- Reload the page and your chats are still in the sidebar, newest first. Click one to open it.
- Delete asks for confirmation. "Clear all conversations" is in Settings.
- If storage is full, blocked or damaged, a message appears and the chat keeps working. Damaged data is backed up in the browser, not overwritten.
- Limits: history is not shared between browsers or devices, clearing browser data deletes it, and two tabs open at once can overwrite each other.

**Why not Supabase yet:** there is no login, so the app cannot tell visitors apart. Saving chats in Supabase without a user identity would mean public tables, or a server key that can read everyone's chats. Neither is safe, so Row Level Security is not weakened.

**What Supabase persistence needs later**

1. Add authentication (for example Supabase Auth) so every chat belongs to a signed-in user.
2. Create a NEW Supabase project for chatLOL. Never use the Blisscco project.
3. Apply `supabase/migrations/20261105000000_chat_history.sql` (SQL Editor, or `supabase db push` with the Supabase CLI). It creates `conversations` and `messages` with Row Level Security and policies for signed-in owners only, none for anonymous users. It has not been applied or tested yet.
4. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example`) and install `@supabase/supabase-js`.
5. Replace the localStorage functions in `src/lib/historyStore.ts` with Supabase calls made as the signed-in user. In the database, `messages.content` matches `text` in the app, and ids are UUIDs.
6. Never use the `service_role` key in browser code.

## Notes and limits

- Replies stream in as they are generated. If a provider does not support streaming, the full reply appears at once.
- Server limits: 12,000 characters per message, the latest 40 messages (max 60,000 characters) are sent as context, 20 requests per minute per IP.
- The rate limit is in memory and best-effort (it resets when the server restarts and is per server instance on serverless hosting).
- No authentication or payments.
