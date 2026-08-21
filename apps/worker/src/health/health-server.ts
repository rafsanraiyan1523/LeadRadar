import { createServer } from "node:http";
import type { HealthCheckResult } from "@lead-radar/types";
import { connection } from "../lib/redis";
import { logger } from "../lib/logger";
import { env } from "../config/env";

async function checkRedis(): Promise<{ status: "ok" | "error"; message?: string }> {
  try {
    const pong = await connection.ping();
    return pong === "PONG"
      ? { status: "ok" }
      : { status: "error", message: `unexpected reply: ${pong}` };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
}

export function startHealthServer(): void {
  const server = createServer(async (req, res) => {
    if (req.url !== "/health") {
      res.writeHead(404).end();
      return;
    }

    const redis = await checkRedis();
    const result: HealthCheckResult = {
      status: redis.status === "ok" ? "ok" : "error",
      service: "worker",
      timestamp: new Date().toISOString(),
      checks: { redis },
    };

    res.writeHead(result.status === "ok" ? 200 : 503, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  });

  server.listen(env.healthPort, () => {
    logger.info(`Worker health server listening on port ${env.healthPort}`);
  });
}
