# Sales Agent Database

PostgreSQL database infrastructure for the "Talk to Your Sales Data" AI chatbot agent on Vertx platform.

**Status**: Phase 0 — Docker Postgres up, schema + dummy data seeded (360k+ records, 3 years).

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose installed
- Python 3.8+ (for seed data)
- ~5GB disk space

### Setup (5 minutes)

```bash
cd /Users/tasbeha/sales-agent-db

# 1. Copy environment file
cp .env.example .env

# 2. Start Docker containers
docker compose up -d

# 3. Wait for health check
sleep 15 && docker compose ps
# STATUS should show "healthy"

# 4. Install Python dependencies
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 5. Seed dummy data (3 years)
python init/03_seed_data.py
# Takes ~2-3 minutes
```

### Verify Setup

```bash
# Check data was loaded
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c \
  "SELECT 'doctors', COUNT(*) FROM doctors UNION ALL 
   SELECT 'call_planning', COUNT(*) FROM call_planning UNION ALL
   SELECT 'secondary_sales', COUNT(*) FROM secondary_sales;"

# Access pgAdmin (web UI)
http://localhost:5050
# Login: admin@example.com / admin
# Connect to: sales-agent-postgres:5432
```

---

## 📁 File Structure

```
sales-agent-db/
├── docker-compose.yml         # Postgres + pgAdmin services
├── init/
│   ├── 01_schema.sql          # Tables (7) + indexes
│   ├── 02_views.sql           # Aggregation views (6)
│   └── 03_seed_data.py        # Data generator (360k+ records)
├── .env.example               # Configuration template
├── requirements.txt           # Python dependencies
├── README.md                  # This file (quick start)
├── SETUP_GUIDE.md             # Detailed setup & data model
├── COMMANDS.md                # Command reference (600+ lines)
├── VERTX_INTEGRATION.md       # Connect to Vertx
└── venv/                      # Python environment
```

---

## 🔗 Quick Reference

| Need | Command |
|------|---------|
| **View logs** | `docker compose logs -f postgres` |
| **Connect to DB** | `docker exec -it sales-agent-postgres psql -U sales_agent -d sales_agent_demo` |
| **Stop containers** | `docker compose down` |
| **Reset all data** | `docker compose down -v && docker compose up -d` |
| **Run seed script** | `source venv/bin/activate && python init/03_seed_data.py` |

---

## 📊 What's Included

- **360,884 records** seeded across 3 years (2023–2025)
- **7 tables**: doctors (300), call_planning (31k), secondary_sales (329k), products (15), sales_reps (50), pharmacies (150), audit_log
- **6 views** for common agent queries (rep performance, product trends, inactive doctors, at-risk territories, etc.)
- **pgAdmin** web UI at http://localhost:5050 for data exploration
- **Realistic patterns**: seasonality, declining region trends, 78% call adherence

---

## 📚 Documentation

- **[SETUP_GUIDE.md](SETUP_GUIDE.md)** — Data model, patterns, security, implementation notes
- **[COMMANDS.md](COMMANDS.md)** — 600+ lines of organized command reference

---

## 🔌 Next: Connect to Vertx

Database is ready. Next step: determine how to connect to Vertx.

**TBD**: Investigate Vertx connection options:
- Native database support in Vertx?
- HTTP API wrapper approach?
- Custom connector?
- Network/deployment requirements?

Database is accessible at `localhost:5433` and ready for integration testing.

---

## 🆘 Troubleshooting

**Docker won't start?** Check logs: `docker compose logs`

**Postgres connection error?** Verify health: `docker compose ps` (should show "healthy")

**Seed script crashes?** Try again: `source venv/bin/activate && python init/03_seed_data.py`

**More help?** See **[COMMANDS.md](COMMANDS.md)** for troubleshooting commands.

---

## 📞 Next Steps

1. ✅ Database running → See SETUP_GUIDE.md for details
2. ⏭️ Connect to Vertx → See VERTX_INTEGRATION.md
3. ⏭️ Build workflows → Use queries in COMMANDS.md

---

**Status**: Phase 0 complete. Ready for Phase 1 (Vertx integration).
