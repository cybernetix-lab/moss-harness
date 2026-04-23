import { ISkillRepository } from '../domain/repositories/ISkillRepository';
import { Skill } from '../domain/models/Skill';

export class SkillService {
  constructor(private skillRepository: ISkillRepository) {}

  async getAllSkills(): Promise<Skill[]> {
    return this.skillRepository.findAll();
  }

  async getSkillById(id: string): Promise<Skill | null> {
    return this.skillRepository.findById(id);
  }

  async setSkillDisabled(id: string, isDisabled: boolean): Promise<Skill> {
    const skill = await this.skillRepository.findById(id);
    if (!skill) throw new Error('Skill not found');

    const updatedSkill: Skill = {
      ...skill,
      isDisabled,
      updatedAt: new Date()
    };

    await this.skillRepository.update(updatedSkill);
    return updatedSkill;
  }
}
