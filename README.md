# LocalAudit SaaS Monorepo

Production-oriented scaffold based on `localaudit_production_codex.md`.

## Services

- `apps/web`: Next.js 14 App Router frontend (marketing + dashboard + Stripe webhook)
- `apps/api`: FastAPI backend (multi-tenant APIs, audit services, GDPR endpoints)
- `workers`: Node.js BullMQ workers (audit/fix/delivery processing)
- `supabase/migrations`: PostgreSQL schema and RLS policies
- `infra/docker-compose.yml`: local orchestration (Redis, Postgres, API, worker, web)

## Quick Start

1. Copy `.env.example` to `.env` and fill required values.
2. Start infrastructure:
   ```bash
   docker compose -f infra/docker-compose.yml up -d redis postgres
   ```
3. Backend:
   ```bash
   cd apps/api
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8000
   ```
4. Worker:
   ```bash
   cd workers
   npm install
   npm run dev
   ```
5. Web:
   ```bash
   cd apps/web
   npm install
   npm run dev
   ```

## Notes

- Stripe webhook route is implemented at `apps/web/app/api/webhooks/stripe/route.ts`.
- Queue handoff is implemented with Redis pub/sub from API to worker enqueue bridge.
- Some integrations (email, OCR, deployment secrets) are production placeholders and require valid credentials.
