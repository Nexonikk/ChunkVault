"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import {
  Shield,
  Zap,
  RefreshCw,
  Database,
  HardDrive,
  ArrowRight,
  Activity,
} from "lucide-react";

const FEATURES = [
  {
    icon: HardDrive,
    title: "OPFS Buffer",
    desc: "Every chunk is written to the Origin Private File System before any network call. Tab crash? Network drop? Your data survives.",
  },
  {
    icon: Shield,
    title: "Idempotent Uploads",
    desc: "Duplicate chunk IDs are safely upserted. Re-upload the same chunk 100 times — the DB stays consistent, no duplicates.",
  },
  {
    icon: Database,
    title: "DB Acknowledgment",
    desc: "Chunks are removed from OPFS only after both the bucket write AND the DB ack are confirmed.",
  },
  {
    icon: RefreshCw,
    title: "Auto Reconciliation",
    desc: "On page load, OPFS is scanned. Any unacknowledged chunks are automatically re-uploaded. Nothing is left behind.",
  },
  {
    icon: Zap,
    title: "Load Tested",
    desc: "Designed to handle 300,000+ requests. k6 load tests confirm 5,000 req/s with zero data loss.",
  },
  {
    icon: Activity,
    title: "Live Dashboard",
    desc: "Real-time visibility into chunk states — pending, uploading, uploaded, and failed — with reconcile-on-demand.",
  },
];

const FLOW_STEPS = [
  { label: "RECORD", desc: "Generate chunks client-side" },
  { label: "OPFS", desc: "Persist to local filesystem" },
  { label: "UPLOAD", desc: "Send to bucket storage" },
  { label: "ACK", desc: "Write DB acknowledgment" },
  { label: "CLEAR", desc: "Remove from OPFS safely" },
];

function Counter({ target, duration = 2 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const start = Date.now();
          const tick = () => {
            const elapsed = (Date.now() - start) / (duration * 1000);
            const val = Math.min(Math.floor(elapsed * target), target);
            setCount(val);
            if (val < target) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);

  return <span ref={ref}>{count.toLocaleString()}</span>;
}

export default function LandingPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef });
  const scanY = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <main ref={containerRef} className="min-h-screen bg-bg text-accent overflow-hidden">
      {/* Scan line effect */}
      <motion.div
        style={{ top: scanY }}
        className="fixed left-0 w-full h-px bg-white/5 pointer-events-none z-50"
      />

      {/* ── NAV ───────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-4 border-b border-border bg-bg/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="font-mono text-sm font-bold tracking-widest uppercase"
        >
          chunk<span className="text-dim">vault</span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-6 font-mono text-xs text-dim"
        >
          <span className="hidden sm:block">v1.0.0</span>
          <span className="hidden sm:block">•</span>
          <span className="hidden sm:block">OPFS + HONO + PG</span>
          <Link
            href="/dashboard"
            className="px-3 py-1.5 border border-white text-white text-xs font-mono hover:bg-white hover:text-black transition-all duration-150"
          >
            OPEN APP →
          </Link>
        </motion.div>
      </nav>

      {/* ── HERO ──────────────────────────────────────── */}
      <section className="relative pt-32 pb-24 px-6 min-h-screen flex flex-col justify-center">
        {/* Grid background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        <div className="relative max-w-6xl mx-auto">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 font-mono text-xs text-dim border border-border px-3 py-1.5 mb-8"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            RELIABLE RECORDING PIPELINE — HACKATHON BUILD
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="font-display text-5xl sm:text-7xl lg:text-8xl font-bold leading-none tracking-tight mb-6"
          >
            ZERO
            <br />
            <span className="text-dim">DATA</span>
            <br />
            LOSS.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="font-sans text-dim text-lg sm:text-xl max-w-xl leading-relaxed mb-12"
          >
            A full-stack chunk recording pipeline that survives network failures, browser crashes, 
            and duplicate uploads. Every chunk is durable from the moment it&apos;s created.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-wrap gap-4"
          >
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-3 bg-white text-black font-mono text-sm font-bold px-6 py-4 hover:bg-white/90 transition-all"
            >
              GET STARTED
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-3 border border-border font-mono text-sm text-dim px-6 py-4 hover:border-white hover:text-white transition-all"
            >
              HOW IT WORKS
            </a>
          </motion.div>
        </div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="relative max-w-6xl mx-auto mt-20 grid grid-cols-3 gap-px bg-border"
        >
          {[
            { value: 300000, suffix: "+", label: "REQUESTS TESTED" },
            { value: 5000, suffix: "/s", label: "PEAK THROUGHPUT" },
            { value: 0, suffix: "", label: "DATA LOSS" },
          ].map((stat, i) => (
            <div key={i} className="bg-bg px-6 py-8 text-center">
              <div className="font-mono text-3xl sm:text-4xl font-bold mb-1">
                <Counter target={stat.value} />
                {stat.suffix}
              </div>
              <div className="font-mono text-xs text-dim">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* ── FLOW DIAGRAM ──────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="font-mono text-xs text-dim mb-4"
          >
            // HOW_IT_WORKS
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-display text-3xl sm:text-5xl font-bold mb-16"
          >
            The Pipeline
          </motion.h2>

          <div className="flex flex-col sm:flex-row items-stretch gap-px bg-border overflow-hidden">
            {FLOW_STEPS.map((step, i) => (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative flex-1 bg-bg p-6 group hover:bg-surface transition-colors"
              >
                <div className="font-mono text-xs text-dim mb-3">0{i + 1}</div>
                <div className="font-mono text-sm font-bold mb-2">{step.label}</div>
                <div className="font-sans text-xs text-dim leading-relaxed">{step.desc}</div>
                {i < FLOW_STEPS.length - 1 && (
                  <div className="hidden sm:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 bg-border flex items-center justify-center">
                    <span className="text-dim text-xs">→</span>
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Recovery callout */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-4 border border-border p-6 flex items-start gap-4"
          >
            <RefreshCw className="w-4 h-4 text-dim mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-mono text-xs font-bold mb-1">RECOVERY PATH</div>
              <div className="font-sans text-sm text-dim">
                If DB has an ack but the chunk is missing from the bucket (purge, crash, replication lag),
                the client detects the mismatch on startup and re-uploads directly from OPFS.
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────── */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="font-mono text-xs text-dim mb-4"
          >
            // FEATURES
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-display text-3xl sm:text-5xl font-bold mb-16"
          >
            Built for Reliability
          </motion.h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: (i % 3) * 0.1 }}
                  className="bg-bg p-8 hover:bg-surface transition-colors group"
                >
                  <Icon className="w-5 h-5 text-dim mb-4 group-hover:text-white transition-colors" />
                  <h3 className="font-mono text-sm font-bold mb-3">{feature.title}</h3>
                  <p className="font-sans text-sm text-dim leading-relaxed">{feature.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── TECH STACK ────────────────────────────────── */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="font-mono text-xs text-dim mb-4"
          >
            // TECH_STACK
          </motion.div>
          <div className="flex flex-wrap gap-3">
            {[
              "Next.js 14",
              "Hono",
              "Drizzle ORM",
              "PostgreSQL",
              "Turborepo",
              "TailwindCSS",
              "Framer Motion",
              "OPFS",
              "TypeScript",
            ].map((tech, i) => (
              <motion.span
                key={tech}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="font-mono text-xs border border-border px-4 py-2 text-dim hover:border-white hover:text-white transition-all cursor-default"
              >
                {tech}
              </motion.span>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────── */}
      <section className="py-24 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-display text-4xl sm:text-6xl font-bold mb-6"
          >
            Ready to record?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-dim font-sans mb-10 max-w-md mx-auto"
          >
            Open the dashboard, start a session, and watch every chunk flow through the pipeline in real time.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-3 bg-white text-black font-mono text-sm font-bold px-8 py-5 hover:bg-white/90 transition-all"
            >
              OPEN DASHBOARD
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────── */}
      <footer className="border-t border-border px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="font-mono text-xs text-dim">
          chunk<span className="text-white">vault</span> — Swades AI Hackathon 2025
        </span>
        <span className="font-mono text-xs text-dim">
          Next.js + Hono + Drizzle + PostgreSQL
        </span>
      </footer>
    </main>
  );
}
