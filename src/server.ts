import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { closePool } from "./database/connection/pool.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`Admin API listening on http://localhost:${env.PORT}`);
  console.log(`Health check: http://localhost:${env.PORT}/api/v1/health`);
});

async function shutdown(signal: string) {
  console.log(`Received ${signal}. Shutting down...`);
  server.close(async () => {
    try {
      await closePool();
      console.log("PostgreSQL pool closed");
      process.exit(0);
    } catch (error) {
      console.error("Error during shutdown", error);
      process.exit(1);
    }
  });
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
