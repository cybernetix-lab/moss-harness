/**
 * Sandbox System Types
 *
 * Secure code execution environment with multiple backends
 * Supports Local, Docker, and Kubernetes sandbox modes
 */

// Sandbox types
export type SandboxType = 'local' | 'docker' | 'kubernetes';

// Sandbox status
export type SandboxStatus = 
  | 'creating'
  | 'ready'
  | 'busy'
  | 'destroyed'
  | 'error';

// Execution types
export type ExecutionType = 'bash' | 'python' | 'read' | 'write' | 'str_replace';

// Sandbox configuration
export interface SandboxConfig {
  type: SandboxType;
  
  // Resource limits
  resources: ResourceLimits;
  
  // Security settings
  security: SecurityConfig;
  
  // Path mappings
  mounts: PathMapping[];
  
  // Network settings
  network: NetworkConfig;
  
  // Timeout settings
  timeout: TimeoutConfig;
}

export interface ResourceLimits {
  cpuMs: number;           // Max CPU time in milliseconds
  memoryBytes: number;     // Max memory in bytes
  fileDescriptors: number; // Max file descriptors
  processes: number;       // Max processes (1 = single process)
  diskBytes: number;       // Max disk usage
}

export interface SecurityConfig {
  // Python restrictions
  allowedModules: string[];
  blockedModules: string[];
  allowExec: boolean;
  allowEval: boolean;
  allowCompile: boolean;
  
  // File restrictions
  allowedPaths: string[];
  blockedPaths: string[];
  readOnlyPaths: string[];
  
  // Network restrictions
  allowNetwork: boolean;
  allowedDomains: string[];
  blockedDomains: string[];
}

export interface PathMapping {
  hostPath: string;
  containerPath: string;
  readOnly: boolean;
}

export interface NetworkConfig {
  mode: 'none' | 'host' | 'bridge';
  proxy?: string;
  dns?: string[];
}

export interface TimeoutConfig {
  execution: number;       // Max execution time
  idle: number;           // Max idle time before cleanup
  cleanup: number;        // Cleanup delay after session end
}

// Sandbox session
export interface SandboxSession {
  id: string;
  type: SandboxType;
  status: SandboxStatus;
  config: SandboxConfig;
  createdAt: Date;
  lastUsedAt: Date;
  destroyedAt?: Date;
  url?: string;           // For remote sandboxes (Docker/K8s)
}

// Execution request
export interface ExecutionRequest {
  sessionId: string;
  command: string;
  type: ExecutionType;
  workingDir?: string;
  env?: Record<string, string>;
  timeout?: number;
}

// Execution result
export interface ExecutionResult {
  id: string;
  sessionId: string;
  command: string;
  type: ExecutionType;
  status: 'pending' | 'running' | 'completed' | 'failed';
  
  // Output
  stdout: string;
  stderr: string;
  exitCode: number;
  
  // Timing
  startedAt: Date;
  completedAt?: Date;
  duration: number;
  
  // Resources
  resourceUsage: ResourceUsage;
  
  // Error
  error?: ExecutionError;
}

export interface ResourceUsage {
  cpuMs: number;
  memoryBytes: number;
  diskBytes: number;
}

export interface ExecutionError {
  code: string;
  message: string;
  type: 'timeout' | 'memory' | 'cpu' | 'security' | 'system' | 'unknown';
}

// Sandbox provider interface
export interface ISandboxProvider {
  // Lifecycle
  create(config: SandboxConfig): Promise<SandboxSession>;
  destroy(sessionId: string): Promise<void>;
  get(sessionId: string): Promise<SandboxSession | null>;
  
  // Execution
  execute(sessionId: string, request: ExecutionRequest): Promise<ExecutionResult>;
  
  // File operations
  readFile(sessionId: string, path: string): Promise<string>;
  writeFile(sessionId: string, path: string, content: string): Promise<void>;
  listFiles(sessionId: string, path: string): Promise<FileInfo[]>;
  
  // Health check
  health(): Promise<SandboxHealth>;
}

export interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modifiedAt: Date;
}

export interface SandboxHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  activeSessions: number;
  availableSlots: number;
  averageLatency: number;
}

// Kubernetes provisioner types
export interface K8sProvisionerConfig {
  namespace: string;
  image: string;
  kubeconfigPath: string;
  nodeHost: string;
  apiServer?: string;
  
  // Resource defaults
  defaultResources: {
    cpu: string;
    memory: string;
    storage: string;
  };
}

export interface K8sSandboxSpec {
  sandboxId: string;
  threadId: string;
  resources?: {
    cpu?: string;
    memory?: string;
    storage?: string;
  };
}

// Sandbox manager
export interface ISandboxManager {
  // Provider management
  registerProvider(type: SandboxType, provider: ISandboxProvider): void;
  getProvider(type: SandboxType): ISandboxProvider;
  
  // Session management
  create(type: SandboxType, config?: Partial<SandboxConfig>): Promise<SandboxSession>;
  destroy(sessionId: string): Promise<void>;
  get(sessionId: string): Promise<SandboxSession | null>;
  
  // Execution
  execute(sessionId: string, request: ExecutionRequest): Promise<ExecutionResult>;
  
  // Cleanup
  cleanupExpired(): Promise<number>;
  cleanupAll(): Promise<void>;
}

// Default configurations
export const DEFAULT_LOCAL_CONFIG: SandboxConfig = {
  type: 'local',
  resources: {
    cpuMs: 15000,        // 15 seconds
    memoryBytes: 512 * 1024 * 1024,  // 512MB
    fileDescriptors: 64,
    processes: 1,
    diskBytes: 1024 * 1024 * 1024,   // 1GB
  },
  security: {
    allowedModules: [
      'math', 'json', 'datetime', 're', 'collections',
      'itertools', 'functools', 'typing', 'enum',
      'numpy', 'pandas', 'matplotlib', 'requests',
    ],
    blockedModules: ['os', 'sys', 'subprocess', 'socket', 'urllib'],
    allowExec: false,
    allowEval: false,
    allowCompile: false,
    allowedPaths: ['/tmp', '/workspace'],
    blockedPaths: ['/etc', '/root', '/home'],
    readOnlyPaths: [],
    allowNetwork: true,
    allowedDomains: ['api.github.com', 'pypi.org', 'files.pythonhosted.org'],
    blockedDomains: [],
  },
  mounts: [
    { hostPath: './skills', containerPath: '/mnt/skills', readOnly: true },
    { hostPath: './workspace', containerPath: '/mnt/user-data', readOnly: false },
  ],
  network: {
    mode: 'host',
  },
  timeout: {
    execution: 60000,    // 1 minute
    idle: 300000,        // 5 minutes
    cleanup: 60000,      // 1 minute
  },
};

export const DEFAULT_DOCKER_CONFIG: SandboxConfig = {
  type: 'docker',
  resources: {
    cpuMs: 60000,        // 1 minute
    memoryBytes: 2 * 1024 * 1024 * 1024,  // 2GB
    fileDescriptors: 256,
    processes: 10,
    diskBytes: 10 * 1024 * 1024 * 1024,   // 10GB
  },
  security: {
    allowedModules: ['*'],  // Allow all in Docker
    blockedModules: [],
    allowExec: true,
    allowEval: true,
    allowCompile: true,
    allowedPaths: ['/workspace'],
    blockedPaths: [],
    readOnlyPaths: ['/mnt/skills'],
    allowNetwork: true,
    allowedDomains: ['*'],
    blockedDomains: [],
  },
  mounts: [
    { hostPath: './skills', containerPath: '/mnt/skills', readOnly: true },
    { hostPath: './workspace', containerPath: '/mnt/user-data', readOnly: false },
  ],
  network: {
    mode: 'bridge',
  },
  timeout: {
    execution: 300000,   // 5 minutes
    idle: 600000,        // 10 minutes
    cleanup: 300000,     // 5 minutes
  },
};

export const DEFAULT_K8S_CONFIG: SandboxConfig = {
  type: 'kubernetes',
  resources: {
    cpuMs: 300000,       // 5 minutes
    memoryBytes: 4 * 1024 * 1024 * 1024,  // 4GB
    fileDescriptors: 1024,
    processes: 50,
    diskBytes: 50 * 1024 * 1024 * 1024,   // 50GB
  },
  security: {
    allowedModules: ['*'],
    blockedModules: [],
    allowExec: true,
    allowEval: true,
    allowCompile: true,
    allowedPaths: ['/workspace'],
    blockedPaths: [],
    readOnlyPaths: ['/mnt/skills'],
    allowNetwork: true,
    allowedDomains: ['*'],
    blockedDomains: [],
  },
  mounts: [
    { hostPath: './skills', containerPath: '/mnt/skills', readOnly: true },
    { hostPath: './workspace', containerPath: '/mnt/user-data', readOnly: false },
  ],
  network: {
    mode: 'bridge',
  },
  timeout: {
    execution: 1800000,  // 30 minutes
    idle: 3600000,       // 1 hour
    cleanup: 600000,     // 10 minutes
  },
};
