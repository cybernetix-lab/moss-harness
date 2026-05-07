import type { IStorage } from '@agent-harness/core/storage/types';

export async function ensureWorkflowRunTableShape(storage: IStorage): Promise<void> {
  await storage.execute(`
    CREATE TABLE IF NOT EXISTS workflow_runs (
      runId TEXT PRIMARY KEY,
      workflowId TEXT NOT NULL,
      workflowVersion TEXT NOT NULL,
      status TEXT NOT NULL,
      definitionSnapshot TEXT NOT NULL,
      stateSnapshot TEXT NOT NULL DEFAULT '{}',
      startedAt DATETIME NULL,
      completedAt DATETIME NULL,
      failureCode TEXT NULL,
      failureMessage TEXT NULL,
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL
    );
  `);

  await storage.execute(`
    CREATE TABLE IF NOT EXISTS workflow_execution_logs (
      logId TEXT PRIMARY KEY,
      runId TEXT NOT NULL,
      nodeId TEXT NULL,
      eventType TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      createdAt DATETIME NOT NULL,
      FOREIGN KEY (runId) REFERENCES workflow_runs(runId)
    );
  `);
}
