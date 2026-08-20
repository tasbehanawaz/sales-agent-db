# Setup Guide & Data Model

Detailed information about the MSSQL database setup, data model, and implementation.

---

## Prerequisites

- **Docker & Docker Compose** installed (`docker --version`, `docker compose --version`)
- **Python 3.8+** (for seed data generation)
- **~5GB disk space** (for 3 years of dummy data)
- **Text editor** (for .env configuration)

---

## Database Connection

### Local Development (sqlcmd CLI)

```
Host: localhost
Port: 1433
Database: sales_agent_demo
User: sa
Password: Sales@Agent123

# Connect:
docker exec -it sales-agent-mssql /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "Sales@Agent123" -d sales_agent_demo
```

### Token Bazaar Server (Remote)

```
Host: 35.240.218.50
Port: 1433
Database: sales_agent_demo
User: sa
Password: Sales@Agent123

# Connect:
docker exec -it sales-agent-mssql /opt/mssql-tools18/bin/sqlcmd -C -S 35.240.218.50,1433 -U sa -P "Sales@Agent123" -d sales_agent_demo
```

### Via GUI Tools

**Supported**: Azure Data Studio, VS Code MSSQL Extension, SQL Server Management Studio

Connection details (same for local/remote, just change host):
- Server: localhost (local) or 35.240.218.50 (Token Bazaar)
- Port: 1433
- Authentication: SQL Login
- Username: sa
- Password: Sales@Agent123
- Database: sales_agent_demo
- Trust certificate: ✅

---

## Data Model

### Dimension Tables

#### **sales_reps** (50 records)
- `rep_id` (UUID primary key)
- `name`, `territory`, `region`
- `manager_id` (FK to sales_reps, nullable for top-level managers)
- `created_at`, `updated_at`

**Indexes**: region, territory, manager_id

**Hierarchy**: 5 managers + 45 reps (realistic sales organization structure)

#### **products** (15 records)
- `product_id` (UUID primary key)
- `sku` (unique), `brand`, `therapy_area`
- `launch_date`

**Indexes**: sku

#### **pharmacies** (150 records)
- `pharmacy_id` (UUID primary key)
- `name`, `region`, `channel`

**Channels**: Retail, Hospital, Clinic

### Fact Tables

#### **doctors** (300 records)
- `doctor_id`, `doctor_name`, `specialty`
- `tier` (A/B/C), `hospital_clinic`, `region`, `territory`, `city`, `market`
- `onboarded_date`, `status` (active/inactive)

**Indexes**: region, territory, tier, status

**Tier Distribution**: A=33%, B=33%, C=34% (realistic distribution)

**Specialties**: Cardiology, Oncology, Neurology, Endocrinology, Psychiatry, General Practice

#### **call_planning** (31,322 records)
- `call_id`, `doctor_id` (FK), `rep_id` (FK), `product_id` (FK)
- `planned_date`, `actual_call_date` (nullable if call wasn't executed)
- `call_type`, `frequency_target`, `call_status`, `feedback_score` (1-10, nullable)

**Execution Rate**: 78.03% (actual_call_date filled in when executed)

**Feedback**: Only recorded for completed calls (actual_call_date IS NOT NULL)

**Indexes**: doctor_id, rep_id, product_id, planned_date, actual_call_date, call_status

#### **secondary_sales** (329,047 records)
- `sale_id`, `sale_date`, `product_id` (FK), `pharmacy_id` (FK), `rep_id` (FK)
- `region`, `quantity_sold`, `value_sold`

**Grain**: Daily transactions per rep-pharmacy-product combo

**Indexes**: sale_date, product_id, pharmacy_id, rep_id, region

### Views (for Agent Queries)

1. **vw_rep_performance**
   - Monthly sales + call adherence per rep
   - Columns: rep_id, name, territory, region, month, total_sales, call_adherence_pct, avg_feedback_score

2. **vw_product_region_trends**
   - Product sales trends by region and month
   - Columns: product_id, sku, brand, therapy_area, region, month, qty_sold, value_sold, pharmacy_count, rep_count

3. **vw_call_effectiveness**
   - Call success metrics by doctor tier
   - Columns: tier, region, month, total_calls, completed_calls, adherence_pct, avg_feedback, sales_value_post_call

4. **vw_inactive_doctors**
   - Doctors not called in 30/60/90+ days
   - Columns: doctor_id, doctor_name, specialty, tier, region, days_since_last_call, total_calls_made

5. **vw_at_risk_territories**
   - Territories with declining sales or low adherence
   - Columns: rep_id, name, territory, region, sales_trend_pct, call_adherence_pct

6. **vw_territory_coverage**
   - Coverage summary per rep
   - Columns: rep_id, name, territory, region, total_doctors, tier_a_count, tier_b_count, tier_c_count, coverage_pct

---

## Dummy Data Details

### Volume

| Table | Records | Details |
|-------|---------|---------|
| doctors | 300 | A/B/C tier, 5 regions, random specialties |
| sales_reps | 50 | With manager hierarchy (5 managers + 45 reps) |
| products | 15 | Different brands & therapy areas |
| pharmacies | 150 | Multiple channels (Retail, Hospital, Clinic) |
| call_planning | 31,322 | Weekly frequency, 78% execution rate |
| secondary_sales | 329,047 | Daily transactions, 3-year span |
| **Total** | **360,884** | Ready for MVP + Phase 1 demos |

### Date Range

- **Start**: 2023-01-01
- **End**: 2025-12-31
- **Duration**: 3 full years
- **Grain**: Weekly for calls, Daily for sales

### Patterns & Trends

#### Seasonality
- **Summer (Jul-Aug)**: -30% sales dip
- **Year-end (Nov-Dec)**: +40% sales spike
- **Other months**: Baseline (1.0x multiplier)

#### Regional Trends
- **North, East, West, Central**: Stable or slight growth
- **South**: Declining ~2% per month (for prescriptive demos)
  - Useful for identifying at-risk territories
  - Demonstrates need for intervention

#### Call Adherence
- **Overall**: 78.03% execution rate
- **Clustered**: Naturally varies by rep performance
- **Realistic**: Not uniform (some reps 90%, others 60%)

#### Feedback Scores
- **Range**: 6-10 (optimistic but realistic)
- **Only for completed calls**: NULL for planned/missed calls
- **Post-call sales**: 30-day window tracked in views

---

## Implementation Notes

### PostgreSQL → MSSQL Migration

1. **Database Engine Switched**
   - From PostgreSQL 16 to SQL Server 2022 Express
   - Aligned with enterprise requirements

2. **Schema Converted**
   - PostgreSQL plpgsql → T-SQL
   - UUID types → T-SQL UNIQUEIDENTIFIER with NEWID()
   - TIMESTAMP → DATETIME
   - Syntax updates (CREATE VIEW, constraints, indexes)

3. **Seed Script Refactored**
   - psycopg2 → pyodbc (MSSQL connector)
   - Same 360k+ records, same patterns
   - Batch processing preserved (5,000 records per commit)
   - macOS ODBC driver limitation handled

4. **Data Fidelity Maintained**
   - Same schema structure
   - Same data volumes
   - Same realistic patterns (seasonality, trends, tier distribution)
   - Same 3-year historical span

### Known Limitations

- **Local Docker only (for now)**: For Vertx to reach this DB:
  - On same machine (local dev)
  - Or exposed via ngrok/tunnel (testing)
  - Or deployed to cloud (Token Bazaar: 35.240.218.50)

- **Dummy data only**: 3 years of synthetic data, not real sales data
  - Sufficient for MVP + Phase 1 demos
  - Real data integration comes in Phase 2

- **ODBC driver on macOS**: Seeding requires either:
  - Running inside Docker container
  - Or deploying to server with ODBC drivers installed
  - Or using cloud SQL Server instance

---

## Security Notes

### Read-Only User (Recommended for Vertx)

```sql
-- Create read-only user for Vertx connector
CREATE LOGIN vertx_reader WITH PASSWORD = 'secure_password';
CREATE USER vertx_reader FOR LOGIN vertx_reader;

-- Grant read-only permissions
GRANT SELECT ON ALL TABLES IN DATABASE sales_agent_demo TO vertx_reader;
GRANT SELECT ON ALL VIEWS IN DATABASE sales_agent_demo TO vertx_reader;

-- Use these credentials in Vertx instead of admin
```

### Best Practices

- ✅ Use read-only credentials for agent connections
- ✅ Parameterized queries (avoid SQL injection)
- ✅ Set connection timeout (avoid hanging queries)
- ✅ Enable SSL/TLS for cloud connections
- ✅ Add response limits (TOP clause in queries)
- ✅ Never commit .env file with real passwords
- ❌ Don't use admin credentials for agent connections
- ❌ Don't expose database password in Vertx code
- ❌ Don't allow unbounded queries

---

## Deployment Checklist

### Local Development
- [ ] Docker & Docker Compose running
- [ ] `docker compose up -d` starts MSSQL
- [ ] Database created & schema applied
- [ ] Seed script runs successfully (360k+ records)
- [ ] All 7 tables exist with data
- [ ] All 6 views exist and queryable
- [ ] Connection via sqlcmd/VS Code/Azure Data Studio works

### Token Bazaar Server (35.240.218.50)
- [ ] Docker & Docker Compose running on server
- [ ] Port 1433 open on firewall
- [ ] `docker compose up -d` starts MSSQL
- [ ] Database created & schema applied
- [ ] Seed script runs successfully
- [ ] All tables/views verified
- [ ] Connection from Vertx platform tested

---

## Next Steps

1. ✅ Database running & seeded (local or Token Bazaar)
2. ⏭️ See [COMMANDS.md](COMMANDS.md) for operational commands
3. ⏭️ Connect API layer to MSSQL (Node + Express)
4. ⏭️ Expose via Vertx integration

---

**Questions?** Check [COMMANDS.md](COMMANDS.md) for troubleshooting commands.
