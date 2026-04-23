export type SkillCategory = 'coding' | 'review' | 'research' | 'ops' | 'communication';

export interface SkillTriggerDto {
  pattern?: string;
  confidence?: number;
}

export interface SkillPatternDto {
  name: string;
  description: string;
  template: string;
}

export interface SkillActionDto {
  type: string;
  description: string;
  steps: string[];
}

export interface SkillContextRequirementsDto {
  requiredFiles?: string[];
  preferredModels?: string[];
}

export interface SkillExampleDto {
  input: string;
  output: string;
  explanation: string;
}

export interface SkillUiMetadataDto {
  icon?: string;
  dependencies?: string[];
}

export interface SkillDto {
  id: string;
  name: string;
  category: SkillCategory;
  version: string;
  description: string;
  author: string;
  triggers: SkillTriggerDto[];
  patterns: SkillPatternDto[];
  actions: SkillActionDto[];
  contextRequirements: SkillContextRequirementsDto;
  validation: string[];
  examples: SkillExampleDto[];
  uiMetadata: SkillUiMetadataDto;
  isBuiltin: boolean;
  isDisabled: boolean;
  createdAt: string;
  updatedAt: string;
}
