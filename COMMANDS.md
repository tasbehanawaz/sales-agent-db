


# Command Reference

Comprehensive command reference organized by category.

---

## 🚀 Startup & Initialization

```bash
# Start fresh (create containers, schema, seed data)
docker compose up -d
sleep 15
source venv/bin/activate
python init/03_seed_data.py

# Or all-in-one:
docker compose up -d && sleep 15 && source venv/bin/activate && python init/03_seed_data.py

# Start existing containers
docker compose up -d

# Check status
docker compose ps
```

---

## 📊 Docker Management

```bash
# View container status
docker compose ps

# View logs in real-time
docker compose logs -f postgres        # Postgres logs
docker compose logs -f pgadmin         # pgAdmin logs
docker compose logs -f                 # All logs

# View specific number of lines
docker compose logs --tail=50 postgres

# Stop containers (keep data)
docker compose down

# Stop + remove ALL data (full reset)
docker compose down -v

# Restart containers
docker compose restart

# Rebuild containers (after docker-compose.yml changes)
docker compose up -d --build

# Remove single container
docker compose rm postgres -v
```

---

## 🗄️ Database Access

### Interactive psql CLI

```bash
# Connect interactively
docker exec -it sales-agent-postgres psql -U sales_agent -d sales_agent_demo

# Inside psql
\dt                    # List tables
\dv                    # List views
\d table_name          # Show table structure
\du                    # List users
SELECT version();      # Show Postgres version
\q                     # Exit
```

### Single Queries

```bash
# Run query without entering psql
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c \
  "SELECT * FROM doctors LIMIT 5;"

# Multiple statements
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c \
  "SELECT COUNT(*) as doctors FROM doctors; 
   SELECT COUNT(*) as calls FROM call_planning;"

# Format output as CSV
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c \
  "SELECT * FROM doctors LIMIT 10;" --csv

# Format as aligned table
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c \
  "SELECT * FROM doctors LIMIT 10;" --table
```

### Export Data

```bash
# Export to CSV
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c \
  "COPY doctors TO STDOUT WITH CSV HEADER;" > doctors_export.csv

# Export entire table
docker exec sales-agent-postgres pg_dump -U sales_agent -d sales_agent_demo \
  -t doctors --data-only -a > doctors_data.sql

# Export schema only
docker exec sales-agent-postgres pg_dump -U sales_agent -d sales_agent_demo \
  -t doctors --schema-only > doctors_schema.sql
```

### Database Info

```bash
# Get database size
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c \
  "SELECT pg_size_pretty(pg_database_size('sales_agent_demo'));"

# List all tables with row counts
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c \
  "SELECT schemaname, tablename, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC;"

# List all views
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c \
  "SELECT viewname FROM pg_views WHERE schemaname='public';"

# Check active connections
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c \
  "SELECT usename, application_name, state FROM pg_stat_activity WHERE datname='sales_agent_demo';"
```

---

## 📈 Data Verification & Quality

```bash
# Count all records
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c \
  "SELECT 'doctors', COUNT(*) FROM doctors
   UNION ALL SELECT 'call_planning', COUNT(*) FROM call_planning
   UNION ALL SELECT 'secondary_sales', COUNT(*) FROM secondary_sales
   UNION ALL SELECT 'sales_reps', COUNT(*) FROM sales_reps
   UNION ALL SELECT 'products', COUNT(*) FROM products
   UNION ALL SELECT 'pharmacies', COUNT(*) FROM pharmacies;"

# Check date ranges
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c \
  "SELECT 'call_planning' as source, MIN(planned_date), MAX(planned_date)
   UNION ALL
   SELECT 'secondary_sales', MIN(sale_date), MAX(sale_date)
   FROM secondary_sales;"

# Verify call adherence
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c \
  "SELECT ROUND(100.0 * COUNT(CASE WHEN actual_call_date IS NOT NULL THEN 1 END) / 
    COUNT(*), 2) as adherence_pct FROM call_planning;"

# Sales by region
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c \
  "SELECT region, COUNT(*) as transactions, 
    ROUND(SUM(value_sold)::NUMERIC, 2) as total_value
   FROM secondary_sales GROUP BY region ORDER BY total_value DESC;"

# Doctor tier distribution
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c \
  "SELECT tier, COUNT(*) as count FROM doctors GROUP BY tier ORDER BY tier;"

# Region distribution
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c \
  "SELECT region, COUNT(*) as doctors FROM doctors GROUP BY region ORDER BY doctors DESC;"
```

---

## 🔄 Data Management

### Truncate & Reset

```bash
# Truncate all data (keep schema & views)
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c \
  "TRUNCATE secondary_sales, call_planning, doctors, pharmacies, 
    products, sales_reps, audit_log CASCADE;"

# Re-seed after truncate
source venv/bin/activate
python init/03_seed_data.py

# Full reset (schema + data + Docker volumes)
docker compose down -v
docker compose up -d
sleep 15
source venv/bin/activate
python init/03_seed_data.py
```

### Backup & Restore

```bash
# Full database backup
docker exec sales-agent-postgres pg_dump -U sales_agent -d sales_agent_demo > backup.sql

# Backup specific table
docker exec sales-agent-postgres pg_dump -U sales_agent -d sales_agent_demo \
  -t secondary_sales > sales_backup.sql

# Backup without data (schema only)
docker exec sales-agent-postgres pg_dump -U sales_agent -d sales_agent_demo \
  --schema-only > schema_backup.sql

# Restore full database
cat backup.sql | docker exec -i sales-agent-postgres psql -U sales_agent -d sales_agent_demo

# Restore specific table
cat sales_backup.sql | docker exec -i sales-agent-postgres psql -U sales_agent -d sales_agent_demo

# Restore with progress
cat backup.sql | docker exec -i sales-agent-postgres psql -U sales_agent -d sales_agent_demo -v ON_ERROR_STOP=1
```

### View Statistics

```bash
# Index usage statistics
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c \
  "SELECT schemaname, tablename, indexname, idx_scan 
   FROM pg_stat_user_indexes ORDER BY idx_scan DESC;"

# Table size statistics
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c \
  "SELECT tablename, 
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
   FROM pg_tables WHERE schemaname='public' ORDER BY 2 DESC;"
```

---

## 📋 Agent Query Examples

### Run Sample Queries

```bash
# Connect to psql first
docker exec -it sales-agent-postgres psql -U sales_agent -d sales_agent_demo
```

### Top Performing Reps

```sql
SELECT name, territory, region, total_sales, call_adherence_pct 
FROM vw_rep_performance 
WHERE month = '2025-12-01'
ORDER BY total_sales DESC 
LIMIT 5;
```

### Product Sales Trends

```sql
SELECT sku, brand, region, month, qty_sold, value_sold 
FROM vw_product_region_trends 
WHERE month >= DATE_TRUNC('month', CURRENT_DATE)::DATE - INTERVAL '3 months'
ORDER BY month DESC, value_sold DESC;
```

### Inactive Doctors (30+ days)

```sql
SELECT doctor_name, specialty, tier, region, days_since_last_call, total_calls_made
FROM vw_inactive_doctors 
WHERE days_since_last_call >= 30 
ORDER BY days_since_last_call DESC
LIMIT 10;
```

### At-Risk Territories

```sql
SELECT name, territory, region, sales_trend_pct, call_adherence_pct 
FROM vw_at_risk_territories 
ORDER BY sales_trend_pct ASC
LIMIT 10;
```

### Call Effectiveness by Tier

```sql
SELECT tier, region, month, total_calls, completed_calls, 
  adherence_pct, avg_feedback, sales_value_post_call
FROM vw_call_effectiveness 
WHERE month >= DATE_TRUNC('month', CURRENT_DATE)::DATE - INTERVAL '6 months'
ORDER BY month DESC, adherence_pct DESC;
```

### Territory Coverage

```sql
SELECT name, territory, region, total_doctors, 
  tier_a_count, tier_b_count, tier_c_count, coverage_pct
FROM vw_territory_coverage 
ORDER BY coverage_pct DESC;
```

### Custom: Sales by Rep & Product

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

### Sales Forecast (Simple Trend)

```sql
WITH monthly_sales AS (
  SELECT DATE_TRUNC('month', sale_date)::DATE as month, 
    SUM(value_sold) as total_value
  FROM secondary_sales
  GROUP BY DATE_TRUNC('month', sale_date)
)
SELECT month, total_value, 
  LAG(total_value) OVER (ORDER BY month) as prev_month,
  ROUND(100.0 * (total_value - LAG(total_value) OVER (ORDER BY month)) / 
    LAG(total_value) OVER (ORDER BY month), 2) as pct_change
FROM monthly_sales
WHERE month >= CURRENT_DATE - INTERVAL '12 months'
ORDER BY month DESC;
```

---

## 🧹 Cleanup & Maintenance

### Python Environment

```bash
# Remove old venv and rebuild
rm -rf venv
python -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Check installed packages
pip list

# Upgrade packages
pip install --upgrade -r requirements.txt
```

### Disk Usage

```bash
# Check repo size
du -sh sales-agent-db/

# Check Docker volume size
docker volume ls | grep sales-agent

# Inspect volume
docker inspect sales-agent-db_sales_agent_data
```

### Connection Management

```bash
# View all active connections
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c \
  "SELECT pid, usename, application_name, state, query FROM pg_stat_activity 
   WHERE datname='sales_agent_demo';"

# Kill all connections (for reset/maintenance)
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity 
   WHERE datname='sales_agent_demo' AND pid <> pg_backend_pid();"

# Kill specific user connections
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity 
   WHERE usename='sales_agent';"
```

---

## ⚙️ Configuration

```bash
# View current settings
cat .env

# Edit settings
nano .env
# (or use your editor: vim, code, etc.)

# Reload after changes
docker compose down
docker compose up -d

# Test new credentials
docker exec sales-agent-postgres psql -h sales-agent-postgres -U sales_agent \
  -d sales_agent_demo -c "SELECT 1;"
```

---

## 🌐 pgAdmin Access

```bash
# Open in browser
http://localhost:5050

# Login
# Email: admin@example.com
# Password: admin

# Add Database Server:
# 1. Right-click "Servers" → Register → Server
# 2. General Tab → Name: sales-agent-db
# 3. Connection Tab → Fill in details:
#    - Host: sales-agent-postgres
#    - Port: 5432
#    - Database: sales_agent_demo
#    - Username: sales_agent
#    - Password: sales_agent_password
# 4. Save
```

---

## 🧪 Testing & Validation

```bash
# Health check
docker exec sales-agent-postgres pg_isready -U sales_agent -d sales_agent_demo

# Test all views exist
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c \
  "SELECT COUNT(*) as view_count FROM pg_views WHERE schemaname='public';"

# Verify all tables have data
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c \
  "SELECT tablename, n_live_tup FROM pg_stat_user_tables 
   WHERE schemaname='public' AND n_live_tup = 0;"

# Test a complex query (view)
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c \
  "SELECT COUNT(*) FROM vw_rep_performance WHERE month = '2025-12-01';"
```

---

## 📞 Troubleshooting Commands

```bash
# Check if Postgres is running
docker compose ps | grep postgres

# View Postgres error logs
docker compose logs postgres | tail -50

# Test network connectivity (container to container)
docker exec sales-agent-postgres ping sales-agent-pgadmin

# Check Postgres version
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c "SELECT version();"

# Verify all indexes created
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c \
  "SELECT schemaname, tablename, indexname FROM pg_indexes 
   WHERE schemaname='public' ORDER BY tablename;"

# Check for missing foreign keys
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c \
  "SELECT constraint_name, table_name FROM information_schema.table_constraints 
   WHERE constraint_type='FOREIGN KEY' AND table_schema='public';"
```

---

**Need help?** See [README.md](README.md) for quick start or [SETUP_GUIDE.md](SETUP_GUIDE.md) for details.
