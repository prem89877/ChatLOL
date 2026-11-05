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

## Notes and limits

- Replies stream in as they are generated. If a provider does not support streaming, the full reply appears at once.
- Server limits: 12,000 characters per message, the latest 40 messages (max 60,000 characters) are sent as context, 20 requests per minute per IP.
- The rate limit is in memory and best-effort (it resets when the server restarts and is per server instance on serverless hosting).
- Conversations are stored in your browser (localStorage) only. No database, authentication or payments.
