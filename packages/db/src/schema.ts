import { pgTable, text, timestamp, serial } from "drizzle-orm/pg-core";

export const chunks = pgTable("chunks", {
  id: serial("id").primaryKey(),
  chunkId: text("chunk_id").notNull().unique(),
  status: text("status").notNull().default("uploaded"),
  data: text("data"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Chunk = typeof chunks.$inferSelect;
export type NewChunk = typeof chunks.$inferInsert;
