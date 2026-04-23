import { Request, Response } from 'express';
import { AgentService } from '../../services/AgentService';
import { toAgentDto } from '../dtoMappers';
import type { Agent } from '../../domain/models/Agent';
import { isBadRequestError, requireObject, requireTrimmedString } from './requestParams';

export class AgentController {
  constructor(private agentService: AgentService) {}

  async createAgent(req: Request, res: Response) {
    try {
      const payload = requireObject(req.body, 'Agent payload') as Partial<Agent>;
      const agent = await this.agentService.createAgent(payload);
      res.status(201).json(toAgentDto(agent));
    } catch (error: any) {
      if (isBadRequestError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }

      if (error?.message === 'Agent not found') {
        res.status(404).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: error.message });
    }
  }

  async getAgents(req: Request, res: Response) {
    try {
      const agents = await this.agentService.getAllAgents();
      res.json(agents.map(toAgentDto));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  async getAgent(req: Request, res: Response) {
    try {
      const agentId = requireTrimmedString(req.params.id, 'Agent id');
      const agent = await this.agentService.getAgentById(agentId);
      if (!agent) return res.status(404).json({ error: 'Agent not found' });
      res.json(toAgentDto(agent));
    } catch (error: any) {
      if (isBadRequestError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }

      if (error?.message === 'Agent not found') {
        res.status(404).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: error.message });
    }
  }

  async updateAgent(req: Request, res: Response) {
    try {
      const agentId = requireTrimmedString(req.params.id, 'Agent id');
      const payload = requireObject(req.body, 'Agent payload') as Partial<Agent>;
      const agent = await this.agentService.updateAgent(agentId, payload);
      res.json(toAgentDto(agent));
    } catch (error: any) {
      if (isBadRequestError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }

      if (error?.message === 'Agent not found') {
        res.status(404).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: error.message });
    }
  }

  async deleteAgent(req: Request, res: Response) {
    try {
      const agentId = requireTrimmedString(req.params.id, 'Agent id');
      await this.agentService.deleteAgent(agentId);
      res.status(204).send();
    } catch (error: any) {
      if (isBadRequestError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }

      if (error?.message === 'Agent not found') {
        res.status(404).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: error.message });
    }
  }

  async disableAgent(req: Request, res: Response) {
    try {
      const agentId = requireTrimmedString(req.params.id, 'Agent id');
      const agent = await this.agentService.setAgentDisabled(agentId, true);
      res.json(toAgentDto(agent));
    } catch (error: any) {
      if (isBadRequestError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }

      if (error?.message === 'Agent not found') {
        res.status(404).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: error.message });
    }
  }

  async enableAgent(req: Request, res: Response) {
    try {
      const agentId = requireTrimmedString(req.params.id, 'Agent id');
      const agent = await this.agentService.setAgentDisabled(agentId, false);
      res.json(toAgentDto(agent));
    } catch (error: any) {
      if (isBadRequestError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }

      if (error?.message === 'Agent not found') {
        res.status(404).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: error.message });
    }
  }
}
