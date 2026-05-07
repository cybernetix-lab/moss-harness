export const skillSchemas = {
  SkillCategory: {
    type: 'string',
    enum: ['coding', 'review', 'research', 'ops', 'communication']
  },
  SkillStringList: {
    type: 'array',
    items: { type: 'string' }
  },
  SkillTrigger: {
    type: 'object',
    additionalProperties: false,
    properties: {
      pattern: { type: 'string' },
      confidence: { type: 'number' }
    }
  },
  SkillTriggerList: {
    type: 'array',
    items: {
      $ref: '#/components/schemas/SkillTrigger'
    }
  },
  SkillPattern: {
    type: 'object',
    required: ['name', 'description', 'template'],
    additionalProperties: false,
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      template: { type: 'string' }
    }
  },
  SkillPatternList: {
    type: 'array',
    items: {
      $ref: '#/components/schemas/SkillPattern'
    }
  },
  SkillAction: {
    type: 'object',
    required: ['type', 'description', 'steps'],
    additionalProperties: false,
    properties: {
      type: { type: 'string' },
      description: { type: 'string' },
      steps: {
        $ref: '#/components/schemas/SkillStringList'
      }
    }
  },
  SkillActionList: {
    type: 'array',
    items: {
      $ref: '#/components/schemas/SkillAction'
    }
  },
  SkillContextRequirements: {
    type: 'object',
    additionalProperties: false,
    properties: {
      requiredFiles: {
        $ref: '#/components/schemas/SkillStringList'
      },
      preferredModels: {
        $ref: '#/components/schemas/SkillStringList'
      }
    }
  },
  SkillExample: {
    type: 'object',
    required: ['input', 'output', 'explanation'],
    additionalProperties: false,
    properties: {
      input: { type: 'string' },
      output: { type: 'string' },
      explanation: { type: 'string' }
    }
  },
  SkillExampleList: {
    type: 'array',
    items: {
      $ref: '#/components/schemas/SkillExample'
    }
  },
  SkillUiMetadata: {
    type: 'object',
    additionalProperties: false,
    properties: {
      icon: { type: 'string' },
      dependencies: {
        $ref: '#/components/schemas/SkillStringList'
      }
    }
  },
  Skill: {
    type: 'object',
    required: [
      'id',
      'name',
      'category',
      'version',
      'description',
      'author',
      'triggers',
      'patterns',
      'actions',
      'contextRequirements',
      'validation',
      'examples',
      'uiMetadata',
      'isBuiltin',
      'isDisabled',
      'createdAt',
      'updatedAt'
    ],
    additionalProperties: false,
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      category: { $ref: '#/components/schemas/SkillCategory' },
      version: { type: 'string' },
      description: { type: 'string' },
      author: { type: 'string' },
      triggers: {
        $ref: '#/components/schemas/SkillTriggerList'
      },
      patterns: {
        $ref: '#/components/schemas/SkillPatternList'
      },
      actions: {
        $ref: '#/components/schemas/SkillActionList'
      },
      contextRequirements: {
        $ref: '#/components/schemas/SkillContextRequirements'
      },
      validation: {
        $ref: '#/components/schemas/SkillStringList'
      },
      examples: {
        $ref: '#/components/schemas/SkillExampleList'
      },
      uiMetadata: {
        $ref: '#/components/schemas/SkillUiMetadata'
      },
      isBuiltin: { type: 'boolean' },
      isDisabled: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' }
    }
  }
} as const;
