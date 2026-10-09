/**
 * Apex Group API routes.
 * Reads apex_agent_demo on the same SQL Server as sales and manufacturing.
 * Prepared scorecard and prediction tables are returned in full enough for an
 * answer. Transaction tables stay capped and include a total.
 */

require('dotenv').config();
const { query } = require('./db');
const { intParam, strParam, dateParam, addFilter, whereSql } = require('./queryParams');

const APEX_DB = process.env.DB_NAME_APEX || 'apex_agent_demo';

function table(name) {
  return `[${APEX_DB}].dbo.[${name}]`;
}

function flagParam(value) {
  const s = strParam(value);
  if (s == null) return null;
  if (s === '1' || s.toLowerCase() === 'true') return 1;
  if (s === '0' || s.toLowerCase() === 'false') return 0;
  return null;
}

function fail(res, err) {
  res.status(500).json({ success: false, error: err.message });
}

async function getExecutiveScorecard(req, res) {
  try {
    const limit = intParam(req.query.limit, 1000, 1, 2000);
    const params = { limit };
    const clauses = [];
    addFilter(clauses, params, 'region', 'region = @region', strParam(req.query.region));
    addFilter(clauses, params, 'business_unit', 'business_unit = @business_unit', strParam(req.query.business_unit));
    addFilter(clauses, params, 'scope_id', 'scope_id = @scope_id', strParam(req.query.scope_id));
    const fromDate = dateParam(req.query.from);
    const toDate = dateParam(req.query.to);
    if (fromDate) addFilter(clauses, params, 'from_date', 'as_of_date >= @from_date', fromDate);
    if (toDate) addFilter(clauses, params, 'to_date', 'as_of_date <= @to_date', toDate);

    const data = await query(
      `SELECT TOP (@limit) * FROM ${table('serving_executive_scorecard_monthly')}
       ${whereSql(clauses)}
       ORDER BY as_of_date DESC, region, business_unit`,
      params
    );
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    fail(res, err);
  }
}

async function getPerformanceDrivers(req, res) {
  try {
    const limit = intParam(req.query.limit, 500, 1, 2000);
    const params = { limit };
    const clauses = [];
    addFilter(clauses, params, 'org_unit_id', 'org_unit_id = @org_unit_id', strParam(req.query.org_unit_id));
    const fromDate = dateParam(req.query.from);
    const toDate = dateParam(req.query.to);
    if (fromDate) addFilter(clauses, params, 'from_date', 'month_start >= @from_date', fromDate);
    if (toDate) addFilter(clauses, params, 'to_date', 'month_start <= @to_date', toDate);

    const bridge = await query(
      `SELECT * FROM ${table('serving_margin_bridge')} ORDER BY sequence`
    );
    const drivers = await query(
      `SELECT TOP (@limit) * FROM ${table('meta_latent_drivers_monthly')}
       ${whereSql(clauses)}
       ORDER BY month_start DESC, org_unit_id`,
      params
    );
    res.json({
      success: true,
      count: bridge.length + drivers.length,
      data: { bridge, drivers }
    });
  } catch (err) {
    fail(res, err);
  }
}

async function getCustomerRisk(req, res) {
  try {
    const limit = intParam(req.query.limit, 100, 1, 1000);
    const params = { limit };
    const clauses = [];
    addFilter(clauses, params, 'risk_band', 'risk_band = @risk_band', strParam(req.query.risk_band));
    addFilter(clauses, params, 'customer_id', 'customer_id = @customer_id', strParam(req.query.customer_id));
    const fromDate = dateParam(req.query.from);
    const toDate = dateParam(req.query.to);
    if (fromDate) addFilter(clauses, params, 'from_date', 'forecast_month >= @from_date', fromDate);
    if (toDate) addFilter(clauses, params, 'to_date', 'forecast_month <= @to_date', toDate);

    const data = await query(
      `SELECT TOP (@limit) * FROM ${table('pred_customer_risk')}
       ${whereSql(clauses)}
       ORDER BY revenue_at_risk DESC`,
      params
    );
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    fail(res, err);
  }
}

async function getFinancialForecast(req, res) {
  try {
    const limit = intParam(req.query.limit, 200, 1, 1000);
    const params = { limit };
    const clauses = [];
    addFilter(clauses, params, 'scenario_id', 'scenario_id = @scenario_id', strParam(req.query.scenario_id));
    addFilter(clauses, params, 'region', 'region = @region', strParam(req.query.region));
    addFilter(clauses, params, 'business_unit', 'business_unit = @business_unit', strParam(req.query.business_unit));
    addFilter(clauses, params, 'org_unit_id', 'org_unit_id = @org_unit_id', strParam(req.query.org_unit_id));
    const fromDate = dateParam(req.query.from);
    const toDate = dateParam(req.query.to);
    if (fromDate) addFilter(clauses, params, 'from_date', 'forecast_month >= @from_date', fromDate);
    if (toDate) addFilter(clauses, params, 'to_date', 'forecast_month <= @to_date', toDate);

    const data = await query(
      `SELECT TOP (@limit) * FROM ${table('pred_financial_forecast')}
       ${whereSql(clauses)}
       ORDER BY forecast_month DESC, region, business_unit`,
      params
    );
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    fail(res, err);
  }
}

async function getWorkforceRisk(req, res) {
  try {
    const limit = intParam(req.query.limit, 200, 1, 1000);
    const params = { limit };
    const clauses = [];
    addFilter(clauses, params, 'region', 'region = @region', strParam(req.query.region));
    addFilter(clauses, params, 'business_unit', 'business_unit = @business_unit', strParam(req.query.business_unit));
    addFilter(clauses, params, 'risk_band', 'risk_band = @risk_band', strParam(req.query.risk_band));
    addFilter(clauses, params, 'role_cohort', 'role_cohort = @role_cohort', strParam(req.query.role_cohort));

    const data = await query(
      `SELECT TOP (@limit) * FROM ${table('pred_workforce_risk')}
       ${whereSql(clauses)}
       ORDER BY attrition_probability DESC`,
      params
    );
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    fail(res, err);
  }
}

async function getControlRisk(req, res) {
  try {
    const limit = intParam(req.query.limit, 320, 1, 1000);
    const params = { limit };
    const clauses = [];
    addFilter(clauses, params, 'region', 'region = @region', strParam(req.query.region));
    addFilter(clauses, params, 'process', 'process = @process', strParam(req.query.process));
    addFilter(clauses, params, 'risk_band', 'risk_band = @risk_band', strParam(req.query.risk_band));

    const data = await query(
      `SELECT TOP (@limit) * FROM ${table('pred_control_risk')}
       ${whereSql(clauses)}
       ORDER BY expected_monetary_exposure DESC`,
      params
    );
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    fail(res, err);
  }
}

async function getRecommendations(req, res) {
  try {
    const limit = intParam(req.query.limit, 100, 1, 1000);
    const params = { limit };
    const clauses = [];
    addFilter(clauses, params, 'action_id', 'r.action_id = @action_id', strParam(req.query.action_id));
    addFilter(clauses, params, 'scope_id', 'r.scope_id = @scope_id', strParam(req.query.scope_id));

    const data = await query(
      `SELECT TOP (@limit)
         r.*,
         c.action_name,
         c.[function] AS action_function,
         c.implementation_effort,
         c.dependencies,
         c.exclusions
       FROM ${table('action_recommendation')} r
       LEFT JOIN ${table('action_catalog')} c ON c.action_id = r.action_id
       ${whereSql(clauses)}
       ORDER BY r.priority_score DESC`,
      params
    );
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    fail(res, err);
  }
}

async function getScenarioSimulation(req, res) {
  try {
    const scenarios = await query(
      `SELECT * FROM ${table('scenario_simulation')} ORDER BY recommended_flag DESC, scenario_id`
    );
    const constraints = await query(
      `SELECT * FROM ${table('decision_constraint')} ORDER BY scenario_id, constraint_name`
    );
    res.json({
      success: true,
      count: scenarios.length,
      data: { scenarios, constraints }
    });
  } catch (err) {
    fail(res, err);
  }
}

async function getGeneralLedger(req, res) {
  try {
    const limit = intParam(req.query.limit, 100, 1, 1000);
    const params = { limit };
    const clauses = [];
    addFilter(clauses, params, 'org_unit_id', 'org_unit_id = @org_unit_id', strParam(req.query.org_unit_id));
    addFilter(clauses, params, 'account_id', 'account_id = @account_id', strParam(req.query.account_id));
    const manual = flagParam(req.query.manual);
    if (manual != null) addFilter(clauses, params, 'manual_flag', 'manual_flag = @manual_flag', manual);
    const fromDate = dateParam(req.query.from);
    const toDate = dateParam(req.query.to);
    if (fromDate) addFilter(clauses, params, 'from_date', 'posting_date >= @from_date', fromDate);
    if (toDate) addFilter(clauses, params, 'to_date', 'posting_date <= @to_date', toDate);
    const where = whereSql(clauses);

    const summaryRows = await query(
      `SELECT COUNT(*) AS journal_lines,
              SUM(debit) AS total_debit,
              SUM(credit) AS total_credit,
              SUM(CASE WHEN manual_flag = 1 THEN 1 ELSE 0 END) AS manual_lines
       FROM ${table('fact_gl_transaction')}
       ${where}`,
      params
    );
    const data = await query(
      `SELECT TOP (@limit) * FROM ${table('fact_gl_transaction')}
       ${where}
       ORDER BY posting_date DESC, journal_id`,
      params
    );
    res.json({ success: true, count: data.length, summary: summaryRows[0] || {}, data });
  } catch (err) {
    fail(res, err);
  }
}

async function getReceivables(req, res) {
  try {
    const limit = intParam(req.query.limit, 100, 1, 1000);
    const params = { limit };
    const clauses = [];
    addFilter(clauses, params, 'customer_id', 'customer_id = @customer_id', strParam(req.query.customer_id));
    addFilter(clauses, params, 'collection_status', 'collection_status = @collection_status', strParam(req.query.collection_status));
    const dispute = flagParam(req.query.dispute);
    if (dispute != null) addFilter(clauses, params, 'dispute_flag', 'dispute_flag = @dispute_flag', dispute);
    const fromDate = dateParam(req.query.from);
    const toDate = dateParam(req.query.to);
    if (fromDate) addFilter(clauses, params, 'from_date', 'invoice_date >= @from_date', fromDate);
    if (toDate) addFilter(clauses, params, 'to_date', 'invoice_date <= @to_date', toDate);
    const where = whereSql(clauses);

    const summaryRows = await query(
      `SELECT COUNT(*) AS invoices,
              SUM(outstanding_amount) AS outstanding_amount,
              SUM(CASE WHEN dispute_flag = 1 THEN 1 ELSE 0 END) AS disputed_invoices,
              AVG(CAST(days_past_due AS float)) AS avg_days_past_due
       FROM ${table('fact_ar_invoice_payment')}
       ${where}`,
      params
    );
    const data = await query(
      `SELECT TOP (@limit) * FROM ${table('fact_ar_invoice_payment')}
       ${where}
       ORDER BY days_past_due DESC, outstanding_amount DESC`,
      params
    );
    res.json({ success: true, count: data.length, summary: summaryRows[0] || {}, data });
  } catch (err) {
    fail(res, err);
  }
}

async function getWorkforce(req, res) {
  try {
    const limit = intParam(req.query.limit, 50, 1, 500);
    const params = { limit };
    const org = strParam(req.query.org_unit_id);
    if (org) params.org_unit_id = org;
    const orgEmployees = org ? 'AND org_unit_id = @org_unit_id' : '';
    const orgPlain = org ? 'AND e.org_unit_id = @org_unit_id' : '';

    const latest = await query(
      `SELECT MAX(month_id) AS latest_month_id FROM ${table('fact_employee_monthly')}`
    );
    const latestMonth = latest[0] && latest[0].latest_month_id;
    params.latest_month_id = latestMonth;

    const summaryRows = await query(
      `SELECT
         (SELECT COUNT(*) FROM ${table('fact_employee_monthly')}
           WHERE month_id = @latest_month_id ${orgEmployees}) AS employees_latest_month,
         (SELECT COUNT(*) FROM ${table('fact_hire_exit')} WHERE 1 = 1 ${org ? 'AND (previous_org_unit_id = @org_unit_id OR new_org_unit_id = @org_unit_id)' : ''}) AS movements,
         (SELECT COUNT(*) FROM ${table('fact_vacancy_recruitment')} WHERE 1 = 1 ${orgEmployees}) AS vacancies,
         (SELECT AVG(utilisation_pct) FROM ${table('fact_time_attendance')}
           WHERE month_id = @latest_month_id ${orgEmployees}) AS avg_utilisation_pct`,
      params
    );
    const employees = await query(
      `SELECT TOP (@limit) * FROM ${table('fact_employee_monthly')} e
       WHERE e.month_id = @latest_month_id ${orgPlain}
       ORDER BY e.critical_role_flag DESC, e.engagement_score`,
      params
    );
    const movements = await query(
      `SELECT TOP (@limit) * FROM ${table('fact_hire_exit')}
       ${org ? 'WHERE previous_org_unit_id = @org_unit_id OR new_org_unit_id = @org_unit_id' : ''}
       ORDER BY event_date DESC`,
      params
    );
    const vacancies = await query(
      `SELECT TOP (@limit) * FROM ${table('fact_vacancy_recruitment')}
       ${org ? 'WHERE org_unit_id = @org_unit_id' : ''}
       ORDER BY open_date DESC`,
      params
    );
    const attendance = await query(
      `SELECT TOP (@limit) * FROM ${table('fact_time_attendance')}
       WHERE month_id = @latest_month_id ${orgEmployees}
       ORDER BY absence_hours DESC`,
      params
    );
    res.json({
      success: true,
      count: employees.length,
      summary: Object.assign({ latest_month_id: latestMonth }, summaryRows[0] || {}),
      data: { employees, movements, vacancies, attendance }
    });
  } catch (err) {
    fail(res, err);
  }
}

async function getAuditExceptions(req, res) {
  try {
    const limit = intParam(req.query.limit, 50, 1, 500);
    const params = { limit };
    const clauses = [];
    addFilter(clauses, params, 'org_unit_id', 'org_unit_id = @org_unit_id', strParam(req.query.org_unit_id));
    addFilter(clauses, params, 'severity', 'severity = @severity', strParam(req.query.severity));
    addFilter(clauses, params, 'status', 'status = @status', strParam(req.query.status));
    const where = whereSql(clauses);
    const testClauses = [];
    if (params.org_unit_id) testClauses.push('org_unit_id = @org_unit_id');
    const testWhere = whereSql(testClauses);

    const summaryRows = await query(
      `SELECT
         (SELECT COUNT(*) FROM ${table('fact_control_exception')} ${where}) AS exceptions,
         (SELECT COUNT(*) FROM ${table('fact_audit_finding')} ${where}) AS findings,
         (SELECT COUNT(*) FROM ${table('fact_issue_remediation')} ${params.status ? 'WHERE status = @status' : ''}) AS remediations,
         (SELECT SUM(monetary_exposure) FROM ${table('fact_control_exception')} ${where}) AS exception_exposure`,
      params
    );
    const exceptions = await query(
      `SELECT TOP (@limit) * FROM ${table('fact_control_exception')}
       ${where}
       ORDER BY exception_date DESC, monetary_exposure DESC`,
      params
    );
    const findings = await query(
      `SELECT TOP (@limit) * FROM ${table('fact_audit_finding')}
       ${where}
       ORDER BY issue_date DESC, monetary_exposure DESC`,
      params
    );
    const tests = await query(
      `SELECT TOP (@limit) * FROM ${table('fact_control_test')}
       ${testWhere}
       ORDER BY test_date DESC`,
      params
    );
    const remediations = await query(
      `SELECT TOP (@limit) * FROM ${table('fact_issue_remediation')}
       ${params.status ? 'WHERE status = @status' : ''}
       ORDER BY target_date`,
      params
    );
    res.json({
      success: true,
      count: exceptions.length,
      summary: summaryRows[0] || {},
      data: { tests, exceptions, findings, remediations }
    });
  } catch (err) {
    fail(res, err);
  }
}

module.exports = {
  getExecutiveScorecard,
  getPerformanceDrivers,
  getCustomerRisk,
  getFinancialForecast,
  getWorkforceRisk,
  getControlRisk,
  getRecommendations,
  getScenarioSimulation,
  getGeneralLedger,
  getReceivables,
  getWorkforce,
  getAuditExceptions
};
