import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import type { TaskRealtimeClientEvents, TaskRealtimeServerEvents } from '@mossclaw/shared';
import { TASK_SUBSCRIPTION_EVENT } from '@mossclaw/shared';

import { createStorage, DEFAULT_STORAGE_CONFIG } from '@agent-harness/core/storage';
import { UnifiedTaskRepository } from './infrastructure/database/UnifiedTaskRepository';
import { UnifiedAgentRepository } from './infrastructure/database/UnifiedAgentRepository';
import { UnifiedSkillRepository } from './infrastructure/database/UnifiedSkillRepository';
import { TaskController } from './api/controllers/TaskController';
import { AgentController } from './api/controllers/AgentController';
import { TaskService } from './services/TaskService';
import { AgentService } from './services/AgentService';
import { SkillService } from './services/SkillService';
import { SkillController } from './api/controllers/SkillController';
import { ModelController } from './api/controllers/ModelController';
import { RosterLoader } from './services/RosterLoader';
import path from 'path';
import { ensureTaskTableShape } from './infrastructure/database/taskSchema';
import { ensureOntologySchema } from './infrastructure/database/ontologySchema';
import { createDefaultModelCatalogService } from './services/ModelCatalogService';

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
  await ensureColumn('agents', 'isBuiltin', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn('agents', 'isDisabled', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn('skills', 'isBuiltin', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn('skills', 'isDisabled', 'INTEGER NOT NULL DEFAULT 0');

  // 2. Initialize Repositories
  const taskRepository = new UnifiedTaskRepository(storage);
  const agentRepository = new UnifiedAgentRepository(storage);
  const skillRepository = new UnifiedSkillRepository(storage);

  // 3. Initialize Services
  const taskService = new TaskService(taskRepository, agentRepository, io);
  const agentService = new AgentService(agentRepository);
  const skillService = new SkillService(skillRepository);
  const modelCatalogService = createDefaultModelCatalogService();

  // 3.5 Sync YAML Configurations to SQLite Database
  const projectRoot = path.resolve(__dirname, '../../../..');
  const rosterLoader = new RosterLoader(agentRepository, skillRepository, projectRoot);
  await rosterLoader.syncAll();

  // 4. Initialize Controllers
  const taskController = new TaskController(taskService);
  const agentController = new AgentController(agentService);
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

bootstrap().catch(console.error);
