import type {
  OntologyLoopAnalysisRequestDto,
  OntologyLoopAnalysisResponseDto
} from '@mossclaw/shared';
import { detectStructuralCycles } from './detectStructuralCycles';

export class LoopAnalysisService {
  async analyze(
    payload: OntologyLoopAnalysisRequestDto
  ): Promise<OntologyLoopAnalysisResponseDto> {
    return {
      loops: detectStructuralCycles(payload.subgraph)
    };
  }
}
