# Manufacturing Data Setup Guide

## 📋 Files Created

### 1. Database Schema
- **File**: `init/mssql/04_manufacturing_schema.sql`
- **Contains**: 14 tables across 7 data domains
  - Dimensions: plants, production_lines, machines, products, operators, suppliers, materials, calendar
  - Facts: production_runs, downtime_events, quality_tests, maintenance_records, inventory_transactions, cost_records
- **Size**: ~5 KB
- **Status**: ✅ Ready to deploy

### 2. Initial Seed Data
- **File**: `init/mssql/05_manufacturing_seed_data.sql`
- **Contains**: Dimension data + Story 1 downtime patterns
- **Status**: ✅ Ready to deploy (provides dimension IDs for Python generator)

### 3. Data Generator (18-24 months)
- **File**: `init/python_seed_generator.py`
- **Purpose**: Generates 700+ production records + 1,500+ downtime events with all business stories
- **Requirements**: `pip install pandas pyodbc python-dotenv`
- **Usage**:
  ```bash
  cd init
  python python_seed_generator.py
  ```
- **Status**: ✅ Ready to use

### 4. Manufacturing API Routes
- **File**: `api/mfg-routes.js`
- **Contains**: 13 endpoints (6 dimensions + 6 facts + 3 KPI endpoints)
- **Integration**: ✅ Already integrated into `api/server.js`
- **Status**: ✅ Ready to deploy

---

## 🚀 Deployment Steps

### Step 1: Create Manufacturing Database
```bash
# SSH to server
ssh user@34.88.207.18

# Create database (run in SSMS or via sqlcmd)
sqlcmd -S 34.88.207.18 -U sales@dmin -P [password] -Q "CREATE DATABASE manufacturing_agent_demo"
```

### Step 2: Run Schema Scripts
```bash
# Option A: Via SSMS (GUI)
1. Connect to manufacturing_agent_demo database
2. Open init/mssql/04_manufacturing_schema.sql
3. Execute

# Option B: Via sqlcmd (CLI)
sqlcmd -S 34.88.207.18 -d manufacturing_agent_demo -U sales@dmin -P [password] -i init/mssql/04_manufacturing_schema.sql
```

### Step 3: Seed Dimension Data
```bash
# Run dimension data insert
sqlcmd -S 34.88.207.18 -d manufacturing_agent_demo -U sales@dmin -P [password] -i init/mssql/05_manufacturing_seed_data.sql
```

### Step 4: Generate Full 18-24 Month Data
```bash
# Local machine: Install dependencies
pip install pandas pyodbc python-dotenv

# Update .env with database credentials
cd init
python python_seed_generator.py
```

**Output**: 
- ~700 production run records
- ~1,500 downtime events
- All 7 business stories embedded

### Step 5: API Endpoints ✅ Already Integrated
**Status**: Manufacturing endpoints are already integrated into `api/server.js`

**13 Endpoints Active**:
```
Dimensions (4):
✅ GET /api/mfg/plants
✅ GET /api/mfg/production-lines
✅ GET /api/mfg/machines
✅ GET /api/mfg/products

Facts (6):
✅ GET /api/mfg/production-runs
✅ GET /api/mfg/downtime-events
✅ GET /api/mfg/quality-tests
✅ GET /api/mfg/maintenance-records
✅ GET /api/mfg/inventory
✅ GET /api/mfg/costs

KPIs (3):
✅ GET /api/mfg/oee-dashboard
✅ GET /api/mfg/downtime-analysis
✅ GET /api/mfg/quality-trends
```

**Features**:
- Uses `api/mfg-routes.js` for business logic
- Environment variable `DB_NAME_MFG` for database selection
- API key validation and response caching (5 min TTL)
- See `api/MFG_ENDPOINTS.md` for complete API reference with curl examples

### Step 6: Deploy & Restart
**Status**: Code is already committed with all endpoints

```bash
# Push to server (if not already pushed)
git push origin main

# SSH to server and restart
ssh user@34.88.207.18
cd /path/to/sales-agent-db
git pull origin main
docker-compose down
docker-compose up -d --build
```

### Step 7: Verify Deployment
```bash
# Test endpoints
curl -H "X-API-Key: sk_prod_..." \
  "https://api-vertx.gigh.com/api/mfg/plants"

curl -H "X-API-Key: sk_prod_..." \
  "https://api-vertx.gigh.com/api/mfg/production-runs?from=2024-09-01&to=2026-09-30&limit=10"

curl -H "X-API-Key: sk_prod_..." \
  "https://api-vertx.gigh.com/api/mfg/oee-dashboard"
```

---

## 📊 Data Schema Overview

### Fact Tables (Transactional Data)
| Table | Records | Time Grain | Business Stories |
|-------|---------|-----------|------------------|
| production_runs | ~700 | Daily/Shift | Output trends, OEE deterioration |
| downtime_events | ~1,500 | Event | Pareto of failures, Story 1 |
| quality_tests | ~5,000 | Batch/Daily | Rejection trends, Story 2 |
| maintenance_records | ~500 | Event | MTBF/MTTR, Story 3 |
| inventory_transactions | ~5,000 | Daily/Weekly | Shortages causing downtime, Story 7 |
| cost_records | ~3,000 | Daily | Cost variance, energy efficiency |

### 7 Embedded Business Stories
1. **Asset 1 (Line-A1)**: Repeated unplanned downtime Oct-Nov 2024 → OEE drops 85%→65%
2. **Product-1/Shift combination**: Rising rejection rate after equipment changeover (Dec 2024)
3. **Asset 5**: Overdue preventive maintenance → Emergency breakdown → High MTTR + cost
4. **Asset 23 (Line-G2)**: High-output line with poor energy efficiency → Performance vs Cost trade-off
5. **Seasonal pattern**: Q1 & Q4 peak production with YoY improvement (Q4 2025) + deterioration (Q2 2026)
6. **Planned shutdown**: Dec 15-Jan 5 annual holiday (planned reduction, not failure)
7. **Material shortage**: Raw material shortage (Mar 2025) → Production downtime → Quality issues

---

## 🔧 API Usage Examples

IDs (`plant_id`, `line_id`, `product_id`, `asset_id`, `material_id`) are **UUIDs**, not codes like `PLANT-001`. Fetch them from dimension endpoints first.

### 1. Resolve real IDs
```bash
# Get plant_id
curl -H "X-API-Key: sk_prod_..." "https://api-vertx.gigh.com/api/mfg/plants"

# Get line_id (optionally filter by plant)
curl -H "X-API-Key: sk_prod_..." "https://api-vertx.gigh.com/api/mfg/production-lines"

# Get product_id / asset_id
curl -H "X-API-Key: sk_prod_..." "https://api-vertx.gigh.com/api/mfg/products"
curl -H "X-API-Key: sk_prod_..." "https://api-vertx.gigh.com/api/mfg/machines"
```

### 2. Get Production Runs for a Line
```bash
curl -H "X-API-Key: sk_prod_..." \
  "https://api-vertx.gigh.com/api/mfg/production-runs?line_id=<LINE_UUID>&from=2024-09-01&to=2026-09-30"
```

### 3. Get Downtime Analysis (Pareto)
```bash
curl -H "X-API-Key: sk_prod_..." \
  "https://api-vertx.gigh.com/api/mfg/downtime-analysis?plant_id=<PLANT_UUID>&from=2024-09-01&to=2026-09-30"
```

### 4. Get OEE Dashboard
```bash
curl -H "X-API-Key: sk_prod_..." \
  "https://api-vertx.gigh.com/api/mfg/oee-dashboard?plant_id=<PLANT_UUID>&from=2024-09-01&to=2026-09-30"
```

### 5. Get Quality Trends
```bash
curl -H "X-API-Key: sk_prod_..." \
  "https://api-vertx.gigh.com/api/mfg/quality-trends?product_id=<PRODUCT_UUID>&from=2024-09-01&to=2026-09-30"
```

Date-only queries (no ID filters) also work, e.g.:
```bash
curl -H "X-API-Key: sk_prod_..." \
  "https://api-vertx.gigh.com/api/mfg/production-runs?from=2024-09-01&to=2026-09-30&limit=100"
```

---

## ✅ Deployment Checklist

### Preparation (Completed ✅)
- [x] Create database schema (04_manufacturing_schema.sql)
- [x] Create seed data (05_manufacturing_seed_data.sql)
- [x] Create data generator (python_seed_generator.py)
- [x] Create API routes (mfg-routes.js)
- [x] Integrate endpoints into api/server.js
- [x] Configure environment variables (DB_NAME_MFG)
- [x] Commit all changes to git

### Deployment (Do These Steps)
- [ ] Create manufacturing_agent_demo database on server
- [ ] Run 04_manufacturing_schema.sql (creates 14 tables + indexes)
- [ ] Run 05_manufacturing_seed_data.sql (dimension data + Story 1)
- [ ] Run python_seed_generator.py (full 18-24 months of data)
- [ ] Push code to remote (git push origin main)
- [ ] SSH to server and pull latest code (git pull origin main)
- [ ] Restart docker-compose (docker-compose down && docker-compose up -d --build)

### Verification (After Deploy)
- [ ] Test health endpoint (curl /health)
- [ ] Test /api/mfg/plants endpoint
- [ ] Test /api/mfg/production-runs endpoint
- [ ] Test /api/mfg/oee-dashboard endpoint
- [ ] Verify sales endpoints still work
- [ ] Update frontend to support agent selection (sales vs manufacturing)

---

## 📞 Support

If you need help with:
- **Data generation**: Modify `init/python_seed_generator.py`
- **API endpoints**: Update `api/mfg-routes.js`
- **Schema changes**: Update `init/mssql/04_manufacturing_schema.sql`
- **Business stories**: Adjust date ranges and values in seed scripts

All files follow the same patterns as your existing sales agent data for consistency.

---

## 🎯 Summary

**What's Included**: ✅
- Database schema with 14 tables (7 data domains)
- Dimension data + seed data generation script
- 13 manufacturing API endpoints (fully integrated)
- Environment variables configured (DB_NAME_MFG)
- Complete deployment guide & API reference

**What's Ready**: ✅
- Code committed and ready to push
- All files prepared for deployment
- No manual code changes needed on server

**Next Steps**: Follow deployment checklist above

---

**Ready to deploy?** Start with: Create manufacturing_agent_demo database (Step 1 in Deployment section)
