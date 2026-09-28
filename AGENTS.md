<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Commands

- Dev: `npm run dev`; build: `npm run build`; tests: `npm test`.
- Lint changed JS/TS files with `npx eslint <changed-files>`.
- The repository currently has five pre-existing lint errors; do not introduce more.

## Data rules

- Never use fake, mocked, or hardcoded market data in the product.
- CoinGecko OHLC supplies 4-hour candles for 3–30-day ranges; never calculate 24-hour change from those candles.
- Source 24-hour changes from an API field that explicitly represents that metric.

## UI rules

- Keep the market-data disclaimer on every page that displays prices.

## Git rules

- Use one branch per task.
- Never push directly to `main`.
