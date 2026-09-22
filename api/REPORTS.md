# Manufacturing Reports API

Generate professional PPTX reports from manufacturing data using the `/api/mfg/reports/generate` endpoint.

## Endpoint

```
GET /api/mfg/reports/generate
```

## Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `report_type` | string | Yes | Type of report to generate |
| `from` | date | No | Start date (YYYY-MM-DD) |
| `to` | date | No | End date (YYYY-MM-DD) |
| `plant_id` | string | No | Filter by plant ID |

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

### Generate OEE Report (Last 30 Days)
```bash
curl -H "X-API-Key: sk_prod_..." \
  "http://localhost:3000/api/mfg/reports/generate?report_type=oee-dashboard&from=2026-08-23&to=2026-09-22"
```

### Generate Downtime Report (Specific Plant)
```bash
# plant_id must be a UUID from GET /api/mfg/plants (not "PLANT-001")
curl -H "X-API-Key: sk_prod_..." \
  "http://localhost:3000/api/mfg/reports/generate?report_type=downtime-analysis&plant_id=<PLANT_UUID>&from=2026-09-01&to=2026-09-30"
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

- **Professional Formatting:** Branded slides with consistent styling
- **Data Visualization:** Tables and KPI boxes for key metrics
- **Dynamic Content:** Generated from live database queries
- **Actionable Insights:** Recommendations based on data patterns
- **Date Filtering:** Flexible time range selection
- **Plant Filtering:** Generate reports for specific facilities

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

Reports are generated using:
- **pptxgenjs** - JavaScript PPTX generation library
- **SQL queries** - Aggregated manufacturing data
- **Node.js** - Server-side processing

File location: `api/reports/reportGenerator.js`
