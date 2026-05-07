import { agentSchemas } from './agent/agentSchemas';
import { commonSchemas } from './common/commonSchemas';
import { modelSchemas } from './model/modelSchemas';
import { ontologySchemas } from './ontology/ontologySchemas';
import { skillSchemas } from './skill/skillSchemas';
import { taskSchemas } from './task/taskSchemas';
import { toolSchemas } from './tool/toolSchemas';
import { workflowRuntimeSchemas } from './workflowRuntime/workflowRuntimeSchemas';

export const openApiSchemas = {
  ...commonSchemas,
  ...taskSchemas,
  ...agentSchemas,
  ...toolSchemas,
  ...skillSchemas,
  ...modelSchemas,
  ...ontologySchemas,
  ...workflowRuntimeSchemas
} as const;
