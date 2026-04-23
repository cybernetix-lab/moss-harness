import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { executeRunCommand } from "./run.js";
import { executeStatusCommand } from "./status.js";
import { executeEvaluateCommand } from "./evaluate.js";

export async function executeMcpCommand(): Promise<void> {
  const server = new Server(
    { name: "mosscli", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "start_moss_workflow",
          description: "Start a full moss-harness R&D workflow loop (Planner->Reviewer->Executor->Evaluator)",
          inputSchema: {
            type: "object",
            properties: {
              goal: { type: "string", description: "The R&D goal/task to accomplish" }
            },
            required: ["goal"]
          }
        },
        {
          name: "get_moss_status",
          description: "Get the current status of a mosscli workflow run",
          inputSchema: {
            type: "object",
            properties: {
              run_id: { type: "string", description: "The ID of the run to check" }
            }
          }
        },
        {
          name: "get_moss_report",
          description: "Get the final Markdown evaluation report for a mosscli run",
          inputSchema: {
            type: "object",
            properties: {
              run_id: { type: "string", description: "The ID of the run to get the report for" }
            },
            required: ["run_id"]
          }
        }
      ]
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    if (request.params.name === "start_moss_workflow") {
      const args = request.params.arguments as any;
      if (!args?.goal || typeof args.goal !== "string") {
        throw new Error("Missing or invalid 'goal' argument");
      }
      try {
        const result = executeRunCommand({ goal: args.goal });
        return { content: [{ type: "text", text: result }] };
      } catch (e: any) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
      }
    }

    if (request.params.name === "get_moss_status") {
      const args = request.params.arguments as any;
      try {
        const result = executeStatusCommand({ runId: args?.run_id });
        return { content: [{ type: "text", text: result }] };
      } catch (e: any) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
      }
    }

    if (request.params.name === "get_moss_report") {
      const args = request.params.arguments as any;
      if (!args?.run_id || typeof args.run_id !== "string") {
        throw new Error("Missing or invalid 'run_id' argument");
      }
      try {
        // Evaluate command provides the Markdown evaluation report
        const result = executeEvaluateCommand({ runId: args.run_id, format: "md" });
        return { content: [{ type: "text", text: result }] };
      } catch (e: any) {
        return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
      }
    }

    throw new Error(`Unknown tool: ${request.params.name}`);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
