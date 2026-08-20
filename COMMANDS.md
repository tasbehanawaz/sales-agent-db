# Command Reference

Comprehensive command reference for MSSQL database operations (local & Token Bazaar server).

---

## 🚀 Startup & Initialization

### Local Development

```bash
# Start fresh (create containers, schema, seed data)
docker compose up -d
sleep 30
docker exec sales-agent-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "Sales@Agent123" -Q "CREATE DATABASE [sales_agent_demo]"
source venv/bin/activate
pip install -r requirements.txt
python init/mssql/03_seed_data.py

# Start existing containers
docker compose up -d

# Check status
docker compose ps
```

### Token Bazaar Server Deployment

```bash
# On Token Bazaar server (35.240.218.50)
docker compose up -d
sleep 30
docker exec sales-agent-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "Sales@Agent123" -Q "CREATE DATABASE [sales_agent_demo]"

# Then seed data (may require ODBC drivers or running inside container)
python init/mssql/03_seed_data.py
```

---

## 📊 Docker Management

```bash
# View container status
docker compose ps

# View logs in real-time
docker compose logs -f mssql           # MSSQL logs
docker compose logs -f                 # All logs

# View specific number of lines
docker compose logs --tail=50 mssql

# Stop containers (keep data)
docker compose down

# Stop + remove ALL data (full reset)
docker compose down -v

# Restart containers
docker compose restart

# Rebuild containers (after docker-compose.yml changes)
docker compose up -d --build

# Remove MSSQL container
docker compose rm mssql -v
```

---

## 🗄️ Database Access

### Local (via sqlcmd CLI)

```bash
# Connect interactively
docker exec -it sales-agent-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "Sales@Agent123" -d sales_agent_demo

# Inside sqlcmd
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='dbo';
SELECT * FROM doctors LIMIT 5;
GO
exit
```

### Remote Token Bazaar Server (via sqlcmd)

```bash
# Connect to Token Bazaar MSSQL
docker exec -it sales-agent-mssql /opt/mssql-tools18/bin/sqlcmd -C -S 35.240.218.50,1433 -U sa -P "Sales@Agent123" -d sales_agent_demo
```

### Via GUI (Azure Data Studio / VS Code MSSQL Extension)

**Server**: localhost (local) or 35.240.218.50 (Token Bazaar)  
**Port**: 1433  
**Username**: sa  
**Password**: Sales@Agent123  
**Database**: sales_agent_demo  
**Trust cert**: ✅

### Single Queries

```bash
# Run query without entering sqlcmd
docker exec sales-agent-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "Sales@Agent123" -d sales_agent_demo -Q "SELECT COUNT(*) as doctor_count FROM dbo.doctors;"

# Multiple statements
docker exec sales-agent-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "Sales@Agent123" -d sales_agent_demo -Q "
SELECT COUNT(*) as doctors FROM dbo.doctors;
SELECT COUNT(*) as calls FROM dbo.call_planning;
GO
"
```

---

## 📈 Data Verification & Quality

```bash
# Count all records
docker exec sales-agent-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "Sales@Agent123" -d sales_agent_demo -Q "
SELECT 'doctors', COUNT(*) FROM dbo.doctors
UNION ALL SELECT 'call_planning', COUNT(*) FROM dbo.call_planning
UNION ALL SELECT 'secondary_sales', COUNT(*) FROM dbo.secondary_sales
UNION ALL SELECT 'sales_reps', COUNT(*) FROM dbo.sales_reps
UNION ALL SELECT 'products', COUNT(*) FROM dbo.products
UNION ALL SELECT 'pharmacies', COUNT(*) FROM dbo.pharmacies
UNION ALL SELECT 'audit_log', COUNT(*) FROM dbo.audit_log;
GO
"

# Check date ranges
docker exec sales-agent-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "Sales@Agent123" -d sales_agent_demo -Q "
SELECT 'call_planning' as source, MIN(CAST(planned_date AS DATE)), MAX(CAST(planned_date AS DATE))
UNION ALL SELECT 'secondary_sales', MIN(CAST(sale_date AS DATE)), MAX(CAST(sale_date AS DATE))
FROM dbo.secondary_sales;
GO
"

# Verify call adherence
docker exec sales-agent-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "Sales@Agent123" -d sales_agent_demo -Q "
SELECT ROUND(100.0 * COUNT(CASE WHEN actual_call_date IS NOT NULL THEN 1 END) / COUNT(*), 2) as adherence_pct 
FROM dbo.call_planning;
GO
"

# Sales by region
docker exec sales-agent-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "Sales@Agent123" -d sales_agent_demo -Q "
SELECT region, COUNT(*) as transactions, ROUND(SUM(CAST(value_sold AS FLOAT)), 2) as total_value
FROM dbo.secondary_sales GROUP BY region ORDER BY total_value DESC;
GO
"

# Doctor tier distribution
docker exec sales-agent-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "Sales@Agent123" -d sales_agent_demo -Q "
SELECT tier, COUNT(*) as count FROM dbo.doctors GROUP BY tier ORDER BY tier;
GO
"

# Region distribution
docker exec sales-agent-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "Sales@Agent123" -d sales_agent_demo -Q "
SELECT region, COUNT(*) as doctors FROM dbo.doctors GROUP BY region ORDER BY doctors DESC;
GO
"

# List all tables
docker exec sales-agent-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "Sales@Agent123" -d sales_agent_demo -Q "
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='dbo' ORDER BY TABLE_NAME;
GO
"

# List all views
docker exec sales-agent-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "Sales@Agent123" -d sales_agent_demo -Q "
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_SCHEMA='dbo' ORDER BY TABLE_NAME;
GO
"
```

---

## 🔄 Data Management

### Truncate & Reset

```bash
# Truncate all data (keep schema & views)
docker exec sales-agent-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "Sales@Agent123" -d sales_agent_demo -Q "
TRUNCATE TABLE dbo.secondary_sales;
TRUNCATE TABLE dbo.call_planning;
TRUNCATE TABLE dbo.doctors;
TRUNCATE TABLE dbo.pharmacies;
TRUNCATE TABLE dbo.products;
TRUNCATE TABLE dbo.sales_reps;
TRUNCATE TABLE dbo.audit_log;
GO
"

# Re-seed after truncate
source venv/bin/activate
python init/mssql/03_seed_data.py

# Full reset (schema + data + Docker volumes)
docker compose down -v
docker compose up -d
sleep 30
docker exec sales-agent-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "Sales@Agent123" -Q "CREATE DATABASE [sales_agent_demo]"
source venv/bin/activate
python init/mssql/03_seed_data.py
```

### Backup & Restore

```bash
# Full database backup (via sqlcmd)
docker exec sales-agent-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "Sales@Agent123" -Q "
BACKUP DATABASE [sales_agent_demo] TO DISK = '/var/opt/mssql/backup/sales_agent_demo.bak';
GO
"

# Restore from backup
docker exec sales-agent-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "Sales@Agent123" -Q "
RESTORE DATABASE [sales_agent_demo] FROM DISK = '/var/opt/mssql/backup/sales_agent_demo.bak';
GO
"
```

---

## 📋 Agent Query Examples

### Top Performing Reps

```sql
SELECT TOP 5 name, territory, region, total_sales, call_adherence_pct 
FROM dbo.vw_rep_performance 
WHERE YEAR([month]) = 2025 AND MONTH([month]) = 12
ORDER BY total_sales DESC;
```

### Product Sales Trends

```sql
SELECT sku, brand, region, [month], qty_sold, value_sold 
FROM dbo.vw_product_region_trends 
WHERE [month] >= DATEADD(MONTH, -3, GETDATE())
ORDER BY [month] DESC, value_sold DESC;
```

### Inactive Doctors (30+ days)

```sql
SELECT doctor_name, specialty, tier, region, days_since_last_call, total_calls_made
FROM dbo.vw_inactive_doctors 
WHERE days_since_last_call >= 30 
ORDER BY days_since_last_call DESC;
```

### At-Risk Territories

```sql
SELECT TOP 10 name, territory, region, sales_trend_pct, call_adherence_pct 
FROM dbo.vw_at_risk_territories 
ORDER BY sales_trend_pct ASC;
```

### Call Effectiveness by Tier

```sql
SELECT tier, region, [month], total_calls, completed_calls, adherence_pct, avg_feedback, sales_value_post_call
FROM dbo.vw_call_effectiveness 
WHERE [month] >= DATEADD(MONTH, -6, GETDATE())
ORDER BY [month] DESC, adherence_pct DESC;
```

### Territory Coverage

```sql
SELECT name, territory, region, total_doctors, tier_a_count, tier_b_count, tier_c_count, coverage_pct
FROM dbo.vw_territory_coverage 
ORDER BY coverage_pct DESC;
```

### Custom: Sales by Rep & Product

```sql
SELECT r.name, r.territory, p.sku, p.brand,
  COUNT(*) as num_transactions,
  SUM(ss.quantity_sold) as total_qty,
  ROUND(SUM(CAST(ss.value_sold AS FLOAT)), 2) as total_value
FROM dbo.secondary_sales ss
JOIN dbo.sales_reps r ON ss.rep_id = r.rep_id
JOIN dbo.products p ON ss.product_id = p.product_id
WHERE YEAR(ss.sale_date) = 2025 AND MONTH(ss.sale_date) = 12
GROUP BY r.rep_id, r.name, r.territory, p.product_id, p.sku, p.brand
ORDER BY total_value DESC;
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
docker inspect sales-agent-db_mssql_data
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

# Test connection (local)
docker exec sales-agent-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "Sales@Agent123" -d sales_agent_demo -Q "SELECT 1;"
```

---

## 🧪 Testing & Validation

```bash
# Health check
docker exec sales-agent-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "Sales@Agent123" -Q "SELECT 1;" 2>&1 | grep -q "1" && echo "✓ Healthy" || echo "✗ Not responding"

# Test all views exist
docker exec sales-agent-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "Sales@Agent123" -d sales_agent_demo -Q "
SELECT COUNT(*) as view_count FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_SCHEMA='dbo';
GO
"

# Verify all tables have data
docker exec sales-agent-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "Sales@Agent123" -d sales_agent_demo -Q "
SELECT t.TABLE_NAME, ROW_NUMBER() OVER (ORDER BY t.TABLE_NAME) as count
FROM INFORMATION_SCHEMA.TABLES t WHERE t.TABLE_SCHEMA='dbo';
GO
"

# Verify all indexes created
docker exec sales-agent-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "Sales@Agent123" -d sales_agent_demo -Q "
SELECT COUNT(*) as index_count FROM sys.indexes WHERE database_id = DB_ID() AND name IS NOT NULL;
GO
"
```

---

## 📞 Troubleshooting Commands

```bash
# Check if MSSQL is running
docker compose ps | grep mssql

# View MSSQL error logs
docker compose logs mssql | tail -50

# Check MSSQL version
docker exec sales-agent-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "Sales@Agent123" -Q "SELECT @@VERSION;"

# Verify database exists
docker exec sales-agent-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "Sales@Agent123" -Q "
SELECT name FROM sys.databases WHERE name = 'sales_agent_demo';
GO
"

# Check foreign keys
docker exec sales-agent-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "Sales@Agent123" -d sales_agent_demo -Q "
SELECT CONSTRAINT_NAME, TABLE_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
WHERE CONSTRAINT_TYPE='FOREIGN KEY' AND TABLE_SCHEMA='dbo';
GO
"

# Check constraints
docker exec sales-agent-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "Sales@Agent123" -d sales_agent_demo -Q "
SELECT CONSTRAINT_NAME, TABLE_NAME, CONSTRAINT_TYPE FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
WHERE TABLE_SCHEMA='dbo' ORDER BY TABLE_NAME;
GO
"
```

---

**Need help?** See [README.md](README.md) for quick start or [SETUP_GUIDE.md](SETUP_GUIDE.md) for details.
