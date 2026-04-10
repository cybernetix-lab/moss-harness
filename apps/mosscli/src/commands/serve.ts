import { startMosscliServer } from "../web/server.js";

interface ServeCommandOptions {
  port: number;
}

export async function executeServeCommand(options: ServeCommandOptions): Promise<void> {
  await startMosscliServer(options.port);
  process.stdout.write(`mosscli read-only server listening on http://127.0.0.1:${options.port}\n`);
}
