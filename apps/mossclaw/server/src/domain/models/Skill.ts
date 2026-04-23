export interface Skill {
  id: string;
  name: string;
  category: 'coding' | 'review' | 'research' | 'ops' | 'communication';
  version: string;
  description: string;
  author: string;
  triggers: {
    pattern?: string;
    confidence?: number;
  }[];
  patterns: {
    name: string;
    description: string;
    template: string;
  }[];
  actions: {
    type: string;
    description: string;
    steps: string[];
  }[];
  contextRequirements: {
    requiredFiles?: string[];
    preferredModels?: string[];
  };
  validation: string[];
  examples: {
    input: string;
    output: string;
    explanation: string;
  }[];
  uiMetadata: {
    icon?: string;
    dependencies?: string[];
  };
  isBuiltin: boolean;
  isDisabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
