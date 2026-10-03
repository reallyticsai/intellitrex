<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Commands
- Dev server: `npm run dev`; production build: `npm run build`.
- Run tests with the configured test script (none is currently defined in `package.json`).
- Lint only changed files: `npx eslint <changed-file> [<changed-file> ...]`.

## Data rules
- CoinGecko OHLC uses 4-hour candles for 3–30 day windows; never derive 24-hour changes from those candles. Use a true 24-hour price-change field.
- Never show fake, sample, or hardcoded market data as real. On data failure, show an unavailable state.
- Keep the not-financial-advice disclaimer on every page that displays prices.

## UI rules
- Preserve responsive layouts and support both light and dark themes.
- Format prices and changes clearly; distinguish positive and negative movements.

## Git rules
- Use one branch per task; do not combine unrelated task changes.
- Never push to `main`.
