import type { IStorage } from '@agent-harness/core/storage/types';
import { UnifiedOntologyIngestJobRepository } from '../../infrastructure/database/UnifiedOntologyIngestJobRepository';
import { UnifiedOntologyMutationGateway } from '../../infrastructure/database/UnifiedOntologyMutationGateway';
import {
  OntologyIngestService,
  type OntologyIngestServiceOptions
} from './OntologyIngestService';

export function createOntologyIngestService(
  storage: IStorage,
  options: OntologyIngestServiceOptions = {}
): OntologyIngestService {
  return new OntologyIngestService(
    new UnifiedOntologyIngestJobRepository(storage),
    new UnifiedOntologyMutationGateway(storage),
    options
  );
}
