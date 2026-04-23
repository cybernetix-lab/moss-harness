import type { IStorage } from '@agent-harness/core/storage/types';

async function ensureColumn(
  storage: IStorage,
  table: string,
  column: string,
  definition: string
) {
  try {
    await storage.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  } catch (error: unknown) {
    const message = String((error as { message?: string })?.message ?? '');
    if (!message.includes('duplicate column name')) {
      throw error;
    }
  }
}

export async function ensureTaskTableShape(storage: IStorage): Promise<void> {
  await storage.execute(`CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      goal TEXT NOT NULL,
      config TEXT NOT NULL DEFAULT '{}',
      stages TEXT NOT NULL DEFAULT '[]',
      artifacts TEXT NOT NULL DEFAULT '[]',
      events TEXT NOT NULL DEFAULT '[]',
      metrics TEXT NOT NULL DEFAULT '{}',
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL
    );`);

  await ensureColumn(storage, 'tasks', 'goal', 'TEXT');
  await ensureColumn(storage, 'tasks', 'config', `TEXT NOT NULL DEFAULT '{}'`);
  await ensureColumn(storage, 'tasks', 'stages', `TEXT NOT NULL DEFAULT '[]'`);
  await ensureColumn(storage, 'tasks', 'artifacts', `TEXT NOT NULL DEFAULT '[]'`);
  await ensureColumn(storage, 'tasks', 'events', `TEXT NOT NULL DEFAULT '[]'`);
  await ensureColumn(storage, 'tasks', 'metrics', `TEXT NOT NULL DEFAULT '{}'`);

  await storage.execute(`UPDATE tasks
    SET
      goal = COALESCE(NULLIF(goal, ''), NULLIF(description, ''), NULLIF(name, ''), ''),
      config = CASE
        WHEN config IS NULL OR config = '' OR config = '{}'
          THEN '{"entryAgentName":"' || COALESCE(NULLIF(agentId, ''), 'planner') || '"}'
        ELSE config
      END,
      stages = COALESCE(NULLIF(stages, ''), '[]'),
      artifacts = COALESCE(NULLIF(artifacts, ''), '[]'),
      events = COALESCE(NULLIF(events, ''), '[]'),
      metrics = COALESCE(NULLIF(metrics, ''), '{}')
    WHERE
      goal IS NULL
      OR goal = ''
      OR config IS NULL
      OR config = ''
      OR config = '{}'
      OR stages IS NULL
      OR stages = ''
      OR artifacts IS NULL
      OR artifacts = ''
      OR events IS NULL
      OR events = ''
      OR metrics IS NULL
      OR metrics = '{}'`);
}
