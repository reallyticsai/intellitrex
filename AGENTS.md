<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project map

Intellitrex is a crypto analytics app: live prices, ML forecasts, market signals, an AI advisor, and Binance portfolio analysis.

- `src/app/page.tsx` — landing page with the live Market Signals section
- `src/app/currency/` — price chart, indicators, forecasts, Fear & Greed
- `src/app/consultancy/` — AI chat (3 modes)
- `src/app/profile/`, `src/app/admin/` — account, portfolio, admin views
- `src/app/api/` — route handlers:
  - `prices` — CoinGecko OHLC candles
  - `signals` — per-coin trend + RSI signals and Fear & Greed, cached 15 min
  - `forecasts` — ML forecast CSVs from the `reallyticsai/Intellitrax_Workflow` GitHub repo
  - `fear-greed` — alternative.me index
  - `chat` — OpenAI chat completions
  - `portfolio` — Binance balances mapped to forecasts
- `src/lib/signals.ts` — indicator math and signal functions
- `src/lib/auth-context.tsx` — users, tiers, chat history (stored in `localStorage`, no backend)
- `src/lib/constants.ts` — supported coins, models, chat modes

Env vars: `OPENAI_API_KEY` (chat), `GH_TOKEN` (optional, forecasts rate limit).

## Commands

- `npm run dev` — start the dev server on http://localhost:3000
- `npm run lint` — ESLint
- `npm run build` — production build and type check

# Signal conventions

- Signals live in `src/lib/signals.ts` as pure functions with no fetching or React.
- Every signal returns `{ direction, label, reason }` where `direction` is `bullish`, `neutral`, or `bearish` and `reason` is one plain-language sentence a beginner can understand.
- Thresholds are named constants or documented in a comment next to the function.
- Compute over timestamps, not candle counts: CoinGecko changes candle size with the requested range (30 min up to 2 days, 4 h up to 30 days, 4 days beyond).
- Fetch data in route handlers, compute signals on the server, and cache with `fetch(..., { next: { revalidate } })`.
- Any UI that shows a signal must also show "Not financial advice."
- Write a short spec in `docs/specs/` before adding a new signal.

# Workflow rules

- Never commit to `main`; work on a feature branch named `feat/...` or `fix/...`.
- Keep commits small and focused, with imperative messages (`feat: ...`, `fix: ...`, `docs: ...`).
- Run `npm run lint` and `npm run build` before opening a PR, and fix new errors.
- Open PRs as drafts with a summary and a test plan.
