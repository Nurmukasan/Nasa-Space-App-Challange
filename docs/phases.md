# phases.md — RED SIGNAL 2.0: план на двух разработчиков

Фундамент (`start-phase.md`) закончен: движок, сеть, соло, пульт и отчёт работают, 98 тестов зелёные.
Но **играть в это скучно**, а выглядит оно как прототип. Этот документ превращает фундамент в игру,
с которой не стыдно выйти к жюри. Он заменяет `start-phase.md` как текущий план работ.

Что делает игра v2, описано в `product-logic.md` (ссылки вида **PL 7.12**). Как она устроена — в
`architecture.md` (**ARCH 6.5**). Куда класть арт и звук — в `assets.md`. Перед любой задачей
ИИ-ассистент читает `AGENTS.md`, `architecture.md`, `product-logic.md` и этот файл.

---

## 1. Диагноз: почему сейчас скучно

Проверено запуском (соло, конструктор, вылазка, пульт, отчёт) и чтением кода.

| # | Проблема | Почему это убивает игру |
|---|---|---|
| 1 | Астронавт — курьер: дошёл до метки, держит пробел 20 с, вернулся, нажал E. Все участки известны с первой секунды | Нет открытий и решений. Через две минуты всё понятно, дальше — повтор |
| 2 | Оператору нечего делать между событиями. Классификация — викторина: подсказка написана прямо на кнопке | Самая интересная роль простаивает 80% времени |
| 3 | Нет сюжета, целей на экране, кульминации и финала. Десять минут без структуры | Нечего рассказать на защите, нечего запомнить игроку |
| 4 | Конструктор — форма с выпадающими списками | Главный экран кейса «Space Mission Design Game» выглядит как анкета |
| 5 | Соло неудобно: карта только по TAB, а пока смотришь в пульт — стоишь и дышишь | Судья откроет игру **один**. Соло — это и есть первое впечатление |
| 6 | Отчёт — колонка текста, без «вау» и без подсказки, что изменить | Петля «попробовал → понял → изменил» не замыкается |
| 7 | Мир пустой: террасы и маркеры. Опасность видна только как надпись TREMOR | Нечего показать в 30-секундном видео |

## 2. Что меняем: шесть столпов v2

1. **Сюжет и три акта.** Тренировка на 4 минуты для новичков и судей. Основная миссия **RED SIGNAL** на 8 минут: найти источник странного повторяющегося сигнала. Голоса ЗЕМЛИ (с задержкой 12 минут — это настоящая физика) и бортового компьютера TULPAR. Три акта: посадка → сигнал → ночь и окно запуска (PL 5).
2. **Разведка вместо курьера.** Известны только ближние участки. Дальние — «аномалии» с орбиты. Сканер шлема ведёт к ним, находка — событие. Источник сигнала сначала надо вычислить, потом найти (PL 7.6, 7.12).
3. **Оператор — сейсмолог и бортинженер.** Классифицирует толчок **и ставит эпицентр на карту** по кольцам дальности станций, как настоящие сейсмологи. Ищет RED SIGNAL. Диагностирует поломки корабля и посылает людей к нужному люку (PL 7.11, 7.16).
4. **Мир, который движется.** Режиссёр расставляет события по актам и не душит игроков. Пылевые вихри бродят по карте (и чистят панели!), зыбучий песок, солнечная вспышка гонит всех под крышу, поломки, окно запуска закрывается (PL 7.13–7.17).
5. **Конструктор и отчёт — главные экраны кейса.** До полёта прогноз: «энергия кончится в 6:10». После полёта: штамп, хронология, награды, разгадка сигнала и подсказка «попробуй бур» прямо на кнопке REDESIGN (PL 6.10, 8).
6. **Соло и демо — в первую очередь.** Мини-карта на запястье, сейсмо-карточка с клавишами Z/X/C, тренировка с фиксированным seed: каждый показ одинаково хорош (PL 7.22).

Что **не** трогаем: стек, сеть, полные снимки 15 Гц, детерминизм, классическую миссию (она остаётся режимом
**Free mission**, и на ней держатся все 98 старых тестов).

---

## 3. Люди и владение файлами

### 3.1. Две роли

| Кто | Дорожка | Коротко |
|---|---|---|
| **A** | **Движок и сюжет** | Сценарии и режиссёр, задачи миссии, сейсмика и RED SIGNAL, поломки, вспышка, очки и отчётные данные, прогноз конструктора. Пульт оператора. Сервер, боты, деплой. **Хранитель контракта** |
| **B** | **Поле и подача** | Разведка и сканер, сейсмометры, песок и вихри. Экран астронавта, HUD, соло. Лобби, конструктор, экран отчёта, заставки и «сочность». Подключение арта и звука. **Хранитель клиентского каркаса** |
| Контент | Научный, геймдизайнер, художник, звук | Тексты сюжета и фактов, ассеты по `assets.md`, плейтесты и баланс (раздел 12) |

### 3.2. Кто какие файлы правит

Правило прежнее: **файл правит только владелец.** Нужно что-то в чужом файле — написать владельцу.

| Файлы | Владелец |
|---|---|
| `shared/src/types.ts`, `protocol.ts`, `sim/step.ts`, `index.ts` 🔒 | **A** (B присылает заявку в чат) |
| `shared/src/scenarios/**`, `sim/{director,objectives,signal,faults,flare,seismic,schedule,hazards,weather,power,comms,lander,endcheck,scoring,insights,sim,awards}.ts`, `engine/**`, `design.ts`, `forecast.ts` | **A** |
| `shared/src/sim/{discovery,stations,devils,digging,oxygen,movement}.ts`, `terrain.ts`, `catalog.ts` | **B** |
| `shared/src/sim/input.ts` | общий: **A** — ветки `mc:*`, **B** — ветки `eva:*` |
| `shared/src/sim/debug.ts` | общий: каждый — свои команды |
| `shared/src/balance.ts` | общий: каждый правит **только свои блоки** (подписаны `// owner: A` / `// owner: B`) |
| `shared/test/**` | автор системы пишет её тесты |
| `server/**`, `tools/**` (кроме `assets.test.ts`), `.github/**`, деплой | **A** |
| `client/src/console/**`, `screens/ConsoleScreen.tsx` | **A** |
| `client/src/i18n/en/{console,panels,radio,report,objectives}.ts` | **A** |
| `client/src/i18n/en/story.ts` | ключи заводит **A**, тексты пишет контент-команда |
| `client/src/game/**`, `render/**`, `fx/**`, `audio/**`, `screens/{EvaScreen,eva/**}` | **B** |
| `client/src/screens/{LobbyScreen,DesignScreen,ReportScreen}.tsx` и новые папки `screens/{lobby,design,report}/` | **B** |
| `client/src/App.tsx` 🔒, `main.tsx`, `net/**`, `state/**`, `ui/**`, `dev/**` | **B** |
| `client/src/i18n/en/{eva,design,catalog,lobby,settings,dev,reportUi}.ts` | **B** |
| `client/src/game/assetManifest.ts`, `audio/soundManifest.ts`, `tools/assets.test.ts` | **B** (по заявкам художника и звукорежиссёра) |
| `client/public/assets/**` | художник и звукорежиссёр: только новые файлы, «один файл — один автор» |
| `docs/content/**`, `docs/REFERENCES.md` | контент-команда |

### 3.3. Правила на всю ночь

1. **Одна задача — одна ветка — один PR.** Ветки `a/<задача>`, `b/<задача>`, `art/<что>`. Слияние squash, когда CI зелёный.
2. **Перед пушем:** `git pull --rebase origin main && npm run check`.
3. **Контракт меняется только в фазе 0** одним PR от A. Если по ходу понадобилось новое поле — «мини-контракт»: отдельный PR от A в 5–15 строк, объявление в чате «🔒 меняю types.ts: …», слить за 10 минут, оба делают `git pull --rebase`.
4. **`main` всегда играбелен.** Недоделанное прячется за флагом в `client/src/ui/features.ts` (B заводит в задаче B4) или недостижимо из интерфейса.
5. **Free mission не меняет поведения.** Все новые правила включаются только в сценариях `training` и `signal`. Старые тесты не правятся и не ослабляются.
6. **Каждая задача движка — с тестами.** Список тестов дан в задаче: «сначала тесты, убедись, что падают, потом код».
7. **Застрял дольше 20 минут** — сказать второму. Не успеваешь задачу к точке синхронизации — сливаешь то, что работает, остальное остаётся в ветке.
8. В конце каждой фазы — тег и одно сообщение в чат: что работает, ссылка, тег.

---

## 4. Расписание

| Фаза | Длится | A | B | Точка | Тег |
|---|---|---|---|---|---|
| **0. Контракт и каркас** | 1:15 | Контрактный PR, заглушки систем, числа | Галерея ассетов, метка возврата O2, камни и обломки | **S0**: контракт в `main`, всё зелёное | `v2-contract` |
| **1. Сюжет и новый цикл** | 3:00 | Сценарии и тренировка, задачи миссии, локализация эпицентра, пульт | Разведка и сканер, HUD v2, соло-набор, выбор сценария | **S1**: тренировка проходится соло от начала до конца | `demo-v2-1` |
| **2. Кризисы и кооператив** | 3:00 | Режиссёр, RED SIGNAL, поломки, вспышка | Сейсмометры, песок и вихри, визуал поля, конструктор v2 (часть 1) | **S2**: миссия RED SIGNAL втроём на 8 минут | `demo-v2-2` |
| **3. Смысл и зрелищность** | 2:45 | Отчётные данные v2, прогноз, пульт v2, боты | Отчёт v2, конструктор v2 (часть 2), заставки, «сочность» | **S3**: полный путь лобби → отчёт → REDESIGN | `demo-v2-3` |
| **4. Баланс и заморозка** | 1:30 | Числа по плейтестам и прогону ботов, исправления | Исправления, видео 30 с, проверка на слабом ноутбуке | **Заморозка** | `demo-stable-final` |

Пример по часам, если старт в 22:30 и заморозка в 11:00: S0 — 23:45, S1 — 02:45, перерыв 30 минут,
S2 — 06:15, S3 — 09:00, заморозка — 10:30, запас 30 минут. Дедлайн другой — сдвиньте время, порядок тот же.

**Правило точки:** в точке синхронизации оба останавливаются, сливают готовое, вместе проходят проверку
из раздела фазы, ставят тег. Проверка не проходит — сначала чинить, потом новые задачи.

---

## 5. Фаза 0 — контракт и каркас (1:15)

Цель: один раз и сразу правильно добавить **все** новые поля, сообщения, системы-заглушки и числа.
После этого A и B три фазы работают параллельно, почти не касаясь общих файлов.

### P0-A. Контрактный PR — A, 60–75 минут

- **Спецификация:** этот раздел; PL 5, 7, 8; ARCH 5, 6.
- **Файлы:** `shared/src/types.ts`, `protocol.ts`, `sim/step.ts`, `index.ts`, `sim/sim.ts`, `sim/input.ts` (только «скелет» порядка клавиши E), `sim/digging.ts` (только вынос `sampleValue`), `design.ts`, `engine/GameRoom.ts`, `balance.ts`; новые `shared/src/scenarios/{index,training,signal,free}.ts`, `shared/src/sim/{director,discovery,stations,devils,faults,flare,signal,objectives,debug}.ts`; `client/src/dev/fixtures/*.ts` (новые поля); `shared/test/engine.test.ts` (только дополнить тест мусорного ввода).
- **Что сделать:**
  1. Добавить в `types.ts` всё из блока ниже, с комментарием к каждому полю.
  2. Добавить в `protocol.ts` новые сообщения и значения.
  3. Создать файлы систем-заглушек: каждая экспортирует `xxxSystem: System = () => {}` и функции-«ручки» с финальной сигнатурой и пустым телом (список ниже). Вписать системы в `step.ts` в новом порядке.
  4. `createSim`: заполнить все новые поля начальными значениями. Комплекты станций (`params.kits`) раздать экипажу по кругу. При `deployStations` стартовая станция одна — на корабле (`STATIONS.landerOffset`), иначе станции ставятся как раньше. Классическая миссия должна вести себя **бит в бит как раньше**.
  5. `deriveParams(design, seed, scenario = 'free')`: новые поля из сценария; `checkDesign(design, scenario = 'free')` — поле `forecast` с пустыми точками.
  6. `GameRoom`: `state.scenario = 'free'`; при запуске передавать сценарий в `deriveParams`; `params.solo` выставить, если единственный игрок в роли `solo`. Сообщения `lobby:scenario` и `mc:locate` пока принимать и игнорировать. Новые отладочные команды направить в `sim/debug.ts`.
  7. Вынести расчёт ценности образца из `digging.ts` в экспортируемую `sampleValue(site, tier, params)` и сразу учесть вид `signal` (`SIGNAL.sampleValue`, только `deep` и `core`). Поведение для старых видов не меняется.
  8. В `input.ts` у `eva:interact` закрепить порядок: спасение → шлюз → `tryStartRepair(sim, a)` → `tryDeployKit(sim, a)`. Заглушки возвращают `false`.
  9. В `balance.ts` добавить блоки чисел ниже, каждый с подписью владельца.
  10. Обновить фикстуры `?dev=` под новые поля, чтобы клиент собирался.
- **Тесты:** все 98 старых — зелёные без единой правки. Тест мусорного ввода дополнить `lobby:scenario`, `mc:locate` и новыми отладочными командами. Тест размера снимка — меньше 16 КБ.
- **Готово, когда:** `npm run check` зелёный; соло и онлайн играются как раньше; PR слит, в чате «🔒 контракт v2 в main».

#### Контракт v2: `types.ts`

```ts
export type ScenarioId = 'training' | 'signal' | 'free';
export type SiteKind = 'delta' | 'crater' | 'basalt' | 'impact' | 'signal'; // + 'signal'

/** Orbital hint about an undiscovered site, shown on the Mission Control map only. */
export interface Anomaly {
  id: string; // same id as the hidden site
  x: number; // fuzzed centre, never the exact site
  y: number;
  r: number;
  kind: SiteKind | null; // known with GPR
  richness: 1 | 2 | 3 | null; // known with GPR
}

export type ObjectiveKind =
  | 'deliver' | 'deliver_deep' | 'deploy_stations' | 'locate_signal' | 'retrieve_signal'
  | 'discover' | 'repair_all' | 'all_aboard' | 'classify';
export interface Objective {
  id: string;
  kind: ObjectiveKind;
  primary: boolean; // primary objectives decide success; secondary ones add score
  target: number;
  progress: number;
  state: 'active' | 'done' | 'failed';
}

export type FaultKind = 'moxie_clog' | 'antenna_drift' | 'battery_fault' | 'panel_dust';
export type ServicePort = 'n' | 'e' | 's' | 'w';
export interface Fault {
  id: string;
  kind: FaultKind;
  port: ServicePort; // exterior hatch where it is repaired with E
  since: number;
  progress: number; // 0..1, kept if the repair is interrupted
}

export interface DustDevil { id: string; x: number; y: number; r: number; vx: number; vy: number; until: number }
export interface FlareState { warnAt: number; tStart: number; tEnd: number } // public from warnAt
export interface SignalState {
  zone: { x: number; y: number; r: number } | null; // search zone narrowed by MC picks
  pulses: number;
  located: boolean; // zone small enough: field beacon shown, scanner can detect the source
  found: boolean; // source site discovered
  retrieved: boolean; // signal sample delivered to the lander
}
export interface ScanReading { dist: number; bearing: number } // nearest undiscovered site in range

// Astronaut: + kits: number; repairing: string | null; scan: ScanReading | null; dose: number;
// StationSignal: + distEst: number (S–P distance, px, noisy); bearingEst: number | null (station 0 only)
// SeismicEvent: + signal: boolean (RED SIGNAL pulse: locate only); pick: Vec2 | null (MC epicentre pick)
// LanderState: + faults: Fault[];
// EvaState: + scenario: ScenarioId; act: number; objectives: Objective[]; anomalies: Anomaly[];
//           devils: DustDevil[]; flare: FlareState | null; signal: SignalState;
// MissionParams: + scenario: ScenarioId; duskEndS: number; solo: boolean; deployStations: boolean;
//                kits: number; scanRange: number; scienceFull: number;
// RoomState: + scenario: ScenarioId;

// FxType: + 'discovery' | 'deploy' | 'repair_done' | 'fault' | 'devil' | 'panel_clean'
//         | 'flare_warn' | 'flare_start' | 'flare_end' | 'signal_pulse' | 'signal_located'
//         | 'signal_found' | 'act' | 'objective_done' | 'window_closing' | 'liftoff'

export interface CrewStats {
  id: string; distance: number; science: number; samples: number; rescues: number;
  repairs: number; discoveries: number; o2Used: number; secondsOutside: number;
}
// MissionStats: + discoveries, stationsDeployed, repairs, faultSeconds, locatePicks, locateGood,
//   locateErrorSum, sandSeconds, devilSeconds, doseMax: number; signalRetrieved: boolean;
//   crewStats: CrewStats[]

export interface TimelineEntry { t: number; type: FxType; playerId?: string; n?: number }
export interface Award { code: string; playerId: string; n?: number }
// Insight: + fix?: { module?: ModuleId; field?: DesignField; value?: string } (REDESIGN hint)
// MissionReport: + scenario: ScenarioId; objectives: Objective[]; timeline: TimelineEntry[];
//                awards: Award[]; reveal: string | null (i18n key of the RED SIGNAL debrief)

export interface ForecastPoint { t: number; powerW: number; needW: number; o2Store: number }
export interface MissionForecast {
  points: ForecastPoint[]; // ~32 points over the mission
  powerShortAtS: number | null; // first time power < need
  storeEmptyAtS: number | null; // projected O2 store exhaustion
  deepReachM: number; // farthest deep sample reachable on one tank
  dataReturnPct: number;
}
// DesignCheck: + forecast: MissionForecast
```

#### Контракт v2: `protocol.ts`

```ts
export type PingKind = 'ok' | 'help' | 'low_o2' | 'returning' | 'found' | 'shaking'; // + 'shaking' (key 6)
export type DebugCmd = /* old */ | 'event_signal' | 'devil' | 'fault' | 'flare' | 'next_act' | 'reveal_all';
// ClientMsg:
//   | { t: 'lobby:scenario'; id: ScenarioId }              // host, phase lobby or design
//   | { t: 'mc:locate'; eventId: string; x: number; y: number } // mc or solo, until the deadline
```

#### Скрытое состояние (`sim.ts`, A) и порядок систем (`step.ts`)

```ts
// SimHidden: + hiddenSites: SampleSite[]; signalSource: Vec2 | null; flare: FlareState | null;
//   director: { act: number; nextAt: number; nextPulseAt: number; crisis: 'storm' | 'flare' | null;
//               spawned: Record<string, number>; windowWarned: boolean };
//   timeline: TimelineEntry[]   // pushFx() appends selected types, max REPORT.timelineMax

director → weather → flare → power → comms → devils → oxygen → digging → discovery
  → faults → lander → seismic → signal → hazards → objectives → endCheck
```

#### Функции-«ручки» (сигнатуры финальные, в фазе 0 — пустые)

| Файл | Функция | Кто наполнит |
|---|---|---|
| `scenarios/index.ts` | `SCENARIOS: Record<ScenarioId, ScenarioDef>` с данными из PL 5.1 | A1 |
| `sim/objectives.ts` | `buildObjectives(params): Objective[]`, `objectivesSystem` | A2 |
| `sim/discovery.ts` | `initDiscovery(sim)` (в фазе 0: все участки известны), `discoverySystem` | B1 |
| `sim/stations.ts` | `tryDeployKit(sim, a): boolean` | B5 |
| `sim/devils.ts` | `spawnDevil(sim, near: Vec2)`, `devilSystem`, `terrainMul(state, salt, x, y): { speed: number; o2: number }` | B6 |
| `sim/faults.ts` | `spawnFault(sim, kind)`, `clearFault(sim, kind)`, `faultActive(sim, kind): boolean`, `tryStartRepair(sim, a): boolean`, `faultSystem` | A7 |
| `sim/flare.ts` | `scheduleFlare(sim, warnAt, leadS, durS)`, `flareSystem` | A8 |
| `sim/signal.ts` | `onSignalResolved(sim, event)`, `signalSystem` | A6 |
| `sim/director.ts` | `directorSystem` (биты сценария + режиссёр) | A1, A5 |
| `sim/debug.ts` | `debugSim(sim, cmd, n)` для новых команд | каждый своё |
| `design.ts` | `forecastMission(design, scenario): MissionForecast` (пустой результат) | A10 |

#### Числа v2 в `balance.ts`

```ts
// owner: B
export const DISCOVERY = { scanRange: 110, gprScanMul: 1.6, revealDist: 22, anomalyR: 70, anomalyFuzz: 40, science: 6 };
export const STATIONS = { kitsWithNet: 2, landerOffset: { x: 0, y: 26 }, minFromLander: 110, minBetween: 120 };
export const SAND = { threshold: 0.35, speedMul: 0.6, o2Mul: 1.3 };
export const DEVIL = { rMin: 18, rMax: 28, speedMin: 14, speedMax: 22, lifeMin: 35, lifeMax: 55,
  spawnMin: 120, spawnMax: 250, speedMul: 0.7, o2Extra: 0.8, cleanDist: 40, minLight: 0.4, turnRate: 0.6 };
export const RETURN = { margin: 1.15, reserve: 5 };
// owner: A
export const LOCATE = { distErr: 0.12, bearingErr: 0.5, warnRadius: 170, goodPx: 80, goodBonus: 20 };
export const SIGNAL = { firstS: 95, gapMinS: 50, gapMaxS: 70, lastS: 360, windowMul: 1.5,
  sourceMinDist: 500, sourceMaxDist: 680, amp: 0.55,
  signature: { riseS: 0.6, decayS: 6, freqHz: 2.8, noise: 0.06, pressureDip: 0 },
  zoneErrMul: 1.2, zoneSlack: 50, autoR3: 170, autoR1: 320, locatedR: 140, sampleValue: 60,
  feelNear: 200, feelFar: 450 };
export const FAULTS = { repairS: 6, portDist: 30, portRadius: 14, maxActive: 2, antennaMul: 0.6,
  panelMul: 0.5, repairBonus: 10,
  ports: { moxie_clog: 'e', antenna_drift: 'n', panel_dust: 's', battery_fault: 'w' } };
export const FLARE = { leadS: 40, durS: 40, doseRate: 2, doseLimit: 50, penaltyPer10: 10 };
export const DIRECTOR = { tensionO2Frac: 0.25, postponeS: 8, windowWarnS: 60, nearCrewMin: 120, nearCrewMax: 260 };
export const SOLO = { classifyMul: 1.5 };
export const OBJECTIVE = { secondaryBonus: 20 };
export const REPORT = { timelineMax: 80 };
```

Длительности, акты, биты и задачи сценариев — данные в `shared/src/scenarios/*.ts` (PL 5.1).

### P0-B. Пока A пишет контракт — B, 60–75 минут, без контракта

**P0-B1. Галерея ассетов `?dev=assets` (25 мин).** Файлы: новый `client/src/dev/entries/assets.tsx`, `i18n/en/dev.ts`.
Страница перечисляет весь `assetManifest.ts` и `soundManifest.ts`: для каждого — есть файл или запасная
отрисовка, анимация кадров, кнопка «проиграть звук». **Готово, когда:** художник кладёт PNG, открывает
`?dev=assets` и видит свою анимацию.

**P0-B2. Метка возврата на шкале кислорода (25 мин).** PL 7.3. Файлы: `shared/src/sim/movement.ts`
(функция `returnCost(params, weather, x, y)`), новый `shared/test/movement.test.ts`, HUD.
Цена дороги домой = расстояние до шлюза ÷ скорость ходьбы × расход ходьбы × `RETURN.margin` + `RETURN.reserve`.
На шкале O2 — риска «точка невозврата»; когда кислород ближе 10 единиц к риске — баннер **RETURN NOW**.
**Тесты:** цена растёт с расстоянием; у шлюза почти ноль; в бурю дороже. **Готово, когда:** уходишь далеко — риска ползёт вправо, вовремя загорается баннер.

**P0-B3. Камни и обломки (25 мин).** Новый `client/src/game/PropLayer.ts`, одна строка в `FieldScene.ts`.
Детерминированно от соли места: 40–60 камней `rock_*`, 4–6 валунов `boulder_*`, у корабля — `debris_chute`
(парашют и обтекатель: Ingenuity снимал такие обломки Perseverance). Не ближе 24 px к участкам и шлюзу.
Только косметика, без коллизий. **Готово, когда:** мир перестал быть пустым, кадр не просел (`F3`).

### S0 — проверка

`npm run check` зелёный. Соло Quick start и онлайн вдвоём проходятся как раньше. `?dev=assets` открывается.
Тег `v2-contract`.

---

## 6. Фаза 1 — сюжет и новый цикл (3:00)

### A1. Сценарии, биты и тренировка — 75 мин

- **Спецификация:** PL 5.1–5.3, 9.1.
- **Файлы:** `shared/src/scenarios/*`, `sim/director.ts` (биты), `design.ts`, `engine/GameRoom.ts`, `sim/debug.ts` (`next_act`), `client/src/i18n/en/story.ts` (ключи с черновыми текстами), новый `shared/test/scenario.test.ts`.
- **Что сделать:**
  - Данные трёх сценариев по таблице PL 5.1: длительность, закат, фиксированный seed и место (тренировка), развёртываемые станции, известные кольца участков, `scienceFull`, пресет для Quick start.
  - `lobby:scenario`: только хост, только в `lobby` и `design`, id проверять через `hasOwnProperty`. После смены сценария пересчитать `state.check` (прогноз зависит от сценария).
  - Биты: список `{ at, action }`, действие — радиосообщение (`pushLog` от `earth` или `tulpar`), событие (`wind`/`quake`/`impact` в точке или «рядом с экипажем»), вспышка, буря, акт, поломка, «окно закрывается». Выполнять каждый бит ровно один раз, когда `t ≥ at`.
  - Полный сценарий тренировки по PL 9.1.
  - Соло: `classifyWindowS × SOLO.classifyMul`.
- **Тесты:**
  1. `deriveParams` без сценария равен классике: 600 / 420 / станции не развёртываются / `kits = 0` / `scienceFull = 220`;
  2. тренировка: 240 / 200, seed 2041 при любом seed комнаты, место `jezero`;
  3. `lobby:scenario` — только хост и только в своих фазах, мусор не роняет;
  4. биты тренировки срабатывают в свои секунды и одинаково в двух прогонах;
  5. толчок тренировки ставится не дальше `DIRECTOR.nearCrewMax` от астронавта и у уступа;
  6. в соло окно классификации ×1,5.
- **Готово, когда:** тесты зелёные; в браузере `rs.send({t:'lobby:scenario', id:'training'})` и Quick start → через 55 с ветер, через 95 с толчок рядом, через 150 с болид, в 3:05 предупреждение о вспышке, в 4:00 взлёт.

### A2. Задачи миссии — 45 мин

- **Спецификация:** PL 7.18, 8.1.
- **Файлы:** `sim/objectives.ts`, `sim/scoring.ts` (успех, бонус, `buildReport`), `sim/endcheck.ts`, новый `shared/test/objectives.test.ts`.
- **Что сделать:** `buildObjectives(params)` по сценарию; каждую секунду пересчитывать `progress` из статистики и состояния; `done` — навсегда; при `endMission` невыполненные → `failed`; эффект `objective_done` один раз. Успех = выжил хотя бы один **и** все главные задачи выполнены. Каждая выполненная второстепенная, кроме `all_aboard`, даёт `OBJECTIVE.secondaryBonus` к Teamwork. `report.objectives`.
- **Тесты:** во free задачи — квота и глубокие (главные) плюс `all_aboard`, и старый тест успеха проходит без правок; прогресс растёт от сдачи; эффект один раз; `failed` в конце; бонус второстепенных с потолком шкалы; в `signal` без образца сигнала успеха нет.
- **Готово, когда:** в отчёте список задач с отметками совпадает с тем, что было в вылазке.

### A3. Локализация эпицентра — 60 мин

- **Спецификация:** PL 7.11.
- **Файлы:** `sim/seismic.ts`, `sim/hazards.ts`, `sim/input.ts` (`mc:locate`), новый `shared/test/locate.test.ts`.
- **Что сделать:**
  - Каждому сигналу станции — `distEst` (истинное расстояние × (1 ± ошибка), ошибка растёт при нехватке энергии приборам) и у станции 0 — `bearingEst` (направление ± `LOCATE.bearingErr`). Генератор от `seed ^ hash(eventId) ^ stationIdx`.
  - `mc:locate`: только `mc`/`solo`, событие не решено или это импульс сигнала, время не вышло, координаты конечные; зажать в мир; последний клик побеждает.
  - **В сценариях v2:** зона предупреждения о толчке — круг `LOCATE.warnRadius` вокруг пика оператора (если пика нет — вокруг авто-оценки). Пик, поставленный после ответа QUAKE, двигает зону и пересчитывает, кого предупредить. В момент обвала зона «прыгает» в настоящий эпицентр — игроки видят свою ошибку.
  - **Во free** поведение прежнее (зона в эпицентре).
  - Статистика: `locatePicks`, `locateErrorSum`, `locateGood`; хороший пик (ошибка ≤ `LOCATE.goodPx`) даёт Teamwork `LOCATE.goodBonus`.
- **Тесты:** ошибки `distEst` и `bearingEst` в пределах; `bearingEst` только у станции 0; валидация `mc:locate` (роль, срок, мусор, зажим); в `signal` пик сдвигает зону и предупреждения; во free — нет; зона прыгает в эпицентр при обвале; бонус хорошего пика.
- **Готово, когда:** в двух вкладках оператор ставит пик, у астронавта в зоне — предупреждение, а при обвале видно, насколько оператор промахнулся.

### A4. Пульт v2, часть 1 — 60 мин

- **Спецификация:** PL 7.8, 7.11.
- **Файлы:** `client/src/console/**`, `screens/ConsoleScreen.tsx`, `i18n/en/{console,panels,radio,objectives}.ts`.
- **Что сделать:**
  - Режим LOCATE: при активном событии на карте кольца `distEst` вокруг станций, у станции 0 — сектор `bearingEst`. Клик ставит пик (крестик), правый клик — отмена.
  - Аномалии — пунктирные круги; с георадаром — значок вида и звёзды богатства.
  - Панель задач миссии; заголовок «сценарий · акт».
  - Журнал радио с голосами: EARTH (с пометкой «+12 min»), TULPAR, MC, имена экипажа — разными цветами.
  - Сейсмограмма: шум плавный (интерполяция между значениями хэша). Сейчас линия похожа на меандр.
- **Готово, когда:** `rs.send({t:'debug',cmd:'event_quake'})` → на карте кольца пересекаются у эпицентра, пик ставится, радио читается.

### B1. Разведка: аномалии, сканер, находки — 50 мин

- **Спецификация:** PL 7.6.
- **Файлы:** `sim/discovery.ts`, новый `shared/test/discovery.test.ts`.
- **Что сделать:**
  - `initDiscovery`: участки из колец, которых нет в `knownRings` сценария, и участок сигнала уходят в `hidden.hiddenSites`. По каждому скрытому, кроме сигнала, — `Anomaly` со сдвигом центра до `DISCOVERY.anomalyFuzz` (генератор `seed ^ 0xa40`). С георадаром у аномалии виден вид и богатство.
  - Каждый тик у активного астронавта `scan` = расстояние и направление до ближайшего скрытого участка в радиусе `params.scanRange`, иначе `null`. Участок сигнала виден сканеру только после `signal.located`.
  - Ближе `DISCOVERY.revealDist` — открытие: участок переходит в `pub.sites` (`known: true`), аномалия удаляется, эффект `discovery`, запись в журнал, `stats.discoveries` и `crewStats`, `DISCOVERY.science` сырых очков науки. Для участка сигнала — `signal.found` и эффект `signal_found`.
- **Тесты:** во free все участки известны и аномалий нет; в `signal` известно только первое кольцо; центр аномалии не совпадает с участком, но не дальше `anomalyFuzz`; георадар открывает вид; сканер `null` вне радиуса и с георадаром видит дальше; открытие ровно один раз; участок сигнала не виден сканеру до `located`.
- **Готово, когда:** `rs.snaps.curr.anomalies` не пуст; идёшь к аномалии — `scan.dist` падает, на 22 px участок появляется.

### B2. HUD астронавта v2 — 60 мин

- **Спецификация:** PL 7.3, 7.23.
- **Файлы:** `client/src/screens/eva/**`, `ui/hud.css`, `i18n/en/eva.ts`.
- **Что сделать:** раскладка из PL 7.23: задачи миссии (верх справа), часы и акт (верх по центру), O2 с риской возврата и полосой дозы (верх слева), образцы и комплекты станций (низ слева), подсказка действия (низ по центру), сканер — стрелка направления, метры и частота писка (низ справа). Радио — бегущая строка по буквам с иконкой говорящего. Титр акта на 3 с. Баннеры по приоритету: в один момент — один критический.
- **Готово, когда:** на скриншоте с 4 разных моментов всё читается за 2 секунды и ничего не перекрывается.

### B3. Соло-набор — 60 мин

- **Спецификация:** PL 7.22.
- **Файлы:** новые `screens/eva/WristMap.tsx`, `screens/eva/SoloSeismic.tsx`, `render/miniMap.ts` (общая отрисовка, её же может взять пульт).
- **Что сделать:** только в роли `solo`:
  - мини-карта 128×128 в углу: корабль, участки, аномалии, станции, метка, зоны опасности, вихри, зона сигнала. Клик по карте ставит себе метку (`mc:waypoint`);
  - карточка сейсмособытия: три кнопки и клавиши Z / X / C, тающий таймер. Для импульса сигнала — надпись «auto-locating»;
  - в карточке поломки виден люк ремонта (в мультиплеере его знает только оператор).
- **Готово, когда:** тренировку можно пройти соло, ни разу не нажав TAB.

### B4. Выбор сценария и флаги — 30 мин

- **Файлы:** `screens/LobbyScreen.tsx` (или `screens/lobby/`), `i18n/en/lobby.ts`, новый `ui/features.ts`.
- **Что сделать:** три карточки сценария с брифингом в две строки. Хост шлёт `lobby:scenario`. Соло-кнопка Quick start запускает **тренировку**. Флаг `FEATURES.signalScenario = false` прячет карточку RED SIGNAL до S2.
- **Готово, когда:** с главного экрана за два клика оказываешься в тренировке.

### S1 — проверка (оба, 15 мин)

1. Новичок проходит тренировку соло без подсказок со стороны: двигается, копает, сдаёт образцы, отвечает на ветер и толчок, видит болид, улетает. (Сейсмометр и вспышка появятся в тренировке в фазе 2 — задачи B5 и A8.)
2. Вдвоём (оператор + астронавт): пик эпицентра ставится, предупреждение приходит тому, кто в зоне.
3. В `signal` (через `rs.send`): видны аномалии, сканер ведёт к участку, находка открывает его на пульте.
4. Боты проходят free-миссию: `npm run bots -- --n 3`.

Тег `demo-v2-1`. **С этого момента тренировка — то, что показываем, если всё остальное сломается.**

---

## 7. Фаза 2 — кризисы и кооператив (3:00)

### A5. Режиссёр — 75 мин

- **Спецификация:** PL 7.17, 9.2.
- **Файлы:** `sim/director.ts`, `scenarios/signal.ts`, новый `shared/test/director.test.ts`.
- **Что сделать:**
  - Акты сценария `signal`: границы, пулы событий с весами, промежутки. Эффект `act` и `pub.act` на границе.
  - Первое событие — учебный ветер в 45–60 с. Дальше в момент `nextAt` выбрать событие из пула акта (генератор `seed ^ 0xd17`), поставить его и назначить `nextAt` через случайный промежуток акта.
  - **Напряжение:** если у кого-то O2 ниже `DIRECTOR.tensionO2Frac` или кто-то лежит — отложить событие на `DIRECTOR.postponeS`. Импульсы сигнала и кризис третьего акта не откладываются.
  - Толчок — у уступа в `nearCrewMin…nearCrewMax` от случайного активного астронавта: обвал грозит людям, предупреждение имеет смысл. Удар — 400–650 px от корабля, вдали от участков. Вихрь — `spawnDevil` рядом с астронавтом. Поломка — `spawnFault`.
  - Кризис третьего акта решается при старте миссии: буря с вероятностью места, иначе вспышка. Ровно один.
  - За `DIRECTOR.windowWarnS` до конца — эффект `window_closing` и сообщение TULPAR.
- **Тесты:** детерминизм при одинаковых входах; промежутки в границах акта; не больше событий, чем в пуле; откладывание при низком O2; ровно один кризис; эффект акта на границах; free не затронут.
- **Готово, когда:** в `signal` за 8 минут 7–10 событий, ни одной минуты тишины, ни одного «двойного удара» по лежащему игроку.

### A6. RED SIGNAL — 50 мин

- **Спецификация:** PL 7.12.
- **Файлы:** `sim/signal.ts`, `sim/seismic.ts` (импульс как `SeismicEvent` с `signal: true`), `sim/director.ts` (дорожка импульсов), новый `shared/test/signal.test.ts`.
- **Что сделать:** источник при старте — 500–680 px от корабля, у уступа, вдали от участков (`seed ^ 0x516`); скрытый участок вида `signal` в этой точке. Импульсы с `SIGNAL.firstS` каждые 50–70 с, пока не найден или до `SIGNAL.lastS`. Классифицировать нельзя, только ставить пик; окно ×`SIGNAL.windowMul`. Сужение зоны по правилу PL 7.12. Каждому активному астронавту — эффект `signal_pulse` с силой тряски по расстоянию (сильно / слабо / нет). `located` → эффект и маяк. Сдача образца сигнала → `retrieved`, задача выполнена, ключ разгадки `reveal.<site>`.
- **Тесты:** источник детерминирован и в границах; импульсы прекращаются после `located`; точный пик сужает зону, промах — нет; без пиков зона сужается медленно по числу станций; `located` при радиусе ≤ `SIGNAL.locatedR`; образец сигнала стоит `SIGNAL.sampleValue`.
- **Готово, когда:** вдвоём находите источник за 2–3 импульса с сетью станций и за 4–5 без неё.

### A7. Поломки и ремонт — 60 мин

- **Спецификация:** PL 7.16.
- **Файлы:** `sim/faults.ts`, `sim/power.ts`, `sim/comms.ts`, `sim/lander.ts`, `sim/weather.ts` (пыль после бури), `client/src/console/panels/SystemsPanel.tsx`, новый `shared/test/faults.test.ts`.
- **Что сделать:** поломки и их действие по таблице PL 7.16; не больше `FAULTS.maxActive`; конец бури всегда даёт `panel_dust`. `tryStartRepair`: астронавт ближе `FAULTS.portRadius` к нужному люку → `repairing`. Прогресс идёт, пока он стоит у люка (расход O2 как при копании); ушёл — пауза, прогресс сохраняется. Готово → эффект `repair_done`, статистика, Teamwork. `stats.faultSeconds`. На пульте — схема корабля с четырьмя люками, мигает нужный, кнопка **SEND TO PORT** ставит метку выбранному астронавту.
- **Тесты:** каждая поломка режет свою систему и отпускает после ремонта; чужой люк не чинит; прогресс сохраняется при уходе; два астронавта не чинят одно вдвое быстрее; `clearFault('panel_dust')` работает; free без поломок.
- **Готово, когда:** `rs.send({t:'debug',cmd:'fault'})` → на пульте мигает люк E, оператор отправляет к нему астронавта, тот стоит 6 с, MOXIE снова работает.

### A8. Солнечная вспышка — 40 мин

- **Спецификация:** PL 7.15.
- **Файлы:** `sim/flare.ts`, пульт (полоса предупреждения), новый `shared/test/flare.test.ts`.
- **Что сделать:** `pub.flare` виден с момента предупреждения; сообщение EARTH; эффекты `flare_warn`/`flare_start`/`flare_end`; доза растёт у тех, кто снаружи (внутри корабля — ноль); `stats.doseMax`; штраф Safety по PL 8.1.
- **Тесты:** до предупреждения `flare === null`; доза только снаружи и только во время вспышки; штраф только сверх лимита.
- **Готово, когда:** `rs.send({t:'debug',cmd:'flare'})` → все бегут в корабль, у опоздавшего доза в отчёте.
- **Тренировка:** вернуть в `scenarios/training.ts` биты вспышки (185 с: сообщение EARTH и `flare` с `leadS: 30`, `durS: 25`), сняты до фазы 2.

### B5. Сейсмометры-комплекты — 40 мин

- **Спецификация:** PL 7.7.
- **Файлы:** `sim/stations.ts`, `sim/sim.ts` → раздача комплектов уже в `createSim` (P0), новый `shared/test/stations.test.ts`, поле (спрайт установки), HUD (подсказка с причиной отказа).
- **Что сделать:** `tryDeployKit`: есть комплект, снаружи, не ближе `STATIONS.minFromLander` к кораблю и `minBetween` к другим станциям, не в песке → станция в `pub.stations`, комплект −1, эффект `deploy`, статистика. Задача `deploy_stations`.
- **Тесты:** правила расстояний; без комплекта — ничего; следующий толчок слышат и новые станции; в free станции как раньше.
- **Готово, когда:** в `signal` поставил две станции треугольником — кольца на пульте пересекаются точно.
- **Тренировка (вместе с A, файл A):** вернуть в `scenarios/training.ts` подсказку TULPAR про сейсмометр (40 с) и второстепенную задачу `deploy_stations` с целью 1, сняты до фазы 2.

### B6. Песок и пылевые вихри — 50 мин

- **Спецификация:** PL 7.1, 7.14.
- **Файлы:** `terrain.ts` (`sandAt`), `sim/movement.ts`, `sim/oxygen.ts`, `sim/devils.ts`, `shared/test/movement.test.ts`, новый `shared/test/devils.test.ts`.
- **Что сделать:** `sandAt(x, y, salt)` — нижний уровень плюс вторая волна шума > `SAND.threshold`. `terrainMul` (песок, вихрь) — одна функция для скорости на клиенте и сервере и для расхода O2. Вихри: рождение `spawnDevil`, плавное блуждание (поворот вектора скорости синусом от времени), отскок от краёв, исчезновение по `until`. Только днём (`light ≥ DEVIL.minLight`). Вихрь над кораблём при поломке `panel_dust` → `clearFault` и эффект `panel_clean` (так ветер чистил панели Spirit и Opportunity).
- **Тесты:** песок медленнее и дороже; клиентская и серверная скорость совпадают для одного состояния; вихрь движется детерминированно и исчезает; внутри вихря медленнее и дороже; вихрь над кораблём чистит панели; ночью вихрей нет; free не затронут.
- **Готово, когда:** `rs.send({t:'debug',cmd:'devil'})` → вихрь идёт на тебя, уйти можно, попал — чувствуешь.

### B7. Визуал поля v2 — 70 мин

- **Спецификация:** PL 10.1, 12; ассеты — `assets.md`.
- **Файлы:** `client/src/game/**` (новые `HazardLayer.ts`, `PortLayer.ts`), `render/terrainPaint.ts`.
- **Что сделать:** вихри (столб частиц, вращение, спрайт `devil`); песок — рябь в текстуре мира ровно там, где `sandAt`; четыре люка на корабле, мигание нужного и кольцо прогресса ремонта; анимация установки станции; вспышка — оттенок неба и слабое зелёное сияние ночью (Perseverance снял видимое сияние с поверхности Марса); буря — частицы и мутность; дрожь экрана по расстоянию до эпицентра (выключается Reduce motion); обломки обвала; блёстки льда у кратера.
- **Готово, когда:** 30-секундная запись экрана тренировки выглядит как игра, а не прототип; FPS не ниже прежнего (`F3`).

### B8. Конструктор v2, часть 1 — 70 мин

- **Спецификация:** PL 6.11.
- **Файлы:** `screens/DesignScreen.tsx` → новая папка `screens/design/` (`LanderCutaway.tsx`, `ModuleCard.tsx`, `ChoiceCards.tsx`, `ResourceGauges.tsx`), `ui/design.css`, `i18n/en/design.ts`.
- **Что сделать:** карточки вместо выпадающих списков (цель, место, сложность, ракета, орбита) с иконками; разрез корабля с шестью отсеками — модуль встаёт в отсек при клике; шесть шкал ресурсов с анимированным заполнением и красной пульсацией при перегрузе; замечания «почему» рядом со шкалой. Сообщения и данные прежние.
- **Готово, когда:** собрать проект можно одной мышью, не читая таблиц; бюджет и масса «живут» при каждом клике.

### S2 — проверка (оба, 20 мин)

1. Миссия RED SIGNAL втроём (оператор + два астронавта), 8 минут: станции поставлены, сигнал найден и образец сдан, хотя бы одна поломка починена, кризис третьего акта пережит.
2. Плейтест 10 минут с человеком не из команды. Записать: где не понял, где скучал, где злился.
3. Включить `FEATURES.signalScenario`. Тег `demo-v2-2`.

---

## 8. Фаза 3 — смысл и зрелищность (2:45)

### A9. Отчётные данные v2 — 60 мин

- **Спецификация:** PL 8.
- **Файлы:** `sim/scoring.ts`, `sim/insights.ts`, новый `sim/awards.ts`, `engine/GameRoom.ts` (передать id оператора), `shared/test/report.test.ts` (только новые тесты), новый `shared/test/awards.test.ts`.
- **Что сделать:** хронология из `hidden.timeline`; награды (одна на игрока, по приоритету PL 8.4); новые выводы PL 8.2 и поле `fix` у старых и новых; разгадка; очки за находки, второстепенные задачи, пики, ремонты; штраф за дозу.
- **Тесты:** хронология не длиннее `REPORT.timelineMax` и по времени; у каждого игрока не больше одной награды; каждый новый вывод срабатывает только по своему условию; `fix` указывает на существующий модуль; во free старые ожидания не меняются.

### A10. Прогноз миссии — 45 мин

- **Спецификация:** PL 6.10.
- **Файлы:** `shared/src/design.ts` (или новый `forecast.ts`), новый `shared/test/forecast.test.ts`.
- **Что сделать:** чистая функция `forecastMission(design, scenario)`: 32 точки мощности и потребности (закат, батарея, РИТЭГ, вероятная буря), проекция запаса O2 при типичной работе экипажа, первая нехватка энергии, исчерпание запаса, дальность глубокого образца на одном баллоне, доля возврата данных. Класть в `check.forecast`.
- **Тесты:** РИТЭГ даёт ровную линию ночью; без батареи солнечные падают в ноль к закату; с батареей — не ниже 60%; большие баллоны увеличивают дальность; время считается по сценарию.

### A11. Пульт v2, часть 2 — 60 мин

- **Файлы:** `client/src/console/**`.
- **Что сделать:** лента «что впереди» на 2 минуты (окна спутника, закат, прогноз бури, вспышка, окно запуска); тающий таймер решения и тревожный тон; вихри, песок и зона сигнала на карте; LIFTOFF с подтверждением и списком, кто снаружи.

### A12. Боты v2 и прогон — 45 мин

- **Файлы:** `tools/bots.ts`, `tools/mission-soak.py` (или TS-версия).
- **Что сделать:** бот-оператор ставит пик пересечением колец (наименьшие квадраты), отправляет к люку; боты-астронавты ставят станции, идут к люку по метке, прячутся от вспышки. Прогон 10 миссий `signal` → сводка: успех, оценка, сколько найдено сигналов, сколько потеряно экипажа. Цифры — геймдизайнеру для баланса.

### B9. Экран отчёта v2 — 70 мин

- **Спецификация:** PL 8.
- **Файлы:** `screens/ReportScreen.tsx` → папка `screens/report/` (`Stamp.tsx`, `ScoreCount.tsx`, `Objectives.tsx`, `Timeline.tsx`, `Awards.tsx`, `Findings.tsx`, `Reveal.tsx`), `i18n/en/reportUi.ts`.
- **Что сделать:** штамп SUCCESS / FAILED с ударом и звуком `stamp`; очки набегают, оценка появляется последней; задачи с галочками; лента хронологии со значками; карточки наград; карточка разгадки RED SIGNAL; выводы со словом BECAUSE и чипом «Try: Drill». REDESIGN открывает конструктор с подсвеченной подсказкой.

### B10. Конструктор v2, часть 2 — 60 мин

- **Спецификация:** PL 6.10, 6.11.
- **Что сделать:** график прогноза (мощность и потребность, полосы ночи и бури, линия запаса O2) и три выноски («Power short at 6:10»); карточки мест с мини-картой рельефа (`levelAt` по сетке) и фактами места; подсветка подсказки из отчёта.

### B11. Заставки и поток — 50 мин

- **Что сделать:** посадка во время отсчёта T−5 (корабль опускается, пламя `lander_flame`, пыль, тряска, TOUCHDOWN); титры актов; оверлей «окно закрывается» с отсчётом; взлёт на 3 с перед отчётом (клиент задерживает смену экрана); заглавный экран с фоном `title_bg` (до появления арта — рельеф с ночным дизерингом).

### B12. «Сочность» — 50 мин

- **Спецификация:** PL 10.1.
- **Что сделать:** «+32» над образцом, счётчик сдачи, вспышка и звук находки, дыхание в шлеме, сердце и запотевание при O2 < 25%, звуки интерфейса, приглушение музыки при тревоге, музыка по напряжению. Всё уважает Reduce motion и Mute.

### S3 — проверка (оба, 20 мин)

Полный путь: лобби → конструктор с прогнозом → RED SIGNAL → взлёт → отчёт со штампом, хронологией,
наградами и разгадкой → REDESIGN с подсказкой → полёт снова. Соло и онлайн. Замер FPS (`F3`) на самом
слабом ноутбуке команды. Тег `demo-v2-3`.

---

## 9. Фаза 4 — баланс, плейтест, заморозка (1:30)

| Кто | Что |
|---|---|
| A | Числа по плейтестам (раздел 12) и прогону ботов (A12): квоты, промежутки режиссёра, кислород, `scienceFull`. Цель: первая попытка новичков — C или B, третья — A |
| B | Исправления по плейтестам, проверка в Firefox и на слабом ноутбуке, видео 30 секунд из тренировки с английскими субтитрами и пометкой AI-generated |
| Оба | Деплой (`render.yaml`) и проверка с двух сетей; GitHub Pages для соло; `README.md` (Use of AI); тег `demo-stable-final` |

**После заморозки — только исправления.** Показываем последний тег `demo-stable-*`.

---

## 10. Если останется время (по порядку)

1. **Разведдрон** (как Ingenuity, A + B): модуль `scout_drone`; оператор посылает дрон к аномалии, тот открывает участки рядом; 3 полёта, только днём и без бури. Ассеты `drone`, `drone_shadow`, `icon_scout_drone` уже в манифесте.
2. **Заявки дисциплин** в конструкторе (A + B): у каждого игрока своя тайная просьба («нужен бур», «возврат данных ≥ 100%»); выполненные — к Teamwork. Это прямо «negotiate between competing priorities» из кейса.
3. **Перегрев бура** (B): держишь — греется, перегрел — заклинило на 2 с. Копание становится навыком.
4. **Тащить товарища** (B): удерживать E у лежащего — тащишь его к шлюзу вдвое медленнее.
5. **Код миссии в ссылке** и таблица рекордов на одном seed (A).
6. **Русский и казахский языки** (B + контент): словари `i18n/ru/`, `i18n/kk/` и переключатель.

## 11. Что резать первым

Отстаёте — режьте в этом порядке (сверху — первым):
раздел 10 → A12 боты v2 → B11 заставки → награды в A9/B9 → A8 вспышка (кризис третьего акта — только буря) →
вихри в B6 → песок в B6 → B5 (станции ставятся автоматически, как во free) → A7 поломки.

**Не резать:** P0, A1 (тренировка), A2, A3, B1, B2, B3, A5, A6 (сигнал — это название игры), B8,
штамп, задачи и выводы в отчёте, прогноз в конструкторе.

---

## 12. Задачи контент-команды

Делают параллельно, код не трогают.

| Кто | Что | Куда |
|---|---|---|
| Геймдизайнер | Тексты всех битов тренировки и сигнала, брифинги, титры актов, тексты задач, наград, подсказок. Английский, коротко: одна строка на экран | `client/src/i18n/en/story.ts` (ключи заводит A1) |
| Геймдизайнер | Плейтесты после S2 и S3: таблица «минута — что понятно / непонятно / скучно» | `docs/content/playtests.md` |
| Научный ответственный | Ссылки nasa.gov на новые факты PL 13.1 (песок Spirit, вихри и чистка панелей, Ingenuity, RAD и вспышка мая 2024, сияние, HiRISE, Cerberus Fossae, InSight и S–P). Текст разгадки RED SIGNAL на три места | `docs/REFERENCES.md`, `docs/content/facts.md` |
| Научный ответственный | Скачать звуки NASA (ветер и пылевой вихрь Perseverance, озвученные толчки InSight), проверить правила использования | `client/public/assets/audio/music/amb_mars_wind.ogg`, `sfx/devil_loop.ogg` |
| Художник | Ассеты по `assets.md`: сначала астронавт, корабль, участки, иконки модулей, затем v2 (вихрь, люки, разрез корабля, штамп) | `client/public/assets/sprites/` |
| Звук | Эффекты и музыка по `assets.md` | `client/public/assets/audio/` |
| Спикер | Сценарий защиты на 5 минут вокруг тренировки, 7 слайдов, текст формы сдачи | презентация, `docs/content/pitch.md` |

## 13. Как ставить задачу ИИ-ассистенту

```
Прочитай AGENTS.md, docs/architecture.md, docs/product-logic.md и docs/phases.md.
Выполни задачу A3 из docs/phases.md. Меняй только файлы, перечисленные в задаче.
Сначала напиши тесты из списка задачи и убедись, что они падают; потом реализуй.
Free mission не должна поменять поведение: старые тесты не трогать.
В конце запусти npm run check и покажи вывод.
Не меняй package.json, types.ts, protocol.ts, step.ts, index.ts (кроме фазы 0 у A).
```

После ответа ассистента **самому** запустить `npm run check` и пройти «Готово, когда» руками.

**Перед мержем:** `npm run check` зелёный · Free mission проходится · соло проходится · нет текста в коде мимо
`i18n` · нет чисел мимо `balance.ts` и сценариев · файлы до ~300 строк · PR маленький.

## 14. Чек-лист «v2 готова»

- [ ] Тренировка 4:00 проходится соло новичком без объяснений.
- [ ] RED SIGNAL 8:00 проходится вдвоём, втроём и вчетвером; источник можно вычислить и найти.
- [ ] Оператор занят всю миссию: события, пики, сигнал, поломки, энергия, метки.
- [ ] Каждую минуту что-то происходит; три акта ощущаются.
- [ ] Конструктор собирается мышью; шесть ресурсов видны; прогноз объясняет, что будет.
- [ ] Отчёт: штамп, задачи, хронология, выводы с подсказкой, разгадка; REDESIGN ведёт к подсказке.
- [ ] Отсутствие любого ассета не ломает игру; `npm test` проверяет размеры и имена ассетов.
- [ ] Free mission и все старые тесты работают как раньше.
- [ ] Публичная ссылка с двух сетей; соло на GitHub Pages.
- [ ] Видео 30 с, 7 слайдов, «Use of AI», пометка AI-generated, тег `demo-stable-final`.
