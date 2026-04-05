import type { ChunkData } from "./opfs";
import {
  writeChunkToOPFS,
  deleteChunkFromOPFS,
  markChunkUploadedInOPFS,
} from "./opfs";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export interface UploadResult {
  chunkId: string;
  success: boolean;
  error?: string;
  retries: number;
}

export async function uploadChunk(
  chunk: ChunkData,
  maxRetries = 3
): Promise<UploadResult> {
  let lastError: string = "";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`${API_URL}/api/chunks/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chunkId: chunk.chunkId, data: chunk.data }),
      });

      if (res.ok) {
        await markChunkUploadedInOPFS(chunk.chunkId);
        await deleteChunkFromOPFS(chunk.chunkId);
        return { chunkId: chunk.chunkId, success: true, retries: attempt };
      }

      const body = await res.json().catch(() => ({}));
      lastError = body.error || `HTTP ${res.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Network error";
    }

    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 100 * Math.pow(2, attempt)));
    }
  }

  return { chunkId: chunk.chunkId, success: false, error: lastError, retries: maxRetries };
}

// transcriptData is the speech text collected during this 5s window
export function createChunk(
  sessionId: string,
  index: number,
  transcriptData?: string
): ChunkData {
  const chunkId = `${sessionId}-chunk-${String(index).padStart(4, "0")}`;
  const data = JSON.stringify({
    chunkId,
    index,
    timestamp: Date.now(),
    transcript: transcriptData || null,
    payload: `recording-data-block-${index}-${"x".repeat(256)}`,
  });
  return { chunkId, data, createdAt: Date.now() };
}

export async function persistAndUpload(
  chunk: ChunkData,
  onStatus?: (status: "persisted" | "uploaded" | "failed", chunkId: string) => void
): Promise<UploadResult> {
  await writeChunkToOPFS(chunk);
  onStatus?.("persisted", chunk.chunkId);
  const result = await uploadChunk(chunk);
  onStatus?.(result.success ? "uploaded" : "failed", chunk.chunkId);
  return result;
}

export async function reconcileOPFSChunks(
  pendingChunks: ChunkData[],
  onProgress?: (done: number, total: number, result: UploadResult) => void
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];
  for (let i = 0; i < pendingChunks.length; i++) {
    const chunk = pendingChunks[i]!;
    const result = await uploadChunk(chunk);
    results.push(result);
    onProgress?.(i + 1, pendingChunks.length, result);
  }
  return results;
}

export function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}