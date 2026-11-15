# Personal mission assignments

Implementation: contract #85 and mechanic #86. These PRs do not constitute manual
acceptance. Local/manual validation belongs to Nurmukasan; automated CI runs the
repository checks. No stability tag or balance result is claimed here.

## Playing

1. In a solo or online lobby, choose **Training** or **RED SIGNAL**.
2. The host enables **Personal assignments**. It is off by default; free mission
   keeps its existing behavior regardless of the stored choice.
3. Pick roles and crew specialties, then launch with Quick start or a custom design.
4. Each player sees **My assignment** and the next milestone. A gold TASK marker and
   the HUD's direction/distance lead to the current destination. A delivery points
   toward its collection site until the sample is carried, then toward the airlock.
5. **Crew assignments** lists owners, status, replacements and handoffs. MC has the
   same panel plus **Mark route** for the named astronaut. The report keeps personal
   contributions separate from the mission goals.

## Allocation and variety

There are exactly two task records per launch participant, including MC:

| Players | Personal task records | Initially active |
| --- | --- | --- |
| 1 | 2 | 1 |
| 2 | 4 | 2 |
| 3 | 6 | 3 |
| 4 | 8 | 4 |

Each chain has an active first milestone and a queued follow-up. The launch roster,
including retained disconnected slots, is frozen for the attempt. Reconnects and
handoffs never add task records. Fly again starts a new board and resets progress.

An independent seeded stream uses the mission seed and attempt number. It rotates
chain preferences and destinations without changing terrain or event randomness.
Training keeps its fixed world and scripted events; repeat attempts can vary the
personal assignments. Identical seed, attempt, roster and design replay identically.

| Specialty / role | Preferred work when feasible |
| --- | --- |
| Engineer | Deploy a carried seismometer, then collect and deliver a nearby sample |
| Scout | Discover a public anomaly, then collect and deliver a sample from that site |
| Geologist | Collect a deep sample with the installed drill, then deliver it |
| Biologist | Collect a preferred-kind sample, then deliver it |
| MC | Mark a useful route and guide a named EVA to it, then resolve an observation |

Every field class can receive ordinary sampling. Missing kits, absent drill, distant
anomalies or consumed targets select a reachable sampling alternative. The allocator
reserves entire sample sites between chains: deep drilling also extracts the surface
tier, so assigning different tiers at the same site to different players is unsafe.

Travel planning conservatively budgets sand, suit capacity, digging and remaining
time. Initial assignments stay near the lander and do not depend on the single rover,
caves, random faults or rescues. This is an initial feasibility policy, not evidence
of equal work duration across roles; that needs Nurmukasan's playtest.

Only public site positions or fuzzed anomaly circles enter tasks. The source of RED
SIGNAL and the truth about unclassified events remain hidden. Discovery replaces
an anomaly's target coordinates only after the site becomes public.

## Progress and recovery

Progress comes from successful engine actions: collection, airlock deposit, discovery,
kit deployment, a correct classification or a first accepted manual signal pick.
The actor and assigned target must match. A queued task cannot receive unrelated
earlier actions; repeated packets and simulation ticks do not repeat completion.

For MC guidance, setting a waypoint is insufficient: the named EVA must subsequently
reach it. Marking someone already at the destination gives no credit. Solo auto-picks
do not count as manual MC work. If an EVA moves on before MC marks the route, guidance
can switch to their new assignment or their return to the lander.

If a teammate consumes a reserved opportunity, the engine replaces the unfinished
task's target under the same ID and retains completed history. An unavailable delivery
remains a delivery: a replacement sample must actually be collected and deposited.
If no safe work remains, the task is visibly blocked. It never forces liftoff to wait.

MC waits for future scheduled observation opportunities. Once those opportunities
are exhausted and no observation remains live, a return-guidance task may replace
observation work. Nobody is asked to leave shelter simply to satisfy that fallback.

Reconnection with the same token preserves progress. After 30 mission seconds of
disconnection, or immediately after a player is lost, the host may offer an unfinished
task to an eligible connected player. The recipient must accept. A returning owner
cancels stale offers; an already accepted transfer stays with its new owner. Task
roles do not grant new player permissions: an EVA cannot inherit MC capabilities.

Each task retains its original owner, current owner, completion time and the last
four replacement/transfer records. At mission end all unfinished tasks become failed;
completed records stay complete. The report copies its data rather than aliasing the sim.

Mission goals, quotas, science value, score calculation and liftoff rules remain
unchanged. Personal-task completion grants no separate score bonus or success gate.

## Validation

Behavior tests cover roster sizes 1–4, deterministic variation, equipment fallbacks,
unique reservations, authoritative action attribution, discovery secrecy, actual MC
travel, retargeting, recipient consent, grace/reconnect, invalid messages, finalization,
score compatibility and the 16 KB snapshot budget across a full mission timeline.
UI logic tests cover current ownership, translated instructions and the switch from
collection-site guidance to airlock guidance when the matching sample is carried.

The initial count tests failed in CI before implementation because no task board
existed. Follow-up CI validates the implementation; check #86 for the current head's
result. No local tests, builds, bots or browser runs were performed by the assistant.

Nurmukasan still needs to accept these flows before enabling assignments by default:

- Solo training with each class, including a design without kits or a drill.
- Two, three and four players: everyone can find their task and complete their chain;
  MC marking, observation input and HUD/console/report remain understandable.
- Helping, consuming another player's target, sheltering during a crisis, loss,
  token reconnect, accepted transfers and host migration.
- HUD layout at supported screen sizes, controls while the crew list is open,
  marker visibility, Reduce motion, Firefox and performance on the weak laptop.
- Comparable workload across classes/roles and enough reason to continue the shared
  mission after the two personal milestones are complete.
