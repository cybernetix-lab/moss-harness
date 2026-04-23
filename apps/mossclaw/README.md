# MossClaw

MossClaw is organized as a product directory with separate app packages:

- `web/`: Vite + React frontend
- `server/`: Express + Socket.IO backend
- `shared/`: shared DTO contracts consumed by both `server/` and `web/`

Current shared contract entrypoints:

- `shared/src/tasks.ts`: task request/response DTOs using `goal/config/stages/artifacts/events/metrics`
- `shared/src/skills.ts`: skill API DTOs
- `shared/src/agents.ts`: agent API DTOs
- `shared/src/index.ts`: barrel export for shared consumers

Current MVP delivery boundary:

- Included: dashboard, task create, task execution, task detail, skills marketplace
- Routes: `/`, `/tasks/new`, `/tasks/:id/run`, `/tasks/:id`, `/skills`
- Task control API: `POST /api/tasks/:id/control` with `action: "retry"`
- Deferred: auth, memory management, sandbox explorer, team management, settings
