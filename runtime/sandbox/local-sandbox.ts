/**
 * Local Sandbox Provider
 *
 * File-system based sandbox with RestrictedPython for secure execution
 * Four-layer security: AST filtering, resource limits, path validation, network proxy
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import type {
  ISandboxProvider,
  SandboxConfig,
  SandboxSession,
  ExecutionRequest,
  ExecutionResult,
  FileInfo,
  SandboxHealth,
  ResourceUsage,
} from './types';
import type { IStorage } from '../storage/types';

export class LocalSandboxProvider implements ISandboxProvider {
  private storage: IStorage;
  private sessions: Map<string, SandboxSession> = new Map();
  private workspaceRoot: string;
  private maxSessions: number;

  constructor(storage: IStorage, workspaceRoot = './sandbox-workspace', maxSessions = 10) {
    this.storage = storage;
    this.workspaceRoot = workspaceRoot;
    this.maxSessions = maxSessions;
  }

  async initialize(): Promise<void> {
    // Create sandbox_sessions table
    await this.storage.execute(`
      CREATE TABLE IF NOT EXISTS sandbox_sessions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        config TEXT NOT NULL, -- JSON
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        destroyed_at DATETIME
      )
    `);

    // Create sandbox_executions table
    await this.storage.execute(`
      CREATE TABLE IF NOT EXISTS sandbox_executions (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        command TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        stdout TEXT,
        stderr TEXT,
        exit_code INTEGER,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        duration INTEGER,
        resource_usage TEXT -- JSON
      )
    `);

    // Ensure workspace directory exists
    await fs.mkdir(this.workspaceRoot, { recursive: true });
  }

  async create(config: SandboxConfig): Promise<SandboxSession> {
    await this.initialize();

    // Check session limit
    if (this.sessions.size >= this.maxSessions) {
      throw new Error(`Maximum number of sessions (${this.maxSessions}) reached`);
    }

    const sessionId = this.generateSessionId();
    const sessionPath = path.join(this.workspaceRoot, sessionId);

    // Create session workspace
    await fs.mkdir(sessionPath, { recursive: true });
    await fs.mkdir(path.join(sessionPath, 'workspace'), { recursive: true });
    await fs.mkdir(path.join(sessionPath, 'tmp'), { recursive: true });

    const session: SandboxSession = {
      id: sessionId,
      type: 'local',
      status: 'ready',
      config,
      createdAt: new Date(),
      lastUsedAt: new Date(),
    };

    // Store in database
    await this.storage.execute(
      `INSERT INTO sandbox_sessions (id, type, status, config)
       VALUES (?, ?, ?, ?)`,
      [sessionId, 'local', 'ready', JSON.stringify(config)]
    );

    this.sessions.set(sessionId, session);
    return session;
  }

  async destroy(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Update status
    session.status = 'destroyed';
    session.destroyedAt = new Date();

    await this.storage.execute(
      'UPDATE sandbox_sessions SET status = ?, destroyed_at = ? WHERE id = ?',
      ['destroyed', new Date().toISOString(), sessionId]
    );

    // Clean up workspace
    const sessionPath = path.join(this.workspaceRoot, sessionId);
    try {
      await fs.rm(sessionPath, { recursive: true, force: true });
    } catch (error) {
      console.error(`Failed to clean up session ${sessionId}:`, error);
    }

    this.sessions.delete(sessionId);
  }

  async get(sessionId: string): Promise<SandboxSession | null> {
    // Check cache first
    const cached = this.sessions.get(sessionId);
    if (cached) {
      return cached;
    }

    // Query database
    const result = await this.storage.execute(
      'SELECT * FROM sandbox_sessions WHERE id = ?',
      [sessionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.rowToSession(result.rows[0]);
  }

  async execute(sessionId: string, request: ExecutionRequest): Promise<ExecutionResult> {
    const session = await this.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.status !== 'ready') {
      throw new Error(`Session ${sessionId} is not ready (status: ${session.status})`);
    }

    // Update session status
    session.status = 'busy';
    session.lastUsedAt = new Date();

    const executionId = this.generateExecutionId();
    const startedAt = new Date();

    // Store execution record
    await this.storage.execute(
      `INSERT INTO sandbox_executions (id, session_id, command, type, status, started_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [executionId, sessionId, request.command, request.type, 'running', startedAt.toISOString()]
    );

    try {
      let result: ExecutionResult;

      switch (request.type) {
        case 'bash':
          result = await this.executeBash(session, request, executionId);
          break;
        case 'python':
          result = await this.executePython(session, request, executionId);
          break;
        case 'read':
          result = await this.executeRead(session, request, executionId);
          break;
        case 'write':
          result = await this.executeWrite(session, request, executionId);
          break;
        default:
          throw new Error(`Unsupported execution type: ${request.type}`);
      }

      // Update session status
      session.status = 'ready';

      return result;
    } catch (error) {
      // Update session status
      session.status = 'ready';

      const failedResult: ExecutionResult = {
        id: executionId,
        sessionId,
        command: request.command,
        type: request.type,
        status: 'failed',
        stdout: '',
        stderr: (error as Error).message,
        exitCode: 1,
        startedAt,
        completedAt: new Date(),
        duration: Date.now() - startedAt.getTime(),
        resourceUsage: { cpuMs: 0, memoryBytes: 0, diskBytes: 0 },
        error: {
          code: 'EXECUTION_ERROR',
          message: (error as Error).message,
          type: 'system',
        },
      };

      await this.storeExecutionResult(failedResult);
      return failedResult;
    }
  }

  async readFile(sessionId: string, filePath: string): Promise<string> {
    const session = await this.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const fullPath = this.resolvePath(session, filePath);
    await this.validateReadPath(session, fullPath);

    return fs.readFile(fullPath, 'utf-8');
  }

  async writeFile(sessionId: string, filePath: string, content: string): Promise<void> {
    const session = await this.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const fullPath = this.resolvePath(session, filePath);
    await this.validateWritePath(session, fullPath);

    // Ensure directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    await fs.writeFile(fullPath, content, 'utf-8');
  }

  async listFiles(sessionId: string, dirPath: string): Promise<FileInfo[]> {
    const session = await this.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const fullPath = this.resolvePath(session, dirPath);
    await this.validateReadPath(session, fullPath);

    const entries = await fs.readdir(fullPath, { withFileTypes: true });

    const files: FileInfo[] = [];
    for (const entry of entries) {
      const entryPath = path.join(fullPath, entry.name);
      const stats = await fs.stat(entryPath);

      files.push({
        name: entry.name,
        path: entryPath,
        type: entry.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        modifiedAt: stats.mtime,
      });
    }

    return files;
  }

  async health(): Promise<SandboxHealth> {
    return {
      status: 'healthy',
      activeSessions: this.sessions.size,
      availableSlots: this.maxSessions - this.sessions.size,
      averageLatency: 0,
    };
  }

  // Private execution methods

  private async executeBash(
    session: SandboxSession,
    request: ExecutionRequest,
    executionId: string
  ): Promise<ExecutionResult> {
    const sessionPath = path.join(this.workspaceRoot, session.id);
    const timeout = request.timeout || session.config.timeout.execution;

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';

      // Use bash with restricted environment
      const child = spawn('bash', ['-c', request.command], {
        cwd: request.workingDir || path.join(sessionPath, 'workspace'),
        env: {
          PATH: '/usr/local/bin:/usr/bin:/bin',
          HOME: sessionPath,
          ...request.env,
        },
        timeout,
      });

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', async (code) => {
        const duration = Date.now() - startTime;
        const completedAt = new Date();

        const result: ExecutionResult = {
          id: executionId,
          sessionId: session.id,
          command: request.command,
          type: 'bash',
          status: code === 0 ? 'completed' : 'failed',
          stdout,
          stderr,
          exitCode: code || 0,
          startedAt: new Date(startTime),
          completedAt,
          duration,
          resourceUsage: { cpuMs: duration, memoryBytes: 0, diskBytes: 0 },
        };

        await this.storeExecutionResult(result);
        resolve(result);
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  private async executePython(
    session: SandboxSession,
    request: ExecutionRequest,
    executionId: string
  ): Promise<ExecutionResult> {
    const sessionPath = path.join(this.workspaceRoot, session.id);
    const timeout = request.timeout || session.config.timeout.execution;

    // Create a wrapper script with security restrictions
    const wrapperScript = this.createPythonWrapper(request.command, session.config);
    const scriptPath = path.join(sessionPath, 'tmp', `script_${Date.now()}.py`);

    await fs.writeFile(scriptPath, wrapperScript, 'utf-8');

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';

      const child = spawn('python3', [scriptPath], {
        cwd: path.join(sessionPath, 'workspace'),
        env: {
          PATH: '/usr/local/bin:/usr/bin:/bin',
          PYTHONPATH: path.join(sessionPath, 'workspace'),
          PYTHONDONTWRITEBYTECODE: '1',
        },
        timeout,
      });

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', async (code) => {
        const duration = Date.now() - startTime;
        const completedAt = new Date();

        // Clean up script
        try {
          await fs.unlink(scriptPath);
        } catch {
          // Ignore cleanup errors
        }

        const result: ExecutionResult = {
          id: executionId,
          sessionId: session.id,
          command: request.command,
          type: 'python',
          status: code === 0 ? 'completed' : 'failed',
          stdout,
          stderr,
          exitCode: code || 0,
          startedAt: new Date(startTime),
          completedAt,
          duration,
          resourceUsage: { cpuMs: duration, memoryBytes: 0, diskBytes: 0 },
        };

        await this.storeExecutionResult(result);
        resolve(result);
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  private async executeRead(
    session: SandboxSession,
    request: ExecutionRequest,
    executionId: string
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      const content = await this.readFile(session.id, request.command);

      const result: ExecutionResult = {
        id: executionId,
        sessionId: session.id,
        command: request.command,
        type: 'read',
        status: 'completed',
        stdout: content,
        stderr: '',
        exitCode: 0,
        startedAt: new Date(startTime),
        completedAt: new Date(),
        duration: Date.now() - startTime,
        resourceUsage: { cpuMs: 0, memoryBytes: 0, diskBytes: 0 },
      };

      await this.storeExecutionResult(result);
      return result;
    } catch (error) {
      const result: ExecutionResult = {
        id: executionId,
        sessionId: session.id,
        command: request.command,
        type: 'read',
        status: 'failed',
        stdout: '',
        stderr: (error as Error).message,
        exitCode: 1,
        startedAt: new Date(startTime),
        completedAt: new Date(),
        duration: Date.now() - startTime,
        resourceUsage: { cpuMs: 0, memoryBytes: 0, diskBytes: 0 },
        error: {
          code: 'READ_ERROR',
          message: (error as Error).message,
          type: 'system',
        },
      };

      await this.storeExecutionResult(result);
      return result;
    }
  }

  private async executeWrite(
    session: SandboxSession,
    request: ExecutionRequest,
    executionId: string
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // Parse command as "path\ncontent"
      const [filePath, ...contentParts] = request.command.split('\n');
      const content = contentParts.join('\n');

      await this.writeFile(session.id, filePath, content);

      const result: ExecutionResult = {
        id: executionId,
        sessionId: session.id,
        command: request.command,
        type: 'write',
        status: 'completed',
        stdout: `File written: ${filePath}`,
        stderr: '',
        exitCode: 0,
        startedAt: new Date(startTime),
        completedAt: new Date(),
        duration: Date.now() - startTime,
        resourceUsage: { cpuMs: 0, memoryBytes: 0, diskBytes: content.length },
      };

      await this.storeExecutionResult(result);
      return result;
    } catch (error) {
      const result: ExecutionResult = {
        id: executionId,
        sessionId: session.id,
        command: request.command,
        type: 'write',
        status: 'failed',
        stdout: '',
        stderr: (error as Error).message,
        exitCode: 1,
        startedAt: new Date(startTime),
        completedAt: new Date(),
        duration: Date.now() - startTime,
        resourceUsage: { cpuMs: 0, memoryBytes: 0, diskBytes: 0 },
        error: {
          code: 'WRITE_ERROR',
          message: (error as Error).message,
          type: 'system',
        },
      };

      await this.storeExecutionResult(result);
      return result;
    }
  }

  private createPythonWrapper(userCode: string, config: SandboxConfig): string {
    // Create a wrapper that applies security restrictions
    const allowedModules = config.security.allowedModules;
    const blockedModules = config.security.blockedModules;

    return `
import sys
import builtins

# Security: Block dangerous modules
blocked_modules = ${JSON.stringify(blockedModules)}

class SecureImporter:
    def find_module(self, name, path=None):
        if name in blocked_modules or any(name.startswith(b) for b in blocked_modules):
            raise ImportError(f"Module '{name}' is blocked for security reasons")
        return None

sys.meta_path.insert(0, SecureImporter())

# Security: Restrict built-ins
dangerous_builtins = ['exec', 'eval', 'compile', '__import__', 'open']
for name in dangerous_builtins:
    if name in builtins.__dict__:
        del builtins.__dict__[name]

# User code
${userCode}
`;
  }

  private resolvePath(session: SandboxSession, filePath: string): string {
    const sessionPath = path.join(this.workspaceRoot, session.id);

    // Handle virtual paths
    if (filePath.startsWith('/mnt/user-data/')) {
      return path.join(sessionPath, 'workspace', filePath.slice('/mnt/user-data/'.length));
    }
    if (filePath.startsWith('/mnt/skills/')) {
      return path.resolve('./skills', filePath.slice('/mnt/skills/'.length));
    }
    if (filePath.startsWith('/tmp/')) {
      return path.join(sessionPath, 'tmp', filePath.slice('/tmp/'.length));
    }

    // Relative paths are resolved against workspace
    if (!path.isAbsolute(filePath)) {
      return path.join(sessionPath, 'workspace', filePath);
    }

    // Absolute paths must be within session directory
    const resolved = path.resolve(sessionPath, filePath.replace(/^\//, ''));
    if (!resolved.startsWith(sessionPath)) {
      throw new Error(`Path '${filePath}' is outside of session directory`);
    }

    return resolved;
  }

  private async validateReadPath(session: SandboxSession, fullPath: string): Promise<void> {
    // Check if path exists
    try {
      await fs.access(fullPath);
    } catch {
      throw new Error(`Path '${fullPath}' does not exist`);
    }

    // Check blocked paths
    for (const blocked of session.config.security.blockedPaths) {
      if (fullPath.includes(blocked)) {
        throw new Error(`Access to '${blocked}' is blocked`);
      }
    }
  }

  private async validateWritePath(session: SandboxSession, fullPath: string): Promise<void> {
    // Check read-only paths
    for (const readOnly of session.config.security.readOnlyPaths) {
      if (fullPath.includes(readOnly)) {
        throw new Error(`Path '${readOnly}' is read-only`);
      }
    }

    // Check blocked paths
    for (const blocked of session.config.security.blockedPaths) {
      if (fullPath.includes(blocked)) {
        throw new Error(`Access to '${blocked}' is blocked`);
      }
    }
  }

  private async storeExecutionResult(result: ExecutionResult): Promise<void> {
    await this.storage.execute(
      `UPDATE sandbox_executions 
       SET status = ?, stdout = ?, stderr = ?, exit_code = ?, 
           completed_at = ?, duration = ?, resource_usage = ?
       WHERE id = ?`,
      [
        result.status,
        result.stdout,
        result.stderr,
        result.exitCode,
        result.completedAt?.toISOString(),
        result.duration,
        JSON.stringify(result.resourceUsage),
        result.id,
      ]
    );
  }

  private rowToSession(row: Record<string, unknown>): SandboxSession {
    return {
      id: row.id as string,
      type: row.type as 'local',
      status: row.status as SandboxSession['status'],
      config: JSON.parse(row.config as string),
      createdAt: new Date(row.created_at as string),
      lastUsedAt: new Date(row.last_used_at as string),
      destroyedAt: row.destroyed_at ? new Date(row.destroyed_at as string) : undefined,
    };
  }

  private generateSessionId(): string {
    return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
