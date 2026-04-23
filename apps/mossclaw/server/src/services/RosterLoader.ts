import fs from 'fs/promises';
import path from 'path';
import yaml from 'yaml';
import { IAgentRepository } from '../domain/repositories/IAgentRepository';
import { ISkillRepository } from '../domain/repositories/ISkillRepository';
import { Agent } from '../domain/models/Agent';
import { Skill } from '../domain/models/Skill';
import { v4 as uuidv4 } from 'uuid';

export class RosterLoader {
  constructor(
    private agentRepo: IAgentRepository,
    private skillRepo: ISkillRepository,
    private projectRoot: string
  ) {}

  /**
   * Load and sync all YAML configurations to the database
   */
  async syncAll(): Promise<void> {
    console.log('[RosterLoader] Starting YAML configuration sync...');
    await this.syncSkills();
    await this.syncAgents();
    console.log('[RosterLoader] Sync completed successfully.');
  }

  private resolveSkillCategory(config: any): Skill['category'] {
    const tags = Array.isArray(config?.tags)
      ? config.tags.map((tag: string) => String(tag).toLowerCase())
      : [];

    if (tags.includes('review') || tags.includes('security')) {
      return 'review';
    }

    if (tags.includes('research') || tags.includes('documentation')) {
      return 'research';
    }

    if (tags.includes('ops') || tags.includes('automation') || tags.includes('monitoring')) {
      return 'ops';
    }

    if (tags.includes('communication') || tags.includes('collaboration')) {
      return 'communication';
    }

    return 'coding';
  }

  private async syncAgents(): Promise<void> {
    const agentsDir = path.join(this.projectRoot, 'configs', 'agents');
    
    try {
      const files = await fs.readdir(agentsDir);
      const yamlFiles = files.filter(f => f.endsWith('.yaml') && f !== 'README.md' && f !== 'agent-evolution.yaml' && f !== 'models.yaml');

      for (const file of yamlFiles) {
        const filePath = path.join(agentsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const config = yaml.parse(content);

        // Some configs might wrap the agent in an `agent:` key
        const agentConfig = config.agent || config;

        if (!agentConfig.name) {
          console.warn(`[RosterLoader] Skipping file ${file}: Missing 'name' field.`);
          continue;
        }

        const existingAgent = await this.agentRepo.findByName(agentConfig.name);

        const agentData: Agent = {
          id: existingAgent ? existingAgent.id : uuidv4(),
          name: agentConfig.name,
          type: agentConfig.type || 'custom',
          description: agentConfig.description || '',
          systemPrompt: agentConfig.system_prompt || '',
          modelConfig: {
            provider: agentConfig.model?.provider || 'anthropic',
            modelName: agentConfig.model?.model || 'claude-3-5-sonnet',
            temperature: agentConfig.model?.temperature || 0.3,
            maxTokens: agentConfig.model?.max_tokens || 4096
          },
          status: 'IDLE',
          isBuiltin: true,
          isDisabled: existingAgent?.isDisabled ?? false,
          createdAt: existingAgent ? existingAgent.createdAt : new Date(),
          updatedAt: new Date()
        };

        // We also want to store the extra tools and capabilities in metadata/customData if needed,
        // but for now we map it to the defined Agent domain model.
        // If your domain model supports `tools` or `atomic_capabilities`, add them here.

        if (existingAgent) {
          await this.agentRepo.update(agentData);
          console.log(`[RosterLoader] Updated existing Agent: ${agentConfig.name}`);
        } else {
          await this.agentRepo.create(agentData);
          console.log(`[RosterLoader] Created new Agent: ${agentConfig.name}`);
        }
      }
    } catch (error) {
      console.error('[RosterLoader] Error syncing agents:', error);
    }
  }

  private async syncSkills(): Promise<void> {
    const skillsBaseDir = path.join(this.projectRoot, 'integrations', 'skills');
    
    try {
      // Get all subdirectories in integrations/skills
      const entries = await fs.readdir(skillsBaseDir, { withFileTypes: true });
      const skillDirs = entries.filter(e => e.isDirectory() && e.name !== 'evolution').map(e => e.name);

      for (const dir of skillDirs) {
        const skillYamlPath = path.join(skillsBaseDir, dir, 'skill.yaml');
        
        try {
          // Check if skill.yaml exists
          await fs.access(skillYamlPath);
          
          const content = await fs.readFile(skillYamlPath, 'utf-8');
          const config = yaml.parse(content);

          const existingSkill = await this.skillRepo.findByName(config.name);

          // Map YAML structure to our Domain Model
          const skillData: Skill = {
            id: existingSkill ? existingSkill.id : uuidv4(),
            name: config.name,
            category: this.resolveSkillCategory(config),
            version: config.version || '1.0.0',
            description: config.description || '',
            author: 'system',
            triggers: config.triggers || [],
            patterns: config.patterns || [],
            actions: Array.isArray(config.actions)
              ? config.actions.map((action: any) => ({
                  type: action.type || 'custom',
                  description: action.description || '',
                  steps: Array.isArray(action.steps)
                    ? action.steps.map((step: any) => String(step))
                    : []
                }))
              : [],
            contextRequirements: config.context || {},
            validation: config.validation || [],
            examples: [], // Examples are not in the current yaml
            uiMetadata: {
              dependencies: config.related_skills || []
            },
            isBuiltin: true,
            isDisabled: existingSkill?.isDisabled ?? false,
            createdAt: existingSkill ? existingSkill.createdAt : new Date(),
            updatedAt: new Date()
          };

          if (existingSkill) {
            await this.skillRepo.update(skillData);
            console.log(`[RosterLoader] Updated existing Skill: ${config.name}`);
          } else {
            await this.skillRepo.create(skillData);
            console.log(`[RosterLoader] Created new Skill: ${config.name}`);
          }
        } catch (e: any) {
          // Ignore directories without skill.yaml
          if (e.code !== 'ENOENT') {
            console.error(`[RosterLoader] Error processing skill in ${dir}:`, e);
          }
        }
      }
    } catch (error) {
      console.error('[RosterLoader] Error syncing skills:', error);
    }
  }
}
