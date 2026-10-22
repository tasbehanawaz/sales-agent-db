# Changelog

## Unreleased

### Added
- MCP `run_many` tool: up to 10 tool calls in one request, run in parallel, results in call order. Cuts agent round trips.
- MCP server at `POST /mcp`: every sales, manufacturing and Apex `GET` endpoint is a tool, generated from the
  OpenAPI spec, plus `apex_table` for the Apex tables. Uses the same `x-api-key`. See `api/README.md`.
- OpenAPI operations now have `operationId`s, matching the MCP tool names.
- Apex table endpoints (and the MCP `apex_table` tool) compute totals with `group_by`, `metrics` and `sort`, and filter or
  group by `business_unit`, `region`, `entity` and `department` through `dim_organisation`. `apex_tables` lists each
  table's `group_by` columns and numeric `measures`. The `apex_table` tool description maps business topics to tables.
- Sales reports in PDF, built from the sales database: sales by region, trend, product, therapy area and representative;
  pharmacies by channel and top accounts; doctors by specialty and region; call completion. New `full-report` type and
  `from`, `to` and `region` filters on `/api/sales/reports/generate`.
- Manufacturing reports gain plant footprint, monthly production trend, shifts, inspection results, scrap reasons,
  cost components, maintenance, costliest machines and material shortages, plus a `full-report` type and
  `maintenance`, `inventory`, `shifts` and `plants` query topics. Priority issues and recommended actions are now
  calculated from the data.

### Changed
- PDF reports for sales, manufacturing and Apex are now written documents: contents, executive summary, numbered
  sections with written analysis, key figures and full detail tables, recommended actions and an appendix listing
  scope, filters and source tables. Slides keep the short layout.
- PDF and CSV carry more rows than slides (four times the slide length, at least 50, monthly instead of quarterly trends).
- Sales reports use real data instead of fixed demo numbers. Sales file names now start with `sales-`
  (for example `sales-overview_<timestamp>.pdf`).
- Report file names get six random digits after the timestamp, so simultaneous requests get separate files.

### Fixed
- `POST /mcp` no longer answers 406 when `Accept` lacks `text/event-stream` (Swagger UI, Vertx HTTP Call).
- `/api/apex/executive-scorecard` `from`/`to` select months (`month_id`) and return the latest month first. Before, they
  compared the snapshot date, which is the same for every row, so date filters returned everything or nothing.
- Apex tables keyed by `month_id`, `date_id` or `quarter_id` (scorecards, budget, sales, cash, employees, attendance,
  close tasks) now honour `from`/`to`; close tasks filter by close month instead of due date. Table CSV exports follow.
- Apex table endpoints answer 400 for an unknown filter or a malformed `from`/`to` instead of ignoring it.

## 2026-10-20 (PR #1)

### Added
- Apex Group reports in PPTX, PDF and CSV: seven report types, natural-language queries, and full-table CSV export
  (`/api/apex/reports/generate`, `/api/apex/reports/generate-query`).
- `format=csv` on the manufacturing and sales report endpoints.

### Fixed
- PDF continuation pages were Letter instead of A4, and footers overlapped table rows.
- Slide tables were cut off after 8 rows; they now continue on further slides.
- The title-slide date sat below the slide.
