export type OntologyIngestSourceKindDto = 'json' | 'csv' | 'api' | 'rdf';
export type OntologyIngestJobStatusDto =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';
export type OntologyIngestDiagnosticSeverityDto = 'error' | 'warning' | 'info';

export interface OntologyIngestSourceDto {
  kind: OntologyIngestSourceKindDto;
  uri?: string;
  contentType?: string;
  payload?: Record<string, unknown>;
  records?: Record<string, unknown>[];
}

export interface OntologyIngestObjectCandidateDto {
  objectType: string;
  objectId: string;
  displayName: string;
  state: string;
  properties: Record<string, unknown>;
}

export interface OntologyIngestDiagnosticDto {
  code: string;
  severity: OntologyIngestDiagnosticSeverityDto;
  message: string;
  recordIndex?: number;
  field?: string;
}

export interface OntologyIngestSummaryDto {
  totalRecords: number;
  acceptedRecords: number;
  rejectedRecords: number;
  createdObjects: number;
  updatedObjects: number;
  skippedObjects: number;
}

export interface OntologyIngestOptionsDto {
  dryRun?: boolean;
  upsert?: boolean;
}

export interface PreviewOntologyIngestRequestDto {
  source: OntologyIngestSourceDto;
  objects: OntologyIngestObjectCandidateDto[];
  options?: OntologyIngestOptionsDto;
}

export interface SubmitOntologyIngestRequestDto {
  source: OntologyIngestSourceDto;
  objects: OntologyIngestObjectCandidateDto[];
  options?: OntologyIngestOptionsDto;
}

export interface OntologyIngestJobDto {
  jobId: string;
  status: OntologyIngestJobStatusDto;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  source: OntologyIngestSourceDto;
  summary?: OntologyIngestSummaryDto;
}

export interface OntologyIngestReportDto {
  jobId?: string;
  dryRun: boolean;
  summary: OntologyIngestSummaryDto;
  diagnostics: OntologyIngestDiagnosticDto[];
  sampleObjects: OntologyIngestObjectCandidateDto[];
}

export interface PreviewOntologyIngestResponseDto {
  ok: true;
  preview: OntologyIngestReportDto;
}

export interface SubmitOntologyIngestResponseDto {
  ok: true;
  job: OntologyIngestJobDto;
}

export interface GetOntologyIngestJobResponseDto {
  job: OntologyIngestJobDto;
}

export interface GetOntologyIngestReportResponseDto {
  report: OntologyIngestReportDto;
}
