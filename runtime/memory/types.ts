/**
 * Memory System Types
 *
 * Hierarchical memory architecture based on DeerFlow design
 * Layer 1: Curated Memory (人工维护)
 * Layer 2: Structured Dynamic Memory (动态抽取)
 * Layer 3: Retrieval Layer (检索层)
 */

// Memory layer types
export type MemoryLayer = 'curated' | 'dynamic' | 'retrieval';

// Memory entry types
export type MemoryEntryType = 
  | 'project_background'
  | 'persistent_constraint'
  | 'user_preference'
  | 'working_convention'
  | 'work_context'
  | 'personal_context'
  | 'top_of_mind'
  | 'recent_summary'
  | 'earlier_summary'
  | 'long_term_background'
  | 'fact';

// Fact categories
export type FactCategory = 
  | 'preference'
  | 'knowledge'
  | 'context'
  | 'behavior'
  | 'goal';

// Memory schema
export interface MemorySchema {
  version: string;
  lastUpdated: Date;
  user: UserContext;
  history: HistoryContext;
  facts: Fact[];
}

export interface UserContext {
  workContext: MemorySection;
  personalContext: MemorySection;
  topOfMind: MemorySection;
}

export interface HistoryContext {
  recentMonths: MemorySection;
  earlierContext: MemorySection;
  longTermBackground: MemorySection;
}

export interface MemorySection {
  summary: string;
  updatedAt: Date;
  shouldUpdate?: boolean;
}

export interface Fact {
  id: string;
  content: string;
  category: FactCategory;
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
  source?: string;
  expiresAt?: Date;
}

// Memory entry (database entity)
export interface MemoryEntry {
  id: string;
  sessionId: string;
  layer: MemoryLayer;
  type: MemoryEntryType;
  content: string;
  metadata: MemoryMetadata;
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  accessCount: number;
  lastAccessedAt?: Date;
}

export interface MemoryMetadata {
  category?: FactCategory;
  source?: string;
  tags: string[];
  importance: number;
  customData: Record<string, unknown>;
}

// Memory configuration
export interface MemoryConfig {
  // Storage
  storage: {
    backend: 'sqlite' | 'postgresql' | 'memory';
    filepath?: string;
  };
  
  // Token budget
  tokenBudget: {
    maxTokens: number;
    curatedRatio: number;
    dynamicRatio: number;
    retrievalRatio: number;
  };
  
  // Fact management
  facts: {
    maxFacts: number;
    confidenceThreshold: number;
    pruneInterval: number;
  };
  
  // Update queue
  updateQueue: {
    debounceSeconds: number;
    maxQueueSize: number;
    rateLimitDelay: number;
  };
  
  // Retrieval
  retrieval: {
    maxResults: number;
    similarityThreshold: number;
    useSemanticSearch: boolean;
  };
}

// Memory update context
export interface MemoryUpdateContext {
  sessionId: string;
  messages: MemoryMessage[];
  agentName?: string;
  timestamp: number;
}

export interface MemoryMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

// Memory retrieval options
export interface MemoryRetrievalOptions {
  layer?: MemoryLayer;
  type?: MemoryEntryType;
  category?: FactCategory;
  sessionId?: string;
  query?: string;
  limit?: number;
  minConfidence?: number;
  includeExpired?: boolean;
}

// Formatted memory for injection
export interface FormattedMemory {
  text: string;
  tokenCount: number;
  sections: FormattedSection[];
}

export interface FormattedSection {
  name: string;
  content: string;
  tokenCount: number;
  priority: number;
}

// Memory system interface
export interface IMemorySystem {
  // Lifecycle
  initialize(): Promise<void>;
  close(): Promise<void>;
  
  // CRUD operations
  add(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<MemoryEntry>;
  get(id: string): Promise<MemoryEntry | null>;
  update(id: string, data: Partial<MemoryEntry>): Promise<MemoryEntry>;
  delete(id: string): Promise<boolean>;
  
  // Layer-specific operations
  addCurated(content: string, type: MemoryEntryType, metadata?: Partial<MemoryMetadata>): Promise<MemoryEntry>;
  addDynamic(content: string, type: MemoryEntryType, confidence: number): Promise<MemoryEntry>;
  addFact(content: string, category: FactCategory, confidence: number): Promise<MemoryEntry>;
  
  // Retrieval
  retrieve(options: MemoryRetrievalOptions): Promise<MemoryEntry[]>;
  search(query: string, limit?: number): Promise<MemoryEntry[]>;
  getFacts(minConfidence?: number): Promise<Fact[]>;
  
  // Formatting
  formatForInjection(maxTokens?: number): Promise<FormattedMemory>;
  
  // Update queue
  queueUpdate(context: MemoryUpdateContext): void;
  processUpdateQueue(): Promise<void>;
  
  // Maintenance
  pruneFacts(): Promise<number>;
  cleanupExpired(): Promise<number>;
  export(): Promise<MemorySchema>;
  import(data: MemorySchema): Promise<void>;
}

// Memory update queue interface
export interface IMemoryUpdateQueue {
  add(context: MemoryUpdateContext): void;
  process(): Promise<void>;
  clear(): void;
  size(): number;
}

// Memory extractor interface
export interface IMemoryExtractor {
  extractFacts(messages: MemoryMessage[]): Promise<ExtractedFact[]>;
  extractSummary(messages: MemoryMessage[]): Promise<string>;
  calculateConfidence(fact: string, context: MemoryMessage[]): number;
}

export interface ExtractedFact {
  content: string;
  category: FactCategory;
  confidence: number;
}

// Memory formatter interface
export interface IMemoryFormatter {
  format(schema: MemorySchema, maxTokens: number): FormattedMemory;
  formatSection(section: MemorySection, name: string): string;
  formatFacts(facts: Fact[], maxFacts: number): string;
  estimateTokens(text: string): number;
}

// Memory metrics
export interface MemoryMetrics {
  totalEntries: number;
  entriesByLayer: Record<MemoryLayer, number>;
  totalFacts: number;
  avgFactConfidence: number;
  queueSize: number;
  lastUpdateAt?: Date;
}

// Default configuration
export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  storage: {
    backend: 'sqlite',
    filepath: './data/memory.db',
  },
  tokenBudget: {
    maxTokens: 2000,
    curatedRatio: 0.3,
    dynamicRatio: 0.5,
    retrievalRatio: 0.2,
  },
  facts: {
    maxFacts: 50,
    confidenceThreshold: 0.7,
    pruneInterval: 3600000, // 1 hour
  },
  updateQueue: {
    debounceSeconds: 5,
    maxQueueSize: 100,
    rateLimitDelay: 500,
  },
  retrieval: {
    maxResults: 20,
    similarityThreshold: 0.7,
    useSemanticSearch: false,
  },
};
