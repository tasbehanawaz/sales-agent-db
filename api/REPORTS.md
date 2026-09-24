# Manufacturing Reports API

Generate professional PPTX and PDF reports from manufacturing data using report generation endpoints.

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
| `format` | string | No | Output format: `pptx` (default) or `pdf` |
| `from` | date | No | Start date (YYYY-MM-DD) |
| `to` | date | No | End date (YYYY-MM-DD) |
| `plant_id` | string | No | Filter by plant ID (UUID format) |

### For Query-Based Reports (`/api/mfg/reports/generate-query`)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Natural language query describing desired report (e.g., "show OEE trends", "what's downtime") |
| `format` | string | No | Output format: `pptx` (default) or `pdf` |
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

**Success (200):**
- PPTX file downloaded as `{report_type}_{timestamp}.pptx`

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

- **Multiple Formats:** Generate as PPTX (PowerPoint) or PDF
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
