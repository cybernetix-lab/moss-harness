import { describe, expect, it } from 'vitest';
import { openApiDocument } from './openapiDocument';
import { openApiPaths } from './paths';
import { openApiSchemas } from './schemas';
import { taskPaths } from './task/taskPaths';
import { agentPaths } from './agent/agentPaths';
import { ontologyPaths } from './ontology/ontologyPaths';
import { toolPaths } from './tool/toolPaths';
import { skillPaths } from './skill/skillPaths';
import { workflowRuntimePaths } from './workflowRuntime/workflowRuntimePaths';
import { commonSchemas } from './common/commonSchemas';
import { taskSchemas } from './task/taskSchemas';
import { agentSchemas } from './agent/agentSchemas';
import { toolSchemas } from './tool/toolSchemas';
import { skillSchemas } from './skill/skillSchemas';
import { modelSchemas } from './model/modelSchemas';
import { ontologySchemas } from './ontology/ontologySchemas';
import { workflowRuntimeSchemas } from './workflowRuntime/workflowRuntimeSchemas';

describe('openApiDocument', () => {
  it('assembles document metadata around externalized paths and schemas', () => {
    expect(openApiDocument.openapi).toBe('3.1.0');
    expect(openApiDocument.paths).toBe(openApiPaths);
    expect(openApiDocument.components.schemas).toBe(openApiSchemas);
  });

  it('keeps representative routes and schemas after modularization', () => {
    expect(openApiPaths).toHaveProperty('/api/tasks');
    expect(openApiPaths).toHaveProperty('/api/skills');
    expect(openApiPaths).toHaveProperty('/api/models');
    expect(openApiSchemas).toHaveProperty('Task');
    expect(openApiSchemas).toHaveProperty('Skill');
    expect(openApiSchemas).toHaveProperty('WorkflowRuntimeRunResult');
  });

  it('composes schema groups from domain-specific subdirectories', () => {
    const openApiSchemaRecord = openApiSchemas as Record<string, unknown>;
    const commonSchemaRecord = commonSchemas as Record<string, unknown>;
    const skillSchemaRecord = skillSchemas as Record<string, unknown>;
    expect(openApiSchemas.Task).toBe(taskSchemas.Task);
    expect(openApiSchemaRecord['JsonObject']).toBe(commonSchemaRecord['JsonObject']);
    expect(openApiSchemaRecord['JsonArray']).toBe(commonSchemaRecord['JsonArray']);
    expect(openApiSchemaRecord['JsonValue']).toBe(commonSchemaRecord['JsonValue']);
    expect(openApiSchemas.Agent).toBe(agentSchemas.Agent);
    expect(openApiSchemas.CreateAgentRequest).toBe(agentSchemas.CreateAgentRequest);
    expect(openApiSchemas.UpdateAgentRequest).toBe(agentSchemas.UpdateAgentRequest);
    expect(openApiSchemas.ToolDescriptor).toBe(toolSchemas.ToolDescriptor);
    expect(openApiSchemas.ToolInvokeRequest).toBe(toolSchemas.ToolInvokeRequest);
    expect(openApiSchemas.ToolInvokeResult).toBe(toolSchemas.ToolInvokeResult);
    expect(openApiSchemas.Skill).toBe(skillSchemas.Skill);
    expect(openApiSchemaRecord['SkillCategory']).toBe(skillSchemaRecord['SkillCategory']);
    expect(openApiSchemaRecord['SkillStringList']).toBe(skillSchemaRecord['SkillStringList']);
    expect(openApiSchemaRecord['SkillTriggerList']).toBe(skillSchemaRecord['SkillTriggerList']);
    expect(openApiSchemaRecord['SkillPatternList']).toBe(skillSchemaRecord['SkillPatternList']);
    expect(openApiSchemaRecord['SkillActionList']).toBe(skillSchemaRecord['SkillActionList']);
    expect(openApiSchemaRecord['SkillExampleList']).toBe(skillSchemaRecord['SkillExampleList']);
    expect(openApiSchemas.ModelOption).toBe(modelSchemas.ModelOption);
    expect(openApiSchemas.OntologyIngestSource).toBe(ontologySchemas.OntologyIngestSource);
    expect(openApiSchemas.WorkflowRuntimeRunResult).toBe(
      workflowRuntimeSchemas.WorkflowRuntimeRunResult
    );
  });

  it('composes path groups from domain-specific modules', () => {
    expect(openApiPaths['/api/tasks']).toBe(taskPaths['/api/tasks']);
    expect(openApiPaths['/api/agents']).toBe(agentPaths['/api/agents']);
    expect(openApiPaths['/api/ontology/schema']).toBe(ontologyPaths['/api/ontology/schema']);
    expect(openApiPaths['/api/tools']).toBe(toolPaths['/api/tools']);
    expect(openApiPaths['/api/skills']).toBe(skillPaths['/api/skills']);
    expect(openApiPaths['/api/models']).toHaveProperty('get');
    expect(openApiPaths['/api/workflow-runtime/runs']).toBe(
      workflowRuntimePaths['/api/workflow-runtime/runs']
    );
  });

  it('binds agent create and update bodies to explicit request schemas', () => {
    expect(agentPaths['/api/agents'].post.requestBody.content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/CreateAgentRequest'
    });
    expect(agentPaths['/api/agents/{id}'].put.requestBody.content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/UpdateAgentRequest'
    });
    expect(agentSchemas.CreateAgentRequest).toMatchObject({
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string' },
        type: {
          type: 'string',
          enum: [
            'planning',
            'plan_review',
            'execution',
            'evaluation',
            'research',
            'memory_management',
            'custom'
          ]
        },
        description: { type: 'string' },
        systemPrompt: { type: 'string' },
        modelConfig: { $ref: '#/components/schemas/AgentModelConfig' },
        isBuiltin: { type: 'boolean' },
        isDisabled: { type: 'boolean' }
      }
    });
    expect(agentSchemas.UpdateAgentRequest).toMatchObject({
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string' },
        type: {
          type: 'string',
          enum: [
            'planning',
            'plan_review',
            'execution',
            'evaluation',
            'research',
            'memory_management',
            'custom'
          ]
        },
        description: { type: 'string' },
        systemPrompt: { type: 'string' },
        modelConfig: { $ref: '#/components/schemas/AgentModelConfig' },
        status: {
          type: 'string',
          enum: ['IDLE', 'WORK', 'BUSY', 'OFFLINE']
        },
        isBuiltin: { type: 'boolean' },
        isDisabled: { type: 'boolean' }
      }
    });
  });

  it('binds tool invoke bodies and results to explicit schemas', () => {
    expect(toolPaths['/api/tools/{toolName}/invoke'].post.requestBody.content['application/json'].schema).toEqual(
      {
        $ref: '#/components/schemas/ToolInvokeRequest'
      }
    );
    expect(toolPaths['/api/tools/{toolName}/invoke'].post.responses['200'].content['application/json'].schema).toEqual(
      {
        $ref: '#/components/schemas/ToolInvokeResult'
      }
    );
    expect(toolSchemas.ToolInvokeRequest).toMatchObject({
      type: 'object',
      additionalProperties: false,
      properties: {
        arguments: {
          type: 'object',
          additionalProperties: true
        }
      }
    });
    expect(toolSchemas.ToolInvokeSuccess).toMatchObject({
      type: 'object',
      additionalProperties: false,
      required: ['ok', 'toolName', 'result'],
      properties: {
        ok: { type: 'boolean', const: true },
        toolName: { type: 'string' },
        result: {}
      }
    });
    expect(toolSchemas.ToolInvokeError).toMatchObject({
      type: 'object',
      additionalProperties: false,
      required: ['ok', 'toolName', 'error', 'errorCode'],
      properties: {
        ok: { type: 'boolean', const: false },
        toolName: { type: 'string' },
        error: { type: 'string' },
        errorCode: { type: 'string' }
      }
    });
    expect(toolSchemas.ToolInvokeResult).toEqual({
      oneOf: [
        { $ref: '#/components/schemas/ToolInvokeSuccess' },
        { $ref: '#/components/schemas/ToolInvokeError' }
      ]
    });
  });

  it('binds skill nested fields to explicit collection and enum schemas', () => {
    expect(skillSchemas.Skill.properties.category).toEqual({
      $ref: '#/components/schemas/SkillCategory'
    });
    expect(skillSchemas.Skill.properties.triggers).toEqual({
      $ref: '#/components/schemas/SkillTriggerList'
    });
    expect(skillSchemas.Skill.properties.patterns).toEqual({
      $ref: '#/components/schemas/SkillPatternList'
    });
    expect(skillSchemas.Skill.properties.actions).toEqual({
      $ref: '#/components/schemas/SkillActionList'
    });
    expect(skillSchemas.Skill.properties.validation).toEqual({
      $ref: '#/components/schemas/SkillStringList'
    });
    expect(skillSchemas.Skill.properties.examples).toEqual({
      $ref: '#/components/schemas/SkillExampleList'
    });
    expect(skillSchemas.SkillAction.properties.steps).toEqual({
      $ref: '#/components/schemas/SkillStringList'
    });
    expect(skillSchemas.SkillContextRequirements.properties.requiredFiles).toEqual({
      $ref: '#/components/schemas/SkillStringList'
    });
    expect(skillSchemas.SkillContextRequirements.properties.preferredModels).toEqual({
      $ref: '#/components/schemas/SkillStringList'
    });
    expect(skillSchemas.SkillUiMetadata.properties.dependencies).toEqual({
      $ref: '#/components/schemas/SkillStringList'
    });
    expect(skillSchemas.SkillCategory).toEqual({
      type: 'string',
      enum: ['coding', 'review', 'research', 'ops', 'communication']
    });
    expect(skillSchemas.SkillStringList).toEqual({
      type: 'array',
      items: { type: 'string' }
    });
    expect(skillSchemas.SkillTriggerList).toEqual({
      type: 'array',
      items: { $ref: '#/components/schemas/SkillTrigger' }
    });
    expect(skillSchemas.SkillPatternList).toEqual({
      type: 'array',
      items: { $ref: '#/components/schemas/SkillPattern' }
    });
    expect(skillSchemas.SkillActionList).toEqual({
      type: 'array',
      items: { $ref: '#/components/schemas/SkillAction' }
    });
    expect(skillSchemas.SkillExampleList).toEqual({
      type: 'array',
      items: { $ref: '#/components/schemas/SkillExample' }
    });
  });

  it('binds ontology http payloads to explicit schemas and shared json containers', () => {
    const ontologySchemaRecord = ontologySchemas as Record<string, any>;
    expect(openApiPaths['/api/ontology/schema'].get.responses['200'].content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/OntologySchemaResponse'
    });
    expect(
      openApiPaths['/api/ontology/objects/{objectType}/{objectId}'].get.responses['200'].content[
        'application/json'
      ].schema
    ).toEqual({
      $ref: '#/components/schemas/OntologyObject'
    });
    expect(openApiPaths['/api/ontology/query'].post.requestBody.content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/OntologyQueryRequest'
    });
    expect(openApiPaths['/api/ontology/query'].post.responses['200'].content['application/json'].schema).toEqual(
      {
        $ref: '#/components/schemas/OntologyQueryResponse'
      }
    );
    expect(ontologySchemaRecord['OntologyObject'].properties.properties).toEqual({
      $ref: '#/components/schemas/JsonObject'
    });
    expect(ontologySchemaRecord['OntologyIngestSource'].properties.payload).toEqual({
      $ref: '#/components/schemas/JsonObject'
    });
    expect(ontologySchemaRecord['OntologyIngestSource'].properties.records).toEqual({
      type: 'array',
      items: {
        $ref: '#/components/schemas/JsonObject'
      }
    });
  });

  it('binds workflow runtime dynamic payloads to explicit schemas and shared json containers', () => {
    const workflowSchemaRecord = workflowRuntimeSchemas as Record<string, any>;
    expect(
      openApiPaths['/api/workflow-runtime/runs'].post.requestBody.content['application/json'].schema
    ).toEqual({
      $ref: '#/components/schemas/WorkflowRuntimeStartRunRequest'
    });
    expect(
      openApiPaths['/api/workflow-runtime/runs/{runId}/logs'].get.responses['200'].content[
        'application/json'
      ].schema
    ).toEqual({
      $ref: '#/components/schemas/WorkflowRuntimeGetRunLogsResponse'
    });
    expect(workflowSchemaRecord['WorkflowRuntimeContext'].properties.variables).toEqual({
      $ref: '#/components/schemas/JsonObject'
    });
    expect(workflowSchemaRecord['WorkflowStepExecution'].properties.output).toEqual({
      $ref: '#/components/schemas/JsonObject'
    });
    expect(workflowSchemaRecord['WorkflowRunLog'].properties.payload).toEqual({
      $ref: '#/components/schemas/JsonObject'
    });
  });
});
