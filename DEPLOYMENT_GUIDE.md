# Manufacturing Database Deployment Guide

**Objective**: Deploy manufacturing database and API endpoints to production server at `34.88.207.18`

**Timeline**: ~30-45 minutes total
**Environment**: MSSQL 2022, Docker, Node.js

---

## 📋 Pre-Deployment Checklist

- [ ] Access to server: `34.88.207.18` (SSH)
- [ ] MSSQL credentials: `sales@dmin` / `[password]`
- [ ] Python 3 installed locally (for seed generation)
- [ ] Git repository up to date
- [ ] All files created (schema, seed, routes, env updated)

---

## 🚀 Deployment Steps

### PHASE 1: Database Creation & Schema Setup (10 minutes)

#### Step 1.1: SSH into Server
```bash
ssh user@34.88.207.18
cd /path/to/sales-agent-db
```

#### Step 1.2: Create Manufacturing Database
```bash
sqlcmd -C -S localhost,1433 \
  -U sales@dmin \
  -P 'AycJx8KAVCheha1Ht8n4Peqf75Nf' \
  -Q "CREATE DATABASE manufacturing_agent_demo"
```

**Expected Output**:
```
(1 rows affected)
```

#### Step 1.3: Verify Database Created
```bash
sqlcmd -C -S localhost,1433 \
  -U sales@dmin \
  -P 'AycJx8KAVCheha1Ht8n4Peqf75Nf' \
  -Q "SELECT name FROM sys.databases WHERE name LIKE '%mfg%'"
```

**Expected Output**:
```
name
manufacturing_agent_demo
```

#### Step 1.4: Run Schema Script
```bash
sqlcmd -C -S localhost,1433 \
  -d manufacturing_agent_demo \
  -U sales@dmin \
  -P 'AycJx8KAVCheha1Ht8n4Peqf75Nf' \
  -i init/mssql/04_manufacturing_schema.sql
```

**Expected Output** (no errors, just messages):
```
✓ (1 rows affected) for each index creation
```

#### Step 1.5: Verify Schema Created
```bash
sqlcmd -C -S localhost,1433 \
  -d manufacturing_agent_demo \
  -U sales@dmin \
  -P 'AycJx8KAVCheha1Ht8n4Peqf75Nf' \
  -Q "SELECT COUNT(*) as table_count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'dbo'"
```

**Expected Output**:
```
table_count
14
```

---

### PHASE 2: Seed Initial Data (5 minutes)

#### Step 2.1: Run Dimension & Calendar Data
```bash
sqlcmd -C -S localhost,1433 \
  -d manufacturing_agent_demo \
  -U sales@dmin \
  -P 'AycJx8KAVCheha1Ht8n4Peqf75Nf' \
  -i init/mssql/05_manufacturing_seed_data.sql
```

**Expected Output**:
```
(3 rows affected)     -- Plants
(15 rows affected)    -- Production lines
(30 rows affected)    -- Machines
(12 rows affected)    -- Products
(24 rows affected)    -- Operators
(6 rows affected)     -- Suppliers
(10 rows affected)    -- Materials
(730 rows affected)   -- Calendar
```

#### Step 2.2: Verify Dimension Data
```bash
sqlcmd -C -S localhost,1433 \
  -d manufacturing_agent_demo \
  -U sales@dmin \
  -P 'AycJx8KAVCheha1Ht8n4Peqf75Nf' \
  -Q "SELECT 'plants' as tbl, COUNT(*) as cnt FROM plants UNION SELECT 'production_lines', COUNT(*) FROM production_lines UNION SELECT 'machines', COUNT(*) FROM machines UNION SELECT 'products', COUNT(*) FROM products"
```

**Expected Output**:
```
tbl                    cnt
machines               30
plants                 3
production_lines       15
products               12
```

---

### PHASE 3: Generate Full Transactional Data (15-20 minutes)

#### Step 3.1: Local Machine - Install Python Dependencies
```bash
pip install pandas pyodbc python-dotenv
```

#### Step 3.2: Update Connection String
Edit `.env` (if needed) with server credentials:
```
DB_HOST=34.88.207.18
DB_PORT=1433
DB_NAME_MFG=manufacturing_agent_demo
DB_USER=sales@dmin
DB_PASSWORD=AycJx8KAVCheha1Ht8n4Peqf75Nf
```

#### Step 3.3: Generate Data
```bash
cd init
python python_seed_generator.py
```

**Expected Output**:
```
✓ Connected to manufacturing_agent_demo
✓ Found 3 plants
✓ Found 15 production lines
✓ Found 30 machines
✓ Found 12 products
✓ Found 24 operators
✓ Found 6 suppliers
✓ Found 10 materials
✓ Inserted 700 production records
✓ Inserted 1500+ downtime records
...
✓ Seed Data Generation Complete!
```

#### Step 3.4: Verify Generated Data (From Server)
```bash
sqlcmd -C -S localhost,1433 \
  -d manufacturing_agent_demo \
  -U sales@dmin \
  -P 'AycJx8KAVCheha1Ht8n4Peqf75Nf' \
  -Q "SELECT COUNT(*) as total FROM production_runs; SELECT COUNT(*) FROM downtime_events;"
```

**Expected Output**:
```
total
700

1500
```

---

### PHASE 4: API Code Deployment (5 minutes)

#### Step 4.1: Commit Changes
```bash
git status
# Should show:
# - modified:   api/server.js
# - modified:   api/.env
# - new file:   api/mfg-routes.js

git add api/server.js api/.env api/mfg-routes.js
git add init/mssql/04_manufacturing_schema.sql
git add init/mssql/05_manufacturing_seed_data.sql
git add init/python_seed_generator.py
```

#### Step 4.2: Create Commit
```bash
git commit -m "feat: Add manufacturing data with 18-24 months of realistic seed data

- Create manufacturing_agent_demo database with 14 tables
- Add 700+ production records and 1,500+ downtime events
- Embed 7 business stories in the data
- Add 13 manufacturing API endpoints
- Support OEE, cost, and quality analysis KPIs"
```

#### Step 4.3: Push to Remote
```bash
git push origin main
```

**Expected Output**:
```
Enumerating objects: 12, done.
Counting objects: 100% (12/12), done.
Delta compression using up to 8 threads
To github.com:your-repo/sales-agent-db.git
   a1b2c3d..e4f5g6h main -> main
```

#### Step 4.4: SSH Back to Server & Pull Latest
```bash
ssh user@34.88.207.18
cd /path/to/sales-agent-db
git pull origin main
```

---

### PHASE 5: Restart API Server (5 minutes)

#### Step 5.1: Stop Current Containers
```bash
docker-compose down
```

**Expected Output**:
```
Stopping sales-agent-api ... done
Stopping sales-agent-mssql ... done
Removing sales-agent-api ... done
Removing sales-agent-mssql ... done
Removing network sales-agent-net
```

#### Step 5.2: Rebuild & Start
```bash
docker-compose up -d --build
```

**Expected Output**:
```
Building api
Step 1/8 : FROM node:18-alpine
...
Successfully built xyz
Creating sales-agent-mssql ... done
Creating sales-agent-api ... done
```

#### Step 5.3: Check Container Status
```bash
docker-compose ps
```

**Expected Output**:
```
NAME                   STATUS              PORTS
sales-agent-mssql      Up 2 minutes        127.0.0.1:1433->1433/tcp
sales-agent-api        Up 1 minute         127.0.0.1:3002->3000/tcp
```

#### Step 5.4: Check API Logs
```bash
docker-compose logs api
```

**Expected Output** (should see):
```
✓ Sales Agent API running on http://localhost:3000
✓ Health check: http://localhost:3000/health
✓ Database: 34.88.207.18:1433
```

---

### PHASE 6: Verification & Testing (10 minutes)

#### Test 6.1: Health Check (Public)
```bash
curl http://localhost:3000/health
```

**Expected Output**:
```json
{"status":"ok","timestamp":"2026-09-22T14:30:00.000Z"}
```

#### Test 6.2: Manufacturing Endpoints (With API Key)
```bash
API_KEY="sk_prod_b0d7dc8f51089eecc448914107945db024b1d8383f176fea"

# Test 1: Get Plants
curl -H "X-API-Key: $API_KEY" \
  http://localhost:3000/api/mfg/plants

# Test 2: Get Production Runs
curl -H "X-API-Key: $API_KEY" \
  "http://localhost:3000/api/mfg/production-runs?from=2024-09-01&to=2026-09-30&limit=5"

# Test 3: Get OEE Dashboard
curl -H "X-API-Key: $API_KEY" \
  "http://localhost:3000/api/mfg/oee-dashboard"

# Test 4: Get Downtime Analysis
curl -H "X-API-Key: $API_KEY" \
  "http://localhost:3000/api/mfg/downtime-analysis"
```

**Expected Output**: JSON responses with manufacturing data

#### Test 6.3: Verify Sales Endpoints Still Work
```bash
API_KEY="sk_prod_b0d7dc8f51089eecc448914107945db024b1d8383f176fea"

curl -H "X-API-Key: $API_KEY" \
  http://localhost:3000/api/doctors
```

**Expected Output**: Sales data unchanged

#### Test 6.4: Test from Vertx Domain (Production)
```bash
API_KEY="sk_prod_b0d7dc8f51089eecc448914107945db024b1d8383f176fea"

curl -H "X-API-Key: $API_KEY" \
  "https://api-vertx.gigh.com/api/mfg/plants"
```

---

## ✅ Post-Deployment Verification

### Database Health
```bash
sqlcmd -C -S localhost,1433 \
  -d manufacturing_agent_demo \
  -U sales@dmin \
  -P 'AycJx8KAVCheha1Ht8n4Peqf75Nf' \
  -Q "SELECT 
        (SELECT COUNT(*) FROM production_runs) as production_runs,
        (SELECT COUNT(*) FROM downtime_events) as downtime_events,
        (SELECT COUNT(*) FROM quality_tests) as quality_tests,
        (SELECT COUNT(*) FROM maintenance_records) as maintenance_records,
        (SELECT COUNT(*) FROM inventory_transactions) as inventory,
        (SELECT COUNT(*) FROM cost_records) as costs"
```

**Expected Output**:
```
production_runs downtime_events quality_tests maintenance_records inventory costs
700             1500+           5000+         500+                5000+     3000+
```

### API Health
```bash
docker-compose logs --tail=50 api | grep "✓"
```

**Expected**: All 3 checkmarks visible

---

## 🔧 Troubleshooting

### Issue: Database Creation Failed
**Solution**:
```bash
# Check if database already exists
sqlcmd -C -S localhost,1433 -U sales@dmin -P '[password]' \
  -Q "SELECT name FROM sys.databases WHERE name = 'manufacturing_agent_demo'"

# If exists, drop and recreate
sqlcmd -C -S localhost,1433 -U sales@dmin -P '[password]' \
  -Q "DROP DATABASE manufacturing_agent_demo"
```

### Issue: Python Seed Generator Connection Error
**Solution**:
```bash
# Verify MSSQL server is accessible
ping 34.88.207.18

# Test connection
sqlcmd -C -S 34.88.207.18,1433 -U sales@dmin -P '[password]' -Q "SELECT @@VERSION"

# Update .env in root directory (not just api/)
export DB_HOST=34.88.207.18
python init/python_seed_generator.py
```

### Issue: API Container Won't Start
**Solution**:
```bash
# Check logs
docker-compose logs api

# Rebuild without cache
docker-compose down
docker-compose up -d --build --no-cache

# Check if port is already in use
lsof -i :3000  # or use docker ps
```

### Issue: Endpoints Return 401 Unauthorized
**Solution**:
```bash
# Verify API key header
curl -H "X-API-Key: sk_prod_..." http://localhost:3000/api/mfg/plants

# Check .env has correct API_KEY
cat api/.env | grep API_KEY

# Restart container if changed
docker-compose restart api
```

---

## 📊 Deployment Rollback Plan

If issues occur after deployment:

```bash
# 1. Stop containers
docker-compose down

# 2. Revert code changes
git revert HEAD

# 3. Restart
docker-compose up -d --build

# 4. Verify sales endpoints work
curl -H "X-API-Key: sk_prod_..." http://localhost:3000/api/doctors

# 5. If needed, drop manufacturing DB
sqlcmd -C -S localhost,1433 -U sales@dmin -P '[password]' \
  -Q "DROP DATABASE manufacturing_agent_demo"
```

---

## 📋 Deployment Checklist

### Pre-Deployment
- [ ] All files created and tested locally
- [ ] Git repository clean (all changes committed)
- [ ] Environment variables configured
- [ ] Server access verified

### Database Setup
- [ ] Database created
- [ ] Schema deployed (14 tables)
- [ ] Dimension data seeded (plants, lines, machines, etc.)
- [ ] Transactional data generated (700+ production records)
- [ ] Data verified (row counts correct)

### API Deployment
- [ ] Code committed and pushed
- [ ] Containers stopped and restarted
- [ ] API logs show successful startup
- [ ] Health check endpoint responds

### Testing
- [ ] GET /api/mfg/plants returns data
- [ ] GET /api/mfg/production-runs works with filters
- [ ] GET /api/mfg/oee-dashboard returns metrics
- [ ] Sales endpoints still work
- [ ] Production domain (api-vertx.gigh.com) accessible

### Post-Deployment
- [ ] Monitor logs for errors (first 24 hours)
- [ ] Verify manufacturing agent can query data
- [ ] Document any issues or customizations
- [ ] Update frontend to support agent selection

---

## 📞 Support

**Files Reference**:
- Schema: `init/mssql/04_manufacturing_schema.sql`
- Seed data: `init/mssql/05_manufacturing_seed_data.sql`
- Data generator: `init/python_seed_generator.py`
- API routes: `api/mfg-routes.js`
- Environment: `api/.env` (DB_NAME_MFG configured)

**Documentation**:
- `MANUFACTURING_SETUP.md` - Setup overview
- `api/MFG_ENDPOINTS.md` - API reference
- This file: Step-by-step deployment

---

## ⏱️ Estimated Timeline

| Phase | Task | Time |
|-------|------|------|
| 1 | Database + Schema | 10 min |
| 2 | Seed Dimensions | 5 min |
| 3 | Generate Data | 15-20 min |
| 4 | Deploy Code | 5 min |
| 5 | Restart Services | 5 min |
| 6 | Verification | 10 min |
| **Total** | | **45-50 min** |

---

**Ready to Deploy?** Start with **Step 1.1: SSH into Server**

Generated: 2026-09-22
Status: ✅ READY FOR DEPLOYMENT
