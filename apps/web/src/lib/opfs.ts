/**
 * OPFS (Origin Private File System) Utility
 *
 * Acts as the durable client-side buffer for recording chunks.
 * Chunks are written here BEFORE any network call, and deleted
 * ONLY after both bucket upload AND DB ack are confirmed.
 *
 * OPFS is sandboxed per-origin, persists across page reloads,
 * and survives browser crashes (unlike IndexedDB in some edge cases).
 */

export interface ChunkData {
  chunkId: string;
  data: string;
  createdAt: number;
  uploadedAt?: number;
}

const OPFS_DIR = "chunkvault";

// ── Get or create the chunkvault directory in OPFS ──────────────────────

async function getDir(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(OPFS_DIR, { create: true });
}

// ── Write a chunk to OPFS ───────────────────────────────────────────────

export async function writeChunkToOPFS(chunk: ChunkData): Promise<void> {
  try {
    const dir = await getDir();
    const fileHandle = await dir.getFileHandle(`${chunk.chunkId}.json`, {
      create: true,
    });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(chunk));
    await writable.close();
  } catch (error) {
    console.error(`[OPFS] Failed to write chunk ${chunk.chunkId}:`, error);
    throw error;
  }
}

// ── Read a single chunk from OPFS ───────────────────────────────────────

export async function readChunkFromOPFS(
  chunkId: string
): Promise<ChunkData | null> {
  try {
    const dir = await getDir();
    const fileHandle = await dir.getFileHandle(`${chunkId}.json`);
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text) as ChunkData;
  } catch {
    return null;
  }
}

// ── Read all chunks from OPFS ────────────────────────────────────────────
// Used on page load for recovery scan

export async function readAllChunksFromOPFS(): Promise<ChunkData[]> {
  const chunks: ChunkData[] = [];
  try {
    const dir = await getDir();
    for await (const [name, handle] of dir.entries()) {
      if (name.endsWith(".json") && handle.kind === "file") {
        try {
          const file = await (handle as FileSystemFileHandle).getFile();
          const text = await file.text();
          const chunk = JSON.parse(text) as ChunkData;
          chunks.push(chunk);
        } catch (e) {
          console.warn(`[OPFS] Could not read ${name}:`, e);
        }
      }
    }
  } catch (error) {
    console.error("[OPFS] Failed to read all chunks:", error);
  }
  return chunks.sort((a, b) => a.createdAt - b.createdAt);
}

// ── Delete a chunk from OPFS ─────────────────────────────────────────────
// Only called AFTER confirmed bucket + DB success

export async function deleteChunkFromOPFS(chunkId: string): Promise<void> {
  try {
    const dir = await getDir();
    await dir.removeEntry(`${chunkId}.json`);
  } catch (error) {
    console.warn(`[OPFS] Failed to delete chunk ${chunkId}:`, error);
  }
}

// ── Mark chunk as uploaded in OPFS ──────────────────────────────────────
// Optional: update the OPFS record to note upload time before deleting

export async function markChunkUploadedInOPFS(
  chunkId: string
): Promise<void> {
  const chunk = await readChunkFromOPFS(chunkId);
  if (chunk) {
    await writeChunkToOPFS({ ...chunk, uploadedAt: Date.now() });
  }
}

// ── Get count of pending chunks ──────────────────────────────────────────

export async function getPendingChunkCount(): Promise<number> {
  const all = await readAllChunksFromOPFS();
  return all.filter((c) => !c.uploadedAt).length;
}

// ── Check if OPFS is supported ───────────────────────────────────────────

export function isOPFSSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "storage" in navigator &&
    "getDirectory" in navigator.storage
  );
}

// ── Get OPFS storage estimate ────────────────────────────────────────────

export async function getStorageEstimate(): Promise<{
  used: number;
  quota: number;
  usedMB: string;
  quotaMB: string;
}> {
  const estimate = await navigator.storage.estimate();
  const used = estimate.usage || 0;
  const quota = estimate.quota || 0;
  return {
    used,
    quota,
    usedMB: (used / 1024 / 1024).toFixed(2),
    quotaMB: (quota / 1024 / 1024).toFixed(0),
  };
}
