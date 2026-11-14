# Rules for AI coding assistants (and humans)

Read `docs/architecture.md`, `docs/product-logic.md` and `docs/phases.md` before writing code.
If a task comes from `docs/phases.md`, follow its acceptance criteria literally.
(`docs/start-phase.md` is the finished foundation phase, kept as an archive.)

## Commands

- `npm ci` – install exactly what the lockfile says (never `npm install` in normal work)
- `npm run dev` – server on :3001 and client on :5173 (open http://localhost:5173)
- `npm run check` – format check, type check, tests, production build. Must pass before every commit.
- `npm test` – tests only · `npm run format` – fix formatting
- `npm run bots -- --code ABCD --n 2` – headless test players

## Hard rules

1. **Dependencies are frozen.** Do not add, remove or upgrade packages. Phaser is pinned to **3.90.0**:
   do not use Phaser 4 APIs (Filters, RenderNodes) and do not "upgrade to latest".
2. **Hot files** change only in a small dedicated PR announced in the team chat:
   `shared/src/types.ts`, `shared/src/protocol.ts`, `shared/src/sim/step.ts`,
   `shared/src/index.ts`, `client/src/App.tsx`, every `package.json`, `package-lock.json`.
3. **Stay in your folders.** Edit only files owned by the task's developer (ownership table:
   `docs/phases.md`, section 3.2). Do not reformat, rename or "clean up" other people's files.
4. **`shared/` is pure TypeScript.** No DOM, no Node APIs, no timers. Inside `shared/src/sim` never use
   `Math.random()` or `Date.now()`: use `createRng(seed)` and the mission clock `sim.pub.t`.
5. **No magic numbers.** Every tunable value lives in `shared/src/balance.ts`, `shared/src/catalog.ts`
   or the scenario data in `shared/src/scenarios/`. In `balance.ts` edit only the blocks marked with your owner tag.
6. **No hard-coded player-facing text.** Use `client/src/i18n/`. UI text, code and comments are in English.
7. **The engine never throws on client input.** Validate every field of every `ClientMsg`.
8. **Never put per-frame data into React state.** Phaser and canvas code read `snaps` directly;
   React reads the throttled `store.hud`.
9. **Every change in `shared/` comes with tests** in `shared/test/`. Do not delete or weaken existing tests.
10. **`main` is always playable.** Unfinished features stay behind a flag or unreachable.
11. Keep files under ~300 lines; one system or one component per file. No `<StrictMode>`.
12. **Free mission keeps v1 behaviour.** New v2 rules switch on only in the `training` and `signal` scenarios.
13. **Assets follow `docs/assets.md`.** Names and frame sizes come from `client/src/game/assetManifest.ts` and
    `client/src/audio/soundManifest.ts`; `npm test` (`tools/assets.test.ts`) rejects anything else.

## Commit format

`type(scope): summary` – types: feat, fix, test, chore, docs, art, audio; scopes: sim, server, field,
console, design, report, audio, art, infra. Example: `feat(sim): dig depth and sample thresholds`.

## AI disclosure

This project is built with AI assistance (code and art). Keep the "Use of AI" section of `README.md`
up to date: which tools were used and for what. AI-generated images must carry a visible
"AI-generated" mark: keep `SHOW_AI_ART_NOTICE` in `client/src/ui/aiNotice.ts` set to `true` while any
AI-made art is in the game, and mark slides and videos too. Never generate NASA logos, flags or
mission patches.
