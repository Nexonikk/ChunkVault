# ChunkVault — Reliable Recording Pipeline

Zero data-loss chunk recording pipeline. OPFS → Bucket → DB.

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up PostgreSQL
Use [Neon](https://neon.tech) or [Supabase](https://supabase.com) for a free hosted PG.

Copy and fill in your DB URL:
```bash
cp apps/server/.env.example apps/server/.env
# Edit DATABASE_URL in apps/server/.env
```

### 3. Push DB schema
```bash
npm run db:push
```

### 4. Run dev
```bash
npm run dev
# Web → http://localhost:3001
# API → http://localhost:3000
```

---

## How to Test / Validate

### ✅ Basic flow
1. Open http://localhost:3001
2. Click **GET STARTED** → Dashboard
3. Click **START RECORDING**
4. Watch chunks appear: PENDING → IN OPFS → UPLOADED
5. Click **STOP RECORDING**
6. Check **SERVER STATE** card: DB records === Bucket files → Consistent ✓

### ✅ OPFS Recovery test
1. Start recording for 5 seconds
2. Hard-refresh the page (Ctrl+Shift+R) while recording
3. Dashboard loads → auto-reconcile runs
4. Any un-uploaded OPFS chunks re-upload automatically

### ✅ Idempotency test
```bash
# Upload same chunk twice
curl -X POST http://localhost:3000/api/chunks/upload \
  -H "Content-Type: application/json" \
  -d '{"chunkId":"test-001","data":"hello"}'

curl -X POST http://localhost:3000/api/chunks/upload \
  -H "Content-Type: application/json" \
  -d '{"chunkId":"test-001","data":"hello"}'

# Check DB — still only 1 record
curl http://localhost:3000/api/chunks
```

### ✅ Stats / consistency check
```bash
curl http://localhost:3000/api/chunks/stats
# → { totalInDb, totalOnDisk, consistent: true }
```

### ✅ Simulate bucket purge → reconcile
```bash
# Delete a file from "bucket" (uploads/ folder)
curl -X DELETE http://localhost:3000/api/chunks/test-001

# Stats now shows orphanedInDb: 1
curl http://localhost:3000/api/chunks/stats

# Click RECONCILE OPFS in dashboard to re-upload from OPFS
```

### ✅ Load test
```bash
# Install k6: https://k6.io/docs/get-started/installation/
k6 run load-test.js
# Target: 300,000 requests @ 5,000 req/s
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Server health |
| POST | `/api/chunks/upload` | Upload chunk (idempotent) |
| GET | `/api/chunks` | List all chunks |
| GET | `/api/chunks/stats` | Consistency stats |
| POST | `/api/chunks/reconcile` | Check missing chunks |
| GET | `/api/chunks/:id/exists` | Check single chunk |
| DELETE | `/api/chunks/:id` | Delete from bucket (testing) |

---

## Deploy to Vercel

### Backend (Hono on Vercel)
1. Create `apps/server/vercel.json`:
```json
{ "builds": [{ "src": "src/index.ts", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "src/index.ts" }] }
```
2. Set `DATABASE_URL` in Vercel env vars
3. `vercel deploy` from `apps/server/`

### Frontend (Next.js on Vercel)
1. Set `NEXT_PUBLIC_API_URL=https://your-server.vercel.app` in Vercel env
2. `vercel deploy` from `apps/web/`

---

## Stack
- **Next.js 14** (App Router) — Frontend
- **Hono** (Node.js) — Backend API
- **Drizzle ORM + PostgreSQL** — Database
- **OPFS** — Durable client-side buffer
- **Turborepo** — Monorepo build system
- **Framer Motion** — Animations
