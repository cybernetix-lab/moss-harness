import type { IStorage } from '@agent-harness/core/storage/types';
import type {
  IOntologyIngestJobRepository,
  OntologyIngestJob,
  OntologyIngestReport
} from '../../domain/repositories/IOntologyIngestJobRepository';

type StorageRow = Record<string, unknown>;

export { type OntologyIngestJob, type OntologyIngestReport } from '../../domain/repositories/IOntologyIngestJobRepository';

export class UnifiedOntologyIngestJobRepository implements IOntologyIngestJobRepository {
  private readonly jobsTableName = 'ontology_ingest_jobs';
  private readonly reportsTableName = 'ontology_ingest_reports';

  constructor(private readonly storage: IStorage) {}

  async createJob(job: OntologyIngestJob): Promise<void> {
    await this.storage.query(this.jobsTableName).insert({
      jobId: job.jobId,
      status: job.status,
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt?.toISOString(),
      finishedAt: job.finishedAt?.toISOString(),
      source: JSON.stringify(job.source),
      summary: job.summary ? JSON.stringify(job.summary) : null
    });
  }

  async updateJob(job: OntologyIngestJob): Promise<void> {
    await this.storage.query(this.jobsTableName).where('jobId', '=', job.jobId).update({
      status: job.status,
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt?.toISOString(),
      finishedAt: job.finishedAt?.toISOString(),
      source: JSON.stringify(job.source),
      summary: job.summary ? JSON.stringify(job.summary) : null
    });
  }

  async saveReport(jobId: string, report: OntologyIngestReport): Promise<void> {
    const exists = await this.storage.query(this.reportsTableName).where('jobId', '=', jobId).exists();

    const payload = {
      jobId,
      dryRun: report.dryRun ? 1 : 0,
      summary: JSON.stringify(report.summary),
      diagnostics: JSON.stringify(report.diagnostics),
      sampleObjects: JSON.stringify(report.sampleObjects)
    };

    if (exists) {
      await this.storage.query(this.reportsTableName).where('jobId', '=', jobId).update(payload);
      return;
    }

    await this.storage.query(this.reportsTableName).insert(payload);
  }

  async getJobById(jobId: string): Promise<OntologyIngestJob | null> {
    const row = await this.storage.query(this.jobsTableName).where('jobId', '=', jobId).first();
    if (!row) {
      return null;
    }

    return this.mapToJob(row);
  }

  async getReportByJobId(jobId: string): Promise<OntologyIngestReport | null> {
    const row = await this.storage.query(this.reportsTableName).where('jobId', '=', jobId).first();
    if (!row) {
      return null;
    }

    return this.mapToReport(row);
  }

  private mapToJob(row: StorageRow): OntologyIngestJob {
    return {
      jobId: String(row.jobId),
      status: row.status as OntologyIngestJob['status'],
      createdAt: new Date(String(row.createdAt)),
      startedAt: row.startedAt ? new Date(String(row.startedAt)) : undefined,
      finishedAt: row.finishedAt ? new Date(String(row.finishedAt)) : undefined,
      source: this.parseJson<OntologyIngestJob['source']>(row.source, {
        kind: 'json'
      }),
      summary: this.parseJson<OntologyIngestJob['summary'] | undefined>(row.summary, undefined)
    };
  }

  private mapToReport(row: StorageRow): OntologyIngestReport {
    return {
      jobId: String(row.jobId),
      dryRun: Number(row.dryRun) === 1,
      summary: this.parseJson<OntologyIngestReport['summary']>(row.summary, {
        totalRecords: 0,
        acceptedRecords: 0,
        rejectedRecords: 0,
        createdObjects: 0,
        updatedObjects: 0,
        skippedObjects: 0
      }),
      diagnostics: this.parseJson<OntologyIngestReport['diagnostics']>(row.diagnostics, []),
      sampleObjects: this.parseJson<OntologyIngestReport['sampleObjects']>(row.sampleObjects, [])
    };
  }

  private parseJson<T>(value: unknown, fallback: T): T {
    if (value == null || value === '') {
      return fallback;
    }

    if (typeof value !== 'string') {
      return value as T;
    }

    return JSON.parse(value) as T;
  }
}
