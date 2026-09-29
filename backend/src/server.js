import http from "http";
import { createApp } from "./app.js";
import { connectDb } from "./config/db.js";
import { env } from "./config/env.js";
import { initSocket } from "./socket/index.js";

async function start() {
  await connectDb();
  const app = createApp();
  const server = http.createServer(app);
  initSocket(server);
  server.listen(env.port, () => console.log(`API running on ${env.port}`));
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
