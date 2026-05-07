import type { IStorage } from '@agent-harness/core/storage/types';

export async function ensureOntologyIngestSchema(storage: IStorage): Promise<void> {
  await storage.execute(`CREATE TABLE IF NOT EXISTS ontology_ingest_jobs (
      jobId TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      createdAt DATETIME NOT NULL,
      startedAt DATETIME,
      finishedAt DATETIME,
      source TEXT NOT NULL,
      summary TEXT
    );`);

  await storage.execute(`CREATE TABLE IF NOT EXISTS ontology_ingest_reports (
      jobId TEXT PRIMARY KEY,
      dryRun INTEGER NOT NULL,
      summary TEXT NOT NULL,
      diagnostics TEXT NOT NULL,
      sampleObjects TEXT NOT NULL,
      FOREIGN KEY (jobId) REFERENCES ontology_ingest_jobs(jobId)
    );`);
}
