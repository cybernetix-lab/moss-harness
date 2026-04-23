# MossClaw Shared

This directory contains code shared by `apps/mossclaw/web` and `apps/mossclaw/server`.

Current contents:

- `src/tasks.ts`: shared task DTOs built around `goal/config/stages/artifacts/events/metrics`
- `src/skills.ts`: shared skill DTOs
- `src/agents.ts`: shared agent DTOs
- `src/index.ts`: barrel export for shared consumers

Planned next steps:

- expand request/response DTO coverage as the web app grows
- add shared domain types only when they are used by both sides
- add a generated or hand-written API client when the web app starts consuming the shared contracts directly
