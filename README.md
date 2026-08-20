# Sales Agent Database (MSSQL)

SQL Server 2022 database infrastructure for the "Talk to Your Sales Data" AI chatbot agent on Vertx platform.

**Status**: Phase 0 — Docker MSSQL deployed locally + Token Bazaar (35.240.218.50), ready for API integration.

**Deployment**: Local (localhost:1433) or Token Bazaar Server (35.240.218.50:1433)

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose installed
- Python 3.8+ (for seed data)
- ~5GB disk space

### Setup (5-10 minutes)

```bash
cd /Users/tasbeha/sales-agent-db

# 1. Copy environment file
cp .env.example .env

# 2. Start Docker container
docker compose up -d

# 3. Wait for SQL Server to be healthy (first time: ~30 seconds)
sleep 30 && docker compose ps
# STATUS should show "healthy"

# 4. Create the database (run once)
docker exec sales-agent-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "Sales@Agent123" -Q "CREATE DATABASE [sales_agent_demo]"

# 5. Install Python dependencies
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 6. Seed dummy data (3 years)
python init/mssql/03_seed_data.py
# Takes ~5-10 minutes
```

### Verify Setup

```bash
# Check tables exist
docker exec sales-agent-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "Sales@Agent123" -d sales_agent_demo -Q "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='dbo' ORDER BY TABLE_NAME;"

# Check record counts (after seeding)
docker exec sales-agent-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "Sales@Agent123" -d sales_agent_demo -Q "SELECT 'doctors', COUNT(*) FROM dbo.doctors UNION ALL SELECT 'call_planning', COUNT(*) FROM dbo.call_planning UNION ALL SELECT 'secondary_sales', COUNT(*) FROM dbo.secondary_sales UNION ALL SELECT 'sales_reps', COUNT(*) FROM dbo.sales_reps UNION ALL SELECT 'products', COUNT(*) FROM dbo.products UNION ALL SELECT 'pharmacies', COUNT(*) FROM dbo.pharmacies;"

# Check views exist
docker exec sales-agent-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "Sales@Agent123" -d sales_agent_demo -Q "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_SCHEMA='dbo' ORDER BY TABLE_NAME;"

# Or use SQL Management tools (VS Code mssql extension, Azure Data Studio, etc.)
```

---

## 📁 File Structure

```
sales-agent-db/
├── docker-compose.yml         # MSSQL service
├── init/mssql/
│   ├── 01_schema.sql          # Tables (7) + indexes
│   ├── 02_views.sql           # Aggregation views (6)
│   └── 03_seed_data.py        # Data generator (360k+ records)
├── .env.example               # Configuration template
├── requirements.txt           # Python dependencies
├── README.md                  # This file (quick start)
├── SETUP_GUIDE.md             # Detailed setup & data model
├── COMMANDS.md                # Command reference
└── venv/                      # Python environment
```

---

## 🔗 Quick Reference

| Need | Command |
|------|---------|
| **List tables (local)** | `docker exec sales-agent-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "Sales@Agent123" -d sales_agent_demo -Q "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='dbo';"` |
| **Count records (local)** | `docker exec sales-agent-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "Sales@Agent123" -d sales_agent_demo -Q "SELECT 'Doctors', COUNT(*) FROM dbo.doctors;"` |
| **Connect via sqlcmd (local)** | `docker exec -it sales-agent-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "Sales@Agent123" -d sales_agent_demo` |
| **Connect to Token Bazaar** | `docker exec -it sales-agent-mssql /opt/mssql-tools18/bin/sqlcmd -C -S 35.240.218.50,1433 -U sa -P "Sales@Agent123" -d sales_agent_demo` |
| **View logs** | `docker compose logs -f mssql` |
| **Check status** | `docker compose ps` |
| **Stop container** | `docker compose down` |
| **Reset all data** | `docker compose down -v` (then repeat setup) |
| **Run seed script** | `source venv/bin/activate && python init/mssql/03_seed_data.py` |

---

## 📊 What's Included

- **360,884 records** seeded across 3 years (2023–2025)
- **7 tables**: doctors (300), call_planning (31k), secondary_sales (329k), products (15), sales_reps (50), pharmacies (150), audit_log
- **6 views** for common agent queries (rep performance, product trends, inactive doctors, at-risk territories, etc.)
- **Realistic patterns**: seasonality, declining region trends, 78% call adherence

---

## 📚 Documentation

- **[SETUP_GUIDE.md](SETUP_GUIDE.md)** — Data model, patterns, security, implementation notes
- **[COMMANDS.md](COMMANDS.md)** — Command reference (sqlcmd, setup, troubleshooting)

---

## 🔌 Next: Build API Layer & Connect to Vertx

Database is ready at:
- **Local**: `localhost:1433`
- **Token Bazaar**: `35.240.218.50:1433`

**Next phase**: Build Node + Express API layer that:
1. Queries this MSSQL database
2. Exposes REST endpoints for agent queries
3. Integrates with Vertx platform via HTTP
4. Handles authentication & rate limiting

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for database details.

---

## 🆘 Troubleshooting

**Docker won't start?** Check logs: `docker compose logs mssql`

**MSSQL not healthy?** It takes ~30-60 sec on first start. Wait and try again: `docker compose ps`

**Can't connect?** Verify credentials (sa/Sales@Agent123) and host (.env file)

**Seed script fails?** 
- Local: Ensure ODBC drivers installed or run inside container
- Token Bazaar: Run seed script on server with ODBC drivers

**Connection timeout?** For Token Bazaar, ensure firewall allows port 1433

**More help?** See **[COMMANDS.md](COMMANDS.md)** for troubleshooting commands and **[SETUP_GUIDE.md](SETUP_GUIDE.md)** for detailed setup info.

---

## 📞 Next Steps

1. ✅ Phase 0: MSSQL database running (local or Token Bazaar)
2. ⏭️ Phase 1: Build Node + Express API layer
3. ⏭️ Phase 2: Expose via Vertx platform integration
4. ⏭️ Phase 3: Build agent workflows

---

**Status**: Phase 0 complete (MSSQL setup). Awaiting API layer + Vertx integration.

**See Also**: [SETUP_GUIDE.md](SETUP_GUIDE.md) (data model), [COMMANDS.md](COMMANDS.md) (operations)
