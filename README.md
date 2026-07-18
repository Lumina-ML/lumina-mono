# Lumina

> Open-source MLOps platform. Rebased from WandB, built for self-hosting.

## Status

MVP V1 in progress. Current end-to-end flow works:

```bash
# Terminal 1: start backend + database
docker compose up

# Terminal 2: log metrics from Python
LUMINA_API_URL=http://localhost:8000 python -c "
import lumina
lumina.init(project='demo', name='exp-001', config={'lr': 0.01})
lumina.log({'loss': 0.9, 'acc': 0.1}, step=0)
lumina.finish()
"

# Open dashboard
open http://localhost:3000
```

## Architecture

- `apps/server` - Fastify backend API (Run + Metric modules)
- `apps/dashboard` - Web dashboard (placeholder HTML, Vue 3 in Week 5)
- `packages/shared` - Shared TypeScript types and schemas
- `packages/lumina-ui` - Internal UI component library
- `python/lumina` - Python SDK, rebased from WandB

## Quick Start

### Prerequisites

- Docker + Docker Compose
- Node.js 20 + pnpm 9
- Python 3.9+

### One-command start

```bash
docker compose up
```

Services:

| Service | Port | Description |
|---------|------|-------------|
| Dashboard | 3000 | Web UI |
| Server API | 8000 | REST API |
| Postgres | 15432 | Database (mapped to avoid local Postgres conflict) |

### Development

```bash
# Install monorepo dependencies
pnpm install

# Start Postgres
docker compose up postgres -d

# Run migrations (Postgres must be running)
pnpm --filter @lumina/server db:migrate

# Start backend
pnpm --filter @lumina/server dev

# Install Python SDK
cd python/lumina && pip install -e .
```

## SDK Usage

```python
import lumina

lumina.init(project="demo", name="exp-001", config={"lr": 0.01})
for i in range(10):
    lumina.log({"loss": 1.0 / (i + 1), "acc": i / 10.0}, step=i)
lumina.finish()
```

When `LUMINA_API_URL` is set, the SDK uses the Lumina backend. Otherwise it falls back to WandB-compatible behavior.

## API

- `POST /api/v1/runs` - Create a run
- `GET /api/v1/runs` - List runs
- `GET /api/v1/runs/:id` - Get a run
- `PATCH /api/v1/runs/:id` - Update run status
- `POST /api/v1/runs/:id/metrics` - Log metrics
- `GET /api/v1/runs/:id/metrics` - Get metrics

## License

See [LICENSE](./LICENSE). The Python SDK is based on WandB and retains its Apache 2.0 license terms in `python/lumina/LICENSE.wandb`.
