/**
 * Memory Module
 *
 * Hierarchical memory system with token-aware injection
 * Based on DeerFlow design and Information Theory principles
 */

export { MemorySystem } from './memory-system';
export { MemoryUpdateQueue } from './update-queue';

// Types
export type {
  MemoryLayer,
  MemoryEntryType,
  FactCategory,
  MemorySchema,
  UserContext,
  HistoryContext,
  MemorySection,
  Fact,
  MemoryEntry,
  MemoryMetadata,
  MemoryConfig,
  MemoryUpdateContext,
  MemoryMessage,
  MemoryRetrievalOptions,
  FormattedMemory,
  FormattedSection,
  IMemorySystem,
  IMemoryUpdateQueue,
  IMemoryExtractor,
  IMemoryFormatter,
  ExtractedFact,
  MemoryMetrics,
} from './types';

// Default configuration
export { DEFAULT_MEMORY_CONFIG } from './types';
