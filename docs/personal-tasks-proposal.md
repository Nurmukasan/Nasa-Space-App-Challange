# Proposal: personal tasks and crew-size scaling

Status: design for review; no gameplay or contract changes in this PR. Do not merge
without the user's review. Based on main `18af70b` (including the big-world mission).

## Goal and scope

Every participant, including Mission Control (MC), starts with a named responsibility.
The amount of assigned work scales with the launch roster instead of giving everyone
the same checklist. This proposal covers `training` and `signal`; `free` keeps its
current rules. Extending personal tasks to free would require an explicit exception
in [product-logic.md](product-logic.md), section 0, and regression coverage.

This is a proposed addition to PL 4, 7.18, 7.22, 7.23 and 8, not a replacement for the
current specification. Two tasks per player is an initial design value for review,
not a balance result.

## What exists today

- `shared/src/sim/objectives.ts` builds a fixed scenario checklist. `Objective` has
  no owner; progress comes from team counters and shared state.
- `training` has four objectives; `signal` has up to eight, omitting zero-target
  entries. Neither list scales with player count. Signal's sample target is quota + 1.
- `GameRoom.launch()` passes only EVA/solo IDs and classes to `createSim`. MC is a
  player but has no astronaut entry; counting astronauts would undercount the crew.
- Crew classes already exist. Sample records contain `siteId`, `tier` and collector
  `by`; discovery and deployment know their actor. Global counters cannot establish
  who completed a personal task, and classification currently does not retain its actor.
- The helmet shows three team objectives. The console and report also use the
  shared objective list. Signal now lasts 720 seconds and uses the big world.

## Count and lifecycle

At each launch, capture all participating player slots with valid roles, including
MC and retained slots disconnected during design. Freeze their IDs, roles and classes
for that attempt. Reconnection does not add a participant. Existing room rules allow
new players only in the lobby; retain that restriction.

Create exactly two task records per participant: one active task and one queued task.
The queued task activates when the first completes. Both are visible from touchdown;
countdown input restrictions still apply. No endless task generation follows completion.

| Launch roster | Role composition | Personal task records | Initially active |
| --- | --- | --- | --- |
| 1 | 1 solo | 2 | 1 |
| 2 | 1 MC + 1 EVA | 4 | 2 |
| 3 | 1 MC + 2 EVA | 6 | 3 |
| 4 | 1 MC + 3 EVA | 8 | 4 |

Thus `personalTaskCount = tasksPerPlayer * launchRosterSize`, initially `tasksPerPlayer = 2`.
This counts all states, including completed and transferred tasks, not just active ones.
Transfers and fallback replacement preserve IDs and count. Fly again creates a fresh
set for the new attempt; it does not reuse progress from the previous mission.

Keep existing mission objectives separate and labelled **Mission goals**. Their
count and success rules remain scenario-defined; the combined count of mission goals
and personal tasks is not claimed to be proportional. Do not multiply the sample
quota, hazards or oxygen consumption by the task multiplier.

## Assignment and feasibility

Allocate in stable launch-slot order using scenario data and a dedicated seeded RNG
stream. Reserve limited opportunities globally: one sample tier at a site, one kit,
one unique discovery or one route target cannot be promised twice. A collector's
and a deliverer's tasks may form an explicit dependency; they cannot masquerade as
two independent copies of the same job.

Role is a hard capability constraint; class is a preference, not an exclusive permission.
The allocator checks equipment, available sample tiers, carried kits, disclosed targets,
travel and return cost, and remaining scenario time. Reserve enough safe near-field
sampling opportunities for up to three EVA chains before choosing optional excursions.

| Participant | Preferred chain | Feasibility requirement / fallback |
| --- | --- | --- |
| Solo | Collect an assigned surface sample, then deliver that sample | Nearby known site; no MC-only dependency or required TAB use |
| EVA generalist | Collect an assigned sample, then deliver it | Distinct unconsumed sample tier, capacity and return route |
| Scout | Discover an assigned anomaly, then deliver a sample from it | Signal only, reachable public anomaly; otherwise near-field sampling |
| Engineer | Deploy a carried kit, then deliver a nearby sample | Actual kit and valid firm ground; otherwise near-field sampling |
| Geologist | Collect a deep sample, then deliver it | Installed drill, reachable tier and safe round trip; otherwise surface sample |
| Biologist | Collect a preferred-kind sample, then deliver it | Available reachable matching site; otherwise another surface sample |
| MC | Guide a named EVA to a public target, then resolve a seismic observation | Valid waypoint reached by that EVA; correct classification in training, valid manual signal pick in signal |

MC's two records are ready from launch even when an observation is not yet present.
The second shows its dependency and a waiting reason; it does not demand a random
fault, a rescue, wasted oxygen or arbitrary power-slider changes. Training's scripted
events and signal's scheduled pulses provide the observation opportunities. The engine
must retain the resolving actor; solo auto-picks do not count as manual MC work.
If observation opportunities expire, MC's fallback is to guide a named returning EVA
from outside the arrival radius back to the lander, using a fresh waypoint and an actual
arrival. It cannot complete from setting a waypoint on someone already at the target.
If everyone has returned or no safe work remains, keep the task blocked until mission
end instead of fabricating progress or making someone leave shelter for a checklist.

These are two milestones of a useful assignment, not two unrelated journeys. Initial
allocation must be feasible for every supported roster and preset. If equipment or
finite opportunities eliminate a preferred chain, select the baseline chain before launch.
If no baseline can be reserved, the implementation is incomplete: fail the development
acceptance case rather than issuing impossible tasks or silently reducing the count.

Do not assign repairs or rescues at launch: they may never occur. Those remain
contextual team work. Do not assign long rover/cave expeditions in the first version;
one rover cannot support three simultaneous compulsory journeys.

Public tasks refer only to known sites, public anomalies or existing observations.
Never expose a hidden site's exact coordinates, undisclosed kind, signal source or
event truth through a task title, target, eligibility message or progress indicator.

## Completion, assistance and interruptions

- Progress is derived from validated simulation actions, not a client "complete" button.
  A task is credited to its owner only when its actor and target match. For delivery,
  match the reserved sample tuple `(siteId, tier)` in the airlock deposit action.
  MC route tasks require the owner's waypoint action and the named EVA's subsequent
  arrival; the EVA arrival alone cannot credit the operator.
- A task consumes each qualifying fact once. Repeated ticks, packets, waypoint edits
  or reconnects cannot award it again. Sample collection and its later delivery are
  different facts and may legitimately complete consecutive milestones.
- Team objective progress still counts everyone's contributions. Helping is allowed;
  assistance alone does not silently finish another player's personal task. A sample
  already collected by someone else requires an explicit handoff or replacement.
- If a teammate consumes a reserved opportunity, the target expires or a route becomes
  unusable, replace the unfinished task's target/kind with a feasible fallback under
  the same ID, retaining its owner and recording the reason. Never spawn extra records.
  Do not count unrelated earlier actions retroactively; already matched chain facts
  remain valid when the next milestone activates.
- A player may prioritize shelter or rescue. Personal tasks have no separate deadline
  and impose no penalty for stopping during a crisis. Temporary danger pauses guidance;
  it must not provoke repeated replacements or unsafe return trips.
- When no feasible replacement remains after a player action or crisis, keep the
  unfinished task blocked with a reason. Launch feasibility is guaranteed by allocation;
  completion after subsequent mistakes, deaths or resource exhaustion is not guaranteed.
- Reconnecting with the same token preserves ownership and progress. Do not reassign
  on a brief disconnect. Proposed grace period: 30 mission seconds, configurable.
  After it, the host can offer unfinished tasks to a connected eligible player, who
  must accept. A lost player is immediately eligible for this handoff process.
- Reassignment changes the owner, not the task ID or completed history. MC work can
  only go to a role authorized for MC actions; it cannot promote EVA to MC. With no
  eligible recipient, leave the task visibly blocked. It never blocks mission liftoff.
- Completed tasks stay completed. At mission end, unfinished tasks, including queued
  or blocked ones, become failed and appear in the report with their actual status.

## Presentation and rewards

Helmet HUD: show **My task**, owner, next action and progress; below it retain the
primary mission goals. A compact **Crew tasks** panel lists owners, completed/total,
waiting reasons and transfers. MC gets the same personal-task summary on the console.
When both tasks are done, show **Assignment complete** and the remaining team goals.

The report separates mission success from personal contribution and lists each
player's two original assignments, completion, helpers and ownership changes. Keep
the original owner in history after a transfer so a replacement does not hide a departure.

Initially personal tasks add no score, grade cap, liftoff gate or secondary-objective
bonus. Existing science and teamwork actions still score normally. In particular,
do not feed personal tasks into `primariesDone()` or the current per-secondary bonus:
larger teams must not obtain extra points just by having more task records.

## Proposed implementation boundaries

This document changes no runtime files. Subsequent implementation needs both owners
and the hot-file procedure in [architecture.md](architecture.md), section 13.2:

1. **A, separate contract PR:** additive `PersonalTask`, launch-roster metadata,
   `EvaState.personalTasks`, report history and validated handoff request/accept
   messages. Keep the current `Objective` shape and meanings. Minimal fixtures must
   remain valid; do not add dummy astronauts to represent MC.
2. **A, engine PR:** scenario task templates, allocator, lifecycle, actor attribution,
   MC facts, report finalization and tests. Initialize tasks in `GameRoom.launch()`
   from the full roster after world/discovery setup. Integrate through existing
   objective-system calls; any necessary `step.ts` change is a separate hot-file PR.
3. **B, field integration PR:** authoritative sample/deposit, discovery and station
   action facts in B-owned systems and `eva:*` input branches, plus tests. Record
   facts where actions succeed; do not reconstruct them from expiring visual effects.
4. **B, UI PR / A, console PR:** HUD, crew panel, report, i18n and transfer controls.
   B must not edit A's objective dictionary or console. Until all layers are present,
   the feature stays unreachable; no contract-only PR enables it in main.

Keep bounded progress/history in the full snapshot, continue React's throttled HUD
channel, and retain the 16 KB snapshot ceiling. Tunables belong in the appropriate
owner-tagged balance block; templates belong in scenario data. Register the new RNG
salt in architecture.md when implementation introduces it. No dependencies are needed.

## Acceptance for the future implementation

These checks are planned, not executed by this documentation PR. Nurmukasan performs
manual/local validation; automated repository CI remains independent.

1. For N = 1, 2, 3, 4, training and signal create exactly 2N uniquely identified
   records, two original assignments per player, one initially active each. Include
   MC and retained disconnected slots; reconnection never changes the denominator.
2. Same seed, roster, design and validated inputs produce identical assignments,
   replacements and progress in LocalTransport and the server. Fly again resets facts.
3. Cover all classes, duplicate classes, zero kits, no drill, four-player training and
   large-world signal. Every baseline chain has a distinct available sample and a safe
   route; no task reveals hidden information or depends on a random rescue/fault.
4. An unrelated player's action cannot complete the owner's task. Correct collection
   and delivery complete their respective milestones exactly once. Concurrent digging,
   target consumption, repeated packets, expiry and out-of-order inputs are covered.
5. Cover MC waypoint arrival and manual observation credit, MC absence from astronauts,
   timeouts, solo auto-picks and the replacement path when observation opportunities
   are exhausted. No fake classification of signal pulses and no automatic success.
6. Cover grace-period boundary, host migration, transfer acceptance, invalid target
   roles/IDs, non-host offers, replayed acceptance, reconnection after transfer and no
   eligible recipient. No duplicated work, unsolicited ownership changes or extra tasks.
7. Mission success, quotas, existing score, liftoff and free snapshots/behaviour remain
   unchanged. Finalize unfinished tasks; report completed and transferred ones honestly.
8. CI runs `npm run check`, including determinism, garbage-input and snapshot-size
   checks. Nurmukasan accepts solo and 2–4-player flows, readable HUD/console/report,
   interruption recovery and comparable work time across roles before feature enablement.

Open review points: accept two milestones per player as the first balance value;
accept initial training/signal scope; accept contribution-only reporting before any
personal-task score bonus. None is presented as implemented or playtested.
