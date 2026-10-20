# Reports API

Generate PPTX, PDF and CSV reports from the sales, manufacturing and Apex Group databases.
Every endpoint returns JSON with a `download_url`. Manufacturing and Apex files are served from `/reports/download/{filename}`
without an API key; sales files from `/api/sales/reports/download/{filename}` with the API key.

Each request builds one report from one domain's database only, and writes it to its own new file named
`{sales|mfg|apex}-{type}_{timestamp}.{pptx|pdf|csv}`. Reports never combine data across domains or requests.

- Manufacturing: below.
- Sales: [Sales Reports](#sales-reports).
- Apex Group: [Apex Group Reports](#apex-group-reports).
- Formats: [PDF Output](#pdf-output), [CSV Output](#csv-output).

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

| `report_type` | Sections |
|---|---|
| `oee-dashboard` | OEE by line, production output by line, monthly production trend, production by shift |
| `downtime-analysis` | Downtime by cause (Pareto), downtime by line, maintenance by type, machines with the highest maintenance cost |
| `quality-trends` | Quality by product, inspection results and severity, scrap reasons, production by product |
| `cost-analysis` | Cost by line against standard, cost components by plant, material shortages and usage variance |
| `executive-summary` | Plant footprint, OEE, production, downtime, quality, cost, maintenance, materials, priority issues |
| `full-report` | Every manufacturing section |

Every report ends with recommended actions calculated from the data (the largest downtime cause, the lowest OEE line,
the highest rejection rate, the largest cost overrun, the material most often short).

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

| Topic | Example phrases | Sections included |
|-------|-----------------|-------------------|
| `oee` | OEE, availability, equipment effectiveness | OEE by line |
| `lines` | production lines, lines | OEE and production by line |
| `production` | production runs, output, throughput, trend | Production by line, monthly trend |
| `downtime` | downtime, failure, breakdown, pareto | Downtime by cause and by line |
| `quality` | quality, yield, rejection, defect, scrap | Quality by product, inspection results, scrap reasons |
| `products` | products, SKU | Production and quality by product |
| `costs` | cost, energy, labour, unit cost | Cost by line, cost components |
| `shifts` | shift, changeover, cycle time | Production by shift |
| `maintenance` | maintenance, repairs, work orders, machines | Maintenance by type, costliest machines |
| `inventory` | inventory, materials, shortages, suppliers | Material shortages and usage variance |
| `plants` | plants, sites, operators | Plant footprint |
| `executive` | no topic matched | Executive summary sections |

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
- **File location:** `api/reports/pdfReportGenerator.js`, written analysis in `api/reports/narrative.js`
- **Format:** Portable Document Format (.pdf), a written document rather than a copy of the slides (see [PDF Output](#pdf-output))

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

## Sales Reports

```
GET /api/sales/reports/generate?report_type=...&format=pptx|pdf|csv&from=YYYY-MM-DD&to=YYYY-MM-DD&region=...
```

Built from `sales_agent_demo` (secondary sales, products, pharmacies, doctors, representatives, call planning).
`from`/`to` filter sale and call dates; `region` is Central, East, North, South or West.

| `report_type` | Sections |
|---|---|
| `sales-overview` | Sales by region, sales trend, sales by product, sales by therapy area, sales by representative |
| `doctor-distribution` | Doctors by specialty and tier, doctor coverage by region, call completion by type, call completion by representative |
| `pharmacy-network` | Pharmacies by channel, top pharmacies, sales by product |
| `full-report` | Every sales section |

## PDF Output

`format=pdf` produces a written report, not a copy of the slide deck:

- A title block with the scope, generation time and section count, then a contents list.
- An executive summary: an overview paragraph, a key-figures table, an "In brief" point for each section, and the priority issues.
- Numbered sections. Each has a one-line description of what it measures, a written analysis generated from the
  figures (leaders and laggards, concentration, ranges), a key-figures table, the detail table and notes.
- Recommended actions, then "About this report": scope, filters and the source tables used.

PDF and CSV fetch more rows than slides: ranked tables carry four times the slide length, at least 50 rows, and trends are monthly rather than quarterly.

## CSV Output

`format=csv` works on every report endpoint (manufacturing, Apex, sales).

- Every report writes one block per section: a title row, its description, a `Metric,Value,Unit` block for the
  KPIs, the section table, then notes. Blocks are separated by a blank line.
- Files are UTF-8 with a byte order mark so Excel reads them correctly.
- Text cells that start with `=`, `+`, `-` or `@` get a leading `'` so spreadsheets don't run them as formulas.
- For raw rows instead of a summary, use Apex `report_type=table-export`.

