# Reports API

Generate PPTX, PDF and CSV reports from the manufacturing and Apex Group databases (and CSV or PPTX for the sales demo).
Every endpoint returns JSON with a `download_url`; files are served from `/reports/download/{filename}` without an API key.

- Manufacturing: below.
- Apex Group: [Apex Group Reports](#apex-group-reports).
- CSV: [CSV Output](#csv-output).

## Endpoints

### Fixed Report Generation
```
GET /api/mfg/reports/generate
```

### Query-Based Report Generation
```
GET /api/mfg/reports/generate-query
POST /api/mfg/reports/generate-query
```

## Query Parameters

### For Fixed Reports (`/api/mfg/reports/generate`)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `report_type` | string | Yes | Type of report to generate (see Report Types below) |
| `format` | string | No | Output format: `pptx` (default), `pdf` or `csv` |
| `from` | date | No | Start date (YYYY-MM-DD) |
| `to` | date | No | End date (YYYY-MM-DD) |
| `plant_id` | string | No | Filter by plant ID (UUID format) |

### For Query-Based Reports (`/api/mfg/reports/generate-query`)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Natural language query describing desired report (e.g., "show OEE trends", "what's downtime") |
| `format` | string | No | Output format: `pptx` (default), `pdf` or `csv` |
| `from` | date | No | Start date (YYYY-MM-DD) |
| `to` | date | No | End date (YYYY-MM-DD) |
| `plant_id` | string | No | Filter by plant ID (UUID format) |

## Report Types

### 1. OEE Dashboard Report
```
report_type=oee-dashboard
```
**Includes:**
- Overall OEE percentage
- Availability, Performance, Quality component breakdown
- OEE trends by line
- Top and bottom performing lines
- Key insights and recommendations

### 2. Downtime Analysis Report
```
report_type=downtime-analysis
```
**Includes:**
- Total downtime hours and incident count
- Average downtime duration
- Pareto analysis (top 20 downtime drivers)
- Recurring failure patterns
- Impact by equipment/line
- Maintenance recommendations

### 3. Quality Trends Report
```
report_type=quality-trends
```
**Includes:**
- Average yield percentage
- Rejection rates
- Quality metrics by product/line
- Defect trend analysis
- Product quality variance
- Process improvement suggestions

### 4. Cost Analysis Report
```
report_type=cost-analysis
```
**Includes:**
- Average cost per unit
- Energy cost and intensity
- Scrap cost impact
- Cost by production line
- Cost variance analysis
- Efficiency recommendations

### 5. Executive Summary
```
report_type=executive-summary
```
**Includes:**
- Key KPIs (OEE, Yield, Cost, Downtime)
- Top 5 priority issues
- Recommended actions (30-day plan)
- Cross-functional impact summary

## Usage Examples

### Generate OEE Report as PPTX (Last 30 Days)
```bash
curl -H "X-API-Key: sk_prod_..." \
  "http://localhost:3000/api/mfg/reports/generate?report_type=oee-dashboard&from=2026-08-23&to=2026-09-22&format=pptx"
```

### Generate OEE Report as PDF (Last 30 Days)
```bash
curl -H "X-API-Key: sk_prod_..." \
  "http://localhost:3000/api/mfg/reports/generate?report_type=oee-dashboard&from=2026-08-23&to=2026-09-22&format=pdf"
```

### Generate Downtime Report (Specific Plant, PDF)
```bash
# plant_id must be a UUID from GET /api/mfg/plants (not "PLANT-001")
curl -H "X-API-Key: sk_prod_..." \
  "http://localhost:3000/api/mfg/reports/generate?report_type=downtime-analysis&plant_id=<PLANT_UUID>&from=2026-09-01&to=2026-09-30&format=pdf"
```

### Generate Query-Based Report (Natural Language)
```bash
# Builds a custom report from DB topics matching the query (not limited to 5 templates)
curl -H "X-API-Key: sk_prod_..." \
  "http://localhost:3000/api/mfg/reports/generate-query?query=create%20a%20report%20on%20production%20runs&format=pdf"
```

### Generate Query-Based Report (POST)
```bash
curl -X POST -H "X-API-Key: sk_prod_..." \
  -H "Content-Type: application/json" \
  -d '{"query": "report on production lines", "format": "pdf", "from": "2026-09-01", "to": "2026-09-30"}' \
  "http://localhost:3000/api/mfg/reports/generate-query"
```

### Generate Executive Summary (All Data)
```bash
curl -H "X-API-Key: sk_prod_..." \
  "http://localhost:3000/api/mfg/reports/generate?report_type=executive-summary"
```

### Generate Quality Report (Year to Date)
```bash
curl -H "X-API-Key: sk_prod_..." \
  "http://localhost:3000/api/mfg/reports/generate?report_type=quality-trends&from=2026-01-01&to=2026-09-22"
```

## Response

**Success (200):** JSON with `filename` and `download_url` (`mfg-{report_type}_{timestamp}.{pptx|pdf|csv}`).

**Error (400):**
```json
{
  "success": false,
  "error": "report_type parameter required"
}
```

**Error (401):**
```json
{
  "success": false,
  "error": "Unauthorized: Invalid or missing API key"
}
```

**Error (500):**
```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

## Report Features

- **Multiple Formats:** Generate as PPTX (PowerPoint), PDF or CSV
- **Professional Formatting:** Branded slides with consistent styling
- **Data Visualization:** Tables and KPI boxes for key metrics
- **Dynamic Content:** Generated from live database queries
- **Actionable Insights:** Recommendations based on data patterns
- **Date Filtering:** Flexible time range selection
- **Plant Filtering:** Generate reports for specific facilities
- **Query-Based Generation:** Free-text queries fetch matching DB topics and build a custom report
- **Agent Integration:** Seamlessly integrates with manufacturing agent for on-demand report generation

## Query-Based Reports (Agent-Friendly)

`/api/mfg/reports/generate-query` does **not** pick one of the 5 fixed templates and stop.
It detects one or more **topics** from the user question, queries the manufacturing DB for each, and renders a custom `query-driven` PDF/PPTX titled from the query.

Use this for agent chat follow-ups ("create a report on production runs", "report on products", etc.).
Use `/api/mfg/reports/generate?report_type=...` only when the user explicitly picks a fixed template.

### Supported Topics

| Topic | Example phrases | DB sections included |
|-------|-----------------|----------------------|
| `oee` | OEE, availability, equipment effectiveness | OEE KPIs + by-line table |
| `lines` | production lines, lines | OEE + production output by line |
| `production` | production runs, output, throughput | Run counts / good vs actual qty by line |
| `downtime` | downtime, failure, breakdown, pareto | Downtime KPIs + reason Pareto |
| `quality` | quality, yield, rejection, defect | Yield / rejection KPIs |
| `products` | products, SKU | Quality-by-product table |
| `costs` | cost, energy, labor, unit cost | Cost KPIs + by-line |
| `executive` | executive, overview, KPIs (fallback) | Cross-metric executive summary |

Multi-topic queries work (e.g. "downtime and quality" → both sections).

### Example Agent Interaction

```
User: "Create a PDF report on production runs"

Agent Action:
POST /api/mfg/reports/generate-query
{
  "query": "Create a PDF report on production runs",
  "format": "pdf"
}

Agent Response:
{
  "success": true,
  "query": "Create a PDF report on production runs",
  "title": "Production runs Report",
  "report_type": "query-driven",
  "topics": ["production"],
  "matched_template": "oee-dashboard",
  "format": "pdf",
  "download_url": "https://api.example.com/reports/download/mfg-query-driven_....pdf",
  "message": "Report built from DB data for topics: production. Use download_url to download."
}
```

## Branding

Reports use the following styling:
- **Primary Color:** Blue (#2E75B6)
- **Success Color:** Green (#70AD47)
- **Warning Color:** Gold (#FFC000)
- **Danger Color:** Red (#C55A11)
- **Font:** Calibri

To customize styling, edit `api/reports/styleConfig.js`

## Performance

- Report generation time: 2-5 seconds (depending on data volume)
- File size: 200-500 KB (typical)
- Maximum date range: 24 months

## Troubleshooting

### Report Contains No Data
- Verify date range has data in the database
- Check plant_id filter is correct
- Query data endpoints to confirm data exists

### API Key Error
- Ensure X-API-Key header is included
- Verify API key matches API_KEY environment variable

### Timeout Error
- Try narrowing the date range
- Run report during off-peak hours
- Check database connection status

## Implementation Details

### PPTX Reports
- **Library:** pptxgenjs - JavaScript PPTX generation library
- **File location:** `api/reports/reportGenerator.js`
- **Format:** PowerPoint (.pptx)
- **Use case:** Presentation-ready slides with visual formatting

### PDF Reports
- **Library:** pdfkit - JavaScript PDF generation library
- **File location:** `api/reports/pdfReportGenerator.js`
- **Format:** Portable Document Format (.pdf)
- **Use case:** Document archival, email distribution, printing

### Common Features
- **SQL queries:** Aggregated manufacturing data
- **Server-side processing:** Node.js with Express
- **Caching:** Optional response caching for performance
- **File storage:** Reports saved to `api/reports/generated/`
- **Download URLs:** Publicly accessible (no API key required for downloads)

### Report Generation Flow

1. **Request Validation:** Verify parameters and API key
2. **Data Aggregation:** Execute SQL queries to fetch report data
3. **Report Generation:** Process data through appropriate generator
4. **File Storage:** Save generated report to disk
5. **URL Generation:** Create download link
6. **Response:** Return download URL to agent/client

### Performance Characteristics

- **Generation time:** 1-3 seconds (PPTX), 2-5 seconds (PDF)
- **File size (PPTX):** 200-500 KB
- **File size (PDF):** 300-800 KB
- **Cache lifetime:** 1 hour (configurable)
- **Maximum parallel requests:** Unlimited (queued by database)

## Apex Group Reports

```
GET  /api/apex/reports/generate?report_type=...&format=pptx|pdf|csv
GET  /api/apex/reports/generate-query?query=...&format=...
POST /api/apex/reports/generate-query   {"query": "...", "format": "pdf"}
```

Optional filters on both: `from`, `to` (YYYY-MM-DD), `region` (North, South, East, West), `business_unit`
(Consumer Markets, Digital Products, Enterprise Solutions, Industrial Operations, Managed Services, Shared Services).

`from`/`to` filter historical facts (scorecard months, ledger, invoices, HR events, control tests).
Predictions, recommendations and scenarios are one forward-looking snapshot (as of 2026-09-30, forecast months
2026-10 to 2027-03), so dates never filter them out. Region and business unit apply through each table's org unit,
entity, region or customer.
The margin bridge, action catalog, scenarios, decision constraints, models, KPI definitions and data coverage are
company-level; with a region or business unit filter they carry a note saying so.

### Report Types

| `report_type` | Sections |
|---|---|
| `executive-summary` | Scorecard by region/BU, margin bridge, financial forecast, customer risk, workforce risk, control risk, recommendations, scenarios, top issues |
| `financial-performance` | Scorecard, monthly trend, margin bridge, performance drivers, forecast, budget vs actual, cash by entity, general ledger, manual journals, month-end close |
| `commercial` | Sales by offering, discount approvals, pipeline, customer segments, customer risk, service cases, AR aging |
| `workforce` | Headcount by BU, hires/exits/moves, vacancies, attendance, engagement, learning and compensation, attrition risk |
| `risk-controls` | Control risk, quarterly control scorecard, exceptions, control testing, audit findings, remediation, access/SoD, manual journals, AP, vendors |
| `recommendations` | Top recommended actions, action catalog, scenario simulation, decision constraints |
| `full-report` | Every section above plus prediction models, KPI definitions and a data coverage appendix with the live row count of all 48 tables |
| `table-export` | With `table=<key>` (see `GET /api/apex/tables`): every matching row of one table as CSV. Accepts that table's filters. CSV only, and `format` defaults to `csv`. |

Aliases: `executive`, `finance`, `sales`, `customers`, `hr`, `risk`, `controls`, `audit`, `actions`, `scenarios`, `full`, `all`.

### Query Topics

`generate-query` maps words in the question to sections and can combine several:
revenue/EBITDA/margin/KPIs, margin bridge/drivers, forecast, budget/variance, cash, ledger/journals, close/reconciliation,
sales/offerings/channels, discounts/overrides, pipeline/contracts, customers/churn, service/SLA/disputes,
receivables/DSO/aging, payables/vendors, workforce/headcount/payroll, attrition/exits/hires, vacancies/recruitment,
attendance/overtime/absence, engagement/learning, controls/exceptions/compliance, audit/remediation, access/SoD,
risk, recommendations/actions, scenarios/constraints, models/definitions/coverage.
"full", "complete", "everything" or "all the data" builds `full-report`; a question with no topic builds `executive-summary`.

```bash
curl -H "X-API-Key: sk_prod_..." \
  "http://localhost:3000/api/apex/reports/generate?report_type=full-report&format=pdf"

curl -H "X-API-Key: sk_prod_..." \
  "http://localhost:3000/api/apex/reports/generate-query?query=customer%20churn%20and%20receivables&format=pptx&region=West"

# All 140,000 general ledger lines as CSV
curl -H "X-API-Key: sk_prod_..." \
  "http://localhost:3000/api/apex/reports/generate?report_type=table-export&table=fact-gl-transaction"
```

Response:

```json
{
  "success": true,
  "report_type": "full-report",
  "title": "Apex Group Full Report",
  "sections": ["Executive Scorecard by Region and Business Unit", "..."],
  "format": "pdf",
  "filename": "apex-full-report_1792478606725.pdf",
  "download_url": "https://api-vertx.gigh.com/reports/download/apex-full-report_1792478606725.pdf"
}
```

Measured against the live database: `full-report` takes about 10 seconds (43 sections, 25 PDF pages or 77 slides);
other report types take 4 to 6 seconds; exporting all of `fact-gl-transaction` takes about 16 seconds (16 MB).

## CSV Output

`format=csv` works on every report endpoint (manufacturing, Apex, sales).

- Sectioned reports (Apex and manufacturing `generate-query`) write one block per section: a title row, a
  `Metric,Value,Unit` block for the KPIs, the section table, then notes. Blocks are separated by a blank line.
- Fixed manufacturing and sales templates write their raw values: scalars as `Field,Value` rows and lists as tables.
- Files are UTF-8 with a byte order mark so Excel reads them correctly.
- Text cells that start with `=`, `+`, `-` or `@` get a leading `'` so spreadsheets don't run them as formulas.
- For raw rows instead of a summary, use Apex `report_type=table-export`.

