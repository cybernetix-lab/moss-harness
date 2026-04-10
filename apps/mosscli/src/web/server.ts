import http from "node:http";

import { handleMosscliRequest } from "./routes.js";

export function startMosscliServer(port: number): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      handleMosscliRequest(req, res);
    });

    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(server);
    });
  });
}
