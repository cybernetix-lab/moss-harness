import { describe, expect, it } from 'vitest';
import { ensureTaskTableShape } from './taskSchema';
import type { IStorage, QueryResult } from '@agent-harness/core/storage/types';

function createQueryResult(command = 'OK'): QueryResult {
  return {
    rows: [],
    rowCount: 0,
    command,
  };
}

describe('ensureTaskTableShape', () => {
  it('补齐 tasks 新列并回填旧数据到 goal 与 config.entryAgentName', async () => {
    const executedSql: string[] = [];

    const storage = {
      execute: async (sql: string) => {
        executedSql.push(sql);
        return createQueryResult();
      },
    } satisfies Pick<IStorage, 'execute'>;

    await ensureTaskTableShape(storage as IStorage);

    expect(executedSql.some((sql) => sql.includes('ALTER TABLE tasks ADD COLUMN goal TEXT'))).toBe(true);
    expect(
      executedSql.some((sql) => sql.includes("ALTER TABLE tasks ADD COLUMN config TEXT NOT NULL DEFAULT '{}'"))
    ).toBe(true);
    expect(executedSql.some((sql) => sql.includes('UPDATE tasks'))).toBe(true);
    expect(executedSql.some((sql) => sql.includes('entryAgentName'))).toBe(true);
    expect(executedSql.some((sql) => sql.includes('COALESCE(NULLIF(goal'))).toBe(true);
  });
});
