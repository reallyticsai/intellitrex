# Repository guidance

## Project facts

- This is a Next.js 16.2.2 application using the App Router, React 19, and TypeScript with strict checking.
- Route pages and layouts live under `src/app/`; API endpoints are Next.js Route Handlers under `src/app/api/`.
- The `@/*` TypeScript alias points to `src/*`.
- Styling uses Tailwind CSS 4 through `src/app/globals.css` and the `@tailwindcss/postcss` plugin. Reuse the existing utility-class approach and shared CSS; do not introduce CSS Modules as a new convention.
- Client-side state currently uses React context and browser storage in `src/lib/auth-context.tsx`. Do not assume Zustand, React Query, a database, or Prisma is configured.

## Next.js guidance

Next.js APIs and conventions can change between versions. Before changing Next.js-specific behavior, consult the matching local documentation under `node_modules/next/dist/docs/`. Start with the App Router guides for project structure, layouts and pages, Server and Client Components, Route Handlers, and CSS as relevant. Follow deprecation notices and the installed Next.js version rather than relying on examples for another version.

Keep components server-rendered by default where possible. Add `"use client"` only when a component needs client-side state, effects, event handlers, or browser APIs. Route handlers should use the existing App Router conventions and return appropriate `Response`/`NextResponse` values.

## Code conventions

- Follow the nearby code's formatting, naming, and export patterns. App Router page modules currently use default exports; shared helpers and hooks use named exports.
- Keep TypeScript types explicit where they clarify API boundaries and shared data. The project has strict TypeScript enabled.
- Use the existing `@/*` imports for modules under `src/` where consistent with nearby code.
- Do not add external npm dependencies without asking first.
- Never add credentials, API tokens, or other secrets to source control. Treat the existing client-side auth and browser-storage implementation as demo functionality, not production-grade authentication or secure storage.

## Commands and verification

The package scripts currently available are:

- `npm run dev` — start the development server.
- `npm run lint` — run ESLint.
- `npm run build` — create a production build.
- `npm start` — serve a production build.

There is no configured `test` script or test framework in this repository. Do not assume Jest, Playwright, Docker, or database migration commands are available. For a change, run the relevant checks supported by the environment and report any check that could not run.

The installed Next.js package requires Node.js 20.9.0 or newer; use a compatible Node.js version for installs and Next.js commands.
