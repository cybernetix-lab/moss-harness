export interface OntologyIngestJob {
  jobId: string;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
  source: {
    kind: 'json' | 'csv' | 'api' | 'rdf';
    uri?: string;
    contentType?: string;
    payload?: Record<string, unknown>;
    records?: Record<string, unknown>[];
  };
  summary?: {
    totalRecords: number;
    acceptedRecords: number;
    rejectedRecords: number;
    createdObjects: number;
    updatedObjects: number;
    skippedObjects: number;
  };
}

export interface OntologyIngestReport {
  jobId: string;
  dryRun: boolean;
  summary: {
    totalRecords: number;
    acceptedRecords: number;
    rejectedRecords: number;
    createdObjects: number;
    updatedObjects: number;
    skippedObjects: number;
  };
  diagnostics: Array<{
    code: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    recordIndex?: number;
    field?: string;
  }>;
  sampleObjects: Array<{
    objectType: string;
    objectId: string;
    displayName: string;
    state: string;
    properties: Record<string, unknown>;
  }>;
}

export interface IOntologyIngestJobRepository {
  createJob(job: OntologyIngestJob): Promise<void>;
  updateJob(job: OntologyIngestJob): Promise<void>;
  saveReport(jobId: string, report: OntologyIngestReport): Promise<void>;
  getJobById(jobId: string): Promise<OntologyIngestJob | null>;
  getReportByJobId(jobId: string): Promise<OntologyIngestReport | null>;
}
