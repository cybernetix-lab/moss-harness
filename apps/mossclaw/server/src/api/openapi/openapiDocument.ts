import { openApiPaths } from './paths';
import { openApiSchemas } from './schemas';

export const openApiTags = [
    { name: 'Ontology', description: 'Ontology schema and object retrieval APIs.' },
    { name: 'Ontology Ingest', description: 'Ontology ingest preview, submit, and job inspection APIs.' },
    { name: 'Workflow Runtime', description: 'Workflow run execution, control, and log retrieval APIs.' },
    { name: 'Task', description: 'Task lifecycle and execution APIs.' },
    { name: 'Agent', description: 'Agent management APIs.' },
    { name: 'Tool Gateway', description: 'Tool directory and invocation APIs.' },
    { name: 'Skill', description: 'Skill directory and state management APIs.' },
    { name: 'Model', description: 'Model option discovery APIs.' }
] as const;
export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'MossClaw Server API',
    version: '1.0.0',
    description: 'Internal development API documentation for MossClaw server.'
  },
  tags: openApiTags,
  paths: openApiPaths,
  components: {
    schemas: openApiSchemas
  }
} as const;
