# LocalAudit AI

Automated local business discovery, website analysis, AI-powered audit reports, and high-converting outreach — all in one production-ready SaaS.

---

## Architecture

```
localaudit/
├── apps/
│   ├── api/                  # FastAPI backend (Python 3.11)
│   │   ├── core/             # Config, database, security
│   │   ├── models/           # SQLAlchemy ORM models (User, Lead)
│   │   ├── routers/          # API route handlers
│   │   ├── schemas/          # Pydantic request/response schemas
│   │   ├── services/
│   │   │   ├── analyzer.py   # Website scoring engine (8 checks)
│   │   │   ├── email_finder.py
│   │   │   ├── scraper.py    # Google search business discovery
│   │   │   ├── ai_service.py # Claude API — reports & emails
│   │   │   ├── outreach.py   # Gmail SMTP sending
│   │   │   ├── report_generator.py
│   │   │   └── pipeline.py   # Full automation orchestrator
│   │   └── main.py
│   └── web/                  # Next.js 14 frontend
│       ├── app/
│       │   ├── (dashboard)/  # Protected dashboard pages
│       │   │   ├── page.tsx        # Overview + charts
│       │   │   ├── leads/          # Lead table + detail view
│       │   │   ├── pipeline/       # Pipeline runner + live logs
│       │   │   └── settings/       # API keys + Gmail setup
│       │   └── login/        # Auth page (login + register)
│       └── lib/
│           ├── api.ts        # Axios client
│           └── auth.tsx      # Auth context + hooks
└── infra/
    └── docker-compose.yml
```

---

## Quick Start (Development)

### 1. Clone and set up environment

```bash
git clone <repo>
cd localaudit
cp .env.example .env
# Fill in your keys in .env
```

### 2. Start the API

```bash
# Create a Python virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux

pip install -r apps/api/requirements.txt

# Start the API (auto-creates SQLite DB on first run)
uvicorn apps.api.main:app --reload --host 0.0.0.0 --port 8000
```

API docs available at: http://localhost:8000/docs

### 3. Start the frontend

```bash
cd apps/web
npm install
npm run dev
```

Frontend at: http://localhost:3000

---

## Configuration (.env)

| Variable             | Description                                            |
|----------------------|--------------------------------------------------------|
| `DATABASE_URL`       | Leave blank for SQLite dev, or set a PostgreSQL URL    |
| `JWT_SECRET`         | Random 32-char hex string for signing tokens           |
| `ANTHROPIC_API_KEY`  | Your Anthropic API key (sk-ant-...)                    |
| `GMAIL_ADDRESS`      | Gmail address to send outreach from                    |
| `GMAIL_APP_PASSWORD` | Gmail App Password (not regular password)              |

---

## Pipeline Workflow

```
1. Enter niche + city in the Pipeline Runner
2. System discovers businesses via Google Search
3. Each website is analyzed for 8 conversion problems
4. Websites scoring < 70/100 with 3+ issues are kept
5. Contact email is extracted from the website
6. Claude generates a personalized audit report
7. Claude generates a high-converting outreach email
8. Email is sent via Gmail SMTP
9. Lead is saved to the database
10. Follow-ups scheduled at Day 3 and Day 7
```

---

## Lead Scoring

| Score   | Priority | Action                  |
|---------|----------|-------------------------|
| 0–39    | HIGH     | Immediate outreach      |
| 40–70   | MEDIUM   | Standard outreach       |
| 71–100  | LOW      | Ignored (healthy site)  |

---

## Email Templates

Three AI-generated email types:

- **Problem + Loss** — highlights specific revenue loss (< 120 words)
- **Value First** — leads with a free insight, offers a small free fix
- **Curiosity** — open-ended question that creates desire to respond

All emails include: business name, city, specific issues, measurable impact.

---

## Deployment

### Backend → Railway / Render

```bash
# Set DATABASE_URL to a PostgreSQL connection string
# All other env vars set in the platform dashboard
```

### Frontend → Vercel

```bash
cd apps/web
vercel deploy
# Set NEXT_PUBLIC_API_URL to your Railway/Render API URL
```

### Docker (full stack)

```bash
cd infra
docker-compose up --build
```

---

## Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| API        | FastAPI, SQLAlchemy, asyncpg        |
| Database   | SQLite (dev), PostgreSQL (prod)     |
| Auth       | JWT + bcrypt                        |
| AI         | Anthropic Claude (haiku-4-5)        |
| Scraping   | requests + BeautifulSoup            |
| Email      | Gmail SMTP (App Password)           |
| Frontend   | Next.js 14, Tailwind CSS            |
| Charts     | Recharts                            |
