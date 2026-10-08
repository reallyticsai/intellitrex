<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Lessons for writing useful prompts

- State a concrete **goal**: name the screen or behavior to improve and describe the intended result. Replace weak prompts such as "make it better" with observable changes.
- Provide **context**: the current branch, relevant screen and files, existing behavior, screenshots or examples, and decisions already made. This helps Codex understand the task and avoid going out of scope.
- State **constraints and rules** explicitly: approved files, package restrictions, mobile requirements, and whether a plan must be approved before editing. Respect those boundaries; surface any necessary scope change before making it.
- Define **done when** criteria that can be checked, such as a passing lint command, expected signal behavior, a reviewed diff, and a visible change after refreshing localhost.
- **Review the diff** before committing or publishing. Check that each change serves the goal, only approved files changed, and unrelated behavior was not altered.
- **Verify completion against the prompt**, not just against compilation. Run appropriate tests for calculations, boundaries, and failures; for UI changes also check localhost, keyboard access, mobile layouts, and before-and-after screenshots. For documentation changes, inspect the requested content and structure.
- Report what changed, what passed, and any remaining limitation. Do not claim a task is finished while an acceptance criterion is still unmet.

## Signal specification: Bitcoin price versus SMA20

Implement a Bitcoin "Price versus SMA20" signal in the homepage hero using the existing `/api/prices?pair=XXBTZUSD&interval=1440&limit=30` endpoint and the latest 20 chronological candle closes. Compute their mean and the latest close's percentage deviation from that mean; classify values above +1% as "Above average," below -1% as "Below average," and values within those boundaries, inclusive, as "Near average." Display the real price chart, SMA20 reference, classification, signed deviation, price values, and latest candle timestamp, explaining that periods refer to returned candles rather than guaranteed days. Support initial loading and manual refresh with cancellation of obsolete requests, and show an unavailable state with retry when fetching fails or required data is insufficient or invalid. Preserve mobile usability, both themes, and keyboard accessibility, and describe the result as a market indicator rather than a buy/sell recommendation. Verify calculations, threshold boundaries, flat prices, invalid or insufficient data, fetch failures, refresh behavior, and responsive rendering.
