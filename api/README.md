# Sales Agent API

Node + Express API service for Sales Agent Database (MSSQL).

## Quick Start

### 1. Install Dependencies
```bash
cd api
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your database credentials
```

### 3. Start Server
```bash
npm start          # Production mode
npm run dev        # Development with nodemon
```

**Server runs at**: `http://localhost:3000`

## API Endpoints

### Health Check
- `GET /health` — API status

### Core Tables
- `GET /api/doctors` — List doctors
- `GET /api/doctors/:id` — Get specific doctor
- `GET /api/sales-reps` — List sales reps
- `GET /api/products` — List products
- `GET /api/pharmacies` — List pharmacies

### Transactions
- `GET /api/call-planning` — Call records (`region`, `rep_id`, `from`, `to`, `limit`)
- `GET /api/secondary-sales` — Sales transactions (`region`, `sku`, `from`, `to`, `limit`)

### Business Views
- `GET /api/rep-performance` — Monthly rep metrics
- `GET /api/product-trends` — Product sales trends (`region`, `sku`, `months`, `limit`)
- `GET /api/call-effectiveness` — Call success metrics (`region`, `tier`, `months`, `limit`)
- `GET /api/inactive-doctors` — Doctors not called in 30+ days
- `GET /api/at-risk-territories` — At-risk regions/reps
- `GET /api/territory-coverage` — Territory summary

### Stats
- `GET /api/stats` — Total record counts

## MCP Server

`POST /mcp` serves the same endpoints as MCP tools (Streamable HTTP, stateless, plain JSON responses).
Send the API key as `x-api-key`.

- One tool per `GET /api/*` endpoint, named by its OpenAPI `operationId`: `/api/mfg/oee-dashboard` is
  `mfg_oee_dashboard`, `/api/doctors/{id}` is `sales_doctors_by_id`. Sales endpoints get a `sales_` prefix.
- The per-table Apex endpoints are one tool, `apex_table`, with a `table` argument. `apex_tables` lists them.
- `apex_table` also returns totals: `group_by` (any column, plus `business_unit`, `region`, `entity`, `department`
  through `dim_organisation`, and `month`, `quarter`, `year`) and `metrics` (`count`, `distinct:<column>`,
  `sum|avg|min|max:<numeric column>`) are computed in SQL over every matching row, sorted with `sort` (`-` for
  descending). Replies carry `rows_matched`, `groups_total` and `truncated` (more groups than `limit`, default 1000).
  `apex_tables` lists each table's filters, `group_by` columns and numeric `measures`. Unknown filters are rejected
  instead of ignored. On tables keyed by `month_id`, `date_id` or `quarter_id`, `from`/`to` cover whole months, days
  or quarters (`from=2026-03-15` on a monthly table includes all of March). For example, revenue and EBITDA by business unit for a year:
  `{"table":"serving-executive-scorecard-monthly","group_by":"business_unit","metrics":"sum:revenue,sum:ebitda","from":"2025-10-01","to":"2026-09-30"}`.
- `apex_chart` draws those totals as an image: `bar`, `horizontal_bar`, `stacked_bar`, `line`, `area`, `combo`, `pie`, `donut`, `heatmap`, `scatter`, `bubble`, `radar`, `histogram` or `waterfall`. It takes `apex_table`'s arguments plus `chart_type` and `title`;
  the first `group_by` column is the x axis and a second is the series (or the heatmap's y axis). The reply has `markdown` (the image), `data` (the
  plotted figures) and `notes` (caveats). A chart that can't be drawn as asked is refused with the change that would fix it.
  Images are drawn by quickchart.io, so the plotted figures are sent there inside the image URL.
  `{"table":"serving-executive-scorecard-monthly","chart_type":"line","title":"Revenue by quarter and region","group_by":"quarter,region","metrics":"sum:revenue"}`.
- Report tools (`*_reports_generate*`) return a `download_url`. Download endpoints are not tools.
- `run_many` runs up to 10 tools in parallel in one call: `{"calls":[{"tool":"apex_customer_risk","arguments":{"limit":10}},{"tool":"sales_insights"}]}`.
  The reply is `{"results":[{"tool","isError","result"}]}` in call order, each `result` being that tool's normal reply. Each call
  is validated and run on its own (five at a time), so a bad or timed-out call fails only itself. An agent that needs several figures gets them in one
  step instead of one step per tool.
- Tool inputs come from `swagger.js`, so a new or changed endpoint documented there shows up as a tool.

Connect a client such as Claude Code:

```bash
claude mcp add --transport http sales-agent https://<host>/mcp --header "x-api-key: <API_KEY>"
```

A platform without MCP support can call a tool with one HTTP POST:

```bash
curl -s https://<host>/mcp \
  -H "x-api-key: $API_KEY" -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"mfg_oee_dashboard","arguments":{"from":"2025-01-01","to":"2025-03-31"}}}'
```

The endpoint's JSON is in `result.content[0].text`. `result.isError` is true when the endpoint returned an error
or the arguments did not match the tool's schema (unknown keys, wrong types, missing path parameters). Strings such as
`"5"` are accepted for integer arguments. Any `Accept` header works, since responses are always JSON.
`GET` and `DELETE` on `/mcp` return 405.

## Postman Collection

**Import**: `Sales-Agent-API.postman_collection.json` into Postman

**Setup**:
1. Open Postman
2. File → Import → Select `Sales-Agent-API.postman_collection.json`
3. Set `base_url` variable to `http://localhost:3000`
4. Test endpoints

## Environment Variables

```
NODE_ENV=development        # development or production
API_PORT=3000              # Server port
API_HOST=localhost         # Server host
DB_HOST=34.88.207.18       # MSSQL server IP
DB_PORT=1433               # MSSQL port
DB_NAME=sales_agent_demo   # Database name
DB_USER=sales@dmin         # Database username
DB_PASSWORD=***            # Database password
CORS_ORIGIN=*              # CORS allowed origins
```

## Response Format

All endpoints return JSON:
```json
{
  "success": true,
  "count": 50,
  "data": [...]
}
```

## Error Handling

```json
{
  "success": false,
  "error": "Error message"
}
```

## Next Steps

1. ✅ API running locally
2. ⏭️ Test with Postman collection
3. ⏭️ Deploy to Token Bazaar server
4. ⏭️ Expose via Vertx platform
5. ⏭️ Host on nginx with Vertx domain
