import { runProcess } from "../shared/process.js";
import { getScriptPath } from "../shared/runtime.js";

interface RosterMember {
  id?: string;
}

interface LaneRoster {
  backup?: RosterMember[];
  experts?: RosterMember[];
}

export function bootstrapLanePresence(lane: string): string[] {
  const rosterOutput = runProcess(getScriptPath("roster-loader.sh"), {
    args: ["list", "--lane", lane],
  });
  const roster = JSON.parse(rosterOutput) as LaneRoster;
  const agentIds = new Set<string>();

  for (const member of [...(roster.backup ?? []), ...(roster.experts ?? [])]) {
    if (member.id && member.id.length > 0) {
      agentIds.add(member.id);
    }
  }

  for (const agentId of agentIds) {
    runProcess(getScriptPath("presence-manager.sh"), {
      args: [
        "set",
        "--lane",
        lane,
        "--agent",
        agentId,
        "--lifecycle",
        "idle",
        "--availability",
        "1",
      ],
    });
  }

  return [...agentIds];
}
