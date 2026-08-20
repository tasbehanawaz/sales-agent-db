# Sales Agent Database Setup

Database infrastructure for the "Talk to Your Sales Data" AI chatbot agent. Provides PostgreSQL container + schema + 3 years of realistic dummy data for sales, call planning, and doctor information.

**Use Case**: Natural language interface to query sales analytics across Doctors Database, Call Planning Data, and Secondary Sales Data.

**Status**: Phase 0 — Docker Postgres up, schema + dummy data seeded.

---

## Prerequisites

- **Docker & Docker Compose** installed (`docker --version`, `docker compose --version`)
- **Python 3.8+** (for seed data generation)
- ~5GB disk space (for 3 years of dummy data)

---

## Quick Start

### 1. Clone & Setup

```bash
cd /Users/tasbeha/sales-agent-db

# Copy .env file (adjust password if desired)
cp .env.example .env

# Install Python dependencies (for seed script)
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Spin Up Docker Postgres

```bash
# Start Postgres container + init schema
docker compose up -d

# Wait for health check (10-15 seconds)
docker compose ps
# STATUS should show "healthy"
```

### 3. Seed Dummy Data

```bash
# Set environment variables from .env
export $(cat .env | xargs)

# Run Python seed script
python init/03_seed_data.py

# Takes ~2-3 minutes for 3 years of data
```

### 4. Access pgAdmin (Web UI)

```bash
# Open in browser
http://localhost:5050

# Login
Email: admin@example.com
Password: admin

# Add Server Connection:
# - Host: sales-agent-postgres
# - Port: 5432
# - Database: sales_agent_demo
# - User: sales_agent
# - Password: sales_agent_password
```

### 5. Verify Setup

```bash
# Connect to DB via CLI
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo

# Run a quick query
SELECT COUNT(*) as total_doctors FROM doctors;
SELECT COUNT(*) as total_sales FROM secondary_sales;
\dt  # List all tables
\dv  # List all views
\q   # Exit
```

---

## File Structure

```
sales-agent-db/
├── docker-compose.yml         # Postgres + pgAdmin services
├── init/
│   ├── 01_schema.sql          # Table definitions + indexes
│   ├── 02_views.sql           # Aggregation views (rep perf, trends, etc.)
│   └── 03_seed_data.py        # Python seeder (Faker + pandas, optimized batching)
├── .env                       # DB + pgAdmin credentials (generated from .env.example)
├── .env.example               # Configuration template
├── .gitignore                 # Secrets + build artifacts
├── requirements.txt           # Python dependencies (psycopg2, faker, pandas, numpy)
├── venv/                      # Python virtual environment
└── README.md                  # This file
```

---

## Data Model

### Fact Tables

- **doctors** (300 records)
  - doctor_id, name, specialty, tier (A/B/C), region, market, onboarded_date, status
  
- **call_planning** (31,322 records)
  - Weekly call plan per rep-doctor-product combo
  - 78% execution rate (actual_call_date filled in when executed)
  - Feedback scores (6-10) only for completed calls
  
- **secondary_sales** (329,047 records)
  - Daily sales transactions per rep-pharmacy-product
  - Seasonality: summer dip (-30%), year-end spike (+40%)
  - Trend: South region declining ~2% per month for prescriptive demos

### Dimension Tables

- **sales_reps** (50 records) — territory, region, manager hierarchy
- **products** (15 records) — SKU, brand, therapy area, launch date
- **pharmacies** (150 records) — channel, region
- **audit_log** (empty) — for tracking future changes

### Views (for Agent Queries)

1. **vw_rep_performance** — Monthly sales + call adherence per rep
2. **vw_product_region_trends** — Product sales trends by region & month
3. **vw_call_effectiveness** — Call success metrics by doctor tier
4. **vw_inactive_doctors** — Doctors not called in 30/60/90+ days
5. **vw_at_risk_territories** — Territories with declining sales or low adherence
6. **vw_territory_coverage** — Coverage summary per rep

---

## Database Connection

### Via CLI (psql)
```
Host: localhost
Port: 5433
Database: sales_agent_demo
User: sales_agent
Password: sales_agent_password (from .env)

# Example:
psql -h localhost -p 5433 -U sales_agent -d sales_agent_demo
```

### Via pgAdmin Web UI
```
Host: localhost:5050 (http://localhost:5050)
Login: admin@example.com / admin
Server Connection:
  - Host: sales-agent-postgres (Docker container name)
  - Port: 5432 (internal, different from 5433 external)
  - Database: sales_agent_demo
  - User: sales_agent
  - Password: sales_agent_password
```

### For Vertx Platform
- **Testing**: Verify Vertx can reach `localhost:5433` from its environment
- **Options for deployment**:
  - **Local development**: Use as-is if Vertx runs locally
  - **Cloud deployment**: 
    - Use ngrok tunnel: `ngrok tcp 5433` (temporary, for testing only)
    - Deploy Postgres to cloud (AWS RDS, Supabase, etc.)
    - Replicate schema + data to cloud instance
  - **Network access**: Confirm Vertx can reach database (VPN, firewall rules, security groups)

---

## Important Commands

### 🚀 Startup & Initialization

```bash
# Start fresh (create containers, schema, seed data)
docker compose up -d
sleep 15  # Wait for Postgres health check
source venv/bin/activate
python init/03_seed_data.py

# Or all-in-one (if containers already exist):
docker compose up -d && source venv/bin/activate && python init/03_seed_data.py
```

---

### 📊 Docker Management

```bash
# View container status
docker compose ps

# View logs in real-time
docker compose logs -f postgres        # Postgres logs
docker compose logs -f pgadmin         # pgAdmin logs
docker compose logs -f                 # All logs

# Stop containers (keep data)
docker compose down

# Stop + remove ALL data (full reset)
docker compose down -v

# Restart containers
docker compose restart

# Rebuild containers (after changing docker-compose.yml)
docker compose up -d --build
```

---

### 🗄️ Database Access

```bash
# Interactive psql CLI
docker exec -it sales-agent-postgres psql -U sales_agent -d sales_agent_demo

# Run query without entering psql
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c "SELECT * FROM doctors LIMIT 5;"

# Export data to CSV
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c "
  COPY doctors TO STDOUT WITH CSV HEADER;" > doctors_export.csv

# Get database size
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c "
  SELECT pg_size_pretty(pg_database_size('sales_agent_demo'));"

# List all tables with row counts
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c "
  SELECT tablename, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC;"
```

---

### 📈 Data Verification & Quality

```bash
# Count all records
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c "
  SELECT 'doctors' as table_name, COUNT(*) FROM doctors
  UNION ALL SELECT 'call_planning', COUNT(*) FROM call_planning
  UNION ALL SELECT 'secondary_sales', COUNT(*) FROM secondary_sales;"

# Check date ranges
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c "
  SELECT 'call_planning' as source, 
    MIN(planned_date)::text, MAX(planned_date)::text
  FROM call_planning
  UNION ALL
  SELECT 'secondary_sales', 
    MIN(sale_date)::text, MAX(sale_date)::text
  FROM secondary_sales;"

# Verify call adherence
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c "
  SELECT ROUND(100.0 * COUNT(CASE WHEN actual_call_date IS NOT NULL THEN 1 END) / 
    COUNT(*), 2) as adherence_pct FROM call_planning;"

# Sales by region
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c "
  SELECT region, COUNT(*) as transactions, 
    ROUND(SUM(value_sold)::NUMERIC, 2) as total_value
  FROM secondary_sales GROUP BY region ORDER BY total_value DESC;"
```

---

### 🔄 Data Management

```bash
# Truncate all data (keep schema & views)
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c "
  TRUNCATE secondary_sales, call_planning, doctors, pharmacies, 
    products, sales_reps, audit_log CASCADE;"

# Re-seed after truncate
source venv/bin/activate
python init/03_seed_data.py

# Full reset (schema + data)
docker compose down -v
docker compose up -d
sleep 15
source venv/bin/activate
python init/03_seed_data.py

# Backup database
docker exec sales-agent-postgres pg_dump -U sales_agent -d sales_agent_demo > backup.sql

# Restore from backup
cat backup.sql | docker exec -i sales-agent-postgres psql -U sales_agent -d sales_agent_demo
```

---

### 📋 Agent Query Examples

```bash
# Connect to psql first
docker exec -it sales-agent-postgres psql -U sales_agent -d sales_agent_demo
```

**Top performing reps (last month):**
```sql
SELECT name, territory, region, total_sales, call_adherence_pct 
FROM vw_rep_performance 
WHERE month = '2025-12-01'
ORDER BY total_sales DESC 
LIMIT 5;
```

**Product sales trend by region (last 3 months):**
```sql
SELECT sku, brand, region, month, qty_sold, value_sold 
FROM vw_product_region_trends 
WHERE month >= DATE_TRUNC('month', CURRENT_DATE)::DATE - INTERVAL '3 months'
ORDER BY month DESC, value_sold DESC;
```

**Inactive doctors (not called in 30+ days):**
```sql
SELECT doctor_name, specialty, tier, region, 
  days_since_last_call, total_calls_made
FROM vw_inactive_doctors 
WHERE days_since_last_call >= 30 
ORDER BY days_since_last_call DESC
LIMIT 10;
```

**At-risk territories (declining sales or low adherence):**
```sql
SELECT name, territory, region, sales_trend_pct, call_adherence_pct 
FROM vw_at_risk_territories 
ORDER BY sales_trend_pct ASC
LIMIT 10;
```

**Call effectiveness by doctor tier:**
```sql
SELECT tier, region, month, total_calls, completed_calls, 
  adherence_pct, avg_feedback, sales_value_post_call
FROM vw_call_effectiveness 
WHERE month >= DATE_TRUNC('month', CURRENT_DATE)::DATE - INTERVAL '6 months'
ORDER BY month DESC, adherence_pct DESC;
```

**Territory coverage summary:**
```sql
SELECT name, territory, region, total_doctors, 
  tier_a_count, tier_b_count, tier_c_count, coverage_pct
FROM vw_territory_coverage 
ORDER BY coverage_pct DESC;
```

**Custom: Sales by rep and product (current month):**
```sql
SELECT r.name, r.territory, p.sku, p.brand,
  COUNT(*) as num_transactions,
  SUM(ss.quantity_sold) as total_qty,
  ROUND(SUM(ss.value_sold)::NUMERIC, 2) as total_value
FROM secondary_sales ss
JOIN sales_reps r ON ss.rep_id = r.rep_id
JOIN products p ON ss.product_id = p.product_id
WHERE EXTRACT(YEAR FROM ss.sale_date) = 2025 
  AND EXTRACT(MONTH FROM ss.sale_date) = 12
GROUP BY r.rep_id, r.name, r.territory, p.product_id, p.sku, p.brand
ORDER BY total_value DESC;
```

---

### 🌐 pgAdmin Access

```bash
# Open in browser
http://localhost:5050

# Default Login
Email: admin@example.com
Password: admin

# Add Database Server in pgAdmin:
# 1. Right-click "Servers" → Register → Server
# 2. General Tab:
#    - Name: sales-agent-db
# 3. Connection Tab:
#    - Host: sales-agent-postgres (container name, NOT localhost)
#    - Port: 5432 (internal port)
#    - Database: sales_agent_demo
#    - Username: sales_agent
#    - Password: sales_agent_password
# 4. Click Save
```

---

### 🧹 Cleanup & Maintenance

```bash
# Remove old venv and rebuild
rm -rf venv
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Check disk usage
du -sh sales-agent-db/

# View all active connections
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c "
  SELECT usename, application_name, state 
  FROM pg_stat_activity WHERE datname='sales_agent_demo';"

# Kill all connections (for reset)
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c "
  SELECT pg_terminate_backend(pid) FROM pg_stat_activity 
  WHERE datname='sales_agent_demo' AND pid <> pg_backend_pid();"
```

---

### ⚙️ Configuration

```bash
# View current env settings
cat .env

# Update credentials
nano .env  # Edit and save

# Restart for changes to take effect
docker compose down
docker compose up -d
```

---

## Dummy Data Details

- **Date Range**: 2023-01-01 to 2025-12-31 (3 full years)
- **Volume**:
  - 300 doctors × 50 reps → 31,322 call plans (weekly frequency, 78% execution)
  - 329,047 sales transactions (daily grain) across 5 regions
  - Total: 360,884 records seeded
- **Quality Metrics**:
  - Call Adherence: 78.03% (realistic execution rate)
  - Regional Distribution: Balanced across Central/East/North/West, South ~40% lower (declining trend)
  - Seasonality: -30% dip Jul-Aug, +40% spike Nov-Dec
  - South region declining: ~2%/month trend (for prescriptive demos)
  - Tier distribution: A (33%), B (33%), C (34%) of doctors
- **Data Patterns**:
  - Call adherence naturally clustered by rep performance
  - Feedback scores (6-10) only for completed calls
  - Sales follow weekly/monthly cycles + seasonal patterns
  - Manager hierarchy included for rep relationships

---

## Next Steps

### Phase 1 (Vertx Integration)
1. Test Postgres connectivity from Vertx
2. Register Postgres tool in Vertx (read-only credentials)
3. Upload FAQ list + glossary to Knowledge Base
4. Build Workflow: query router (FAQ → KB, dynamic data → Postgres tool)
5. Create Ontology (optional, if it aids grounding)
6. Deploy Agent for descriptive Q&A

### Phase 2-4
- Add predictive forecasting logic
- Add prescriptive recommendation logic
- Evaluations + feedback + monitoring setup

---

## Troubleshooting

### Docker daemon not running
```bash
# macOS
open /Applications/Docker.app

# Or check if running
docker info
```

### Port already in use (5433 or 5050)
```bash
# Find what's using the port
lsof -i :5433   # Postgres
lsof -i :5050   # pgAdmin

# Solution: Either kill the process or change port in docker-compose.yml
# Change: ports: ["5434:5432"] for Postgres or ["5051:80"] for pgAdmin
```

### Containers not starting
```bash
# Check logs
docker compose logs

# Rebuild containers
docker compose down
docker compose up -d --build

# Check Docker resources (may need more memory)
docker info | grep Memory
```

### Postgres connection errors
```bash
# Verify container is healthy
docker compose ps
# STATUS should show "healthy"

# Check Postgres logs
docker compose logs postgres

# Test connection manually
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c "SELECT 1;"
```

### Seed script fails or crashes
```bash
# Check error output first (captures in command output)
source venv/bin/activate && python init/03_seed_data.py

# If connection error: verify Docker is running and healthy
docker compose ps

# If out of memory: script uses batching (5k records at a time) to avoid this
# But if it still fails, can increase Docker memory in Docker Desktop settings

# Reset and retry
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c \
  "TRUNCATE secondary_sales, call_planning, doctors, pharmacies, products, sales_reps, audit_log CASCADE;"
python init/03_seed_data.py
```

### Seed script performance
- **Normal timing**: 2-3 minutes for 360k+ records (3 years of data)
- **Optimization**: Script uses batching (5,000 records per commit) to avoid memory overload
- **Progress**: Check Docker logs to see what stage it's on
- **If too slow**: Reduce NUM_DOCTORS, NUM_REPS, or date range in `init/03_seed_data.py`

### pgAdmin login issues
```bash
# Verify pgAdmin container is running
docker compose ps | grep pgadmin

# Check pgAdmin logs
docker compose logs pgadmin

# Reset pgAdmin credentials
docker compose down
# Edit .env with new PGADMIN_EMAIL and PGADMIN_PASSWORD
docker compose up -d pgadmin
```

### pgAdmin can't connect to Postgres
**Common issue**: Using `localhost` instead of container name
- ✅ Correct: `sales-agent-postgres` (Docker container name)
- ❌ Wrong: `localhost` (won't work from pgAdmin container)

**Solution**:
1. In pgAdmin, edit the server connection
2. Set Host to: `sales-agent-postgres`
3. Set Port to: `5432` (internal Docker port, NOT 5433)
4. Save and retry

### Python venv issues
```bash
# Rebuild venv from scratch
rm -rf venv
python -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

---

## Security Notes

- **Read-only user** (for production Vertx connector): create with `GRANT SELECT ON ALL TABLES IN SCHEMA public TO read_only_user;`
- **Parameterized queries**: Vertx SQL tool should use bound parameters, not string interpolation
- **Data caps**: Agent responses should have row/result limits to prevent accidental data dumps
- **.env file**: add to `.gitignore` (never commit DB password)

---

---

## Implementation Notes

### What Changed from Original Plan

1. **pgAdmin Added**: Web-based database UI for easier data exploration
   - Accessible at http://localhost:5050
   - No CLI knowledge required for browsing data
   
2. **Seed Script Optimized**: Fixed memory issues during large data generation
   - Added batching (5,000 records per commit) for secondary_sales
   - Original: single batch insert → Postgres memory crash
   - Now: incremental commits prevent OOM errors
   - Reduced execution time variance
   
3. **Foreign Key Handling**: Manager hierarchy improved
   - First creates 5 managers without manager references
   - Then creates 45 reps with valid manager_id references
   - Avoids self-referential FK constraint violations
   
4. **Docker Compose Simplified**: Removed obsolete `version` field
   - Eliminates deprecation warning
   - Modern Compose (v2+) doesn't require version

### Known Limitations

- **Local Docker only**: For Vertx to reach this DB, it must be:
  - On same machine (local dev)
  - Or exposed via ngrok/tunnel (testing)
  - Or deployed to cloud Postgres (production)
  
- **Dummy data only**: 3 years of synthetic data, not real sales data
  - Sufficient for MVP + Phase 1 demos
  - Real data integration comes in Phase 2

- **No built-in backups**: Recommended before major changes:
  ```bash
  docker exec sales-agent-postgres pg_dump -U sales_agent \
    -d sales_agent_demo > backup.sql
  ```

---

## References

- **Implementation Plan**: Talk-to-Your-Sales-Data-Implementation-Plan.md (in your project)
- **Vertx Platform**: https://vertxai.io/home
- **Postgres Docker**: https://hub.docker.com/_/postgres
- **pgAdmin**: https://www.pgadmin.org/
- **Faker (Data Gen)**: https://faker.readthedocs.io/
- **psycopg2**: https://www.psycopg.org/

---

## Support

- **Docker/Setup Issues**: Check logs with `docker compose logs`
- **Database Queries**: Test in pgAdmin or psql first, then migrate to Vertx
- **Seed Data Issues**: Review `init/03_seed_data.py` for data generation logic
- **Vertx Integration**: Verify network reachability + SQL connector credentials
- **Questions**: See implementation plan for use case details
