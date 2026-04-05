import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

import { chunksRouter } from "./routes/chunks";

const app = new Hono();

// Ensure uploads dir exists
const uploadsDir = process.env.UPLOADS_DIR || "./uploads";
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use("*", logger());
app.use("*", prettyJSON());
app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3001",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// Health check
app.get("/", (c) => {
  return c.json({
    status: "ok",
    service: "recoding-pipeline-server",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.route("/api/chunks", chunksRouter);

// 404
app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error("Server error:", err);
  return c.json({ error: "Internal server error", message: err.message }, 500);
});

const port = parseInt(process.env.PORT || "3000");

console.log(`🚀 Server starting on port ${port}`);
console.log(`📁 Uploads directory: ${path.resolve(uploadsDir)}`);

serve({
  fetch: app.fetch,
  port,
});

export default app;
