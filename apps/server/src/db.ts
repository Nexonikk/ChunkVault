import { createDb } from "@repo/db";

let _db: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    _db = createDb(url);
  }
  return _db;
}
