# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository

Lumina — open-source MLOps platform rebased from WandB, designed for self-hosting. Monorepo managed by pnpm workspaces and Turbo. Default branch: `main`. Feature branch in use: `feat/lumina-ui`.

```
lumina-mono/
├── apps/
│   ├── server/       Fastify backend (TypeScript, ESM)
│   └── dashboard/    Vue 3 + Vite web dashboard
├── packages/
│   ├── lumina-ui/    Internal UI component library (Vue 3, GridStack, ECharts)
│   └── shared/       Shared types/schemas (currently zod-based, near-empty)
├── python/lumina/    Python SDK (rebased from WandB; pip-installable)
├── examples/         SDK usage examples, one per feature
├── lumina-design/    Design language research (tokens, mobile-first, widgets)
└── docs/             Architecture notes, iteration goals, gap analyses
```

Prereqs: Node 20+, pnpm 9, Python 3.9+, Docker (for Postgres/MinIO/ClickHouse/Redis).

## Commands

All root-level scripts dispatch through Turbo to individual workspaces.

```bash
pnpm install                                    # install monorepo deps
pnpm dev                                        # run all dev servers in parallel
pnpm build                                      # build all workspaces
pnpm test                                       # run all tests
pnpm lint                                       # lint all workspaces
pnpm typecheck                                  # typecheck all workspaces
pnpm clean                                      # clean all build outputs + node_modules

# Single workspace
pnpm --filter @lumina/server dev
pnpm --filter @lumina/server build
pnpm --filter @lumina/server test               # vitest run
pnpm --filter @lumina/server typecheck          # tsc --noEmit
pnpm --filter @lumina/server lint
pnpm --filter @lumina/dashboard dev            # vite dev server
pnpm --filter @lumina/dashboard test           # vitest
pnpm --filter @lumina/dashboard typecheck      # vue-tsc --noEmit
pnpm --filter @lumina/ui build
pnpm --filter @lumina/ui test

# Database
docker compose up postgres -d                  # start just Postgres
pnpm --filter @lumina/server db:migrate        # prisma migrate dev
pnpm --filter @lumina/server db:generate       # prisma generate
pnpm --filter @lumina/server db:studio         # prisma studio

# Python SDK
cd python/lumina && pip install -e .            # editable install
cd python/lumina && pytest                      # if tests exist

# Full stack via Docker (db + minio + clickhouse + redis + server + dashboard)
docker compose up
```

Single-test invocation patterns:

```bash
pnpm --filter @lumina/server test -- pattern    # vitest -t
pnpm --filter @lumina/dashboard test -- path/to/file.spec.ts
```

## Backend (`apps/server`)

Fastify on Node 20, ESM, TypeScript, Prisma. Entry points:

- `src/index.ts` — HTTP API (`buildApp` → `app.listen`)
- `src/worker.ts` — separate process for BullMQ jobs + event-bus subscribers
- `src/bootstrap.ts` — shared `buildApp` factory

### Plugin bootstrap order (in `src/bootstrap.ts`)

1. **Config** (`plugins/config.ts`) — Zod-validated env (`loadConfig` in `config/index.ts`)
2. **Core infra** — `prismaPlugin`, `clickhousePlugin`, `storagePlugin`, `telemetryPlugin`, `busPlugin`, `cachePlugin`, `queuePlugin`
3. **Cross-cutting** — `authPlugin`, `observabilityPlugin`, `websocketPlugin`
4. **Business modules** — all registered with `/api/v1` prefix
5. Default workspace seed (`workspaceId = "default"`)

Each module under `src/modules/<name>/` follows the same shape:

```
routes.ts        Fastify route registration, wires Service + Handler
handler.ts       HTTP boundary: parses Zod schema, calls Service
service.ts       Business logic + publishes DomainEvents
repository.ts    Prisma queries
schema.ts        Zod input/response schemas
```

When adding a new endpoint, follow this pattern and publish a `DomainEvent` from `src/core/events/domain-event.ts` if any subscriber (websocket, worker, etc.) needs to react.

### Pluggable infrastructure

Core interfaces live in `src/core/`:

| Interface           | Implementations                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------- |
| `MetricStorage`     | `infra/prisma/prisma-metric-storage.ts`, `infra/clickhouse/clickhouse-metric-storage.ts`         |
| `TimeSeriesStorage` | `infra/prisma/prisma-time-series-storage.ts`, `infra/clickhouse/clickhouse-time-series-storage.ts` |
| `ObjectStorage`     | `infra/storage/local.ts`, `infra/storage/s3.ts` (S3-compatible: MinIO or AWS)                     |
| `EventBus`          | `infra/memory/memory-event-bus.ts`, `infra/redis/redis-event-bus.ts`                              |
| `Cache`             | `infra/noop/noop-cache.ts`, `infra/redis/redis-cache.ts`                                          |
| `Queue`             | `infra/noop/noop-queue.ts`, `infra/bullmq/bullmq-queue.ts`                                        |
| `Telemetry`         | `infra/prometheus/prometheus-telemetry.ts`                                                         |

Plugins in `src/plugins/` select implementations based on `app.config` (e.g., Redis-backed queue only when `REDIS_URL` is set; otherwise `NoopQueue`). New infrastructure integrations should add an `infra/<name>/` implementation and wire selection into the relevant plugin.

### Domain events + workers

- Event types: `MetricLogged`, `RunCreated`, `RunFinished`, `ArtifactUploaded` (see `src/core/events/domain-event.ts`).
- Job types: `metric.logged`, `run.finished`, `artifact.uploaded` (`src/jobs/types.ts`).
- Processors implement `JobProcessor` and are registered in `src/jobs/registry.ts`.
- BullMQ worker (`src/jobs/worker.ts`) is started only when `REDIS_URL` is set, in the separate `worker.ts` process.
- WebSocket plugin broadcasts domain events to `run:<runId>` / `project:<projectId>` channels.

### Prisma

- Schema: `apps/server/prisma/schema.prisma` — Postgres, models include `User`, `Workspace`, `Project`, `Run`, `Metric`, `SystemMetric`, `LogLine`, `Tag`, `Artifact`, `ArtifactVersion`, `ArtifactFile`, `Sweep`, `RegistryModel`, `RegistryModelVersion`, `Evaluation`, `EvaluationResult`, `Trace`, `Span`, `Report`, `RunMedia`, `LaunchQueue`, `LaunchJob`, `LaunchRun`, `WorkspaceMembership`.
- `Run.runId` is a UUID v7 — generated server-side, globally unique, stable across regions.
- Generated client lives in `src/generated/prisma/` (gitignored — run `db:generate` after schema changes).

### Storage configuration

`STORAGE_TYPE` selects `local` (filesystem under `./uploads`) vs `s3` (presigned URLs against MinIO/real S3). `infra/storage/routes.ts` exposes local download endpoints; for S3, the SDK receives presigned URLs directly.

## Dashboard (`apps/dashboard`)

Vue 3 + Vite + TypeScript, Pinia, TanStack Vue Query, vue-router, Tailwind v4, ECharts (via `vue-echarts`). `@lumina/ui` and `@lumina/shared` are workspace deps.

- `src/main.ts` mounts the app, registers `@lumina/ui/dist/style.css` globally, calls `registerWidgets(...)` from `src/widgets/registry.ts`.
- Routing is in `src/app/router.ts` — all routes are children of `AppLayout`. Routes are lazy-loaded.
- API client: `src/services/api.ts` (`fetchApi`). Reads `VITE_LUMINA_API_URL` and `VITE_LUMINA_API_KEY` from env.
- Per-resource services in `src/services/*.service.ts`. TanStack Vue Query composables in `src/modules/<name>/composables/use*.ts`.
- Workspace layout: `src/layouts/AppLayout.vue` uses `LSidebar`/`LSidebarItem`/`LBreadcrumb` from `@lumina/ui`.

### Widget system

`apps/dashboard/src/widgets/` is the dashboard-specific widget layer that sits on top of the framework in `packages/lumina-ui/src/widgets/`. Each widget folder exports a `.vue` component registered in `widgets/registry.ts`:

```ts
registerWidgets([
  { type: "metric-chart", name: "Metric Chart", component: MetricChartWidget, defaultSize: { w: 12, h: 5 } },
]);
```

`WorkspaceOverview.vue` is JSON-driven; layouts use `DashboardLayout` from `@lumina/ui/widgets`. `GridStackLayout.vue` provides drag/resize (handle class: `.widget-drag-handle`); `GridLayout.vue` is the static variant.

## `@lumina/ui` (`packages/lumina-ui`)

Internal Vue 3 component library. Published as bundled dist (`vue-tsc --noEmit && vite build && vue-tsc -p tsconfig.build.json`).

Structure:

```
src/
├── primitives/   LButton, LCard, LSidebar, LSidebarItem, LBreadcrumb, LTag, LTabs, LSelect, LStatusBadge, LStatistic, LSkeleton, LPagination, LResult, LEmpty, LIconButton
├── chart/        ChartRenderer (declarative), adapters/echarts.ts, theme.ts, types.ts — see lumina-design/chart-language.md
├── widgets/      GridLayout, GridStackLayout, WidgetRenderer, registry, types
└── theme/        tokens + theme.css (LDL design tokens; mobile-first)
```

Peer deps: `vue@^3.4`, `vue-router@^4.4`, `echarts@^5.5`, `vue-echarts@^6.7`. Also pulls `naive-ui` and `gridstack` internally.

## `@lumina/shared`

Reserved for cross-workspace types and Zod schemas. Currently a near-empty placeholder; new shared types should live here.

## Python SDK (`python/lumina`)

Rebased from WandB (`LICENSE.wandb` retains Apache 2.0 attribution). Build backend: hatchling. `pyproject.toml` declares the `lumina` package and the `lumina` CLI entrypoint.

### Lumina backend path

When `LUMINA_API_URL` is set (or `lumina.init()` is called with `project=...`), the SDK takes the **Lumina backend path** and bypasses the WandB cloud integration. Key modules under `python/lumina/lumina/backend/`:

```
client.py        LuminaClient — thin HTTP client (urllib, no extra deps)
run.py           LuminaRun — mirrors wandb.sdk.wandb_run.Run public surface
run_context.py   Thread/process-local active-run context
artifact.py      LuminaArtifact, use_lumina_artifact
model_registry.py log_model / use_model / link_model
evaluation.py    init_eval / log_eval_result / finish_eval
trace.py         trace / span / start_trace / finish_trace / start_span / finish_span
report.py        LuminaReport
media.py         LuminaTable, log_media, media-value detection
launch.py        launch / launch_agent (queues)
sweep.py         sweep / agent
```

`lumina.init(...)`, `lumina.log(...)`, `lumina.finish()`, etc. (`lumina/__init__.py`) dispatch to either Lumina backend code or the original WandB SDK depending on env. Top-level helpers (`lumina.log`, `lumina.summary`, ...) are rebound to the active run via `lumina.sdk.lib.module.set_global` to match WandB semantics.

When modifying the SDK, prefer extending `lumina/backend/` modules over touching WandB-derived code (`lumina/sdk/`, `lumina/apis/`), unless the change is a WandB-compatible bug fix.

## Design system (`lumina-design/`)

Research-driven design language (LDL). Phases per `How-To-Design.md`. Current state: Phase 1 (Foundation tokens). Important conventions:

- **Mobile-first** (`mobile-first.md`): base components must work on touch devices — 44×44px min hit targets, `pointer: coarse` media queries, mobile-first breakpoint utility classes, no hover as primary interaction.
- **Widget system** (`widget-system.md`): dashboards are JSON-driven, not hardcoded pages.
- **Chart language** (`chart-language.md`): `ChartConfig` is renderer-agnostic; ECharts adapter lives at `@lumina/ui/src/chart/adapters/echarts.ts`. Auto-downsamples (LTTB) past `samplingThreshold` and progressive render past `largeThreshold`.

## Conventions

- Server modules: handler validates with Zod, service publishes domain events, repository owns DB. Never reach into Prisma from handlers.
- New domain events: extend `KnownDomainEvent` in `src/core/events/domain-event.ts` and add a matching entry in `src/jobs/types.ts` if a durable job is needed.
- Workspace: every project belongs to a workspace. The seed bootstrap creates `workspaceId="default"` if missing; new code should not hardcode this — accept it via env or membership.
- Run IDs: always `run.runId` (UUID v7), not the internal `Run.id` PK. The internal PK is opaque.
- API style: REST under `/api/v1`, JSON, mutating endpoints accept `Authorization: Bearer <apiKey>`. The dashboard reads `VITE_LUMINA_API_KEY` to attach it client-side.
- Frontend data fetching: TanStack Vue Query in `composables/use*.ts`. Services in `services/*.service.ts` are plain functions that call `fetchApi`.
- Widget additions: register in `apps/dashboard/src/widgets/registry.ts`, never inside page components.
- Build outputs are gitignored (`dist/`, `src/generated/`, `.turbo/`, `uploads/`). `pnpm clean` + reinstall is the canonical reset.

## Documentation references

- `docs/MasterPlan.md` — feature progress against WandB parity (P0/P1 checklist)
- `docs/DataModel.md` — Prisma schema notes
- `docs/服务端架构.md`, `docs/服务端架构Gap.md` — backend architecture and remaining gaps
- `docs/前端架构.md` — frontend architecture
- `docs/服务端SDK-Wandb能力Gap.md` — server+SDK feature parity gaps vs WandB
- `lumina-design/How-To-Design.md` — design system phases