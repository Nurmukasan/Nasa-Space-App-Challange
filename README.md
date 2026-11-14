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
- `docs/` – product logic, architecture, work plan.

## Deploy

Any Node host. Build command `npm ci && npm run build`, start command `npm start`, port from `PORT`.

## Use of AI

AI assistants were used to help write and review code and to create some of the art in this
repository; screens that show AI-made art carry a visible "AI-GENERATED ART" label.
OpenAI Codex assisted with the C0 client foundation recovery and its validation.
Additional contributions and asset tools must be disclosed by their authors before submission.

## Data and references

See `docs/REFERENCES.md` (NASA data, audio, fonts, tools and their licenses).
