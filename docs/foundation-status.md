# Foundation integration status

Recorded 2026-11-14. **A/B/C code is integrated; full foundation acceptance is not yet complete.**
Local browser automation, production-server traffic and hosted human/device acceptance are different checks.
The original `c/foundation` and owner branches were preserved; incompatible code was recovered task by task.

## Integrated work

| Work | PR | Result |
| --- | --- | --- |
| B1 remote interpolation | #1 | Merged upstream |
| B scene destruction / stale FxBus handlers | #3 | Merged; regression test and repeat-flight browser check |
| C0 dictionary/playground/preferences/fixtures | #2 | Merged after the lifecycle blocker was fixed |
| A1 full-hands excavation correction | #4 | Merged from the existing owner work with regression tests |
| C1 tactical map / lost-link telemetry | #5 | Merged; local S1 smoke |
| C2 signals, crew/power panels and commands | #6 | Merged; nonzero-station pressure regression covered |
| C3 six-resource shared designer | #7 | Merged; correct combined discipline badges |
| B6 bounded field effects / frame measurements | #9 | Merged; performance limits below |
| Causal report and mission twin | #10 | Merged; rendered findings and redesign checked |
| Production deployment blueprint | #12 | Merged; public service not created |
| C4 reconnect, rolling limit, mission bots | #8 | Merged after a successful natural-time soak |
| C5 session/health/settings/diagnostic core | #11 | Merged after C4 |
| C5 activation in hot App.tsx | #13 | Merged as a separate minimal PR |

All recovery PRs were squash merged only after their CI `check` passed. No direct main pushes or protection bypasses were used.
A1–A6 and B0–B5 were already present before recovery; their existence alone was not treated as acceptance.

## Reproducible checks

Run `npm ci`, then `npm run check`. For browser scripts, start `npm run dev` and use a Python environment
with Playwright plus Chromium (`/usr/bin/chromium` by default); these tools do not add npm dependencies.
Do not run dictionary-discovery probes concurrently with format checks: the probes create and remove temporary files.

| Command | Scope |
| --- | --- |
| `python tools/c0-smoke.py` | Auto-discovery, B compatibility, real fixtures, storage failures, lobby, exactly-once effects over two solo flights |
| `python tools/s1-smoke.py` | Two browser clients + two CLI bots; shared design, mass blocking, movement, waypoints, oxygen, keyboard digging/deposit/refill, report/redesign |
| `python tools/s2-smoke.py` | Three browsers; resources, all three events, real rockfall breach, RATION/refill/repair, commands, power, night/storm/report |
| `python tools/c5-smoke.py` | Real EVA F5 resume, health failure, offline solo, persistent settings, measured live diagnostics and F3 |
| `python tools/report-smoke.py` | At least three rendered causal findings, mission twin, translated text and redesign |
| `python tools/field-benchmark.py --cpu 4` | One-minute software-renderer CPU-throttled benchmark; includes walking/digging/reduced motion |
| `python tools/static-solo-smoke.py` | Built static client on :5174; no game server/socket requests, lighting captures, fallback tones/mute, report and repeat flight |
| `python tools/mission-soak.py --url http://localhost:3101` | Natural-time production-server soak; use a separate `PORT=3101 NODE_ENV=production npm start` process so dev reloads cannot reset it |

S2 uses documented debug event/time commands for night and end transitions; it is not a ten-minute playtest.
The natural soak separately ran **605.0 seconds**, returning **15 samples, 7 deep, all three EVA crew aboard,
zero losses/downs, success A / 787 points**, without JavaScript errors. See [raw result](validation/natural-soak.json).
A first soak reached A but its result collector incorrectly read cleared EVA snapshots; the collector was fixed
and the complete run repeated rather than reported as passing from incomplete evidence.

Final C0/S1/S2/full-C5 and built-static browser scenarios passed after integration. The idle diagnostic
object/particle counts are also cleared after leaving a session. S1 selects an unoccupied sample site
so the new digging bots cannot legitimately collect the shared sample before the keyboard test player.

Production startup was checked separately: `/healthz`, built assets, two Socket.IO clients, roles, launch,
snapshots and waypoint placement. Debug commands were verified disabled in production.

## Performance evidence and limits

The CPU x4 software-GL minute measured **39.1 FPS**, renderer JavaScript mean **2.524ms**, p95 **6.3ms**,
frame p95 **50ms**, terrain bake **256.4ms** before throttling, peak **24 particles / 28 objects**;
no JavaScript errors. See [raw result](validation/field-cpu4.json).
The script measurement covers the renderer callback, not GPU time or all browser tasks.
A final CPU x1 software-GL minute measured **50.3 FPS**, renderer JS mean **0.772ms** / p95 **0.7ms**,
frame p95 **33.4ms**, terrain bake **410.2ms**, peak **24 particles / 28 objects** with no JS errors.
See [raw result](validation/field-cpu1.json). This runtime misses the 60 FPS and 400ms targets;
these results are not rounded into passes.
The 60 FPS weak-laptop target is **not accepted** from these results. A real target laptop/GPU and Firefox
must still be tested. No benchmark threshold was disabled or misreported as a pass.

## Remaining acceptance gates

- Public online deployment and a complete mission from two different networks/devices. `render.yaml` is ready,
  but no hosting account binding or public service exists. Connect the repository in Render, review the Blueprint,
  deploy, verify `/healthz`, then run the real browser/bot scenario on that URL. Never put credentials in chat or git.
- A human ten-minute playtest with the required team composition, recording unclear/boring moments.
  Browser automation and bots cannot supply that feedback.
- Real weak-laptop/GPU performance and Firefox validation; tune against those measurements if necessary.
- Repository settings from step 0: only squash merging, automatic branch deletion, main requiring `check`
  without mandatory review. The GitHub integration returned HTTP 403 for repository administration;
  main was observed unprotected. Set these in GitHub Settings; successful PR operations do not imply admin API access.
- Final science/asset credits by their authors. The report has mission comparisons; no unverified numerical NASA
  fact cards or NASA audio recordings are claimed.

Local S1/S2 functional integration is evidenced above. Hosted/human S1/S2/S3 acceptance is not fabricated.
**`demo-stable-3` was not tagged**, since its public/device requirements are still open.
GitHub Pages publication was explicitly requested for the static solo build. The owner enabled Pages
manually after the integration's site-enablement API returned 403. `.github/workflows/pages.yml`
checks/builds the exact commit, deploys `client/dist`, and verifies the public HTML/JavaScript.
Pages cannot host Socket.IO online rooms; the Render Blueprint remains the online-hosting path.

No cloud-environment configuration was re-applied and no environment publication was performed.
