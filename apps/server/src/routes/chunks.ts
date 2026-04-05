import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { chunks } from "@repo/db";

export const chunksRouter = new Hono();

const uploadsDir = path.resolve(process.env.UPLOADS_DIR || "./uploads");

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ─── Schemas ───────────────────────────────────────────────────────────────

const uploadSchema = z.object({
  chunkId: z.string().min(1, "chunkId is required"),
  data: z.string().min(1, "data is required"),
});

const reconcileSchema = z.object({
  chunkIds: z.array(z.string()),
});

// ─── POST /api/chunks/upload ─────────────────────────────────────────────
// 1. Write chunk to local filesystem (simulated S3 bucket)
// 2. Upsert into DB with status="uploaded" (idempotent)
// 3. Return success

chunksRouter.post(
  "/upload",
  zValidator("json", uploadSchema),
  async (c) => {
    const { chunkId, data } = c.req.valid("json");

    try {
      // Step 1: Write to filesystem (simulated bucket)
      const filePath = path.join(uploadsDir, `${chunkId}.txt`);
      fs.writeFileSync(filePath, data, "utf-8");

      // Step 2: Upsert in DB — idempotent via ON CONFLICT DO UPDATE
      const db = getDb();
      await db
        .insert(chunks)
        .values({
          chunkId,
          status: "uploaded",
          data: data.substring(0, 500), // store preview only
        })
        .onConflictDoUpdate({
          target: chunks.chunkId,
          set: {
            status: "uploaded",
            updatedAt: new Date(),
          },
        });

      return c.json({
        success: true,
        chunkId,
        message: "Chunk uploaded and acknowledged",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`Failed to upload chunk ${chunkId}:`, error);
      return c.json(
        {
          success: false,
          chunkId,
          error: "Failed to process chunk",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500
      );
    }
  }
);

// ─── GET /api/chunks ─────────────────────────────────────────────────────
// Returns all acknowledged chunks from DB

chunksRouter.get("/", async (c) => {
  try {
    const db = getDb();
    const allChunks = await db.select().from(chunks).orderBy(chunks.createdAt);
    return c.json({ chunks: allChunks, total: allChunks.length });
  } catch (error) {
    console.error("Failed to fetch chunks:", error);
    return c.json({ error: "Failed to fetch chunks" }, 500);
  }
});

// ─── GET /api/chunks/:chunkId/exists ─────────────────────────────────────
// Check if a specific chunk exists in the bucket (filesystem)

chunksRouter.get("/:chunkId/exists", async (c) => {
  const chunkId = c.req.param("chunkId");
  const filePath = path.join(uploadsDir, `${chunkId}.txt`);
  const existsInBucket = fs.existsSync(filePath);

  let existsInDb = false;
  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(chunks)
      .where(eq(chunks.chunkId, chunkId));
    existsInDb = !!row;
  } catch (_) {}

  return c.json({ chunkId, existsInBucket, existsInDb });
});

// ─── POST /api/chunks/reconcile ──────────────────────────────────────────
// Given a list of chunkIds the client has in OPFS,
// returns which ones are missing from the bucket so client can re-upload

chunksRouter.post(
  "/reconcile",
  zValidator("json", reconcileSchema),
  async (c) => {
    const { chunkIds } = c.req.valid("json");

    const missing: string[] = [];
    const present: string[] = [];

    for (const chunkId of chunkIds) {
      const filePath = path.join(uploadsDir, `${chunkId}.txt`);
      if (!fs.existsSync(filePath)) {
        missing.push(chunkId);
      } else {
        present.push(chunkId);
      }
    }

    return c.json({
      missing,
      present,
      totalChecked: chunkIds.length,
      missingCount: missing.length,
    });
  }
);

// ─── GET /api/chunks/stats ───────────────────────────────────────────────
// Dashboard stats

chunksRouter.get("/stats", async (c) => {
  try {
    const db = getDb();
    const allChunks = await db.select().from(chunks);

    // Count files on disk
    const files = fs.readdirSync(uploadsDir).filter((f) => f.endsWith(".txt"));

    // Find orphans: in DB but not on disk
    const orphanedInDb = allChunks.filter((chunk) => {
      const filePath = path.join(uploadsDir, `${chunk.chunkId}.txt`);
      return !fs.existsSync(filePath);
    });

    // Files on disk not in DB
    const dbChunkIds = new Set(allChunks.map((c) => c.chunkId));
    const orphanedOnDisk = files
      .map((f) => f.replace(".txt", ""))
      .filter((id) => !dbChunkIds.has(id));

    return c.json({
      totalInDb: allChunks.length,
      totalOnDisk: files.length,
      orphanedInDb: orphanedInDb.length,
      orphanedOnDisk: orphanedOnDisk.length,
      consistent: orphanedInDb.length === 0 && orphanedOnDisk.length === 0,
      uploadsDir,
    });
  } catch (error) {
    console.error("Stats error:", error);
    return c.json({ error: "Failed to get stats" }, 500);
  }
});

// ─── DELETE /api/chunks/:chunkId ─────────────────────────────────────────
// For testing: delete a chunk from bucket to simulate inconsistency

chunksRouter.delete("/:chunkId", async (c) => {
  const chunkId = c.req.param("chunkId");
  const filePath = path.join(uploadsDir, `${chunkId}.txt`);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return c.json({ success: true, message: `Deleted ${chunkId} from bucket` });
  }
  return c.json({ success: false, message: "File not found in bucket" }, 404);
});
