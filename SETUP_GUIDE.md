# Setup Guide & Data Model

Detailed information about the database setup, data model, and implementation.

---

## Prerequisites

- **Docker & Docker Compose** installed (`docker --version`, `docker compose --version`)
- **Python 3.8+** (for seed data generation)
- **~5GB disk space** (for 3 years of dummy data)
- **Text editor** (for .env configuration)

---

## Database Connection

### Via CLI (psql)
```
Host: localhost
Port: 5433
Database: sales_agent_demo
User: sales_agent
Password: sales_agent_password (from .env)

# Connect:
psql -h localhost -p 5433 -U sales_agent -d sales_agent_demo
```

### Via pgAdmin Web UI
```
Browser: http://localhost:5050
Login: admin@example.com / admin

Server Connection:
  - Host: sales-agent-postgres (Docker container name)
  - Port: 5432 (internal Docker port)
  - Database: sales_agent_demo
  - User: sales_agent
  - Password: sales_agent_password
```

**⚠️ Important**: Use `sales-agent-postgres` (container name), NOT `localhost`

---

## Data Model

### Dimension Tables

#### **sales_reps** (50 records)
- `rep_id` (UUID primary key)
- `name`, `territory`, `region`
- `manager_id` (FK to sales_reps, nullable)
- `created_at`, `updated_at`

**Indexes**: region, territory

#### **products** (15 records)
- `product_id` (UUID primary key)
- `sku` (unique), `brand`, `therapy_area`
- `launch_date`

**Indexes**: sku

#### **pharmacies** (150 records)
- `pharmacy_id` (UUID primary key)
- `name`, `region`, `channel`

### Fact Tables

#### **doctors** (300 records)
- `doctor_id`, `doctor_name`, `specialty`
- `tier` (A/B/C), `hospital_clinic`, `region`, `territory`, `city`, `market`
- `onboarded_date`, `status`

**Indexes**: region, territory, tier, status

**Tier Distribution**: A=33%, B=33%, C=34% (realistic distribution)

#### **call_planning** (31,322 records)
- `call_id`, `doctor_id` (FK), `rep_id` (FK), `product_id` (FK)
- `planned_date`, `actual_call_date` (nullable)
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
   - Columns: tier, region, market, month, total_calls, completed_calls, adherence_pct, avg_feedback, sales_value_post_call

4. **vw_inactive_doctors**
   - Doctors not called in 30/60/90+ days
   - Columns: doctor_id, doctor_name, specialty, tier, region, last_call_date, days_since_last_call, total_calls_made

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

### What Changed from Original Plan

1. **pgAdmin Added**
   - Web-based database UI for easier data exploration
   - Accessible at http://localhost:5050
   - No CLI knowledge required

2. **Seed Script Optimized**
   - Fixed memory issues during large data generation
   - Added batching (5,000 records per commit) for secondary_sales
   - Original: single batch insert → Postgres memory crash
   - Now: incremental commits prevent OOM errors

3. **Foreign Key Handling**
   - Manager hierarchy improved for sales_reps
   - First creates 5 managers without manager references
   - Then creates 45 reps with valid manager_id references
   - Avoids self-referential FK constraint violations

4. **Docker Compose Simplified**
   - Removed obsolete `version` field
   - Eliminates deprecation warning
   - Modern Compose (v2+) doesn't require version

### Known Limitations

- **Local Docker only**: For Vertx to reach this DB:
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

## Security Notes

### Read-Only User (Recommended for Vertx)

```sql
-- Create read-only user for Vertx connector
CREATE USER vertx_reader WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE sales_agent_demo TO vertx_reader;
GRANT USAGE ON SCHEMA public TO vertx_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO vertx_reader;
GRANT SELECT ON ALL VIEWS IN SCHEMA public TO vertx_reader;

-- Use these credentials in Vertx instead of admin
```

### Best Practices

- ✅ Use read-only credentials for agent connections
- ✅ Parameterized queries (avoid SQL injection)
- ✅ Set connection timeout (avoid hanging queries)
- ✅ Enable SSL/TLS for cloud connections
- ✅ Add response limits (LIMIT clause in queries)
- ✅ Never commit .env file with real passwords
- ❌ Don't use admin credentials for agent connections
- ❌ Don't expose database password in Vertx code
- ❌ Don't allow unbounded queries

---

## Backup & Restore

### Export Database

```bash
# Full dump
docker exec sales-agent-postgres pg_dump -U sales_agent \
  -d sales_agent_demo > backup.sql

# Specific table
docker exec sales-agent-postgres pg_dump -U sales_agent \
  -d sales_agent_demo -t secondary_sales > sales_backup.sql

# CSV export
docker exec sales-agent-postgres psql -U sales_agent -d sales_agent_demo -c \
  "COPY secondary_sales TO STDOUT WITH CSV HEADER;" > sales.csv
```

### Restore from Backup

```bash
# Full restore
cat backup.sql | docker exec -i sales-agent-postgres psql -U sales_agent -d sales_agent_demo

# Single table restore
cat sales_backup.sql | docker exec -i sales-agent-postgres psql -U sales_agent -d sales_agent_demo
```

---

## Next Steps

1. ✅ Database running & seeded
2. ⏭️ See [COMMANDS.md](COMMANDS.md) for operational commands
3. ⏭️ See [VERTX_INTEGRATION.md](VERTX_INTEGRATION.md) for Vertx setup

---

**Questions?** Check [COMMANDS.md](COMMANDS.md) for troubleshooting commands.
