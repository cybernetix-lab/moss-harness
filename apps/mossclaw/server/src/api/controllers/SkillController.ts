import { Request, Response } from 'express';
import { SkillService } from '../../services/SkillService';
import { toSkillDto } from '../dtoMappers';
import { isBadRequestError, requireTrimmedString } from './requestParams';

export class SkillController {
  constructor(private skillService: SkillService) {}

  async getSkills(req: Request, res: Response) {
    try {
      const skills = await this.skillService.getAllSkills();
      res.json(skills.map(toSkillDto));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getSkill(req: Request, res: Response) {
    try {
      const skillId = requireTrimmedString(req.params.id, 'Skill id');
      const skill = await this.skillService.getSkillById(skillId);
      if (!skill) return res.status(404).json({ error: 'Skill not found' });
      res.json(toSkillDto(skill));
    } catch (error: any) {
      if (isBadRequestError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }

      if (error?.message === 'Skill not found') {
        res.status(404).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: error.message });
    }
  }

  async disableSkill(req: Request, res: Response) {
    try {
      const skillId = requireTrimmedString(req.params.id, 'Skill id');
      const skill = await this.skillService.setSkillDisabled(skillId, true);
      res.json(toSkillDto(skill));
    } catch (error: any) {
      if (isBadRequestError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }

      if (error?.message === 'Skill not found') {
        res.status(404).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: error.message });
    }
  }

  async enableSkill(req: Request, res: Response) {
    try {
      const skillId = requireTrimmedString(req.params.id, 'Skill id');
      const skill = await this.skillService.setSkillDisabled(skillId, false);
      res.json(toSkillDto(skill));
    } catch (error: any) {
      if (isBadRequestError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }

      if (error?.message === 'Skill not found') {
        res.status(404).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: error.message });
    }
  }
}
