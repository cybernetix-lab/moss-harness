import { agentPaths } from './agent/agentPaths';
import { modelPaths } from './model/modelPaths';
import { ontologyPaths } from './ontology/ontologyPaths';
import { skillPaths } from './skill/skillPaths';
import { taskPaths } from './task/taskPaths';
import { toolPaths } from './tool/toolPaths';
import { workflowRuntimePaths } from './workflowRuntime/workflowRuntimePaths';

export const openApiPaths = {
  ...taskPaths,
  ...agentPaths,
  ...toolPaths,
  ...skillPaths,
  ...modelPaths,
  ...ontologyPaths,
  ...workflowRuntimePaths
} as const;
