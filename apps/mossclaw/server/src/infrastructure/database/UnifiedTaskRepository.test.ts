import { describe, expect, it } from 'vitest';
import { UnifiedTaskRepository } from './UnifiedTaskRepository';
import type { Task } from '../../domain/models/task';

type Row = Record<string, unknown>;

class MockTaskQueryBuilder {
  private whereId?: string;

  constructor(
    private readonly rows: Row[],
    private readonly handlers: {
      insert: (data: Row) => Promise<void>;
      update: (id: string | undefined, data: Row) => Promise<void>;
      delete: (id: string | undefined) => Promise<void>;
    }
  ) {}

  where(column: string, _operator: string, value: unknown) {
    if (column === 'id' && typeof value === 'string') {
      this.whereId = value;
    }
    return this;
  }

  async first(): Promise<Row | null> {
    if (!this.whereId) {
      return this.rows[0] ?? null;
    }

    return this.rows.find((row) => row.id === this.whereId) ?? null;
  }

  async get(): Promise<Row[]> {
    return [...this.rows];
  }

  async insert(data: Row) {
    await this.handlers.insert(data);
    return {
      id: data.id as string,
      rowCount: 1
    };
  }

  async update(data: Row) {
    await this.handlers.update(this.whereId, data);
    return { rowCount: 1 };
  }

  async delete() {
    await this.handlers.delete(this.whereId);
    return { rowCount: 1 };
  }
}

function createStorage(options?: {
  rows?: Row[];
  onInsert?: (data: Row) => Promise<void> | void;
  onUpdate?: (id: string | undefined, data: Row) => Promise<void> | void;
}) {
  const rows = options?.rows ?? [];

  return {
    query: () =>
      new MockTaskQueryBuilder(rows, {
        insert: async (data) => {
          await options?.onInsert?.(data);
        },
        update: async (id, data) => {
          await options?.onUpdate?.(id, data);
        },
        delete: async () => undefined
      })
  };
}

const sampleTask: Task = {
  id: 'task-1',
  goal: 'Split the Task domain model and migrate the repository',
  status: 'pending',
  config: {
    entryAgentName: 'planner',
    priority: 'high'
  },
  stages: [
    {
      id: 'stage-1',
      name: 'Plan',
      status: 'completed'
    }
  ],
  artifacts: [],
  events: [],
  metrics: {
    completedStages: 1
  },
  createdAt: new Date('2026-04-14T10:00:00.000Z'),
  updatedAt: new Date('2026-04-14T10:05:00.000Z')
};

describe('UnifiedTaskRepository', () => {
  it('在现代 tasks 表中创建任务时不应再写入旧列 name/description/agentId', async () => {
    const insertedRows: Row[] = [];
    const repository = new UnifiedTaskRepository(
      createStorage({
        onInsert: (data) => {
          const unsupportedColumns = ['name', 'description', 'agentId'].filter((column) => column in data);
          if (unsupportedColumns.length > 0) {
            throw new Error(`table tasks has no column named ${unsupportedColumns[0]}`);
          }
          insertedRows.push(data);
        }
      }) as never
    );

    await expect(repository.create(sampleTask)).resolves.toBeUndefined();

    expect(insertedRows).toEqual([
      {
        id: 'task-1',
        goal: 'Split the Task domain model and migrate the repository',
        status: 'pending',
        config: JSON.stringify(sampleTask.config),
        stages: JSON.stringify(sampleTask.stages),
        artifacts: JSON.stringify(sampleTask.artifacts),
        events: JSON.stringify(sampleTask.events),
        metrics: JSON.stringify(sampleTask.metrics),
        createdAt: '2026-04-14T10:00:00.000Z',
        updatedAt: '2026-04-14T10:05:00.000Z'
      }
    ]);
  });

  it('在现代 tasks 表中更新任务时不应再写入旧列 name/description/agentId', async () => {
    const updatedRows: Array<{ id: string | undefined; data: Row }> = [];
    const repository = new UnifiedTaskRepository(
      createStorage({
        onUpdate: (id, data) => {
          const unsupportedColumns = ['name', 'description', 'agentId'].filter((column) => column in data);
          if (unsupportedColumns.length > 0) {
            throw new Error(`table tasks has no column named ${unsupportedColumns[0]}`);
          }
          updatedRows.push({ id, data });
        }
      }) as never
    );

    await expect(repository.update(sampleTask)).resolves.toBeUndefined();

    expect(updatedRows).toEqual([
      {
        id: 'task-1',
        data: {
          goal: 'Split the Task domain model and migrate the repository',
          status: 'pending',
          config: JSON.stringify(sampleTask.config),
          stages: JSON.stringify(sampleTask.stages),
          artifacts: JSON.stringify(sampleTask.artifacts),
          events: JSON.stringify(sampleTask.events),
          metrics: JSON.stringify(sampleTask.metrics),
          updatedAt: '2026-04-14T10:05:00.000Z'
        }
      }
    ]);
  });

  it('在历史 tasks 表仍要求旧列时应回退补写兼容字段', async () => {
    const insertedRows: Row[] = [];
    const repository = new UnifiedTaskRepository(
      createStorage({
        onInsert: (data) => {
          if (!('name' in data) || !('agentId' in data)) {
            throw new Error('NOT NULL constraint failed: tasks.name');
          }
          insertedRows.push(data);
        }
      }) as never
    );

    await expect(repository.create(sampleTask)).resolves.toBeUndefined();

    expect(insertedRows).toEqual([
      {
        id: 'task-1',
        goal: 'Split the Task domain model and migrate the repository',
        status: 'pending',
        config: JSON.stringify(sampleTask.config),
        stages: JSON.stringify(sampleTask.stages),
        artifacts: JSON.stringify(sampleTask.artifacts),
        events: JSON.stringify(sampleTask.events),
        metrics: JSON.stringify(sampleTask.metrics),
        createdAt: '2026-04-14T10:00:00.000Z',
        updatedAt: '2026-04-14T10:05:00.000Z',
        name: 'Split the Task domain model and migrate the repository',
        description: 'Split the Task domain model and migrate the repository',
        agentId: 'planner'
      }
    ]);
  });

  it('读取旧行结构时应回退到 description/name 与 agentId', async () => {
    const repository = new UnifiedTaskRepository(
      createStorage({
        rows: [
          {
            id: 'legacy-task',
            name: 'Legacy title',
            description: 'Legacy task goal',
            status: 'running',
            agentId: 'reviewer',
            createdAt: '2026-04-14T09:00:00.000Z',
            updatedAt: '2026-04-14T09:30:00.000Z'
          }
        ]
      }) as never
    );

    await expect(repository.findById('legacy-task')).resolves.toEqual({
      id: 'legacy-task',
      goal: 'Legacy task goal',
      status: 'running',
      config: {
        entryAgentName: 'reviewer'
      },
      stages: [],
      artifacts: [],
      events: [],
      metrics: {},
      createdAt: new Date('2026-04-14T09:00:00.000Z'),
      updatedAt: new Date('2026-04-14T09:30:00.000Z')
    });
  });
});
