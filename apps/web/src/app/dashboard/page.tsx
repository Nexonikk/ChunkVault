"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Square, RefreshCw, Activity, Database, HardDrive,
  CheckCircle, XCircle, AlertTriangle, Clock, ArrowLeft,
  Wifi, WifiOff, Trash2, Mic, MicOff, Copy,
} from "lucide-react";
import Link from "next/link";
import { readAllChunksFromOPFS, isOPFSSupported, type ChunkData } from "@/lib/opfs";
import { createChunk, persistAndUpload, reconcileOPFSChunks, generateSessionId } from "@/lib/upload";
import { startTranscription } from "@/lib/transcribe";

type ChunkStatus = "pending" | "persisted" | "uploading" | "uploaded" | "failed";

interface ChunkEntry {
  chunkId: string;
  status: ChunkStatus;
  createdAt: number;
  data: string;
  transcript?: string;
  error?: string;
  retries?: number;
}

interface ServerStats {
  totalInDb: number;
  totalOnDisk: number;
  orphanedInDb: number;
  orphanedOnDisk: number;
  consistent: boolean;
}

function StatusBadge({ status }: { status: ChunkStatus }) {
  const config = {
    pending:   { color: "text-warning border-warning/30 bg-warning/5",  icon: Clock,        label: "PENDING"   },
    persisted: { color: "text-info border-info/30 bg-info/5",           icon: HardDrive,    label: "IN OPFS"   },
    uploading: { color: "text-dim border-border bg-surface",            icon: Activity,     label: "UPLOADING" },
    uploaded:  { color: "text-success border-success/30 bg-success/5",  icon: CheckCircle,  label: "UPLOADED"  },
    failed:    { color: "text-error border-error/30 bg-error/5",        icon: XCircle,      label: "FAILED"    },
  }[status];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-[10px] border px-2 py-0.5 ${config.color}`}>
      <Icon className="w-2.5 h-2.5" />
      {config.label}
    </span>
  );
}

export default function Dashboard() {
  const [isRecording, setIsRecording]     = useState(false);
  const [chunks, setChunks]               = useState<ChunkEntry[]>([]);
  const [sessionId, setSessionId]         = useState("");
  const [chunkIndex, setChunkIndex]       = useState(0);
  const [serverStats, setServerStats]     = useState<ServerStats | null>(null);
  const [opfsSupported, setOpfsSupported] = useState(true);
  const [isReconciling, setIsReconciling] = useState(false);
  const [serverOnline, setServerOnline]   = useState<boolean | null>(null);
  const [totalUploaded, setTotalUploaded] = useState(0);
  const [totalFailed, setTotalFailed]     = useState(0);
  const [copied, setCopied]               = useState(false);

  const [transcript, setTranscript] = useState<{ text: string; final: boolean }[]>([]);
  const transcriptRef = useRef<{ text: string; final: boolean }[]>([]);
  const lastChunkLengthRef = useRef(0);

  const recordingInterval    = useRef<NodeJS.Timeout | null>(null);
  const chunkIndexRef        = useRef(0);
  const sessionIdRef         = useRef("");
  const stopTranscriptionRef = useRef<(() => void) | null>(null);

  // Critical fix: Prevent orphaned chunks and zombie microphones on component unmount / Fast Refresh
  useEffect(() => {
    return () => {
      if (recordingInterval.current) clearInterval(recordingInterval.current);
      if (stopTranscriptionRef.current) stopTranscriptionRef.current();
    };
  }, []);

  useEffect(() => {
    setOpfsSupported(isOPFSSupported());
    const id = generateSessionId();
    setSessionId(id);
    sessionIdRef.current = id;
    checkServerHealth();
    fetchServerStats();
    runRecovery();
  }, []);

  const checkServerHealth = useCallback(async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/health`,
        { signal: AbortSignal.timeout(3000) }
      );
      setServerOnline(res.ok);
    } catch { setServerOnline(false); }
  }, []);

  const fetchServerStats = useCallback(async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/api/chunks/stats`);
      if (res.ok) setServerStats(await res.json());
    } catch {}
  }, []);

  const runRecovery = useCallback(async () => {
    if (!isOPFSSupported()) return;
    const pending = await readAllChunksFromOPFS();
    if (pending.length === 0) return;
    setIsReconciling(true);
    setChunks((prev) => [
      ...pending.map((c) => ({ chunkId: c.chunkId, status: "persisted" as ChunkStatus, createdAt: c.createdAt, data: c.data })),
      ...prev,
    ]);
    await reconcileOPFSChunks(pending, (_d, _t, result) => {
      setChunks((prev) => prev.map((c) => c.chunkId === result.chunkId
        ? { ...c, status: result.success ? "uploaded" : "failed", error: result.error, retries: result.retries }
        : c
      ));
      if (result.success) setTotalUploaded((n) => n + 1);
      else setTotalFailed((n) => n + 1);
    });
    setIsReconciling(false);
    fetchServerStats();
  }, [fetchServerStats]);

  const startRecording = useCallback(() => {
    if (recordingInterval.current) clearInterval(recordingInterval.current);
    if (stopTranscriptionRef.current) stopTranscriptionRef.current();

    setIsRecording(true);
    chunkIndexRef.current = 0;
    setChunkIndex(0);
    transcriptRef.current = [];
    lastChunkLengthRef.current = 0;
    setTranscript([]);

    // Start speech transcription
    const stopFn = startTranscription((text, isFinal) => {
      setTranscript((prev) => {
        const nextState = isFinal
          ? [...prev.filter((t) => t.final), { text, final: true }]
          : [...prev.filter((t) => t.final), { text, final: false }];
        transcriptRef.current = nextState;
        return nextState;
      });
    });
    stopTranscriptionRef.current = stopFn;

    // Chunk every 5 seconds
    recordingInterval.current = setInterval(async () => {
      const idx = chunkIndexRef.current++;
      setChunkIndex(idx + 1);

      // Snapshot transcript collected so far in this window by slicing exactly what was added since the last chunk
      const fullSnapshot = transcriptRef.current.map((t) => t.text).join(" ").replace(/\s+/g, " ").trim();
      const transcriptDelta = fullSnapshot.slice(lastChunkLengthRef.current).trim();
      lastChunkLengthRef.current = fullSnapshot.length;

      const chunk: ChunkData = createChunk(sessionIdRef.current, idx, transcriptDelta || undefined);
      const entry: ChunkEntry = {
        chunkId: chunk.chunkId,
        status: "pending",
        createdAt: chunk.createdAt,
        data: chunk.data,
        transcript: transcriptDelta || undefined,
      };

      setChunks((prev) => [entry, ...prev].slice(0, 100));

      await persistAndUpload(chunk, (status, chunkId) => {
        setChunks((prev) => prev.map((c) => c.chunkId === chunkId
          ? { ...c, status: status === "persisted" ? "persisted" : status === "uploaded" ? "uploaded" : "failed" }
          : c
        ));
        if (status === "uploaded") { setTotalUploaded((n) => n + 1); fetchServerStats(); }
        else if (status === "failed") setTotalFailed((n) => n + 1);
      });
    }, 5000);
  }, [fetchServerStats]);

  const stopRecording = useCallback(() => {
    stopTranscriptionRef.current?.();
    stopTranscriptionRef.current = null;
    setIsRecording(false);
    if (recordingInterval.current) { clearInterval(recordingInterval.current); recordingInterval.current = null; }
    fetchServerStats();
  }, [fetchServerStats]);

  const handleReconcile = useCallback(async () => {
    setIsReconciling(true);
    const pending = await readAllChunksFromOPFS();
    if (pending.length > 0) {
      await reconcileOPFSChunks(pending, (_d, _t, result) => {
        setChunks((prev) => prev.map((c) => c.chunkId === result.chunkId
          ? { ...c, status: result.success ? "uploaded" : "failed" }
          : c
        ));
        if (result.success) setTotalUploaded((n) => n + 1);
      });
    }
    await fetchServerStats();
    setIsReconciling(false);
  }, [fetchServerStats]);

  const clearLog = useCallback(() => { if (!isRecording) setChunks([]); }, [isRecording]);

  const fullTranscript = transcript.map((t) => t.text).join(" ").replace(/\s+/g, " ").trim();

  const copyTranscript = () => {
    navigator.clipboard.writeText(fullTranscript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const counts = {
    pending:  chunks.filter((c) => c.status === "pending" || c.status === "persisted").length,
    uploaded: chunks.filter((c) => c.status === "uploaded").length,
    failed:   chunks.filter((c) => c.status === "failed").length,
  };

  return (
    <div className="min-h-screen bg-bg text-accent">
      {/* NAV */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 border-b border-border bg-bg/95 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-dim hover:text-white transition-colors"><ArrowLeft className="w-4 h-4" /></Link>
          <span className="font-mono text-sm font-bold">chunk<span className="text-dim">vault</span></span>
          <span className="font-mono text-xs text-dim hidden sm:block">/ dashboard</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 font-mono text-xs">
            {serverOnline === null ? <span className="text-dim">CHECKING...</span>
              : serverOnline ? <><Wifi className="w-3 h-3 text-success" /><span className="text-success">CONNECTED</span></>
              : <><WifiOff className="w-3 h-3 text-error" /><span className="text-error">OFFLINE</span></>}
          </div>
          {!opfsSupported && <span className="font-mono text-xs text-error border border-error/30 px-2 py-1">OPFS UNSUPPORTED</span>}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6 font-mono text-xs text-dim">
          SESSION: <span className="text-white">{sessionId}</span>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border mb-8">
          {[
            { label: "IN QUEUE", value: counts.pending,               color: "text-warning", icon: Clock },
            { label: "UPLOADED", value: totalUploaded,                color: "text-success", icon: CheckCircle },
            { label: "FAILED",   value: totalFailed,                  color: "text-error",   icon: XCircle },
            { label: "DB TOTAL", value: serverStats?.totalInDb ?? "—", color: "text-info",    icon: Database },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-bg px-6 py-5">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-3 h-3 ${stat.color}`} />
                  <span className="font-mono text-xs text-dim">{stat.label}</span>
                </div>
                <div className={`font-mono text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* CONTROLS */}
          <div className="space-y-4">
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={!opfsSupported}
              className={`w-full flex items-center justify-center gap-3 py-5 font-mono text-sm font-bold transition-all border ${
                isRecording
                  ? "bg-error/10 border-error text-error hover:bg-error/20"
                  : "bg-white text-black border-white hover:bg-white/90"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {isRecording ? <><Square className="w-4 h-4" />STOP RECORDING</> : <><Play className="w-4 h-4" />START RECORDING</>}
            </motion.button>

            <AnimatePresence>
              {isRecording && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border border-error/30 bg-error/5 p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
                    <span className="font-mono text-xs text-error">RECORDING</span>
                    <Mic className="w-3 h-3 text-error ml-auto" />
                  </div>
                  <div className="font-mono text-xs text-dim">
                    {chunkIndex} chunk{chunkIndex !== 1 ? "s" : ""} generated
                    <br />1 chunk / 5 seconds
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button onClick={handleReconcile} disabled={isReconciling}
              className="w-full flex items-center justify-center gap-2 py-3 font-mono text-xs border border-border text-dim hover:border-white hover:text-white transition-all disabled:opacity-40">
              <RefreshCw className={`w-3 h-3 ${isReconciling ? "animate-spin" : ""}`} />
              {isReconciling ? "RECONCILING..." : "RECONCILE OPFS"}
            </button>

            <button onClick={clearLog} disabled={isRecording}
              className="w-full flex items-center justify-center gap-2 py-3 font-mono text-xs border border-border text-dim hover:border-white hover:text-white transition-all disabled:opacity-40">
              <Trash2 className="w-3 h-3" />CLEAR LOG
            </button>

            {serverStats && (
              <div className="border border-border p-4 space-y-3">
                <div className="font-mono text-xs text-dim mb-3">SERVER STATE</div>
                {[
                  { label: "DB records",        value: serverStats.totalInDb },
                  { label: "Bucket files",      value: serverStats.totalOnDisk },
                  { label: "Orphaned in DB",    value: serverStats.orphanedInDb,    warn: serverStats.orphanedInDb > 0 },
                  { label: "Orphaned on disk",  value: serverStats.orphanedOnDisk,  warn: serverStats.orphanedOnDisk > 0 },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between font-mono text-xs">
                    <span className="text-dim">{row.label}</span>
                    <span className={row.warn && row.value > 0 ? "text-warning" : "text-white"}>{row.value}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-border flex justify-between font-mono text-xs">
                  <span className="text-dim">Consistent</span>
                  <span className={serverStats.consistent ? "text-success" : "text-error"}>
                    {serverStats.consistent ? "✓ YES" : "✗ NO"}
                  </span>
                </div>
              </div>
            )}

            <div className="border border-border p-4">
              <div className="font-mono text-xs text-dim mb-3">PIPELINE</div>
              {[
                { step: "01", label: "Generate chunk" },
                { step: "02", label: "Write to OPFS" },
                { step: "03", label: "Upload to bucket" },
                { step: "04", label: "ACK to DB" },
                { step: "05", label: "Delete from OPFS" },
              ].map((s, i, arr) => (
                <div key={s.step} className="flex items-start gap-2">
                  <div className="flex flex-col items-center">
                    <div className="font-mono text-[10px] text-dim w-6 text-center">{s.step}</div>
                    {i < arr.length - 1 && <div className="w-px h-3 bg-border my-0.5" />}
                  </div>
                  <span className="font-mono text-[10px] text-dim pt-0.5">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CHUNK LOG + TRANSCRIPT */}
          <div className="lg:col-span-2 space-y-6">
            {/* Chunk log */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="font-mono text-xs text-dim">CHUNK LOG <span className="text-white ml-2">{chunks.length}</span></div>
                {isReconciling && (
                  <span className="font-mono text-xs text-warning flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin" />RECOVERING...
                  </span>
                )}
              </div>
              <div className="border border-border h-[380px] overflow-y-auto">
                {chunks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-dim">
                    <Activity className="w-8 h-8 mb-3 opacity-30" />
                    <span className="font-mono text-xs">No chunks yet. Start recording.</span>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    <AnimatePresence initial={false}>
                      {chunks.map((chunk) => (
                        <motion.div key={chunk.chunkId}
                          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}
                          className="px-4 py-3 hover:bg-surface transition-colors"
                        >
                          <div className="flex items-center justify-between gap-3 mb-1">
                            <span className="font-mono text-xs text-white truncate flex-1">{chunk.chunkId}</span>
                            <StatusBadge status={chunk.status} />
                          </div>
                          <div className="flex items-center gap-4 font-mono text-[10px] text-dim">
                            <span>{new Date(chunk.createdAt).toLocaleTimeString()}</span>
                            <span>{(chunk.data.length / 1024).toFixed(1)}KB</span>
                            {chunk.error && <span className="text-error flex items-center gap-1"><AlertTriangle className="w-2.5 h-2.5" />{chunk.error}</span>}
                            {chunk.retries && chunk.retries > 0 && <span className="text-warning">{chunk.retries} retries</span>}
                          </div>
                          {/* Show transcript snippet if present */}
                          {chunk.transcript && (
                            <div className="mt-1 font-sans text-[10px] text-dim italic truncate">
                              &ldquo;{chunk.transcript}&rdquo;
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
                </div>
              </div>

              {/* TRANSCRIPT PANEL */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 font-mono text-xs text-dim">
                    {isRecording
                      ? <><Mic className="w-3 h-3 text-error animate-pulse" /><span className="text-error">LIVE TRANSCRIPT</span></>
                      : <><MicOff className="w-3 h-3" />TRANSCRIPT</>
                    }
                  </div>
                  <div className="flex items-center gap-2">
                    {fullTranscript && (
                      <button onClick={copyTranscript}
                        className="flex items-center gap-1 font-mono text-xs text-dim hover:text-white border border-border px-2 py-1 hover:border-white transition-all">
                        <Copy className="w-2.5 h-2.5" />
                        {copied ? "COPIED!" : "COPY"}
                      </button>
                    )}
                    {transcript.length > 0 && (
                      <button onClick={() => { setTranscript([]); transcriptRef.current = []; lastChunkLengthRef.current = 0; }}
                        className="font-mono text-xs text-dim hover:text-white transition-colors">
                        CLEAR
                      </button>
                    )}
                  </div>
                </div>

                <div className="border border-border p-4 min-h-[180px] max-h-[220px] overflow-y-auto">
                  {transcript.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                      <MicOff className="w-6 h-6 text-dim opacity-30 mb-2" />
                      <span className="font-mono text-xs text-dim">
                        {isRecording ? "Listening... speak now" : "Start recording to transcribe audio"}
                      </span>
                    </div>
                  ) : (
                    <p className="font-sans text-sm leading-relaxed">
                      {transcript.map((t, i) => (
                        <span key={i} className={t.final ? "text-white" : "text-dim italic"}>
                          {t.text}{" "}
                        </span>
                      ))}
                      {isRecording && <span className="inline-block w-1.5 h-3.5 bg-white ml-0.5 animate-blink align-middle" />}
                    </p>
                  )}
                </div>

                {/* Per-chunk transcript summary */}
                {chunks.some((c) => c.transcript) && (
                  <div className="mt-3 border border-border divide-y divide-border max-h-[150px] overflow-y-auto">
                    <div className="px-3 py-2 font-mono text-[10px] text-dim">TRANSCRIPT PER CHUNK</div>
                    {chunks.filter((c) => c.transcript).map((c) => (
                      <div key={c.chunkId} className="px-3 py-2">
                        <div className="font-mono text-[10px] text-dim mb-0.5">{c.chunkId.split("-").slice(-2).join("-")}</div>
                        <div className="font-sans text-xs text-white">{c.transcript}</div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}