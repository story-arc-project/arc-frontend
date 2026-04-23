# Repository Guidelines

## Project Structure & Module Organization
`app/` contains the Next.js App Router routes, including grouped segments such as `app/(auth)` and `app/(main)`. Route-local UI lives beside pages in `_components/`. Shared UI primitives are in `components/ui/`, feature-specific composites in `components/features/`, app-wide state in `contexts/`, reusable hooks in `hooks/`, and API/helpers in `lib/` (`lib/api`, `lib/auth`, `lib/utils`, `lib/constants`). Product and workflow notes live in `docs/`. Ignore build output in `.next/`.

## Build, Test, and Development Commands
Use Node 20 with npm.

- `npm install` installs dependencies.
- `npm run dev` starts the local Next.js dev server on `http://localhost:3000`.
- `npm run lint` runs ESLint with the Next.js core-web-vitals and TypeScript rules.
- `npm run typecheck` runs `tsc --noEmit`.
- `npm run build` creates a production build and matches the final CI gate.

CI on pull requests to `main` runs `lint`, `typecheck`, and `build`; run all three before opening a PR.

## Coding Style & Naming Conventions
This codebase uses TypeScript, React 19, Next.js 16 App Router, and Tailwind CSS v4. Follow the existing style in the file you're editing: use 2-space indentation, and keep quote and semicolon usage consistent with the surrounding code while minimizing unrelated formatting changes. Use `PascalCase` for React components (`ResumePreview.tsx`), `camelCase` for hooks and helpers (`useFileUpload.ts`), and kebab-case for shared utility/UI filenames (`date-picker.tsx`, `analysis-api.ts`). Keep route files aligned with Next conventions: `page.tsx`, `layout.tsx`, `loading.tsx`.

## Testing Guidelines
There is no dedicated test runner committed yet. Treat `npm run lint`, `npm run typecheck`, and `npm run build` as the required validation baseline. For UI changes, add manual QA notes in the PR and include screenshots for visible changes. If you introduce automated tests later, colocate them as `*.test.ts` or `*.test.tsx` next to the feature they cover.

## Commit & Pull Request Guidelines
Recent history favors short, imperative commit subjects, sometimes with gitmoji prefixes such as `:bug:` or `:sparkles:`. Keep commits focused and descriptive, for example `:bug: Fix archive empty-state handling`. PRs should follow `.github/pull_request_template.md`: summarize the work, attach screenshots, note review requests, and complete the checklist. Work from a feature branch, not `main`.

## Configuration & API Notes
Local runtime config lives in `.env.local`. `next.config.ts` rewrites `/api/:path*` to `NEXT_PUBLIC_API_URL`, defaulting to `http://localhost:8000`, so keep frontend and backend URLs aligned during local development.
