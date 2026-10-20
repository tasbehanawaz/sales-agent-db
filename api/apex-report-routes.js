/**
 * Apex Group report generation (PPTX, PDF, CSV).
 *
 * Every report is a list of sections built from apex_agent_demo. Between them
 * the sections read all 48 tables; full-report includes every section plus a
 * data coverage appendix with the live row count of each table.
 *
 * from/to filter historical facts. Predictions, recommendations and scenarios
 * are a single forward-looking snapshot (as of 2026-09-30, forecast months
 * 2026-10 to 2027-03), so dates never filter them out.
 * region/business_unit filter through dim_organisation wherever a table has an
 * org unit, entity, or region column.
 */

require('dotenv').config();
const { query, getPool } = require('./db');
const { strParam, dateParam } = require('./queryParams');
const { TABLES, APEX_DB, tableFilters } = require('./apex-table-routes');
const { FORMATS, reportsDir, writeReport, downloadUrl } = require('./reports/writeReport');
const { csvLine } = require('./reports/csvReportGenerator');
const { n, money, count, dec, frac, pct, share, monthLabel, limit } = require('./reports/format');
const fs = require('fs');
const path = require('path');

const BRAND = 'Apex Group';

function t(name) {
  return `[${APEX_DB}].dbo.[${name}]`;
}

// ---- filters ----

/**
 * Request filters plus the derived month, date_id and quarter bounds used by
 * tables keyed by month_id (YYYYMM), date_id (YYYYMMDD) or quarter_id (2026Q3).
 */
function buildFilters({ from, to, region, business_unit, detail }) {
  const f = { from, to, region, business_unit, detail };
  const params = {};
  if (from) {
    params.from = from;
    params.from_month = parseInt(from.slice(0, 7).replace('-', ''), 10);
    params.from_date_id = parseInt(from.replace(/-/g, ''), 10);
    params.from_quarter = `${from.slice(0, 4)}Q${Math.ceil(parseInt(from.slice(5, 7), 10) / 3)}`;
  }
  if (to) {
    params.to = to;
    params.to_month = parseInt(to.slice(0, 7).replace('-', ''), 10);
    params.to_date_id = parseInt(to.replace(/-/g, ''), 10);
    params.to_quarter = `${to.slice(0, 4)}Q${Math.ceil(parseInt(to.slice(5, 7), 10) / 3)}`;
  }
  if (region) params.region = region;
  if (business_unit) params.business_unit = business_unit;
  f.params = params;
  return f;
}

/**
 * WHERE clause for one table.
 * opts: date | month | dateId | quarter (column), org (org_unit_id column, or
 * an array of columns where any may match),
 * entity (entity_id column), region / bu (direct columns), customerRegion
 * (customer_id column), extra (raw conditions).
 */
function where(f, opts = {}) {
  const c = [...(opts.extra || [])];
  const p = f.params;
  const range = (col, lo, hi) => {
    if (p[lo] != null) c.push(`${col} >= @${lo}`);
    if (p[hi] != null) c.push(`${col} <= @${hi}`);
  };
  if (opts.date) range(`CAST(${opts.date} AS date)`, 'from', 'to');
  if (opts.month) range(opts.month, 'from_month', 'to_month');
  if (opts.dateId) range(opts.dateId, 'from_date_id', 'to_date_id');
  if (opts.quarter) range(opts.quarter, 'from_quarter', 'to_quarter');

  const orgConds = [p.region && 'region = @region', p.business_unit && 'business_unit = @business_unit'].filter(Boolean);
  if (orgConds.length) {
    const orgSet = `SELECT org_unit_id FROM ${t('dim_organisation')} WHERE ${orgConds.join(' AND ')}`;
    if (opts.org) c.push(`(${[].concat(opts.org).map((col) => `${col} IN (${orgSet})`).join(' OR ')})`);
    if (opts.entity) c.push(`${opts.entity} IN (SELECT entity_id FROM ${t('dim_organisation')} WHERE ${orgConds.join(' AND ')})`);
  }
  if (p.region) {
    if (opts.region) c.push(`${opts.region} = @region`);
    if (opts.customerRegion) c.push(`${opts.customerRegion} IN (SELECT customer_id FROM ${t('dim_customer')} WHERE region = @region)`);
  }
  if (p.business_unit && opts.bu) c.push(`${opts.bu} = @business_unit`);
  return c.length ? `WHERE ${c.join(' AND ')}` : '';
}

function q(f, text) {
  return query(text, f.params);
}

// ---- sections ----
// Each builder returns { id, title, kpis?, table?, bullets? }.

const SECTIONS = {
  async 'scorecard'(f) {
    const w = where(f, { month: 'month_id', region: 'region', bu: 'business_unit' });
    const [tot] = await q(f, `SELECT SUM(revenue) revenue, SUM(gross_margin) gross_margin, SUM(ebitda) ebitda,
        SUM(operating_cash_flow) ocf, MIN(month_id) first_month, MAX(month_id) last_month
      FROM ${t('serving_executive_scorecard_monthly')} ${w}`);
    const rows = await q(f, `SELECT region, business_unit, SUM(revenue) revenue, SUM(gross_margin) gross_margin,
        SUM(ebitda) ebitda, SUM(operating_cash_flow) ocf, AVG(dso_days) dso, AVG(control_risk_index) cri
      FROM ${t('serving_executive_scorecard_monthly')} ${w}
      GROUP BY region, business_unit ORDER BY region, business_unit`);
    // Shared Services carries cost but no revenue, so it has no margin to rank.
    const ranked = rows.filter((r) => n(r.revenue) > 0).sort((a, b) => n(b.ebitda) / n(b.revenue || 1) - n(a.ebitda) / n(a.revenue || 1));
    const margin = (r) => pct((n(r.ebitda) / n(r.revenue || 1)) * 100);
    return {
      id: 'scorecard',
      title: 'Executive Scorecard by Region and Business Unit',
      kpis: [
        { label: 'Revenue', value: money(tot.revenue), color: 'primary' },
        { label: 'Gross Margin', value: share(tot.gross_margin, tot.revenue), color: 'success' },
        { label: 'EBITDA', value: money(tot.ebitda), color: 'warning' },
        { label: 'Op. Cash Flow', value: money(tot.ocf), color: 'neutral' },
      ],
      table: {
        headers: ['Region', 'Business Unit', 'Revenue', 'GM %', 'EBITDA %', 'Op. Cash Flow', 'Avg DSO', 'Ctrl Risk'],
        rows: rows.map((r) => [r.region, r.business_unit, money(r.revenue), share(r.gross_margin, r.revenue),
          margin(r), money(r.ocf), dec(r.dso), dec(r.cri, 0)]),
        weights: [1, 2, 1.2, 1, 1, 1.3, 1, 1],
      },
      bullets: ranked.length ? [
        `Period covered: ${monthLabel(tot.first_month)} to ${monthLabel(tot.last_month)}`,
        `Highest EBITDA margin: ${ranked[0].region} ${ranked[0].business_unit} (${margin(ranked[0])})`,
        `Lowest EBITDA margin: ${ranked[ranked.length - 1].region} ${ranked[ranked.length - 1].business_unit} (${margin(ranked[ranked.length - 1])})`,
      ] : [],
    };
  },

  async 'scorecard-trend'(f) {
    const rows = await q(f, `SELECT month_id, SUM(revenue) revenue, SUM(ebitda) ebitda, SUM(headcount) headcount,
        SUM(exit_count) exits, SUM(outstanding_ar) ar, SUM(disputed_ar) disputed, SUM(control_exceptions) exceptions,
        SUM(vacancies_opened) vacancies
      FROM ${t('serving_executive_scorecard_monthly')} ${where(f, { month: 'month_id', region: 'region', bu: 'business_unit' })}
      GROUP BY month_id ORDER BY month_id`);
    return {
      id: 'scorecard-trend',
      title: 'Monthly Performance Trend',
      table: {
        headers: ['Month', 'Revenue', 'EBITDA', 'EBITDA %', 'Headcount', 'Exits', 'Outstanding AR', 'Disputed AR', 'Ctrl Exceptions', 'Vacancies'],
        rows: rows.map((r) => [monthLabel(r.month_id), money(r.revenue), money(r.ebitda),
          pct((n(r.ebitda) / n(r.revenue || 1)) * 100), count(r.headcount), count(r.exits), money(r.ar),
          money(r.disputed), count(r.exceptions), count(r.vacancies)]),
        weights: [1, 1.1, 1.1, 1, 1, 0.8, 1.2, 1.1, 1.1, 0.9],
      },
    };
  },

  async 'margin-bridge'() {
    const rows = await query(`SELECT * FROM ${t('serving_margin_bridge')} ORDER BY sequence`);
    const start = rows[0] || {};
    const end = rows[rows.length - 1] || {};
    const drags = rows.filter((r) => n(r.impact_percentage_points) < 0)
      .sort((a, b) => n(a.impact_percentage_points) - n(b.impact_percentage_points));
    return {
      id: 'margin-bridge',
      title: `EBITDA Margin Bridge (${start.scope_id || 'n/a'})`,
      kpis: [
        { label: 'Starting Margin', value: pct(start.margin_after_pct ?? start.margin_before_pct), color: 'primary' },
        { label: 'Ending Margin', value: pct(end.margin_after_pct ?? end.margin_before_pct), color: 'warning' },
        { label: 'Net Change', value: `${dec(n(end.margin_after_pct) - n(start.margin_after_pct))} pp`, color: 'danger' },
        { label: 'Largest Drag', value: drags[0] ? `${dec(drags[0].impact_percentage_points)} pp` : 'n/a', color: 'danger' },
      ],
      table: {
        headers: ['#', 'Component', 'Before %', 'Impact (pp)', 'After %', 'EBITDA Impact', 'Evidence'],
        rows: rows.map((r) => [r.sequence, r.component, pct(r.margin_before_pct), dec(r.impact_percentage_points),
          pct(r.margin_after_pct), money(r.estimated_ebitda_impact_usd), r.evidence_reference]),
        weights: [0.4, 2.2, 0.9, 0.9, 0.9, 1.1, 2],
      },
      bullets: drags.slice(0, 3).map((r) => `${r.component}: ${dec(r.impact_percentage_points)} pp (${money(r.estimated_ebitda_impact_usd)})`),
    };
  },

  async 'latent-drivers'(f) {
    const rows = await q(f, `SELECT o.business_unit, AVG(d.demand_index) demand, AVG(d.pricing_pressure_index) pricing,
        AVG(d.capacity_index) capacity, AVG(d.engagement_index) engagement, AVG(d.control_maturity_index) control,
        AVG(d.service_complexity_index) complexity, AVG(d.collection_effectiveness_index) collection
      FROM ${t('meta_latent_drivers_monthly')} d JOIN ${t('dim_organisation')} o ON o.org_unit_id = d.org_unit_id
      ${where(f, { date: 'd.month_start', org: 'd.org_unit_id' })}
      GROUP BY o.business_unit ORDER BY o.business_unit`);
    return {
      id: 'latent-drivers',
      title: 'Performance Drivers by Business Unit (index, 1.00 = baseline)',
      table: {
        headers: ['Business Unit', 'Demand', 'Pricing Pressure', 'Capacity', 'Engagement', 'Control Maturity', 'Service Complexity', 'Collection'],
        rows: rows.map((r) => [r.business_unit, dec(r.demand, 3), dec(r.pricing, 3), dec(r.capacity, 3), dec(r.engagement, 3),
          dec(r.control, 3), dec(r.complexity, 3), dec(r.collection, 3)]),
        weights: [2, 1, 1.2, 1, 1, 1.2, 1.2, 1],
      },
    };
  },

  async 'financial-forecast'(f) {
    const rows = await q(f, `SELECT scenario_id, SUM(revenue_forecast) revenue, SUM(revenue_low) revenue_low,
        SUM(revenue_high) revenue_high, SUM(ebitda_forecast) ebitda, SUM(operating_cash_flow_forecast) ocf,
        AVG(dso_days) dso, AVG(confidence_score) confidence, MIN(forecast_month) first_month, MAX(forecast_month) last_month
      FROM ${t('pred_financial_forecast')} ${where(f, { region: 'region', bu: 'business_unit' })}
      GROUP BY scenario_id ORDER BY SUM(ebitda_forecast) DESC`);
    const drivers = await q(f, `SELECT TOP 5 top_driver_1 driver, COUNT(*) c FROM ${t('pred_financial_forecast')}
      ${where(f, { region: 'region', bu: 'business_unit' })} GROUP BY top_driver_1 ORDER BY c DESC`);
    const best = rows[0] || {};
    const first = rows[0] ? new Date(rows[0].first_month).toISOString().slice(0, 7) : 'n/a';
    const last = rows[0] ? new Date(rows[0].last_month).toISOString().slice(0, 7) : 'n/a';
    return {
      id: 'financial-forecast',
      title: `Financial Forecast by Scenario (${first} to ${last})`,
      kpis: [
        { label: `Revenue (${best.scenario_id || 'n/a'})`, value: money(best.revenue), color: 'primary' },
        { label: 'EBITDA', value: money(best.ebitda), color: 'success' },
        { label: 'EBITDA Margin', value: share(best.ebitda, best.revenue), color: 'warning' },
        { label: 'Op. Cash Flow', value: money(best.ocf), color: 'neutral' },
      ],
      table: {
        headers: ['Scenario', 'Revenue', 'Low', 'High', 'EBITDA', 'EBITDA %', 'Op. Cash Flow', 'Avg DSO', 'Confidence'],
        rows: rows.map((r) => [r.scenario_id, money(r.revenue), money(r.revenue_low), money(r.revenue_high), money(r.ebitda),
          share(r.ebitda, r.revenue), money(r.ocf), dec(r.dso), frac(r.confidence, 0)]),
        weights: [1.3, 1, 1, 1, 1, 1, 1.2, 0.9, 1],
      },
      bullets: drivers.map((d) => `Top forecast driver "${d.driver}": ${count(d.c)} forecast rows`),
    };
  },

  async 'budget'(f) {
    const w = where(f, { month: 'month_id', org: 'org_unit_id' });
    const rows = await q(f, `SELECT version, account_category, SUM(budget_amount) budget, SUM(forecast_amount) forecast,
        SUM(actual_amount) actual
      FROM ${t('fact_budget_forecast')} ${w}
      GROUP BY version, account_category ORDER BY version, account_category`);
    const [cc] = await q(f, `SELECT COUNT(DISTINCT cost_center_id) cost_centers, COUNT(DISTINCT account_id) accounts
      FROM ${t('fact_budget_forecast')} ${w}`);
    const [ccDim] = await query(`SELECT COUNT(*) total, SUM(CASE WHEN active_flag = 1 THEN 1 ELSE 0 END) active,
        COUNT(DISTINCT cost_center_type) types FROM ${t('dim_cost_center')}`);
    const orig = rows.filter((r) => r.version === 'Original Budget');
    const budget = orig.reduce((s, r) => s + n(r.budget), 0);
    const actual = orig.reduce((s, r) => s + n(r.actual), 0);
    return {
      id: 'budget',
      title: 'Budget vs Forecast vs Actual',
      kpis: [
        { label: 'Budget (Original)', value: money(budget), color: 'primary' },
        { label: 'Actual', value: money(actual), color: 'success' },
        { label: 'Variance', value: money(actual - budget), color: actual >= budget ? 'warning' : 'success' },
        { label: 'Variance %', value: share(actual - budget, budget), color: 'neutral' },
      ],
      table: {
        headers: ['Version', 'Account Category', 'Budget', 'Forecast', 'Actual', 'Actual vs Budget'],
        rows: rows.map((r) => [r.version, r.account_category, money(r.budget), money(r.forecast), money(r.actual),
          share(n(r.actual) - n(r.budget), r.budget)]),
        weights: [1.4, 1.8, 1, 1, 1, 1.2],
      },
      bullets: [
        `${count(cc.cost_centers)} cost centers and ${count(cc.accounts)} accounts carry budget lines`,
        `Cost center master: ${count(ccDim.total)} cost centers (${count(ccDim.active)} active, ${count(ccDim.types)} types)`,
      ],
    };
  },

  async 'cash'(f) {
    const asOf = f.params.to_date_id ? 'AND x.date_id <= @to_date_id' : '';
    const rows = await q(f, `SELECT c.entity_id, c.currency, SUM(c.cash_inflow) inflow, SUM(c.cash_outflow) outflow,
        MAX(l.closing_balance) closing, MAX(l.restricted_cash) restricted, MAX(c.date_id) last_date
      FROM ${t('fact_cash_position')} c
      CROSS APPLY (SELECT TOP 1 closing_balance, restricted_cash FROM ${t('fact_cash_position')} x
        WHERE x.entity_id = c.entity_id AND x.currency = c.currency ${asOf} ORDER BY x.date_id DESC) l
      ${where(f, { dateId: 'c.date_id', entity: 'c.entity_id' })}
      GROUP BY c.entity_id, c.currency ORDER BY c.entity_id`);
    const inflow = rows.reduce((s, r) => s + n(r.inflow), 0);
    const outflow = rows.reduce((s, r) => s + n(r.outflow), 0);
    const closing = rows.reduce((s, r) => s + n(r.closing), 0);
    const restricted = rows.reduce((s, r) => s + n(r.restricted), 0);
    return {
      id: 'cash',
      title: 'Cash Position by Entity',
      kpis: [
        { label: 'Cash Inflow', value: money(inflow), color: 'success' },
        { label: 'Cash Outflow', value: money(outflow), color: 'danger' },
        { label: 'Closing Balance', value: money(closing), color: 'primary' },
        { label: 'Restricted', value: money(restricted), color: 'warning' },
      ],
      table: {
        headers: ['Entity', 'Currency', 'Inflow', 'Outflow', 'Net Flow', 'Closing Balance', 'Restricted', 'As Of'],
        rows: rows.map((r) => [r.entity_id, r.currency, money(r.inflow), money(r.outflow), money(n(r.inflow) - n(r.outflow)),
          money(r.closing), money(r.restricted), String(r.last_date).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')]),
        weights: [1, 0.8, 1, 1, 1, 1.2, 1, 1],
      },
    };
  },

  async 'general-ledger'(f) {
    const w = where(f, { date: 'g.posting_date', org: 'g.org_unit_id' });
    const rows = await q(f, `SELECT a.financial_statement, a.account_category, COUNT(*) lines, SUM(g.debit) debit,
        SUM(g.credit) credit, SUM(CASE WHEN g.manual_flag = 1 THEN 1 ELSE 0 END) manual
      FROM ${t('fact_gl_transaction')} g JOIN ${t('dim_account')} a ON a.account_id = g.account_id
      ${w} GROUP BY a.financial_statement, a.account_category ORDER BY a.financial_statement, a.account_category`);
    const sources = await q(f, `SELECT g.source_system, COUNT(*) lines FROM ${t('fact_gl_transaction')} g ${w}
      GROUP BY g.source_system ORDER BY lines DESC`);
    const [acct] = await query(`SELECT COUNT(*) accounts, SUM(CASE WHEN active_flag = 1 THEN 1 ELSE 0 END) active
      FROM ${t('dim_account')}`);
    const lines = rows.reduce((s, r) => s + n(r.lines), 0);
    const manual = rows.reduce((s, r) => s + n(r.manual), 0);
    return {
      id: 'general-ledger',
      title: 'General Ledger by Account Category',
      kpis: [
        { label: 'Journal Lines', value: count(lines), color: 'primary' },
        { label: 'Total Debit', value: money(rows.reduce((s, r) => s + n(r.debit), 0)), color: 'success' },
        { label: 'Total Credit', value: money(rows.reduce((s, r) => s + n(r.credit), 0)), color: 'warning' },
        { label: 'Manual Lines', value: share(manual, lines), color: 'danger' },
      ],
      table: {
        headers: ['Statement', 'Account Category', 'Lines', 'Debit', 'Credit', 'Net (Dr - Cr)', 'Manual'],
        rows: rows.map((r) => [r.financial_statement, r.account_category, count(r.lines), money(r.debit), money(r.credit),
          money(n(r.debit) - n(r.credit)), count(r.manual)]),
        weights: [1.4, 1.8, 0.9, 1, 1, 1.1, 0.8],
      },
      bullets: [
        `Chart of accounts: ${count(acct.accounts)} accounts (${count(acct.active)} active)`,
        ...sources.map((s) => `Source ${s.source_system}: ${count(s.lines)} lines (${share(s.lines, lines)})`),
      ],
    };
  },

  async 'manual-journals'(f) {
    const w = where(f, { date: 'posting_date', org: 'org_unit_id' });
    const [s] = await q(f, `SELECT COUNT(*) journals, SUM(amount) amount, SUM(late_posting_flag) late,
        SUM(weekend_posting_flag) weekend, SUM(round_amount_flag) round_amt, SUM(same_preparer_approver_flag) same_person,
        AVG(risk_score) risk FROM ${t('fact_manual_journal')} ${w}`);
    const top = await q(f, `SELECT TOP ${limit(f, 15)} manual_journal_id, posting_date, org_unit_id, amount, late_posting_flag,
        weekend_posting_flag, round_amount_flag, same_preparer_approver_flag, risk_score
      FROM ${t('fact_manual_journal')} ${w} ORDER BY risk_score DESC, amount DESC`);
    const yn = (v) => (n(v) ? 'Yes' : '');
    return {
      id: 'manual-journals',
      title: 'Manual Journal Risk',
      kpis: [
        { label: 'Manual Journals', value: count(s.journals), color: 'primary' },
        { label: 'Amount', value: money(s.amount), color: 'neutral' },
        { label: 'Same Preparer/Approver', value: count(s.same_person), color: 'danger' },
        { label: 'Avg Risk Score', value: dec(s.risk, 2), color: 'warning' },
      ],
      table: {
        headers: ['Journal', 'Posted', 'Org Unit', 'Amount', 'Late', 'Weekend', 'Round', 'Same Person', 'Risk'],
        rows: top.map((r) => [r.manual_journal_id, new Date(r.posting_date).toISOString().slice(0, 10), r.org_unit_id,
          money(r.amount), yn(r.late_posting_flag), yn(r.weekend_posting_flag), yn(r.round_amount_flag),
          yn(r.same_preparer_approver_flag), dec(r.risk_score, 2)]),
        weights: [1.2, 1, 0.9, 1, 0.6, 0.8, 0.7, 1, 0.7],
      },
      bullets: [
        `Late postings: ${count(s.late)} (${share(s.late, s.journals)})`,
        `Weekend postings: ${count(s.weekend)} (${share(s.weekend, s.journals)})`,
        `Round amounts: ${count(s.round_amt)} (${share(s.round_amt, s.journals)})`,
      ],
    };
  },

  async 'close'(f) {
    const rows = await q(f, `SELECT task_name, COUNT(*) tasks, SUM(late_flag) late, SUM(adjustment_required_flag) adjustments,
        SUM(reconciliation_exception_count) exceptions, SUM(CASE WHEN status <> 'Complete' THEN 1 ELSE 0 END) not_completed
      FROM ${t('fact_reconciliation_close')} ${where(f, { month: 'month_id', entity: 'entity_id' })}
      GROUP BY task_name ORDER BY late DESC`);
    const tasks = rows.reduce((s, r) => s + n(r.tasks), 0);
    const late = rows.reduce((s, r) => s + n(r.late), 0);
    return {
      id: 'close',
      title: 'Month-End Close and Reconciliations',
      kpis: [
        { label: 'Close Tasks', value: count(tasks), color: 'primary' },
        { label: 'Late', value: share(late, tasks), color: 'danger' },
        { label: 'Adjustments', value: count(rows.reduce((s, r) => s + n(r.adjustments), 0)), color: 'warning' },
        { label: 'Recon Exceptions', value: count(rows.reduce((s, r) => s + n(r.exceptions), 0)), color: 'neutral' },
      ],
      table: {
        headers: ['Task', 'Tasks', 'Late', 'Late %', 'Adjustments', 'Recon Exceptions', 'Not Completed'],
        rows: rows.map((r) => [r.task_name, count(r.tasks), count(r.late), share(r.late, r.tasks), count(r.adjustments),
          count(r.exceptions), count(r.not_completed)]),
        weights: [2.4, 0.8, 0.8, 0.8, 1, 1.2, 1.1],
      },
    };
  },

  async 'sales'(f) {
    const w = where(f, { dateId: 's.date_id', org: 's.org_unit_id' });
    const [s] = await q(f, `SELECT COUNT(*) transactions, SUM(s.net_revenue) revenue, SUM(s.gross_margin) margin,
        AVG(s.discount_pct) discount, SUM(s.discount_override_indicator) overrides, SUM(s.quantity) quantity
      FROM ${t('fact_sales_transaction')} s ${w}`);
    const rows = await q(f, `SELECT p.offering_name, p.business_unit, p.offering_type, COUNT(*) transactions,
        SUM(s.net_revenue) revenue, SUM(s.gross_margin) margin, AVG(s.discount_pct) discount
      FROM ${t('fact_sales_transaction')} s JOIN ${t('dim_product_service')} p ON p.offering_id = s.offering_id
      ${w} GROUP BY p.offering_name, p.business_unit, p.offering_type ORDER BY revenue DESC`);
    const channels = await q(f, `SELECT s.channel, SUM(s.net_revenue) revenue FROM ${t('fact_sales_transaction')} s ${w}
      GROUP BY s.channel ORDER BY revenue DESC`);
    return {
      id: 'sales',
      title: 'Sales by Offering',
      kpis: [
        { label: 'Net Revenue', value: money(s.revenue), color: 'primary' },
        { label: 'Gross Margin %', value: share(s.margin, s.revenue), color: 'success' },
        { label: 'Avg Discount', value: frac(s.discount), color: 'warning' },
        { label: 'Discount Overrides', value: count(s.overrides), color: 'danger' },
      ],
      table: {
        headers: ['Offering', 'Business Unit', 'Type', 'Transactions', 'Net Revenue', 'GM %', 'Avg Discount'],
        rows: rows.map((r) => [r.offering_name, r.business_unit, r.offering_type, count(r.transactions), money(r.revenue),
          share(r.margin, r.revenue), frac(r.discount)]),
        weights: [2.2, 1.8, 1, 1, 1.1, 0.8, 1],
      },
      bullets: [
        `${count(s.transactions)} transactions, ${count(s.quantity)} units sold across ${rows.length} offerings`,
        ...channels.map((c) => `Channel ${c.channel}: ${money(c.revenue)} (${share(c.revenue, s.revenue)})`),
      ],
    };
  },

  async 'discounts'(f) {
    const rows = await q(f, `SELECT approval_status, COUNT(*) requests, AVG(requested_discount_pct) requested,
        AVG(policy_limit_pct) policy, SUM(override_flag) overrides,
        SUM(CASE WHEN requested_discount_pct > policy_limit_pct THEN 1 ELSE 0 END) above_policy
      FROM ${t('fact_discount_approval')} ${where(f, { dateId: 'date_id', org: 'org_unit_id' })}
      GROUP BY approval_status ORDER BY requests DESC`);
    const reasons = await q(f, `SELECT TOP 5 override_reason, COUNT(*) c FROM ${t('fact_discount_approval')}
      ${where(f, { dateId: 'date_id', org: 'org_unit_id', extra: ['override_flag = 1'] })}
      GROUP BY override_reason ORDER BY c DESC`);
    const total = rows.reduce((s, r) => s + n(r.requests), 0);
    const overrides = rows.reduce((s, r) => s + n(r.overrides), 0);
    const above = rows.reduce((s, r) => s + n(r.above_policy), 0);
    return {
      id: 'discounts',
      title: 'Discount Approvals and Overrides',
      kpis: [
        { label: 'Requests', value: count(total), color: 'primary' },
        { label: 'Above Policy', value: share(above, total), color: 'warning' },
        { label: 'Overrides', value: count(overrides), color: 'danger' },
        { label: 'Override Rate', value: share(overrides, total), color: 'neutral' },
      ],
      table: {
        headers: ['Status', 'Requests', 'Avg Requested', 'Avg Policy Limit', 'Above Policy', 'Overrides'],
        rows: rows.map((r) => [r.approval_status, count(r.requests), frac(r.requested), frac(r.policy), count(r.above_policy),
          count(r.overrides)]),
        weights: [1.6, 1, 1.2, 1.3, 1.1, 1],
      },
      bullets: reasons.map((r) => `Override reason "${r.override_reason || 'none given'}": ${count(r.c)}`),
    };
  },

  async 'pipeline'(f) {
    const rows = await q(f, `SELECT stage, COUNT(*) opportunities, SUM(booking_value) booking, SUM(booking_value * probability) weighted,
        AVG(probability) probability
      FROM ${t('fact_contract_pipeline')} ${where(f, { date: 'created_date', org: 'org_unit_id' })}
      GROUP BY stage ORDER BY booking DESC`);
    const reasons = await q(f, `SELECT TOP 5 won_lost_reason, COUNT(*) c FROM ${t('fact_contract_pipeline')}
      ${where(f, { date: 'created_date', org: 'org_unit_id', extra: ['won_lost_reason IS NOT NULL', "won_lost_reason <> ''"] })}
      GROUP BY won_lost_reason ORDER BY c DESC`);
    const opps = rows.reduce((s, r) => s + n(r.opportunities), 0);
    return {
      id: 'pipeline',
      title: 'Contract Pipeline by Stage',
      kpis: [
        { label: 'Opportunities', value: count(opps), color: 'primary' },
        { label: 'Booking Value', value: money(rows.reduce((s, r) => s + n(r.booking), 0)), color: 'success' },
        { label: 'Weighted Value', value: money(rows.reduce((s, r) => s + n(r.weighted), 0)), color: 'warning' },
        { label: 'Stages', value: count(rows.length), color: 'neutral' },
      ],
      table: {
        headers: ['Stage', 'Opportunities', 'Booking Value', 'Weighted Value', 'Avg Probability'],
        rows: rows.map((r) => [r.stage, count(r.opportunities), money(r.booking), money(r.weighted), frac(r.probability, 0)]),
        weights: [1.8, 1.1, 1.2, 1.2, 1.1],
      },
      bullets: reasons.map((r) => `Won/lost reason "${r.won_lost_reason}": ${count(r.c)}`),
    };
  },

  async 'customers'(f) {
    const rows = await q(f, `SELECT segment, COUNT(DISTINCT customer_id) customers, SUM(revenue) revenue, SUM(gross_margin) margin,
        AVG(dso_days) dso, SUM(disputes) disputes, SUM(sla_breaches) sla, AVG(service_health_score) health,
        SUM(credit_notes) credit_notes
      FROM ${t('fact_customer_monthly')} ${where(f, { month: 'month_id', region: 'region' })}
      GROUP BY segment ORDER BY revenue DESC`);
    const [dim] = await q(f, `SELECT COUNT(*) customers, SUM(strategic_flag) strategic, SUM(active_flag) active,
        SUM(south_concentration_flag) south
      FROM ${t('dim_customer')} ${where(f, { region: 'region' })}`);
    return {
      id: 'customers',
      title: 'Customer Portfolio by Segment',
      kpis: [
        { label: 'Customers', value: count(dim.customers), color: 'primary' },
        { label: 'Strategic', value: count(dim.strategic), color: 'success' },
        { label: 'Revenue', value: money(rows.reduce((s, r) => s + n(r.revenue), 0)), color: 'warning' },
        { label: 'Disputes', value: count(rows.reduce((s, r) => s + n(r.disputes), 0)), color: 'danger' },
      ],
      table: {
        headers: ['Segment', 'Customers', 'Revenue', 'GM %', 'Avg DSO', 'Disputes', 'SLA Breaches', 'Credit Notes', 'Service Health'],
        rows: rows.map((r) => [r.segment, count(r.customers), money(r.revenue), share(r.margin, r.revenue), dec(r.dso),
          count(r.disputes), count(r.sla), count(r.credit_notes), dec(r.health)]),
        weights: [1.5, 1, 1.1, 0.8, 0.9, 0.9, 1, 1, 1.1],
      },
      bullets: [`${count(dim.active)} active customers; ${count(dim.south)} flagged for South-region concentration`],
    };
  },

  async 'customer-risk'(f) {
    const w = where(f, { customerRegion: 'r.customer_id' });
    const bands = await q(f, `SELECT r.risk_band, COUNT(DISTINCT r.customer_id) customers, SUM(r.revenue_at_risk) revenue_at_risk,
        SUM(r.cash_at_risk) cash_at_risk, AVG(r.churn_probability) churn, AVG(r.late_payment_probability) late
      FROM ${t('pred_customer_risk')} r ${w} GROUP BY r.risk_band ORDER BY revenue_at_risk DESC`);
    const top = await q(f, `SELECT TOP ${limit(f, 15)} c.customer_name, c.segment, c.region, SUM(r.revenue_at_risk) revenue_at_risk,
        SUM(r.cash_at_risk) cash_at_risk, MAX(r.churn_probability) churn, MAX(r.risk_band) risk_band, MAX(r.driver_1) driver
      FROM ${t('pred_customer_risk')} r JOIN ${t('dim_customer')} c ON c.customer_id = r.customer_id
      ${w} GROUP BY c.customer_name, c.segment, c.region ORDER BY revenue_at_risk DESC`);
    const rar = bands.reduce((s, r) => s + n(r.revenue_at_risk), 0);
    return [{
      id: 'customer-risk',
      title: 'Customer Risk by Band (6-month forecast)',
      kpis: [
        { label: 'Revenue at Risk', value: money(rar), color: 'danger' },
        { label: 'Cash at Risk', value: money(bands.reduce((s, r) => s + n(r.cash_at_risk), 0)), color: 'warning' },
        { label: 'Customers Scored', value: count(bands.reduce((s, r) => s + n(r.customers), 0)), color: 'primary' },
        { label: 'Bands', value: count(bands.length), color: 'neutral' },
      ],
      table: {
        headers: ['Risk Band', 'Customers', 'Revenue at Risk', 'Cash at Risk', 'Avg Churn Prob.', 'Avg Late Pay Prob.'],
        rows: bands.map((r) => [r.risk_band, count(r.customers), money(r.revenue_at_risk), money(r.cash_at_risk), frac(r.churn),
          frac(r.late)]),
        weights: [1.2, 1, 1.3, 1.2, 1.2, 1.3],
      },
    }, {
      id: 'customer-risk-top',
      title: `Top ${top.length} Customers by Revenue at Risk`,
      table: {
        headers: ['Customer', 'Segment', 'Region', 'Revenue at Risk', 'Cash at Risk', 'Max Churn', 'Band', 'Top Driver'],
        rows: top.map((r) => [r.customer_name, r.segment, r.region, money(r.revenue_at_risk), money(r.cash_at_risk),
          frac(r.churn), r.risk_band, r.driver]),
        weights: [1.8, 1.2, 0.8, 1.1, 1, 0.9, 0.8, 2],
      },
    }];
  },

  async 'customer-service'(f) {
    const rows = await q(f, `SELECT case_type, COUNT(*) cases, SUM(sla_breach_flag) sla, SUM(dispute_flag) disputes,
        SUM(credit_note_amount) credit, AVG(CAST(resolution_days AS float)) resolution
      FROM ${t('fact_customer_service')} ${where(f, { date: 'opened_date', org: 'org_unit_id' })}
      GROUP BY case_type ORDER BY cases DESC`);
    const causes = await q(f, `SELECT TOP 5 root_cause, COUNT(*) c FROM ${t('fact_customer_service')}
      ${where(f, { date: 'opened_date', org: 'org_unit_id' })} GROUP BY root_cause ORDER BY c DESC`);
    const cases = rows.reduce((s, r) => s + n(r.cases), 0);
    const sla = rows.reduce((s, r) => s + n(r.sla), 0);
    return {
      id: 'customer-service',
      title: 'Customer Service Cases',
      kpis: [
        { label: 'Cases', value: count(cases), color: 'primary' },
        { label: 'SLA Breach Rate', value: share(sla, cases), color: 'danger' },
        { label: 'Disputes', value: count(rows.reduce((s, r) => s + n(r.disputes), 0)), color: 'warning' },
        { label: 'Credit Notes', value: money(rows.reduce((s, r) => s + n(r.credit), 0)), color: 'neutral' },
      ],
      table: {
        headers: ['Case Type', 'Cases', 'SLA Breaches', 'Breach %', 'Disputes', 'Credit Notes', 'Avg Resolution (days)'],
        rows: rows.map((r) => [r.case_type, count(r.cases), count(r.sla), share(r.sla, r.cases), count(r.disputes),
          money(r.credit), dec(r.resolution)]),
        weights: [1.8, 0.8, 1, 0.8, 0.8, 1, 1.4],
      },
      bullets: causes.map((c) => `Root cause "${c.root_cause}": ${count(c.c)} cases`),
    };
  },

  async 'receivables'(f) {
    const w = where(f, { date: 'invoice_date', org: 'org_unit_id' });
    const aging = await q(f, `SELECT bucket, COUNT(*) invoices, SUM(outstanding_amount) outstanding, SUM(dispute_flag) disputed
      FROM (SELECT outstanding_amount, dispute_flag, CASE
          WHEN outstanding_amount <= 0 THEN '0. Settled'
          WHEN days_past_due <= 0 THEN '1. Current'
          WHEN days_past_due <= 30 THEN '2. 1-30 days'
          WHEN days_past_due <= 60 THEN '3. 31-60 days'
          WHEN days_past_due <= 90 THEN '4. 61-90 days'
          ELSE '5. 90+ days' END bucket
        FROM ${t('fact_ar_invoice_payment')} ${w}) x
      GROUP BY bucket ORDER BY bucket`);
    const status = await q(f, `SELECT collection_status, COUNT(*) invoices, SUM(outstanding_amount) outstanding
      FROM ${t('fact_ar_invoice_payment')} ${w} GROUP BY collection_status ORDER BY outstanding DESC`);
    const [s] = await q(f, `SELECT COUNT(*) invoices, SUM(invoice_amount) invoiced, SUM(outstanding_amount) outstanding,
        AVG(CAST(days_to_pay AS float)) dtp, SUM(billing_error_flag) billing_errors, SUM(missing_approval_flag) missing_approval
      FROM ${t('fact_ar_invoice_payment')} ${w}`);
    return {
      id: 'receivables',
      title: 'Accounts Receivable Aging',
      kpis: [
        { label: 'Invoiced', value: money(s.invoiced), color: 'primary' },
        { label: 'Outstanding', value: money(s.outstanding), color: 'warning' },
        { label: 'Avg Days to Pay', value: dec(s.dtp), color: 'neutral' },
        { label: 'Billing Errors', value: count(s.billing_errors), color: 'danger' },
      ],
      table: {
        headers: ['Aging Bucket', 'Invoices', 'Outstanding', '% of Outstanding', 'Disputed'],
        rows: aging.map((r) => [r.bucket.slice(3), count(r.invoices), money(r.outstanding), share(r.outstanding, s.outstanding),
          count(r.disputed)]),
        weights: [1.5, 1, 1.2, 1.3, 1],
      },
      bullets: [
        `${count(s.invoices)} invoices; ${count(s.missing_approval)} missing approval`,
        ...status.map((r) => `Collection status ${r.collection_status}: ${count(r.invoices)} invoices, ${money(r.outstanding)} outstanding`),
      ],
    };
  },

  async 'payables'(f) {
    const rows = await q(f, `SELECT invoice_status, COUNT(*) invoices, SUM(invoice_amount) amount, SUM(duplicate_indicator) duplicates,
        SUM(split_invoice_indicator) splits, SUM(bank_change_proximity_flag) bank_change,
        SUM(CASE WHEN po_match_status = 'Exception' THEN 1 ELSE 0 END) po_issues,
        SUM(CASE WHEN payment_date > due_date THEN 1 ELSE 0 END) paid_late
      FROM ${t('fact_ap_invoice_payment')} ${where(f, { date: 'invoice_date', org: 'org_unit_id' })}
      GROUP BY invoice_status ORDER BY amount DESC`);
    const sum = (k) => rows.reduce((s, r) => s + n(r[k]), 0);
    return {
      id: 'payables',
      title: 'Accounts Payable and Payment Controls',
      kpis: [
        { label: 'AP Invoices', value: count(sum('invoices')), color: 'primary' },
        { label: 'Amount', value: money(sum('amount')), color: 'neutral' },
        { label: 'Possible Duplicates', value: count(sum('duplicates')), color: 'danger' },
        { label: 'Paid Late', value: share(sum('paid_late'), sum('invoices')), color: 'warning' },
      ],
      table: {
        headers: ['Status', 'Invoices', 'Amount', 'Duplicates', 'Split', 'Near Bank Change', 'PO Exception', 'Paid Late'],
        rows: rows.map((r) => [r.invoice_status, count(r.invoices), money(r.amount), count(r.duplicates), count(r.splits),
          count(r.bank_change), count(r.po_issues), count(r.paid_late)]),
        weights: [1.3, 0.9, 1, 0.9, 0.7, 1.2, 1.2, 0.9],
      },
    };
  },

  async 'vendors'(f) {
    const vendors = await q(f, `SELECT category, COUNT(*) vendors, SUM(CASE WHEN criticality IN ('High', 'Critical') THEN 1 ELSE 0 END) critical,
        SUM(CASE WHEN risk_rating = 'High' THEN 1 ELSE 0 END) high_risk, SUM(CASE WHEN approved_status <> 'Approved' THEN 1 ELSE 0 END) unapproved
      FROM ${t('dim_vendor')} ${where(f, { region: 'region' })} GROUP BY category ORDER BY vendors DESC`);
    const changes = await q(f, `SELECT change_type, COUNT(*) changes, SUM(emergency_change_flag) emergency,
        SUM(payment_within_7d_flag) paid_7d, SUM(risk_indicator_flag) risky
      FROM ${t('fact_vendor_master_change')} ${where(f, { date: 'change_date' })}
      GROUP BY change_type ORDER BY changes DESC`);
    const totalChanges = changes.reduce((s, r) => s + n(r.changes), 0);
    return [{
      id: 'vendors',
      title: 'Vendor Master by Category',
      kpis: [
        { label: 'Vendors', value: count(vendors.reduce((s, r) => s + n(r.vendors), 0)), color: 'primary' },
        { label: 'High Risk', value: count(vendors.reduce((s, r) => s + n(r.high_risk), 0)), color: 'danger' },
        { label: 'Master Changes', value: count(totalChanges), color: 'warning' },
        { label: 'Risky Changes', value: count(changes.reduce((s, r) => s + n(r.risky), 0)), color: 'danger' },
      ],
      table: {
        headers: ['Category', 'Vendors', 'High/Critical', 'High Risk', 'Not Approved'],
        rows: vendors.map((r) => [r.category, count(r.vendors), count(r.critical), count(r.high_risk), count(r.unapproved)]),
        weights: [2, 1, 1.2, 1, 1.1],
      },
    }, {
      id: 'vendor-changes',
      title: 'Vendor Master Changes',
      table: {
        headers: ['Change Type', 'Changes', 'Emergency', 'Paid Within 7 Days', 'Risk Indicator'],
        rows: changes.map((r) => [r.change_type, count(r.changes), count(r.emergency), count(r.paid_7d), count(r.risky)]),
        weights: [2, 1, 1, 1.3, 1.1],
      },
    }];
  },

  async 'workforce'(f) {
    const [{ m }] = await q(f, `SELECT MAX(month_id) m FROM ${t('fact_employee_monthly')} ${where(f, { month: 'month_id' })}`);
    const rows = m == null ? [] : await query(`SELECT o.business_unit, COUNT(*) employees, SUM(e.fte) fte,
        SUM(e.base_pay_monthly + e.variable_pay_monthly) payroll, AVG(e.engagement_score) engagement,
        AVG(e.workload_index) workload, SUM(e.critical_role_flag) critical, AVG(e.tenure_years) tenure
      FROM ${t('fact_employee_monthly')} e JOIN ${t('dim_organisation')} o ON o.org_unit_id = e.org_unit_id
      ${where(f, { org: 'e.org_unit_id', extra: ['e.month_id = @latest_month'] })}
      GROUP BY o.business_unit ORDER BY employees DESC`, { ...f.params, latest_month: m });
    const [dim] = await q(f, `SELECT COUNT(*) employees, SUM(CASE WHEN employment_status = 'Active' THEN 1 ELSE 0 END) active,
        COUNT(DISTINCT role) roles FROM ${t('dim_employee')} ${where(f, { org: 'org_unit_id' })}`);
    const employees = rows.reduce((s, r) => s + n(r.employees), 0);
    return {
      id: 'workforce',
      title: `Workforce by Business Unit (${m ? monthLabel(m) : 'n/a'})`,
      kpis: [
        { label: 'Employees', value: count(employees), color: 'primary' },
        { label: 'FTE', value: count(rows.reduce((s, r) => s + n(r.fte), 0)), color: 'success' },
        { label: 'Monthly Payroll', value: money(rows.reduce((s, r) => s + n(r.payroll), 0)), color: 'warning' },
        { label: 'Critical Roles', value: count(rows.reduce((s, r) => s + n(r.critical), 0)), color: 'danger' },
      ],
      table: {
        headers: ['Business Unit', 'Employees', 'FTE', 'Monthly Payroll', 'Avg Engagement', 'Avg Workload', 'Critical Roles', 'Avg Tenure'],
        rows: rows.map((r) => [r.business_unit, count(r.employees), dec(r.fte, 0), money(r.payroll), dec(r.engagement),
          dec(r.workload, 2), count(r.critical), dec(r.tenure)]),
        weights: [2, 1, 0.8, 1.2, 1.1, 1, 1, 0.9],
      },
      bullets: [`Employee master: ${count(dim.employees)} records, ${count(dim.active)} active, ${count(dim.roles)} roles`],
    };
  },

  async 'hires-exits'(f) {
    const rows = await q(f, `SELECT event_type, COALESCE(exit_reason, '-') exit_reason, COUNT(*) events, SUM(voluntary_flag) voluntary,
        SUM(regrettable_flag) regrettable, SUM(replacement_required) replacements
      FROM ${t('fact_hire_exit')} ${where(f, { date: 'event_date', org: ['previous_org_unit_id', 'new_org_unit_id'] })}
      GROUP BY event_type, COALESCE(exit_reason, '-') ORDER BY event_type, events DESC`);
    const sum = (type, k) => rows.filter((r) => r.event_type === type).reduce((s, r) => s + n(r[k]), 0);
    const exits = rows.filter((r) => /exit/i.test(r.event_type)).reduce((s, r) => s + n(r.events), 0);
    return {
      id: 'hires-exits',
      title: 'Hires, Exits and Moves',
      kpis: [
        { label: 'Hires', value: count(sum('Hire', 'events')), color: 'success' },
        { label: 'Exits', value: count(exits), color: 'danger' },
        { label: 'Regrettable', value: count(rows.reduce((s, r) => s + n(r.regrettable), 0)), color: 'warning' },
        { label: 'Replacements Needed', value: count(rows.reduce((s, r) => s + n(r.replacements), 0)), color: 'neutral' },
      ],
      table: {
        headers: ['Event', 'Exit Reason', 'Events', 'Voluntary', 'Regrettable', 'Replacement Required'],
        rows: rows.map((r) => [r.event_type, r.exit_reason, count(r.events), count(r.voluntary), count(r.regrettable),
          count(r.replacements)]),
        weights: [1.2, 1.8, 0.8, 0.9, 1, 1.4],
      },
    };
  },

  async 'vacancies'(f) {
    const rows = await q(f, `SELECT status, COUNT(*) vacancies, SUM(critical_role_flag) critical,
        AVG(CAST(time_to_fill_days AS float)) ttf, SUM(recruitment_cost) cost, AVG(CAST(candidate_pipeline_count AS float)) pipeline
      FROM ${t('fact_vacancy_recruitment')} ${where(f, { date: 'open_date', org: 'org_unit_id' })}
      GROUP BY status ORDER BY vacancies DESC`);
    const total = rows.reduce((s, r) => s + n(r.vacancies), 0);
    return {
      id: 'vacancies',
      title: 'Vacancies and Recruitment',
      kpis: [
        { label: 'Vacancies', value: count(total), color: 'primary' },
        { label: 'Critical Roles', value: count(rows.reduce((s, r) => s + n(r.critical), 0)), color: 'danger' },
        { label: 'Recruitment Cost', value: money(rows.reduce((s, r) => s + n(r.cost), 0)), color: 'warning' },
        { label: 'Statuses', value: count(rows.length), color: 'neutral' },
      ],
      table: {
        headers: ['Status', 'Vacancies', 'Critical', 'Avg Time to Fill (days)', 'Recruitment Cost', 'Avg Candidates'],
        rows: rows.map((r) => [r.status, count(r.vacancies), count(r.critical), dec(r.ttf), money(r.cost), dec(r.pipeline)]),
        weights: [1.4, 1, 0.8, 1.6, 1.2, 1.1],
      },
    };
  },

  async 'attendance'(f) {
    const rows = await q(f, `SELECT o.business_unit, SUM(a.scheduled_hours) scheduled, SUM(a.worked_hours) worked,
        SUM(a.overtime_hours) overtime, SUM(a.absence_hours) absence, AVG(a.utilisation_pct) utilisation,
        SUM(a.timesheet_late_flag) late
      FROM ${t('fact_time_attendance')} a JOIN ${t('dim_organisation')} o ON o.org_unit_id = a.org_unit_id
      ${where(f, { month: 'a.month_id', org: 'a.org_unit_id' })}
      GROUP BY o.business_unit ORDER BY overtime DESC`);
    const absenceTypes = await q(f, `SELECT TOP 5 absence_type, SUM(absence_hours) hours FROM ${t('fact_time_attendance')}
      ${where(f, { month: 'month_id', org: 'org_unit_id', extra: ['absence_hours > 0'] })}
      GROUP BY absence_type ORDER BY hours DESC`);
    const sum = (k) => rows.reduce((s, r) => s + n(r[k]), 0);
    return {
      id: 'attendance',
      title: 'Time and Attendance by Business Unit',
      kpis: [
        { label: 'Hours Worked', value: count(sum('worked')), color: 'primary' },
        { label: 'Overtime Hours', value: count(sum('overtime')), color: 'warning' },
        { label: 'Absence Hours', value: count(sum('absence')), color: 'danger' },
        { label: 'Utilisation', value: share(sum('worked'), sum('scheduled')), color: 'success' },
      ],
      table: {
        headers: ['Business Unit', 'Scheduled Hrs', 'Worked Hrs', 'Overtime Hrs', 'Absence Hrs', 'Avg Utilisation', 'Late Timesheets'],
        rows: rows.map((r) => [r.business_unit, count(r.scheduled), count(r.worked), count(r.overtime), count(r.absence),
          frac(r.utilisation), count(r.late)]),
        weights: [2, 1.1, 1.1, 1.1, 1.1, 1.1, 1.1],
      },
      bullets: absenceTypes.map((a) => `Absence type ${a.absence_type}: ${count(a.hours)} hours`),
    };
  },

  async 'engagement'(f) {
    const rows = await q(f, `SELECT performance_band, COUNT(*) responses, AVG(engagement_score) engagement,
        AVG(manager_effectiveness_score) manager, AVG(career_opportunity_score) career, AVG(workload_sustainability_score) workload
      FROM ${t('fact_engagement_performance')} ${where(f, { quarter: "CONCAT(LEFT(CAST(quarter_id AS varchar(6)), 4), 'Q', RIGHT(CAST(quarter_id AS varchar(6)), 1))", org: 'org_unit_id' })}
      GROUP BY performance_band ORDER BY performance_band`);
    const responses = rows.reduce((s, r) => s + n(r.responses), 0);
    const avg = (k) => rows.reduce((s, r) => s + n(r[k]) * n(r.responses), 0) / (responses || 1);
    return {
      id: 'engagement',
      title: 'Engagement Survey by Performance Band',
      kpis: [
        { label: 'Responses', value: count(responses), color: 'primary' },
        { label: 'Engagement', value: dec(avg('engagement')), color: 'success' },
        { label: 'Manager Effectiveness', value: dec(avg('manager')), color: 'warning' },
        { label: 'Workload Sustainability', value: dec(avg('workload')), color: 'danger' },
      ],
      table: {
        headers: ['Performance Band', 'Responses', 'Engagement', 'Manager', 'Career Opportunity', 'Workload'],
        rows: rows.map((r) => [r.performance_band, count(r.responses), dec(r.engagement), dec(r.manager), dec(r.career), dec(r.workload)]),
        weights: [1.6, 1, 1, 1, 1.3, 1],
      },
    };
  },

  async 'learning'(f) {
    const rows = await q(f, `SELECT event_type, COUNT(*) events, SUM(learning_hours) hours, AVG(compensation_change_pct) comp,
        SUM(CASE WHEN completion_status = 'Complete' THEN 1 ELSE 0 END) completed, SUM(critical_skill_flag) critical
      FROM ${t('fact_learning_compensation')} ${where(f, { date: 'event_date', org: 'org_unit_id' })}
      GROUP BY event_type ORDER BY events DESC`);
    const events = rows.reduce((s, r) => s + n(r.events), 0);
    return {
      id: 'learning',
      title: 'Learning and Compensation Events',
      kpis: [
        { label: 'Events', value: count(events), color: 'primary' },
        { label: 'Learning Hours', value: count(rows.reduce((s, r) => s + n(r.hours), 0)), color: 'success' },
        { label: 'Completed', value: share(rows.reduce((s, r) => s + n(r.completed), 0), events), color: 'warning' },
        { label: 'Critical Skill', value: count(rows.reduce((s, r) => s + n(r.critical), 0)), color: 'neutral' },
      ],
      table: {
        headers: ['Event Type', 'Events', 'Learning Hours', 'Avg Comp Change', 'Completed', 'Critical Skill'],
        rows: rows.map((r) => [r.event_type, count(r.events), count(r.hours), frac(r.comp, 2), count(r.completed), count(r.critical)]),
        weights: [1.8, 0.9, 1.1, 1.2, 1, 1],
      },
    };
  },

  async 'workforce-risk'(f) {
    const w = where(f, { region: 'region', bu: 'business_unit' });
    const rows = await q(f, `SELECT role_cohort, SUM(headcount) headcount, AVG(attrition_probability) attrition,
        SUM(expected_exits) exits, SUM(expected_capacity_gap_fte) gap, SUM(revenue_or_service_impact_usd) impact,
        SUM(CASE WHEN risk_band = 'High' THEN 1 ELSE 0 END) high
      FROM ${t('pred_workforce_risk')} ${w} GROUP BY role_cohort ORDER BY impact DESC`);
    const drivers = await q(f, `SELECT TOP 5 driver_1 driver, COUNT(*) c FROM ${t('pred_workforce_risk')} ${w}
      GROUP BY driver_1 ORDER BY c DESC`);
    const sum = (k) => rows.reduce((s, r) => s + n(r[k]), 0);
    return {
      id: 'workforce-risk',
      title: 'Workforce Attrition Risk by Role Cohort',
      kpis: [
        { label: 'Expected Exits', value: dec(sum('exits'), 0), color: 'danger' },
        { label: 'Capacity Gap (FTE)', value: count(sum('gap')), color: 'warning' },
        { label: 'Revenue/Service Impact', value: money(sum('impact')), color: 'danger' },
        { label: 'Headcount Scored', value: count(sum('headcount')), color: 'primary' },
      ],
      table: {
        headers: ['Role Cohort', 'Headcount', 'Avg Attrition Prob.', 'Expected Exits', 'Capacity Gap (FTE)', 'Impact', 'High-Risk Units'],
        rows: rows.map((r) => [r.role_cohort, count(r.headcount), frac(r.attrition), dec(r.exits), count(r.gap), money(r.impact), count(r.high)]),
        weights: [2, 1, 1.3, 1.1, 1.3, 1, 1.1],
      },
      bullets: drivers.map((d) => `Top attrition driver "${d.driver}": ${count(d.c)} prediction rows`),
    };
  },

  async 'control-risk'(f) {
    const w = where(f, { region: 'region', entity: 'entity_id' });
    const rows = await q(f, `SELECT process, COUNT(*) predictions, AVG(material_exception_probability) prob,
        SUM(expected_exception_count) exceptions, SUM(expected_monetary_exposure) exposure,
        SUM(CASE WHEN risk_band = 'High' THEN 1 ELSE 0 END) high
      FROM ${t('pred_control_risk')} ${w} GROUP BY process ORDER BY exposure DESC`);
    const top = await q(f, `SELECT TOP ${limit(f, 10)} entity, region, process, forecast_quarter, material_exception_probability, expected_monetary_exposure,
        risk_band, driver_1 FROM ${t('pred_control_risk')} ${w} ORDER BY expected_monetary_exposure DESC`);
    const sum = (k) => rows.reduce((s, r) => s + n(r[k]), 0);
    return [{
      id: 'control-risk',
      title: 'Predicted Control Risk by Process',
      kpis: [
        { label: 'Expected Exposure', value: money(sum('exposure')), color: 'danger' },
        { label: 'Expected Exceptions', value: count(sum('exceptions')), color: 'warning' },
        { label: 'High-Risk Predictions', value: count(sum('high')), color: 'danger' },
        { label: 'Processes', value: count(rows.length), color: 'primary' },
      ],
      table: {
        headers: ['Process', 'Predictions', 'Avg Material Exc. Prob.', 'Expected Exceptions', 'Expected Exposure', 'High Risk'],
        rows: rows.map((r) => [r.process, count(r.predictions), frac(r.prob), count(r.exceptions), money(r.exposure), count(r.high)]),
        weights: [2, 1, 1.5, 1.3, 1.3, 0.9],
      },
    }, {
      id: 'control-risk-top',
      title: `Top ${top.length} Entity-Process Control Risks`,
      table: {
        headers: ['Entity', 'Region', 'Process', 'Quarter', 'Material Exc. Prob.', 'Exposure', 'Band', 'Top Driver'],
        rows: top.map((r) => [r.entity, r.region, r.process, r.forecast_quarter, frac(r.material_exception_probability),
          money(r.expected_monetary_exposure), r.risk_band, r.driver_1]),
        weights: [1.4, 0.8, 1.4, 0.9, 1.1, 1, 0.8, 2],
      },
    }];
  },

  async 'control-scorecard'(f) {
    const rows = await q(f, `SELECT quarter_id, SUM(exception_count) exceptions, SUM(high_risk_count) high, SUM(repeat_count) repeats,
        SUM(monetary_exposure) exposure, AVG(control_risk_index) cri
      FROM ${t('serving_control_risk_scorecard_quarterly')} ${where(f, { quarter: 'quarter_id', region: 'region', bu: 'business_unit' })}
      GROUP BY quarter_id ORDER BY quarter_id`);
    return {
      id: 'control-scorecard',
      title: 'Quarterly Control Risk Scorecard',
      table: {
        headers: ['Quarter', 'Exceptions', 'High Risk', 'Repeat', 'Monetary Exposure', 'Avg Control Risk Index'],
        rows: rows.map((r) => [r.quarter_id, count(r.exceptions), count(r.high), count(r.repeats), money(r.exposure), dec(r.cri)]),
        weights: [1, 1, 1, 0.9, 1.4, 1.6],
      },
    };
  },

  async 'control-exceptions'(f) {
    const w = where(f, { date: 'exception_date', org: 'org_unit_id' });
    const rows = await q(f, `SELECT exception_type, COUNT(*) exceptions, SUM(CASE WHEN severity IN ('High', 'Critical') THEN 1 ELSE 0 END) high,
        SUM(repeat_flag) repeats, SUM(monetary_exposure) exposure, SUM(CASE WHEN status <> 'Closed' THEN 1 ELSE 0 END) open_items
      FROM ${t('fact_control_exception')} ${w} GROUP BY exception_type ORDER BY exposure DESC`);
    const causes = await q(f, `SELECT TOP 5 root_cause, COUNT(*) c FROM ${t('fact_control_exception')} ${w}
      GROUP BY root_cause ORDER BY c DESC`);
    const sum = (k) => rows.reduce((s, r) => s + n(r[k]), 0);
    return {
      id: 'control-exceptions',
      title: 'Control Exceptions by Type',
      kpis: [
        { label: 'Exceptions', value: count(sum('exceptions')), color: 'primary' },
        { label: 'High/Critical', value: count(sum('high')), color: 'danger' },
        { label: 'Repeat', value: share(sum('repeats'), sum('exceptions')), color: 'warning' },
        { label: 'Exposure', value: money(sum('exposure')), color: 'danger' },
      ],
      table: {
        headers: ['Exception Type', 'Exceptions', 'High/Critical', 'Repeat', 'Exposure', 'Not Closed'],
        rows: rows.map((r) => [r.exception_type, count(r.exceptions), count(r.high), count(r.repeats), money(r.exposure), count(r.open_items)]),
        weights: [2.2, 1, 1.1, 0.8, 1.1, 1],
      },
      bullets: causes.map((c) => `Root cause "${c.root_cause}": ${count(c.c)} exceptions`),
    };
  },

  async 'control-tests'(f) {
    const rows = await q(f, `SELECT c.process, COUNT(*) tests, SUM(CASE WHEN ct.result = 'Effective' THEN 1 ELSE 0 END) effective,
        SUM(ct.exception_count) exceptions, SUM(ct.sample_size) samples, SUM(CASE WHEN c.key_control_flag = 1 THEN 1 ELSE 0 END) key_tests
      FROM ${t('fact_control_test')} ct JOIN ${t('dim_risk_control')} c ON c.control_id = ct.control_id
      ${where(f, { date: 'ct.test_date', org: 'ct.org_unit_id' })}
      GROUP BY c.process ORDER BY tests DESC`);
    const results = await q(f, `SELECT result, COUNT(*) c FROM ${t('fact_control_test')}
      ${where(f, { date: 'test_date', org: 'org_unit_id' })} GROUP BY result ORDER BY c DESC`);
    const [dim] = await query(`SELECT COUNT(*) controls, SUM(key_control_flag) key_controls, COUNT(DISTINCT risk_id) risks
      FROM ${t('dim_risk_control')}`);
    const tests = rows.reduce((s, r) => s + n(r.tests), 0);
    return {
      id: 'control-tests',
      title: 'Control Testing by Process',
      kpis: [
        { label: 'Tests', value: count(tests), color: 'primary' },
        { label: 'Effective', value: share(rows.reduce((s, r) => s + n(r.effective), 0), tests), color: 'success' },
        { label: 'Exceptions Found', value: count(rows.reduce((s, r) => s + n(r.exceptions), 0)), color: 'danger' },
        { label: 'Controls in Library', value: count(dim.controls), color: 'neutral' },
      ],
      table: {
        headers: ['Process', 'Tests', 'Effective', 'Effective %', 'Exceptions', 'Samples', 'Key-Control Tests'],
        rows: rows.map((r) => [r.process, count(r.tests), count(r.effective), share(r.effective, r.tests), count(r.exceptions),
          count(r.samples), count(r.key_tests)]),
        weights: [2, 0.8, 0.9, 1, 1, 0.9, 1.3],
      },
      bullets: [
        `Control library: ${count(dim.controls)} controls (${count(dim.key_controls)} key) over ${count(dim.risks)} risks`,
        ...results.map((r) => `Result ${r.result}: ${count(r.c)} tests`),
      ],
    };
  },

  async 'audit-findings'(f) {
    const w = where(f, { date: 'issue_date', org: 'org_unit_id' });
    const rows = await q(f, `SELECT severity, COUNT(*) findings, SUM(monetary_exposure) exposure, SUM(repeat_finding_flag) repeats,
        SUM(CASE WHEN status <> 'Closed' THEN 1 ELSE 0 END) open_items
      FROM ${t('fact_audit_finding')} ${w} GROUP BY severity ORDER BY exposure DESC`);
    const top = await q(f, `SELECT TOP 10 finding_title, process, severity, monetary_exposure, status, target_date
      FROM ${t('fact_audit_finding')} ${w} ORDER BY monetary_exposure DESC`);
    const sum = (k) => rows.reduce((s, r) => s + n(r[k]), 0);
    return {
      id: 'audit-findings',
      title: 'Audit Findings by Severity',
      kpis: [
        { label: 'Findings', value: count(sum('findings')), color: 'primary' },
        { label: 'Exposure', value: money(sum('exposure')), color: 'danger' },
        { label: 'Open', value: count(sum('open_items')), color: 'warning' },
        { label: 'Repeat Findings', value: count(sum('repeats')), color: 'danger' },
      ],
      table: {
        headers: ['Severity', 'Findings', 'Exposure', 'Repeat', 'Not Closed'],
        rows: rows.map((r) => [r.severity, count(r.findings), money(r.exposure), count(r.repeats), count(r.open_items)]),
        weights: [1.4, 1, 1.2, 1, 1],
      },
      bullets: top.slice(0, 5).map((r) => `${r.severity}: ${r.finding_title} (${r.process}), ${money(r.monetary_exposure)}, ${r.status}`),
    };
  },

  async 'remediation'(f) {
    const rows = await q(f, `SELECT status, COUNT(*) items, SUM(overdue_flag) overdue, AVG(milestone_completion_pct) completion,
        SUM(validation_required_flag) validation
      FROM ${t('fact_issue_remediation')} ${where(f, { date: 'start_date' })}
      GROUP BY status ORDER BY items DESC`);
    const residual = await q(f, `SELECT residual_risk, COUNT(*) c FROM ${t('fact_issue_remediation')}
      ${where(f, { date: 'start_date' })} GROUP BY residual_risk ORDER BY c DESC`);
    const items = rows.reduce((s, r) => s + n(r.items), 0);
    return {
      id: 'remediation',
      title: 'Issue Remediation Status',
      kpis: [
        { label: 'Remediation Items', value: count(items), color: 'primary' },
        { label: 'Overdue', value: count(rows.reduce((s, r) => s + n(r.overdue), 0)), color: 'danger' },
        { label: 'Overdue %', value: share(rows.reduce((s, r) => s + n(r.overdue), 0), items), color: 'warning' },
        { label: 'Need Validation', value: count(rows.reduce((s, r) => s + n(r.validation), 0)), color: 'neutral' },
      ],
      table: {
        headers: ['Status', 'Items', 'Overdue', 'Avg Milestone Completion', 'Validation Required'],
        rows: rows.map((r) => [r.status, count(r.items), count(r.overdue), pct(r.completion, 0), count(r.validation)]),
        weights: [1.5, 1, 1, 1.6, 1.4],
      },
      bullets: residual.map((r) => `Residual risk ${r.residual_risk}: ${count(r.c)} items`),
    };
  },

  async 'access'(f) {
    const rows = await q(f, `SELECT event_type, COUNT(*) events, SUM(conflict_flag) conflicts, SUM(privileged_flag) privileged,
        SUM(CASE WHEN approval_status IN ('Pending', 'Rejected') THEN 1 ELSE 0 END) not_approved, AVG(CAST(days_open AS float)) days_open
      FROM ${t('fact_access_sod_event')} ${where(f, { date: 'event_date', org: 'org_unit_id' })}
      GROUP BY event_type ORDER BY conflicts DESC`);
    const systems = await q(f, `SELECT TOP 5 system_name, SUM(conflict_flag) conflicts FROM ${t('fact_access_sod_event')}
      ${where(f, { date: 'event_date', org: 'org_unit_id' })} GROUP BY system_name ORDER BY conflicts DESC`);
    const sum = (k) => rows.reduce((s, r) => s + n(r[k]), 0);
    return {
      id: 'access',
      title: 'Access and Segregation of Duties',
      kpis: [
        { label: 'Access Events', value: count(sum('events')), color: 'primary' },
        { label: 'SoD Conflicts', value: count(sum('conflicts')), color: 'danger' },
        { label: 'Privileged', value: count(sum('privileged')), color: 'warning' },
        { label: 'Pending/Rejected', value: count(sum('not_approved')), color: 'neutral' },
      ],
      table: {
        headers: ['Event Type', 'Events', 'SoD Conflicts', 'Privileged', 'Pending/Rejected', 'Avg Days Open'],
        rows: rows.map((r) => [r.event_type, count(r.events), count(r.conflicts), count(r.privileged), count(r.not_approved), dec(r.days_open)]),
        weights: [1.8, 1, 1.1, 1, 1.1, 1.1],
      },
      bullets: systems.map((s) => `${s.system_name}: ${count(s.conflicts)} conflicts`),
    };
  },

  async 'recommendations'(f) {
    const w = where(f, { extra: scopeFilter(f, 'r.scope_id') });
    const rows = await q(f, `SELECT TOP ${limit(f, 20)} c.action_name, c.[function] fn, r.scope_id, r.net_financial_benefit_usd net,
        r.implementation_cost_usd cost, r.cash_benefit_usd cash, r.risk_reduction_points risk, r.confidence_score confidence,
        r.priority_score priority, r.accountable_owner_role owner, r.time_to_impact_days days
      FROM ${t('action_recommendation')} r LEFT JOIN ${t('action_catalog')} c ON c.action_id = r.action_id
      ${w} ORDER BY r.priority_score DESC`);
    const [s] = await q(f, `SELECT COUNT(*) recs, SUM(r.net_financial_benefit_usd) net, SUM(r.cash_benefit_usd) cash,
        SUM(r.risk_reduction_points) risk, SUM(r.workforce_effect_fte) fte
      FROM ${t('action_recommendation')} r ${w}`);
    return {
      id: 'recommendations',
      title: `Top ${rows.length} Recommended Actions by Priority`,
      kpis: [
        { label: 'Recommendations', value: count(s.recs), color: 'primary' },
        { label: 'Net Benefit', value: money(s.net), color: 'success' },
        { label: 'Cash Benefit', value: money(s.cash), color: 'warning' },
        { label: 'Risk Reduction (pts)', value: count(s.risk), color: 'neutral' },
      ],
      table: {
        headers: ['Action', 'Function', 'Scope', 'Net Benefit', 'Cost', 'Confidence', 'Priority', 'Owner', 'Days'],
        rows: rows.map((r) => [r.action_name, r.fn, r.scope_id, money(r.net), money(r.cost), frac(r.confidence, 0), dec(r.priority),
          r.owner, count(r.days)]),
        weights: [2.4, 1, 1.6, 1, 0.8, 0.9, 0.8, 1.4, 0.6],
      },
      bullets: [`Workforce effect across all recommendations: ${dec(s.fte)} FTE`],
    };
  },

  async 'action-catalog'() {
    const rows = await query(`SELECT [function] fn, COUNT(*) actions, SUM(active_flag) active, AVG(CAST(estimated_cost_usd AS float)) cost,
        SUM(expected_benefit_usd_m) benefit, AVG(CAST(time_to_impact_days AS float)) days, SUM(risk_reduction_points) risk
      FROM ${t('action_catalog')} GROUP BY [function] ORDER BY benefit DESC`);
    return {
      id: 'action-catalog',
      title: 'Action Catalog by Function',
      table: {
        headers: ['Function', 'Actions', 'Active', 'Avg Est. Cost', 'Expected Benefit', 'Avg Days to Impact', 'Risk Reduction'],
        rows: rows.map((r) => [r.fn, count(r.actions), count(r.active), money(r.cost), money(n(r.benefit) * 1e6), dec(r.days, 0), count(r.risk)]),
        weights: [1.6, 0.9, 0.8, 1.1, 1.3, 1.4, 1.2],
      },
    };
  },

  async 'scenarios'() {
    const rows = await query(`SELECT * FROM ${t('scenario_simulation')} ORDER BY recommended_flag DESC, investment_usd_m`);
    const rec = rows.find((r) => n(r.recommended_flag)) || {};
    return {
      id: 'scenarios',
      title: `Scenario Simulation (${rec.scope_id || rows[0]?.scope_id || 'n/a'})`,
      kpis: [
        { label: 'Recommended', value: rec.scenario_id || 'n/a', color: 'success' },
        { label: 'Investment', value: money(n(rec.investment_usd_m) * 1e6), color: 'primary' },
        { label: 'EBITDA Margin', value: pct(rec.ebitda_margin_pct), color: 'warning' },
        { label: '6-Month Net Cash', value: money(n(rec.six_month_net_cash_benefit_usd_m) * 1e6), color: 'neutral' },
      ],
      table: {
        headers: ['Scenario', 'Investment', 'Headcount Growth', 'EBITDA %', 'DSO', 'Attrition', 'Ctrl Risk', '6-Mo Net Cash', 'Rev. Growth', 'Execution Risk'],
        describe: false,
        rows: rows.map((r) => [`${r.scenario_id}${n(r.recommended_flag) ? ' *' : ''}`, money(n(r.investment_usd_m) * 1e6),
          pct(r.net_headcount_growth_pct), pct(r.ebitda_margin_pct), count(r.dso_days), pct(r.cohort_attrition_pct),
          count(r.control_risk_index), money(n(r.six_month_net_cash_benefit_usd_m) * 1e6), pct(r.revenue_growth_pct), r.execution_risk]),
        weights: [1.2, 1, 1.1, 0.9, 0.6, 0.9, 0.8, 1.1, 1, 2],
      },
      bullets: rec.rationale ? [`* Recommended. ${rec.rationale}`] : [],
    };
  },

  async 'constraints'() {
    const rows = await query(`SELECT * FROM ${t('decision_constraint')} ORDER BY scenario_id, constraint_name`);
    return {
      id: 'constraints',
      title: 'Decision Constraints by Scenario',
      table: {
        headers: ['Scenario', 'Constraint', 'Operator', 'Value', 'Unit', 'Mandatory'],
        describe: false,
        rows: rows.map((r) => [r.scenario_id, r.constraint_name, r.operator, r.constraint_value, r.unit, n(r.mandatory_flag) ? 'Yes' : 'No']),
        weights: [1.2, 2.4, 0.8, 0.8, 0.9, 0.9],
      },
    };
  },

  async 'data-coverage'() {
    const counts = await query(`SELECT t.name table_name, SUM(p.rows) row_count
      FROM [${APEX_DB}].sys.tables t JOIN [${APEX_DB}].sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
      GROUP BY t.name ORDER BY t.name`);
    const used = new Set(Object.values(SECTION_TABLES).flat());
    const [dates] = await query(`SELECT MIN(date) first_date, MAX(date) last_date FROM ${t('dim_date')}`);
    const [orgs] = await query(`SELECT COUNT(*) units, COUNT(DISTINCT region) regions, COUNT(DISTINCT business_unit) bus,
        COUNT(DISTINCT entity_id) entities FROM ${t('dim_organisation')}`);
    const total = counts.reduce((s, r) => s + n(r.row_count), 0);
    const day = (d) => new Date(d).toISOString().slice(0, 10);
    return {
      id: 'data-coverage',
      title: 'Data Coverage: every Apex table',
      kpis: [
        { label: 'Tables', value: count(counts.length), color: 'primary' },
        { label: 'Rows', value: count(total), color: 'success' },
        { label: 'Org Units', value: count(orgs.units), color: 'warning' },
        { label: 'Calendar Days', value: count((new Date(dates.last_date) - new Date(dates.first_date)) / 864e5 + 1), color: 'neutral' },
      ],
      table: {
        headers: ['Table', 'Rows', 'Used In Sections'],
        rows: counts.map((r) => [r.table_name, count(r.row_count),
          Object.entries(SECTION_TABLES).filter(([, tables]) => tables.includes(r.table_name)).map(([id]) => id).join(', ') || '-']),
        weights: [2.2, 0.8, 3],
      },
      bullets: [
        `Calendar (dim_date): ${day(dates.first_date)} to ${day(dates.last_date)}`,
        `Organisation: ${count(orgs.units)} units, ${count(orgs.entities)} entities, ${count(orgs.regions)} regions, ${count(orgs.bus)} business units`,
        `${counts.filter((r) => used.has(r.table_name)).length} of ${counts.length} tables feed report sections`,
      ],
    };
  },

  async 'models'() {
    const models = await query(`SELECT * FROM ${t('meta_model_registry')} ORDER BY model_id`);
    return {
      id: 'models',
      title: 'Prediction Models',
      table: {
        headers: ['Model', 'Version', 'Method', 'Training Window', 'Approved', 'Owner', 'Intended Use'],
        describe: false,
        rows: models.map((m) => [m.model_name, m.model_version, m.method,
          `${new Date(m.training_start).toISOString().slice(0, 7)} to ${new Date(m.training_end).toISOString().slice(0, 7)}`,
          n(m.approved_flag) ? 'Yes' : 'No', m.owner, m.intended_use]),
        weights: [1.6, 0.7, 1.4, 1.4, 0.7, 1.1, 2.4],
      },
    };
  },

  async 'kpi-definitions'() {
    const kpis = await query(`SELECT * FROM ${t('meta_kpi_definition')} ORDER BY kpi_name`);
    const endpoints = await query(`SELECT * FROM ${t('meta_endpoint_catalog')} ORDER BY endpoint`);
    return {
      id: 'kpi-definitions',
      title: 'KPI Definitions and Source Catalog',
      table: {
        headers: ['KPI', 'Unit', 'Definition', 'Authoritative Source'],
        describe: false,
        rows: kpis.map((k) => [k.kpi_name, k.unit, k.definition, k.authoritative_source]),
        weights: [1.3, 0.8, 3.2, 1.8],
      },
      bullets: endpoints.map((e) => `${e.endpoint}: ${e.purpose} (${e.source_tables})`),
    };
  },
};

/** Tables each section reads; drives the data coverage appendix. */
const SECTION_TABLES = {
  'scorecard': ['serving_executive_scorecard_monthly'],
  'scorecard-trend': ['serving_executive_scorecard_monthly'],
  'margin-bridge': ['serving_margin_bridge'],
  'latent-drivers': ['meta_latent_drivers_monthly', 'dim_organisation'],
  'financial-forecast': ['pred_financial_forecast'],
  'budget': ['fact_budget_forecast', 'dim_cost_center'],
  'cash': ['fact_cash_position'],
  'general-ledger': ['fact_gl_transaction', 'dim_account'],
  'manual-journals': ['fact_manual_journal'],
  'close': ['fact_reconciliation_close'],
  'sales': ['fact_sales_transaction', 'dim_product_service'],
  'discounts': ['fact_discount_approval'],
  'pipeline': ['fact_contract_pipeline'],
  'customers': ['fact_customer_monthly', 'dim_customer'],
  'customer-risk': ['pred_customer_risk', 'dim_customer'],
  'customer-service': ['fact_customer_service'],
  'receivables': ['fact_ar_invoice_payment'],
  'payables': ['fact_ap_invoice_payment'],
  'vendors': ['dim_vendor', 'fact_vendor_master_change'],
  'workforce': ['fact_employee_monthly', 'dim_employee', 'dim_organisation'],
  'hires-exits': ['fact_hire_exit'],
  'vacancies': ['fact_vacancy_recruitment'],
  'attendance': ['fact_time_attendance'],
  'engagement': ['fact_engagement_performance'],
  'learning': ['fact_learning_compensation'],
  'workforce-risk': ['pred_workforce_risk'],
  'control-risk': ['pred_control_risk'],
  'control-scorecard': ['serving_control_risk_scorecard_quarterly'],
  'control-exceptions': ['fact_control_exception'],
  'control-tests': ['fact_control_test', 'dim_risk_control'],
  'audit-findings': ['fact_audit_finding'],
  'remediation': ['fact_issue_remediation'],
  'access': ['fact_access_sod_event'],
  'recommendations': ['action_recommendation', 'action_catalog'],
  'action-catalog': ['action_catalog'],
  'scenarios': ['scenario_simulation'],
  'constraints': ['decision_constraint'],
  'data-coverage': ['dim_date', 'dim_organisation'],
  'models': ['meta_model_registry'],
  'kpi-definitions': ['meta_kpi_definition', 'meta_endpoint_catalog'],
};

/** Recommendation scope_id is "Region|Business Unit" for region-level actions. */
function scopeFilter(f, col) {
  const { region, business_unit } = f.params;
  if (region && business_unit) return [`${col} = CONCAT(@region, '|', @business_unit)`];
  if (region) return [`${col} LIKE CONCAT(@region, '|%')`];
  if (business_unit) return [`${col} LIKE CONCAT('%|', @business_unit)`];
  return [];
}

// ---- report types ----

const REPORT_TYPES = {
  'executive-summary': {
    title: 'Apex Group Executive Summary',
    subtitle: 'Performance, forecast, risk and recommended actions',
    sections: ['scorecard', 'margin-bridge', 'financial-forecast', 'customer-risk', 'workforce-risk', 'control-risk', 'recommendations', 'scenarios'],
    executive: true,
  },
  'financial-performance': {
    title: 'Apex Group Financial Performance',
    subtitle: 'Scorecard, margin bridge, forecast, budget, cash, ledger and close',
    sections: ['scorecard', 'scorecard-trend', 'margin-bridge', 'latent-drivers', 'financial-forecast', 'budget', 'cash', 'general-ledger', 'manual-journals', 'close'],
  },
  'commercial': {
    title: 'Apex Group Sales and Customers',
    subtitle: 'Sales, discounts, pipeline, customer health, risk and receivables',
    sections: ['sales', 'discounts', 'pipeline', 'customers', 'customer-risk', 'customer-service', 'receivables'],
  },
  'workforce': {
    title: 'Apex Group Workforce',
    subtitle: 'Headcount, movement, recruitment, attendance, engagement and attrition risk',
    sections: ['workforce', 'hires-exits', 'vacancies', 'attendance', 'engagement', 'learning', 'workforce-risk'],
  },
  'risk-controls': {
    title: 'Apex Group Risk and Controls',
    subtitle: 'Control risk, exceptions, testing, audit, access, payables and vendors',
    sections: ['control-risk', 'control-scorecard', 'control-exceptions', 'control-tests', 'audit-findings', 'remediation', 'access', 'manual-journals', 'payables', 'vendors'],
  },
  'recommendations': {
    title: 'Apex Group Recommendations and Scenarios',
    subtitle: 'Prioritised actions, action catalog, scenarios and constraints',
    sections: ['recommendations', 'action-catalog', 'scenarios', 'constraints'],
  },
  'full-report': {
    title: 'Apex Group Full Report',
    subtitle: 'Every Apex table: performance, finance, commercial, workforce, risk, actions',
    sections: Object.keys(SECTION_TABLES),
    executive: true,
  },
};

/** Free-text topics. Each maps words in the question to sections. */
const QUERY_TOPICS = [
  { topic: 'scorecard', re: /\bscorecard\b|\bkpis?\b|\bperformance\b|\bebitda\b|\brevenue\b|\bmargin\b|\bprofit/, sections: ['scorecard', 'scorecard-trend'] },
  { topic: 'margin', re: /\bmargin bridge\b|\bbridge\b|\bmargin\b|\bdrivers?\b/, sections: ['margin-bridge', 'latent-drivers'] },
  { topic: 'forecast', re: /\bforecast|\bprojection|\boutlook\b|\bpredict/, sections: ['financial-forecast'] },
  { topic: 'budget', re: /\bbudget|\bvariance\b|\bplan vs\b/, sections: ['budget'] },
  { topic: 'cash', re: /\bcash\b|\bliquidity\b|\btreasury\b/, sections: ['cash'] },
  { topic: 'ledger', re: /\bledger\b|\bgl\b|\bjournals?\b|\baccounting\b/, sections: ['general-ledger', 'manual-journals'] },
  { topic: 'close', re: /\bclose\b|\breconciliation/, sections: ['close'] },
  { topic: 'sales', re: /\bsales\b|\bofferings?\b|\bproducts?\b|\bchannels?\b/, sections: ['sales'] },
  { topic: 'discounts', re: /\bdiscounts?\b|\bpricing\b|\boverrides?\b/, sections: ['discounts'] },
  { topic: 'pipeline', re: /\bpipeline\b|\bcontracts?\b|\bbookings?\b|\bopportunit/, sections: ['pipeline'] },
  { topic: 'customers', re: /\bcustomers?\b|\bclients?\b|\bsegments?\b|\bchurn\b/, sections: ['customers', 'customer-risk'] },
  { topic: 'service', re: /\bservice\b|\bcases?\b|\bsla\b|\bcomplaints?\b|\bdisputes?\b/, sections: ['customer-service'] },
  { topic: 'receivables', re: /\breceivables?\b|\bar\b|\bdso\b|\bcollections?\b|\binvoices?\b|\baging\b|\bageing\b/, sections: ['receivables'] },
  { topic: 'payables', re: /\bpayables?\b|\bap\b|\bvendors?\b|\bsuppliers?\b|\bduplicate/, sections: ['payables', 'vendors'] },
  { topic: 'workforce', re: /\bworkforce\b|\bheadcount\b|\bemployees?\b|\bhr\b|\bpeople\b|\bstaff\b|\bpayroll\b/, sections: ['workforce', 'hires-exits'] },
  { topic: 'attrition', re: /\battrition\b|\bturnover\b|\bexits?\b|\bretention\b|\bhires?\b/, sections: ['hires-exits', 'workforce-risk'] },
  { topic: 'recruitment', re: /\bvacanc|\brecruit|\bhiring\b/, sections: ['vacancies'] },
  { topic: 'attendance', re: /\battendance\b|\bovertime\b|\babsence\b|\butili[sz]ation\b/, sections: ['attendance'] },
  { topic: 'engagement', re: /\bengagement\b|\bsurvey\b|\blearning\b|\btraining\b|\bcompensation\b/, sections: ['engagement', 'learning'] },
  { topic: 'controls', re: /\bcontrols?\b|\bexceptions?\b|\bcompliance\b|\bsox\b/, sections: ['control-risk', 'control-scorecard', 'control-exceptions', 'control-tests'] },
  { topic: 'audit', re: /\baudit\b|\bfindings?\b|\bremediation\b/, sections: ['audit-findings', 'remediation'] },
  { topic: 'access', re: /\baccess\b|\bsod\b|\bsegregation\b|\bprivileged\b/, sections: ['access'] },
  { topic: 'risk', re: /\brisks?\b/, sections: ['customer-risk', 'workforce-risk', 'control-risk'] },
  { topic: 'recommendations', re: /\brecommend|\bactions?\b|\bnext steps\b|\binitiatives?\b/, sections: ['recommendations', 'action-catalog'] },
  { topic: 'scenarios', re: /\bscenarios?\b|\bsimulation\b|\bwhat if\b|\bconstraints?\b|\binvestment\b/, sections: ['scenarios', 'constraints'] },
  { topic: 'metadata', re: /\bmodels?\b|\bdefinitions?\b|\bmetadata\b|\bcoverage\b|\btables?\b/, sections: ['models', 'kpi-definitions', 'data-coverage'] },
];

function normalizeReportType(raw) {
  const s = String(raw || '').toLowerCase().trim().replace(/[_\s]+/g, '-');
  if (REPORT_TYPES[s]) return s;
  const aliases = {
    executive: 'executive-summary', summary: 'executive-summary', exec: 'executive-summary',
    financial: 'financial-performance', finance: 'financial-performance',
    sales: 'commercial', customers: 'commercial', 'sales-customers': 'commercial',
    hr: 'workforce', people: 'workforce',
    risk: 'risk-controls', controls: 'risk-controls', audit: 'risk-controls',
    actions: 'recommendations', scenarios: 'recommendations',
    full: 'full-report', all: 'full-report', complete: 'full-report', everything: 'full-report',
  };
  return aliases[s] || null;
}

function analyzeQuery(text) {
  const s = String(text || '').toLowerCase();
  if (/\b(full|complete|entire|whole|all (the )?data|everything|all tables|every table)\b/.test(s)) {
    return { reportType: 'full-report', topics: ['all'], sections: REPORT_TYPES['full-report'].sections };
  }
  const matched = QUERY_TOPICS.filter((x) => x.re.test(s));
  if (!matched.length) {
    return { reportType: 'executive-summary', topics: ['executive'], sections: REPORT_TYPES['executive-summary'].sections };
  }
  const sections = [...new Set(matched.flatMap((x) => x.sections))];
  return { reportType: 'query-driven', topics: matched.map((x) => x.topic), sections };
}

function reportTitleFromQuery(text, topics) {
  const cleaned = String(text || '')
    .replace(/^(create|generate|make|give me|show me|build|prepare)\s+(an?\s+)?/i, '')
    .replace(/\b(as\s+(an?\s+)?)?(pdf|pptx|csv|powerpoint|excel|spreadsheet|report|apex( group)?)\b/gi, '')
    .replace(/^\s*(on|for|about|of)\s+/i, '')
    .replace(/^\s*the\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length >= 3 && cleaned.length <= 70) {
    return `Apex Group ${cleaned.replace(/^\w/, (c) => c.toUpperCase())} Report`;
  }
  return `Apex Group ${topics.map((x) => x.replace(/^\w/, (c) => c.toUpperCase())).join(' & ')} Report`;
}

// ---- report data ----

async function overviewKpis(f) {
  const [s] = await q(f, `SELECT SUM(revenue) revenue, SUM(ebitda) ebitda, SUM(operating_cash_flow) ocf
    FROM ${t('serving_executive_scorecard_monthly')} ${where(f, { month: 'month_id', region: 'region', bu: 'business_unit' })}`);
  const [latest] = await q(f, `SELECT SUM(headcount) headcount, AVG(dso_days) dso
    FROM ${t('serving_executive_scorecard_monthly')}
    WHERE month_id = (SELECT MAX(month_id) FROM ${t('serving_executive_scorecard_monthly')} ${where(f, { month: 'month_id' })})
    ${f.params.region ? 'AND region = @region' : ''} ${f.params.business_unit ? 'AND business_unit = @business_unit' : ''}`);
  const [cr] = await q(f, `SELECT SUM(revenue_at_risk) rar FROM ${t('pred_customer_risk')} ${where(f, { customerRegion: 'customer_id' })}`);
  const [ctl] = await q(f, `SELECT SUM(expected_monetary_exposure) exposure FROM ${t('pred_control_risk')} ${where(f, { region: 'region', entity: 'entity_id' })}`);
  return [
    { label: 'Revenue', value: money(s.revenue), color: 'primary' },
    { label: 'EBITDA Margin', value: share(s.ebitda, s.revenue), color: 'success' },
    { label: 'Op. Cash Flow', value: money(s.ocf), color: 'neutral' },
    { label: 'Headcount (latest)', value: count(latest.headcount), color: 'primary' },
    { label: 'DSO (latest)', value: dec(latest.dso), unit: 'days', color: 'warning' },
    { label: 'Revenue at Risk', value: money(cr.rar), color: 'danger' },
    { label: 'Control Exposure', value: money(ctl.exposure), color: 'danger' },
  ];
}

/** Largest risk in each domain, for the executive Top Issues page. */
async function topIssues(f) {
  const [unit] = await q(f, `SELECT TOP 1 region, business_unit, SUM(ebitda) / NULLIF(SUM(revenue), 0) * 100 margin
    FROM ${t('serving_executive_scorecard_monthly')} ${where(f, { month: 'month_id', region: 'region', bu: 'business_unit' })}
    GROUP BY region, business_unit HAVING SUM(revenue) > 0 ORDER BY margin`);
  const [cust] = await q(f, `SELECT TOP 1 c.customer_name, SUM(r.revenue_at_risk) rar FROM ${t('pred_customer_risk')} r
    JOIN ${t('dim_customer')} c ON c.customer_id = r.customer_id ${where(f, { customerRegion: 'r.customer_id' })}
    GROUP BY c.customer_name ORDER BY rar DESC`);
  const [ctl] = await q(f, `SELECT TOP 1 process, SUM(expected_monetary_exposure) exposure FROM ${t('pred_control_risk')}
    ${where(f, { region: 'region', entity: 'entity_id' })} GROUP BY process ORDER BY exposure DESC`);
  const [wf] = await q(f, `SELECT TOP 1 role_cohort, SUM(expected_exits) exits, SUM(revenue_or_service_impact_usd) impact
    FROM ${t('pred_workforce_risk')} ${where(f, { region: 'region', bu: 'business_unit' })} GROUP BY role_cohort ORDER BY impact DESC`);
  const [ar] = await q(f, `SELECT SUM(outstanding_amount) overdue FROM ${t('fact_ar_invoice_payment')}
    ${where(f, { date: 'invoice_date', org: 'org_unit_id', extra: ['days_past_due > 90', 'outstanding_amount > 0'] })}`);
  return [
    unit && { title: `Lowest EBITDA margin: ${unit.region} ${unit.business_unit}`, impact: `${pct(unit.margin)} EBITDA margin over the period` },
    cust && { title: `Largest customer at risk: ${cust.customer_name}`, impact: `${money(cust.rar)} revenue at risk over 6 months` },
    ctl && { title: `Highest control exposure: ${ctl.process}`, impact: `${money(ctl.exposure)} expected monetary exposure` },
    wf && { title: `Attrition risk: ${wf.role_cohort}`, impact: `${dec(wf.exits)} expected exits, ${money(wf.impact)} revenue/service impact` },
    ar && n(ar.overdue) > 0 && { title: 'Receivables over 90 days past due', impact: `${money(ar.overdue)} outstanding` },
  ].filter(Boolean);
}

async function recommendedActions(f) {
  const rows = await q(f, `SELECT TOP 5 c.action_name, r.scope_id, r.net_financial_benefit_usd net, r.accountable_owner_role owner,
      r.time_to_impact_days days
    FROM ${t('action_recommendation')} r LEFT JOIN ${t('action_catalog')} c ON c.action_id = r.action_id
    ${where(f, { extra: scopeFilter(f, 'r.scope_id') })} ORDER BY r.priority_score DESC`);
  return rows.map((r) => ({
    action: `${r.action_name} (${r.scope_id}): ${money(r.net)} net benefit, owner ${r.owner}, impact in ${count(r.days)} days`,
  }));
}

/** What each section measures, shown under its heading in the PDF. */
const ABOUT = {
  'scorecard': 'Prepared monthly scorecard totals for each region and business unit over the period. EBITDA % is EBITDA over revenue.',
  'scorecard-trend': 'Company totals for each scorecard month: revenue, profit, people, receivables and control exceptions.',
  'margin-bridge': 'How the EBITDA margin moved from the start to the end of the comparison period, one driver at a time.',
  'latent-drivers': 'Modelled performance indexes averaged by business unit; 1.00 is the baseline and higher demand or control maturity is better.',
  'financial-forecast': 'Six-month model forecast of revenue, EBITDA and cash under each planning scenario, with the forecast range.',
  'budget': 'Budget, forecast and actual amounts by plan version and account category.',
  'cash': 'Cash inflows and outflows over the period and the latest closing balance for each legal entity.',
  'general-ledger': 'Journal lines posted to the general ledger, by financial statement and account category.',
  'manual-journals': 'Manual journal entries ranked by risk score, with the red flags that drive the score.',
  'close': 'Month-end close and reconciliation tasks: lateness, adjustments and reconciliation exceptions.',
  'sales': 'Net revenue, gross margin and discount for each product or service offering.',
  'discounts': 'Discount requests against policy limits, and how many were overridden.',
  'pipeline': 'Open and closed contract opportunities by stage; weighted value is booking value times win probability.',
  'customers': 'Monthly customer health by segment: revenue, margin, payment days, disputes and service.',
  'customer-risk': 'Model forecast of churn and late payment, grouped by risk band.',
  'customer-risk-top': 'Individual customers with the most revenue at risk over the forecast horizon.',
  'customer-service': 'Customer service cases by type, with SLA breaches, disputes and credit notes.',
  'receivables': 'Outstanding customer invoices by days past due.',
  'payables': 'Supplier invoices by status, with payment-control red flags.',
  'vendors': 'The vendor master by category, criticality, risk rating and approval status.',
  'vendor-changes': 'Changes to vendor master data such as bank details, with the flags that suggest payment fraud risk.',
  'workforce': 'Employees in the latest month of the period, by business unit.',
  'hires-exits': 'Hires, exits and internal transfers, with exit reasons.',
  'vacancies': 'Open and filled vacancies, time to fill and recruitment cost.',
  'attendance': 'Scheduled, worked, overtime and absence hours by business unit.',
  'engagement': 'Engagement survey scores by performance band.',
  'learning': 'Learning, certification and pay events, with hours and pay change.',
  'workforce-risk': 'Model forecast of attrition by role cohort, with the capacity gap and the revenue or service impact.',
  'control-risk': 'Model forecast of material control exceptions by process.',
  'control-risk-top': 'Entity and process pairs with the highest expected exception exposure.',
  'control-scorecard': 'Quarterly control exceptions, high-risk and repeat exceptions, and monetary exposure.',
  'control-exceptions': 'Control exceptions raised in the period, by type.',
  'control-tests': 'Control tests performed in the period by process, and how many found the control effective.',
  'audit-findings': 'Internal audit findings by severity, with monetary exposure.',
  'remediation': 'Actions raised to fix audit findings, and how many are overdue.',
  'access': 'System access events and segregation-of-duties conflicts.',
  'recommendations': 'Recommended actions ranked by priority score, with expected benefit and cost.',
  'action-catalog': 'The library of actions the recommendation engine can choose from, by function.',
  'scenarios': 'Outcomes of each investment scenario; the asterisk marks the recommended one.',
  'constraints': 'Limits each scenario has to respect.',
  'data-coverage': 'Every table in the Apex database, its row count, and the report sections that use it.',
  'models': 'The prediction models behind the forecast and risk sections.',
  'kpi-definitions': 'How each headline KPI is defined, and which source is authoritative.',
};

/** Company-level sections with no org unit, region or customer to filter on. */
const UNSCOPED = new Set(['margin-bridge', 'action-catalog', 'scenarios', 'constraints', 'data-coverage', 'models', 'kpi-definitions']);

async function buildReportData({ title, subtitle, sections, topics, executive }, f) {
  const built = await Promise.all(sections.map(async (id) => {
    const out = [].concat(await SECTIONS[id](f));
    for (const sec of out) {
      sec.about = ABOUT[sec.id];
      sec.sources = SECTION_TABLES[id];
    }
    if (UNSCOPED.has(id) && (f.region || f.business_unit)) {
      for (const sec of out) sec.bullets = [...(sec.bullets || []), 'Company-level data: not filtered by region or business unit.'];
    }
    return out;
  }));
  const [kpis, issues, actions] = await Promise.all([
    overviewKpis(f),
    executive ? topIssues(f) : [],
    recommendedActions(f),
  ]);
  return {
    brand: BRAND,
    title,
    subtitle,
    topics,
    kpis,
    sections: built.flat(),
    top_issues: issues,
    recommended_actions: actions,
    is_executive: Boolean(executive),
    empty_hint: 'No Apex data matched this request. Try a topic such as revenue, forecast, customers, workforce, controls or recommendations.',
  };
}

// ---- full-table CSV export ----

/** Stream every row of one Apex table (with its filters) to a CSV file. */
async function exportTable(tableKey, reqQuery) {
  const spec = TABLES[tableKey];
  const filters = tableFilters(spec, reqQuery, {});
  if (filters.error) return { error: filters.error };

  const filename = `apex-table-${tableKey}_${Date.now()}.csv`;
  const filepath = path.join(reportsDir, filename);
  const out = fs.createWriteStream(filepath);

  const pool = await getPool();
  const request = pool.request();
  request.stream = true;
  for (const [k, v] of Object.entries(filters.params)) request.input(k, v);

  let rows = 0;
  try {
    await new Promise((resolve, reject) => {
      out.on('error', reject);
      out.write('﻿');
      let columns = null;
      request.on('recordset', (cols) => {
        columns = Object.keys(cols);
        out.write(csvLine(columns));
      });
      request.on('row', (row) => {
        rows += 1;
        if (!out.write(csvLine(columns.map((c) => row[c])))) {
          request.pause();
          out.once('drain', () => request.resume());
        }
      });
      request.on('error', reject);
      request.on('done', resolve);
      request.query(`SELECT * FROM [${APEX_DB}].dbo.[${spec.table}] ${filters.clauses.length ? 'WHERE ' + filters.clauses.join(' AND ') : ''}
        ORDER BY [${spec.orderBy}] ${spec.orderDir}`);
    });
    await new Promise((resolve, reject) => out.end((err) => (err ? reject(err) : resolve())));
  } catch (err) {
    // Never leave a partial CSV behind a download link.
    out.destroy();
    await fs.promises.unlink(filepath).catch(() => {});
    throw err;
  }
  return { filename, rows, table: spec.table };
}

// ---- handlers ----

function reportFormat(value) {
  const format = (strParam(value) || 'pptx').toLowerCase();
  return FORMATS.includes(format) ? format : null;
}

function requestFilters(src, format) {
  return buildFilters({
    detail: format !== 'pptx',
    from: dateParam(src.from),
    to: dateParam(src.to),
    region: strParam(src.region),
    business_unit: strParam(src.business_unit),
  });
}

function publicFilters(f) {
  return { from: f.from, to: f.to, region: f.region, business_unit: f.business_unit };
}

async function generateReport(req, res) {
  try {
    const tableKey = strParam(req.query.table);
    const rawType = strParam(req.query.report_type);
    const exporting = rawType === 'table-export' || (tableKey && !rawType);
    if (tableKey && !exporting) {
      return res.status(400).json({ success: false, error: 'table is only used with report_type=table-export' });
    }
    const format = exporting && !strParam(req.query.format) ? 'csv' : reportFormat(req.query.format);
    if (!format) return res.status(400).json({ success: false, error: `format must be one of ${FORMATS.join(', ')}` });

    if (exporting) {
      if (!tableKey || !TABLES[tableKey]) {
        return res.status(400).json({ success: false, error: 'table must be one of: ' + Object.keys(TABLES).join(', ') });
      }
      if (format !== 'csv') {
        return res.status(400).json({ success: false, error: 'table-export only supports format=csv' });
      }
      const result = await exportTable(tableKey, req.query);
      if (result.error) return res.status(400).json({ success: false, error: result.error });
      return res.json({
        success: true,
        report_type: 'table-export',
        table: result.table,
        rows: result.rows,
        format,
        filename: result.filename,
        download_url: downloadUrl(req, result.filename),
        message: `Exported all ${result.rows} matching rows of ${result.table} to CSV. Use download_url to download.`,
      });
    }

    const reportType = normalizeReportType(rawType);
    if (!reportType) {
      return res.status(400).json({
        success: false,
        error: `report_type must be one of ${[...Object.keys(REPORT_TYPES), 'table-export'].join(', ')}`,
      });
    }

    const f = requestFilters(req.query, format);
    const spec = REPORT_TYPES[reportType];
    const data = await buildReportData({ ...spec, topics: [reportType] }, f);
    const filename = await writeReport({
      prefix: 'apex',
      format,
      reportType: 'query-driven',
      data,
      filters: publicFilters(f),
      slug: reportType,
    });

    res.json({
      success: true,
      report_type: reportType,
      title: data.title,
      sections: data.sections.map((s) => s.title),
      format,
      filename,
      download_url: downloadUrl(req, filename),
      message: `Apex Group report generated with ${data.sections.length} sections. Use download_url to download.`,
    });
  } catch (err) {
    console.error('Apex report generation error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function generateReportQuery(req, res) {
  try {
    const src = { ...req.query, ...req.body };
    const userQuery = strParam(src.query);
    const format = reportFormat(src.format);
    if (!userQuery) return res.status(400).json({ success: false, error: 'query parameter required' });
    if (!format) return res.status(400).json({ success: false, error: `format must be one of ${FORMATS.join(', ')}` });

    const plan = analyzeQuery(userQuery);
    const fixed = REPORT_TYPES[plan.reportType];
    const title = fixed ? fixed.title : reportTitleFromQuery(userQuery, plan.topics);
    const f = requestFilters(src, format);
    const data = await buildReportData({
      title,
      subtitle: fixed ? fixed.subtitle : undefined,
      sections: plan.sections,
      topics: plan.topics,
      executive: fixed ? fixed.executive : false,
    }, f);
    const slug = fixed ? plan.reportType : title.toLowerCase().replace(/^apex group /, '').replace(/\breport\b/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'custom';
    const filename = await writeReport({
      prefix: 'apex',
      format,
      reportType: 'query-driven',
      data,
      filters: { ...publicFilters(f), query: userQuery },
      slug,
    });

    res.json({
      success: true,
      query: userQuery,
      title: data.title,
      report_type: 'query-driven',
      matched_template: plan.reportType,
      topics: plan.topics,
      sections: data.sections.map((s) => s.title),
      format,
      filename,
      download_url: downloadUrl(req, filename),
      message: `Apex Group report built for topics: ${plan.topics.join(', ')}. Use download_url to download.`,
    });
  } catch (err) {
    console.error('Apex query report generation error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  REPORT_TYPES,
  SECTIONS,
  SECTION_TABLES,
  generateReport,
  generateReportQuery,
};
