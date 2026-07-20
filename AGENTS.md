# AGENTS.md — Lumina Mono

Agent working notes for the `lumina-mono` repository.

## Project

Lumina — open-source MLOps platform rebased from WandB, built for self-hosting.

- **Default branch**: `main`
- **Current feature branch**: `feat/wandb_benchmark`
- **Monorepo**: pnpm workspaces + Turbo
- **Stack**: Fastify (TS/ESM) + Vue 3 + Python SDK + Postgres/ClickHouse/Redis/MinIO

## Quick commands

```bash
# Install / reset
pnpm install
pnpm clean          # removes build outputs + node_modules

# Dev / build / test
pnpm dev            # all dev servers
pnpm build
pnpm test
pnpm lint
pnpm typecheck

# Single workspace
pnpm --filter @lumina/server dev
pnpm --filter @lumina/server test
pnpm --filter @lumina/server db:migrate
pnpm --filter @lumina/dashboard dev
pnpm --filter @lumina/ui build

# Full stack
docker compose up

# Benchmarks
cd python/lumina
uv run python ../../benchmarks/scenario_runner.py --mode real --level S
```

## Repository layout

```
apps/server/        Fastify backend, Prisma, modular domain design
apps/dashboard/     Vue 3 + Vite dashboard, Pinia, TanStack Query
packages/lumina-ui/ Internal Vue component library
packages/shared/    Placeholder for shared types/schemas
python/lumina/      Python SDK (rebased from WandB)
benchmarks/         WandB scenario benchmark suite
examples/           One SDK example per feature
docs/               Architecture and iteration docs
lumina-design/      Design language research
```

## Conventions

### Backend (`apps/server`)

- Module shape: `routes.ts` → `handler.ts` → `service.ts` → `repository.ts` + `schema.ts`.
- Handlers validate with Zod; services publish `DomainEvent`s; repositories own DB access.
- New endpoints go under `/api/v1`.
- Plugin order matters: see `src/bootstrap.ts` comments.
- Workspace is resolved via `X-Lumina-Workspace` header after auth. Don't hardcode `"default"`.

### Frontend (`apps/dashboard`)

- Use `@lumina/ui` primitives. Don't self-write button/input/card/popover in dashboard code.
- Data fetching: TanStack Vue Query composables in `src/modules/<name>/composables/use*.ts`.
- API calls: plain service functions in `src/services/*.service.ts` calling `fetchApi`.
- Widgets register in `src/widgets/registry.ts`.

### Python SDK (`python/lumina`)

- Prefer extending `lumina/backend/` over modifying WandB-derived `lumina/sdk/` or `lumina/apis/`.
- `LuminaClient` sends `X-Lumina-Workspace` header when `workspace_id` is set.

## Current priorities (2026-07-21)

1. **Productization**: front-end fully owns WandB-equivalent views (charts, traces, reports, artifacts, sweeps, launch, evals).
2. **Service architecture optimization**: metric/trace throughput, ClickHouse query paths, Redis queue reliability.
3. **WandB scenario benchmark**: 23 scenarios implemented; next is M/L/XL sizing and fixing known skips/gaps.

## Known gaps

- ClickHouse trace detail authz (`/traces/:traceId/spans`) still hits Prisma in `workspaceGuardPlugin`; needs `traceStorage` integration.
- S3 presigned URLs in local docker use internal `minio:9000` hostname, so artifact/media/model-registry benchmarks skip from the host.
- `SW-1` sweep `best_run_recorded` assertion is currently false.
- API key still stored in `localStorage`; HttpOnly cookie redesign is in `docs/Design-Multiworkspace-Cookie-Auth.md`.

## Docs map

- `CLAUDE.md` — detailed codebase guide
- `docs/Next-Steps.md` — verified execution snapshot and next steps
- `docs/MasterPlan.md` — WandB parity checklist
- `docs/Design-Multiworkspace-Cookie-Auth.md` — auth redesign
- `benchmarks/Wandb-Scenario-Benchmark.md` — benchmark matrix
- `lumina-design/How-To-Design.md` — design system

## License

See `LICENSE`. Python SDK retains WandB Apache 2.0 terms in `python/lumina/LICENSE.wandb`.
