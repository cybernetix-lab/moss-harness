import { Memory } from '../models/Memory';

export interface IMemoryRepository {
  findById(id: string): Promise<Memory | null>;
  findAll(sessionId?: string): Promise<Memory[]>;
  create(memory: Memory): Promise<void>;
  update(memory: Memory): Promise<void>;
  delete(id: string): Promise<void>;
}
