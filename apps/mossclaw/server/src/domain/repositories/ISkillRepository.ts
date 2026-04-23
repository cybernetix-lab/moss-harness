import { Skill } from '../models/Skill';

export interface ISkillRepository {
  findById(id: string): Promise<Skill | null>;
  findByName(name: string): Promise<Skill | null>;
  findAll(): Promise<Skill[]>;
  create(skill: Skill): Promise<void>;
  update(skill: Skill): Promise<void>;
  delete(id: string): Promise<void>;
}
