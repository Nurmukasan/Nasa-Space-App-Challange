# RED SIGNAL

A cooperative Mars mission design game for 1–4 players, built for the NASA Space Apps Challenge 2026
(challenge: Space Mission Design Game).

Design a sample-return mission under budget, mass and power limits, then fly it yourself: field
astronauts collect samples outside while Mission Control guides them, manages oxygen and power, and
reads the seismograms. The after-action report explains which design decision caused what.

## Quick start

Requirements: Node.js 22 or newer.

```bash
npm ci
npm run dev        # server http://localhost:3001, game http://localhost:5173
```

Open two browser tabs on http://localhost:5173, create a room in one, join with the code in the other.
"Play solo (offline)" runs the whole game inside the browser with no server.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Server and client with hot reload |
| `npm run check` | Format check, type check, tests, production build (CI runs this) |
| `npm test` | Unit and integration tests |
| `npm run build` then `npm start` | Production: one Node process serves the game and the sockets |
| `npm run bots -- --code ABCD --n 2` | Headless test players |

Add `?debug=1` to the URL to get `window.rs` (send, store, snaps) in the browser console.

## Structure

- `shared/` – game rules: types, protocol, balance, catalog, simulation, room engine. Pure TypeScript.
- `server/` – thin Socket.IO wrapper around the engine.
- `client/` – React UI, Phaser field view, canvas Mission Control console.
- `docs/` – product logic, architecture, work plan (`phases.md`), asset guide (`assets.md`).

## Deploy

Use the included `render.yaml` Blueprint on Render: connect this GitHub repository, review the
service, and deploy it. A Render account and repository connection are required; no credentials
belong in the repository or chat. The build installs development tools intentionally because Vite
and tsx are needed. `npm start` serves both the client and Socket.IO on the provider's `PORT`.
Production disables debug commands. Health check: `/healthz`.

For another Node host, use `npm ci --include=dev && npm run build`, then `NODE_ENV=production npm start`
with Node 22 and WebSocket support. Free services may sleep: warm the service before a demo.

GitHub Pages publishes the static solo build through `.github/workflows/pages.yml` after each main
push, or via its manual workflow dispatch. Pages serves solo play; online rooms need the Node host.
The workflow checks the build and verifies the deployed HTML and JavaScript.

For another offline-only fallback, build and upload `client/dist` to a static host. Relative asset paths
support subdirectories. Online rooms need the Node service; the static build supports solo only.

Deployment configuration is prepared; no public service URL is claimed until a live deployment
has been checked from two different networks.

## Use of AI

AI assistants were used to help write and review code and to create some of the art in this
repository; screens that show AI-made art carry a visible "AI-GENERATED ART" label.
OpenAI Codex assisted with client foundation recovery, mission control, mission design, networking,
scene lifecycle fixes, field effects, causal report UI, integration checks and deployment setup.
OpenAI Codex also drafted the personal-task and crew-size scaling proposal
(`docs/personal-tasks-proposal.md`); this proposal does not implement gameplay changes.
Claude Code assisted with the remote-interpolation correction in PR #1.
Claude Code drew the 18 pixel-art constructor icons (modules, launch vehicles, relays) in code,
and they are used in the mission design screen.
Claude Code also drew the pixel-art Mars backdrop of the menu screens and restyled the menu UI.
Claude Code also assisted with the v2 game design and work plan
(`docs/phases.md`, `docs/product-logic.md`, `docs/architecture.md`, `docs/assets.md`) and the asset validator.
Claude Code also assisted with v2 engine and Mission Control work: epicentre location, event director,
RED SIGNAL, lander faults, solar flare, crew awards and report findings, the mission forecast and the
"what's ahead" console feed.
Claude Code drew the four crew class sprites (engineer, scout, geologist, biologist) in code
(`client/src/game/crewArt.ts`), modelled on AI-generated reference sheets from the team, and added the
class picker and class perks.
The lander interior is built from the team's AI-generated tileset and base reference
(`assets/raw/`): Claude Code wrote the slicing and map tools (`tools/art/`), cut the sheet into a
sprite atlas and 64-px tiles, laid out the Tiled map `client/src/game/interior/data/base.tmj` after the
reference, and added collisions, sliding doors, room actions and the ARIA assistant's talking face and
alarm screen on top of it (`client/src/game/interior/`).
The built-in fallback sprites and sounds are procedural; NASA audio is not bundled.
Additional asset contributions must be credited by their authors before submission.

## Data and references

See `docs/REFERENCES.md` (NASA data, audio, fonts, tools and their licenses).
