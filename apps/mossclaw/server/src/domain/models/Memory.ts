export interface Memory {
  id: string;
  sessionId: string;
  layer: 'curated' | 'dynamic' | 'retrieval';
  type: string;
  content: string;
  confidence: number;
  metadata: {
    tags?: string[];
    importance?: number;
    category?: string;
    source?: string;
    customData?: Record<string, any>;
  };
  lifecycle: {
    expiresAt?: Date;
  };
  usageStats: {
    accessCount: number;
    lastAccessedAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}
