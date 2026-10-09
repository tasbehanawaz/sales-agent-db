/**
 * One list endpoint per Apex table.
 * Filters and sort columns come from the whitelist in apex-table-catalog.js.
 */

require('dotenv').config();
const { query } = require('./db');
const { intParam, strParam, dateParam, addFilter, whereSql } = require('./queryParams');
const { TABLES } = require('./apex-table-catalog');

const APEX_DB = process.env.DB_NAME_APEX || 'apex_agent_demo';

function flagParam(value) {
  const s = strParam(value);
  if (s == null) return null;
  if (s === '1' || s.toLowerCase() === 'true') return 1;
  if (s === '0' || s.toLowerCase() === 'false') return 0;
  return null;
}

function listTables(req, res) {
  const data = Object.entries(TABLES).map(([key, table]) => ({
    endpoint: '/api/apex/tables/' + key,
    table: table.table,
    rows: table.rows,
    date_filter: table.dateColumn,
    filters: table.filters.map((f) => f.param)
  }));
  res.json({ success: true, count: data.length, data });
}

function handler(key) {
  const spec = TABLES[key];
  return async function getTable(req, res) {
    try {
      const limit = intParam(req.query.limit, spec.defaultLimit, 1, spec.maxLimit);
      const params = { limit };
      const clauses = [];

      if (spec.dateColumn) {
        const fromDate = dateParam(req.query.from);
        const toDate = dateParam(req.query.to);
        if (fromDate) addFilter(clauses, params, 'from_date', `CAST([${spec.dateColumn}] AS date) >= @from_date`, fromDate);
        if (toDate) addFilter(clauses, params, 'to_date', `CAST([${spec.dateColumn}] AS date) <= @to_date`, toDate);
      }

      for (const filter of spec.filters) {
        const column = `[${filter.column}]`;
        if (filter.kind === 'flag') {
          const value = flagParam(req.query[filter.param]);
          if (value == null && strParam(req.query[filter.param])) {
            return res.status(400).json({ success: false, error: filter.param + ' must be 0 or 1' });
          }
          if (value != null) addFilter(clauses, params, filter.param, column + ' = @' + filter.param, value);
        } else if (filter.kind === 'int') {
          const raw = strParam(req.query[filter.param]);
          if (raw == null) continue;
          const value = parseInt(raw, 10);
          if (Number.isNaN(value)) {
            return res.status(400).json({ success: false, error: filter.param + ' must be an integer' });
          }
          addFilter(clauses, params, filter.param, column + ' = @' + filter.param, value);
        } else if (filter.kind === 'date-from' || filter.kind === 'date-to') {
          const value = dateParam(req.query[filter.param]);
          if (!value && strParam(req.query[filter.param])) {
            return res.status(400).json({ success: false, error: filter.param + ' must be YYYY-MM-DD' });
          }
          if (!value) continue;
          const op = filter.kind === 'date-from' ? '>=' : '<=';
          addFilter(clauses, params, filter.param, 'CAST(' + column + ' AS date) ' + op + ' @' + filter.param, value);
        } else {
          addFilter(clauses, params, filter.param, column + ' = @' + filter.param, strParam(req.query[filter.param]));
        }
      }

      const data = await query(
        `SELECT TOP (@limit) * FROM [${APEX_DB}].dbo.[${spec.table}]
         ${whereSql(clauses)}
         ORDER BY [${spec.orderBy}] ${spec.orderDir}`,
        params
      );
      res.json({
        success: true,
        count: data.length,
        table: spec.table,
        rows_in_database: spec.rows,
        data
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  };
}

module.exports = { TABLES, listTables, handler };
