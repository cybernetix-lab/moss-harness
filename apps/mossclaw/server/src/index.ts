import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import type { TaskRealtimeClientEvents, TaskRealtimeServerEvents } from '@mossclaw/shared';
import { TASK_SUBSCRIPTION_EVENT } from '@mossclaw/shared';

import { createStorage, DEFAULT_STORAGE_CONFIG } from '@agent-harness/core/storage';
import { UnifiedTaskRepository } from './infrastructure/database/UnifiedTaskRepository';
import { UnifiedAgentRepository } from './infrastructure/database/UnifiedAgentRepository';
import { UnifiedOntologyRepository } from './infrastructure/database/UnifiedOntologyRepository';
import { UnifiedSkillRepository } from './infrastructure/database/UnifiedSkillRepository';
import { TaskController } from './api/controllers/TaskController';
import { AgentController } from './api/controllers/AgentController';
import { OntologyController, registerOntologyRoutes } from './api/controllers/OntologyController';
import {
  OntologyIngestController,
  registerOntologyIngestRoutes
} from './api/controllers/OntologyIngestController';
import { OntologyProjectionController } from './api/controllers/OntologyProjectionController';
import { registerOntologyProjectionRoutes } from './api/controllers/OntologyProjectionRoutes';
import {
  WorkflowBuilderController,
  registerWorkflowBuilderRoutes
} from './api/controllers/WorkflowBuilderController';
import {
  WorkflowRuntimeController,
  registerWorkflowRuntimeRoutes
} from './api/controllers/WorkflowRuntimeController';
import { ToolGatewayController, registerToolGatewayRoutes } from './api/controllers/ToolGatewayController';
import { registerSwaggerRoutes } from './api/controllers/SwaggerController';
import { TaskService } from './services/TaskService';
import { AgentService } from './services/AgentService';
import { OntologyService } from './services/OntologyService';
import { SkillService } from './services/SkillService';
import { WorkflowBuilderService } from './services/workflowBuilder/WorkflowBuilderService';
import { SkillController } from './api/controllers/SkillController';
import { ModelController } from './api/controllers/ModelController';
import { RosterLoader } from './services/RosterLoader';
import { OntologyToolAdapter } from './services/toolGateway/OntologyToolAdapter';
import { OntologyIngestToolAdapter } from './services/toolGateway/OntologyIngestToolAdapter';
import { WorkflowBuilderToolAdapter } from './services/toolGateway/WorkflowBuilderToolAdapter';
import { createDefaultToolRegistry } from './services/toolGateway/ToolRegistry';
import { ToolGatewayService } from './services/toolGateway/ToolGatewayService';
import path from 'path';
import { ensureTaskTableShape } from './infrastructure/database/taskSchema';
import { ensureOntologySchema } from './infrastructure/database/ontologySchema';
import { ensureOntologyIngestSchema } from './infrastructure/database/ontologyIngestSchema';
import { createDefaultModelCatalogService } from './services/ModelCatalogService';
import { TypeProjectionService } from './services/ontologyProjection/TypeProjectionService';
import { SubgraphProjectionService } from './services/ontologyProjection/SubgraphProjectionService';
import { LoopAnalysisService } from './services/ontologyProjection/LoopAnalysisService';
import { createOntologyIngestService } from './services/ontologyIngest/createOntologyIngestService';
import { TaskScheduler } from '@agent-harness/core/subagent';
import { UnifiedWorkflowRunRepository } from './infrastructure/database/UnifiedWorkflowRunRepository';
import { UnifiedWorkflowExecutionLogRepository } from './infrastructure/database/UnifiedWorkflowExecutionLogRepository';
import { ensureWorkflowRunTableShape } from './infrastructure/database/workflowRunSchema';
import { ExecutionStateStore } from './services/workflowRuntime/ExecutionStateStore';
import { RunPolicyGuard } from './services/workflowRuntime/RunPolicyGuard';
import { StepExecutorRegistry } from './services/workflowRuntime/StepExecutorRegistry';
import { ExecutionEngine } from './services/workflowRuntime/ExecutionEngine';
import { SubagentTaskHandleAdapter } from './services/workflowRuntime/SubagentTaskHandleAdapter';
import { ToolGatewayStepExecutor } from './services/workflowRuntime/executors/ToolGatewayStepExecutor';
import { SubagentTaskStepExecutor } from './services/workflowRuntime/executors/SubagentTaskStepExecutor';
import { WorkflowRuntimeService } from './services/workflowRuntime/WorkflowRuntimeService';

const app = express();
const server = http.createServer(app);
const io = new Server<TaskRealtimeClientEvents, TaskRealtimeServerEvents>(server, {
  cors: {
    origin: '*', // For development
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

async function bootstrap() {
  // 1. Initialize Harness Unified Storage
  const storage = await createStorage(DEFAULT_STORAGE_CONFIG);

  const ensureColumn = async (table: string, column: string, definition: string) => {
    try {
      await storage.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    } catch (error: any) {
      const message = String(error?.message || '');
      if (!message.includes('duplicate column name')) {
        throw error;
      }
    }
  };

  // Initialize tables (simulated migration for MVP)
  const tables = [
    `CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      systemPrompt TEXT,
      modelConfig TEXT NOT NULL,
      status TEXT NOT NULL,
      isBuiltin INTEGER NOT NULL DEFAULT 0,
      isDisabled INTEGER NOT NULL DEFAULT 0,
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      version TEXT NOT NULL,
      description TEXT,
      author TEXT,
      triggers TEXT,
      patterns TEXT,
      actions TEXT,
      contextRequirements TEXT,
      validation TEXT,
      examples TEXT,
      uiMetadata TEXT,
      isBuiltin INTEGER NOT NULL DEFAULT 0,
      isDisabled INTEGER NOT NULL DEFAULT 0,
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      layer TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      confidence REAL NOT NULL,
      metadata TEXT,
      lifecycle TEXT,
      usageStats TEXT,
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL
    );`
  ];

  for (const sql of tables) {
    await storage.execute(sql);
  }

  await ensureTaskTableShape(storage);
  await ensureOntologySchema(storage);
  await ensureOntologyIngestSchema(storage);
  await ensureWorkflowRunTableShape(storage);
  await ensureColumn('agents', 'isBuiltin', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn('agents', 'isDisabled', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn('skills', 'isBuiltin', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn('skills', 'isDisabled', 'INTEGER NOT NULL DEFAULT 0');

  // 2. Initialize Repositories
  const taskRepository = new UnifiedTaskRepository(storage);
  const agentRepository = new UnifiedAgentRepository(storage);
  const ontologyRepository = new UnifiedOntologyRepository(storage);
  const skillRepository = new UnifiedSkillRepository(storage);
  const workflowRunRepository = new UnifiedWorkflowRunRepository(storage);
  const workflowExecutionLogRepository = new UnifiedWorkflowExecutionLogRepository(storage);

  // 3. Initialize Services
  const taskService = new TaskService(taskRepository, agentRepository, io);
  const agentService = new AgentService(agentRepository);
  const ontologyService = new OntologyService(ontologyRepository);
  const typeProjectionService = new TypeProjectionService(ontologyService);
  const subgraphProjectionService = new SubgraphProjectionService(ontologyService);
  const loopAnalysisService = new LoopAnalysisService();
  const skillService = new SkillService(skillRepository);
  const workflowBuilderService = new WorkflowBuilderService();
  const ontologyIngestService = createOntologyIngestService(storage);
  const ontologyToolAdapter = new OntologyToolAdapter(ontologyService);
  const ontologyIngestToolAdapter = new OntologyIngestToolAdapter(ontologyIngestService);
  const workflowBuilderToolAdapter = new WorkflowBuilderToolAdapter(workflowBuilderService);
  const toolGatewayService = new ToolGatewayService(
    createDefaultToolRegistry(),
    ontologyToolAdapter,
    workflowBuilderToolAdapter,
    ontologyIngestToolAdapter
  );
  const workflowRuntimeTaskScheduler = new TaskScheduler(storage, 5);
  await workflowRuntimeTaskScheduler.initialize();
  await workflowRuntimeTaskScheduler.start();
  const executionStateStore = new ExecutionStateStore();
  const runPolicyGuard = new RunPolicyGuard();
  const stepExecutorRegistry = new StepExecutorRegistry();
  const subagentTaskHandleAdapter = new SubagentTaskHandleAdapter(
    storage,
    workflowRuntimeTaskScheduler
  );
  stepExecutorRegistry.register('tool_gateway', new ToolGatewayStepExecutor(toolGatewayService));
  stepExecutorRegistry.register(
    'subagent_task',
    new SubagentTaskStepExecutor(subagentTaskHandleAdapter)
  );
  const executionEngine = new ExecutionEngine(
    stepExecutorRegistry,
    executionStateStore,
    runPolicyGuard
  );
  const workflowRuntimeService = new WorkflowRuntimeService(
    workflowRunRepository,
    workflowExecutionLogRepository,
    executionEngine
  );
  const modelCatalogService = createDefaultModelCatalogService();

  // 3.5 Sync YAML Configurations to SQLite Database
  const projectRoot = path.resolve(__dirname, '../../../..');
  const rosterLoader = new RosterLoader(agentRepository, skillRepository, projectRoot);
  await rosterLoader.syncAll();

  // 4. Initialize Controllers
  const taskController = new TaskController(taskService);
  const agentController = new AgentController(agentService);
  const ontologyController = new OntologyController(ontologyService);
  const ontologyProjectionController = new OntologyProjectionController({
    getTypes: () => typeProjectionService.getTypes(),
    getNeighbors: (payload) => subgraphProjectionService.getNeighbors(payload),
    getSubgraph: (payload) => subgraphProjectionService.getSubgraph(payload),
    analyzeLoops: (payload) => loopAnalysisService.analyze(payload)
  });
  const ontologyIngestController = new OntologyIngestController(ontologyIngestService);
  const workflowBuilderController = new WorkflowBuilderController(workflowBuilderService);
  const workflowRuntimeController = new WorkflowRuntimeController(workflowRuntimeService);
  const toolGatewayController = new ToolGatewayController(toolGatewayService);
  const skillController = new SkillController(skillService);
  const modelController = new ModelController(modelCatalogService);

  // Setup Routes
  app.post('/api/tasks', (req, res) => taskController.createTask(req, res));
  app.get('/api/tasks', (req, res) => taskController.getTasks(req, res));
  app.get('/api/tasks/:id', (req, res) => taskController.getTask(req, res));
  app.post('/api/tasks/:id/execute', (req, res) => taskController.executeTask(req, res));
  app.post('/api/tasks/:id/control', (req, res) => taskController.controlTask(req, res));

  app.post('/api/agents', (req, res) => agentController.createAgent(req, res));
  app.get('/api/agents', (req, res) => agentController.getAgents(req, res));
  app.get('/api/agents/:id', (req, res) => agentController.getAgent(req, res));
  app.put('/api/agents/:id', (req, res) => agentController.updateAgent(req, res));
  app.patch('/api/agents/:id/disable', (req, res) => agentController.disableAgent(req, res));
  app.patch('/api/agents/:id/enable', (req, res) => agentController.enableAgent(req, res));
  app.delete('/api/agents/:id', (req, res) => agentController.deleteAgent(req, res));

  registerOntologyRoutes(app, ontologyController);
  registerOntologyIngestRoutes(app, ontologyIngestController);
  registerOntologyProjectionRoutes(app, ontologyProjectionController);
  registerWorkflowBuilderRoutes(app, workflowBuilderController);
  registerWorkflowRuntimeRoutes(app, workflowRuntimeController);
  registerToolGatewayRoutes(app, toolGatewayController);
  registerSwaggerRoutes(app, { enabled: isSwaggerUiEnabled() });

  app.get('/api/skills', (req, res) => skillController.getSkills(req, res));
  app.get('/api/models', (req, res) => modelController.getModels(req, res));
  app.get('/api/skills/:id', (req, res) => skillController.getSkill(req, res));
  app.patch('/api/skills/:id/disable', (req, res) => skillController.disableSkill(req, res));
  app.patch('/api/skills/:id/enable', (req, res) => skillController.enableSkill(req, res));

  // Setup WebSocket
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.on(TASK_SUBSCRIPTION_EVENT, (taskId) => {
      socket.join(`task_${taskId}`);
      console.log(`Client ${socket.id} subscribed to task ${taskId}`);
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => {
    console.log(`MossClaw server running on port ${PORT}`);
  });
}

function isSwaggerUiEnabled(): boolean {
  return process.env.ENABLE_SWAGGER_UI === 'true' || process.env.NODE_ENV !== 'production';
}

bootstrap().catch(console.error);
