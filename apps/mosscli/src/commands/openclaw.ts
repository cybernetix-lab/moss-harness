import { exec } from "child_process";
import util from "util";

const execAsync = util.promisify(exec);

export async function executeOpenclawCommand(): Promise<void> {
  console.log("Migrating mosscli as an OpenClaw MCP server...");

  try {
    await execAsync(`openclaw config set mcp.servers.mosscli.command "mosscli"`);
    await execAsync(`openclaw config set mcp.servers.mosscli.args '["mcp"]'`);
    console.log("Successfully registered mosscli MCP server to OpenClaw.");
    
    console.log("Restarting OpenClaw gateway...");
    await execAsync(`openclaw gateway restart`);
    console.log("Migration complete! You can now use mosscli as an agent from OpenClaw.");
  } catch (error: any) {
    console.error("Failed to integrate with OpenClaw. Are you sure 'openclaw' CLI is installed and available?");
    console.error(error.message);
  }
}
