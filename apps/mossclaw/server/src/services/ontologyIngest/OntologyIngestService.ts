import { randomUUID } from 'node:crypto';
import type {
  OntologyIngestJobDto,
  OntologyIngestObjectCandidateDto,
  OntologyIngestReportDto,
  PreviewOntologyIngestRequestDto,
  PreviewOntologyIngestResponseDto,
  SubmitOntologyIngestRequestDto,
  SubmitOntologyIngestResponseDto
} from '@mossclaw/shared';
import type {
  IOntologyIngestJobRepository,
  OntologyIngestJob,
  OntologyIngestReport
} from '../../domain/repositories/IOntologyIngestJobRepository';
import type { OntologyMutationResult } from '../../infrastructure/database/UnifiedOntologyMutationGateway';

export interface IOntologyMutationGateway {
  persistObjects(
    objects: OntologyIngestObjectCandidateDto[],
    options?: { upsert?: boolean }
  ): Promise<OntologyMutationResult>;
}

export interface OntologyIngestServiceOptions {
  now?: () => Date;
  createJobId?: () => string;
}

export class OntologyIngestService {
  private readonly now: () => Date;
  private readonly createJobId: () => string;

  constructor(
    private readonly ontologyIngestJobRepository: IOntologyIngestJobRepository,
    private readonly ontologyMutationGateway: IOntologyMutationGateway,
    options: OntologyIngestServiceOptions = {}
  ) {
    this.now = options.now ?? (() => new Date());
    this.createJobId = options.createJobId ?? (() => randomUUID());
  }

  async previewIngest(
    request: PreviewOntologyIngestRequestDto
  ): Promise<PreviewOntologyIngestResponseDto> {
    const totalRecords = request.source.records?.length ?? request.objects.length;

    return {
      ok: true,
      preview: {
        dryRun: true,
        summary: {
          totalRecords,
          acceptedRecords: request.objects.length,
          rejectedRecords: Math.max(totalRecords - request.objects.length, 0),
          createdObjects: 0,
          updatedObjects: 0,
          skippedObjects: request.objects.length
        },
        diagnostics: [],
        sampleObjects: request.objects
      }
    };
  }

  async submitIngest(request: SubmitOntologyIngestRequestDto): Promise<SubmitOntologyIngestResponseDto> {
    const createdAt = this.now();
    const jobId = this.createJobId();
    const pendingJob: OntologyIngestJob = {
      jobId,
      status: 'pending',
      createdAt,
      source: request.source
    };

    await this.ontologyIngestJobRepository.createJob(pendingJob);

    const totalRecords = request.source.records?.length ?? request.objects.length;

    if (request.options?.dryRun) {
      const report = this.buildReport({
        jobId,
        dryRun: true,
        totalRecords,
        objects: request.objects,
        result: {
          createdCount: 0,
          updatedCount: 0,
          skippedCount: request.objects.length
        }
      });
      const finalJob: OntologyIngestJob = {
        ...pendingJob,
        status: 'succeeded',
        finishedAt: createdAt,
        summary: report.summary
      };

      await this.ontologyIngestJobRepository.saveReport(jobId, report);
      await this.ontologyIngestJobRepository.updateJob(finalJob);

      return {
        ok: true,
        job: this.toJobDto(finalJob)
      };
    }

    const runningJob: OntologyIngestJob = {
      ...pendingJob,
      status: 'running',
      startedAt: createdAt
    };
    await this.ontologyIngestJobRepository.updateJob(runningJob);

    const mutationResult = await this.ontologyMutationGateway.persistObjects(request.objects, {
      upsert: request.options?.upsert
    });

    const report = this.buildReport({
      jobId,
      dryRun: false,
      totalRecords,
      objects: request.objects,
      result: mutationResult
    });
    const finalJob: OntologyIngestJob = {
      ...runningJob,
      status: 'succeeded',
      finishedAt: this.now(),
      summary: report.summary
    };

    await this.ontologyIngestJobRepository.saveReport(jobId, report);
    await this.ontologyIngestJobRepository.updateJob(finalJob);

    return {
      ok: true,
      job: this.toJobDto(finalJob)
    };
  }

  async getIngestJob(jobId: string): Promise<OntologyIngestJobDto | null> {
    const job = await this.ontologyIngestJobRepository.getJobById(jobId);
    return job ? this.toJobDto(job) : null;
  }

  async getIngestReport(jobId: string): Promise<OntologyIngestReportDto | null> {
    const report = await this.ontologyIngestJobRepository.getReportByJobId(jobId);
    return report ? this.toReportDto(report).preview : null;
  }

  private buildReport(input: {
    jobId: string;
    dryRun: boolean;
    totalRecords: number;
    objects: OntologyIngestObjectCandidateDto[];
    result: OntologyMutationResult;
  }): OntologyIngestReport {
    return {
      jobId: input.jobId,
      dryRun: input.dryRun,
      summary: {
        totalRecords: input.totalRecords,
        acceptedRecords: input.objects.length,
        rejectedRecords: Math.max(input.totalRecords - input.objects.length, 0),
        createdObjects: input.result.createdCount,
        updatedObjects: input.result.updatedCount,
        skippedObjects: input.result.skippedCount
      },
      diagnostics: [],
      sampleObjects: input.objects
    };
  }

  private toJobDto(job: OntologyIngestJob): OntologyIngestJobDto {
    return {
      jobId: job.jobId,
      status: job.status,
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt?.toISOString(),
      finishedAt: job.finishedAt?.toISOString(),
      source: job.source,
      summary: job.summary
    };
  }

  private toReportDto(report: OntologyIngestReport): PreviewOntologyIngestResponseDto {
    return {
      ok: true,
      preview: {
        jobId: report.jobId,
        dryRun: report.dryRun,
        summary: report.summary,
        diagnostics: report.diagnostics,
        sampleObjects: report.sampleObjects
      }
    };
  }
}
