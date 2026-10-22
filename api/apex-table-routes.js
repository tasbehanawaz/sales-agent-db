/**
 * One list endpoint per Apex table.
 * Filters, columns and sort columns come from the whitelist in apex-table-catalog.js.
 * With group_by or metrics the endpoint returns totals computed in SQL instead of rows,
 * so an agent never has to add up thousands of rows itself.
 */

require('dotenv').config();
const { query } = require('./db');
const { intParam, strParam, dateParam, monthId, dateId, quarterId, addFilter, whereSql } = require('./queryParams');
const { TABLES } = require('./apex-table-catalog');

const APEX_DB = process.env.DB_NAME_APEX || 'apex_agent_demo';
const AGGREGATE_LIMIT = 1000;

function source(name) {
  return `[${APEX_DB}].dbo.[${name}]`;
}

// Period columns are a date, a month_id (YYYYMM), a date_id (YYYYMMDD) or a quarter_id (2026Q3).
// from/to are converted to the column's own key, and month/quarter/year group on it.
const PERIODS = {
  date: {
    range: (c) => `CAST(${c} AS date)`,
    bound: (d) => d,
    month: (c) => `CONVERT(char(7), ${c}, 120)`,
    quarter: (c) => `CONCAT(YEAR(${c}), 'Q', DATEPART(quarter, ${c}))`,
    year: (c) => `YEAR(${c})`,
  },
  month: {
    range: (c) => c,
    bound: monthId,
    month: (c) => `STUFF(CAST(${c} AS char(6)), 5, 0, '-')`,
    quarter: (c) => `CONCAT(${c} / 100, 'Q', (${c} % 100 + 2) / 3)`,
    year: (c) => `${c} / 100`,
  },
  dateId: {
    range: (c) => c,
    bound: dateId,
    month: (c) => `STUFF(CAST(${c} / 100 AS char(6)), 5, 0, '-')`,
    quarter: (c) => `CONCAT(${c} / 10000, 'Q', (${c} / 100 % 100 + 2) / 3)`,
    year: (c) => `${c} / 10000`,
  },
  quarter: {
    range: (c) => c,
    bound: quarterId,
    quarter: (c) => c,
    year: (c) => `LEFT(${c}, 4)`,
  },
};

function period(spec) {
  return spec.dateColumn ? PERIODS[spec.dateKind || 'date'] : null;
}

// Business unit, region, entity and department come from dim_organisation, through
// org_unit_id or entity_id. A column the table already has is used directly instead.
function organisation(spec) {
  const own = spec.columns;
  if (spec.table === 'dim_organisation') return { names: [], join: '' };
  if (own.org_unit_id) {
    return {
      names: ['business_unit', 'region', 'entity', 'department'].filter((n) => !own[n]),
      join: `LEFT JOIN ${source('dim_organisation')} o ON o.org_unit_id = t.org_unit_id`,
    };
  }
  if (own.entity_id) {
    return {
      names: ['entity', 'region'].filter((n) => !own[n]),
      join: `LEFT JOIN (SELECT DISTINCT entity_id, entity, region FROM ${source('dim_organisation')}) o ON o.entity_id = t.entity_id`,
    };
  }
  return { names: [], join: '' };
}

function flagParam(value) {
  const s = strParam(value);
  if (s == null) return null;
  if (s === '1' || s.toLowerCase() === 'true') return 1;
  if (s === '0' || s.toLowerCase() === 'false') return 0;
  return null;
}

function listTables(req, res) {
  const data = Object.entries(TABLES).map(([key, table]) => {
    const org = organisation(table);
    const columns = Object.entries(table.columns);
    return {
      endpoint: '/api/apex/tables/' + key,
      table: key,
      rows: table.rows,
      date_filter: table.dateColumn,
      filters: [...table.filters.map((f) => f.param), ...org.names],
      group_by: [
        ...columns.filter(([, kind]) => kind !== 'number').map(([name]) => name),
        ...org.names,
        ...(table.dateColumn ? Object.keys(period(table)).filter((p) => ['month', 'quarter', 'year'].includes(p)) : []),
      ],
      measures: columns.filter(([, kind]) => kind === 'number').map(([name]) => name),
    };
  });
  res.json({ success: true, count: data.length, data });
}

/**
 * Build the WHERE clauses for one table from request query values.
 * Returns { clauses, params, join } or { error } for a value of the wrong type.
 * Table columns are qualified with alias t; organisation columns with alias o.
 */
function tableFilters(spec, q, params) {
  const clauses = [];
  let join = '';

  const p = period(spec);
  if (p) {
    for (const [name, op] of [['from', '>='], ['to', '<=']]) {
      const value = dateParam(q[name]);
      if (!value && strParam(q[name])) return { error: name + ' must be YYYY-MM-DD' };
      addFilter(clauses, params, name + '_date', `${p.range(`t.[${spec.dateColumn}]`)} ${op} @${name}_date`, value && p.bound(value));
    }
  }

  for (const filter of spec.filters) {
    const column = `t.[${filter.column}]`;
    if (filter.kind === 'flag') {
      const value = flagParam(q[filter.param]);
      if (value == null && strParam(q[filter.param])) {
        return { error: filter.param + ' must be 0 or 1' };
      }
      if (value != null) addFilter(clauses, params, filter.param, column + ' = @' + filter.param, value);
    } else if (filter.kind === 'int') {
      const raw = strParam(q[filter.param]);
      if (raw == null) continue;
      const value = parseInt(raw, 10);
      if (Number.isNaN(value)) {
        return { error: filter.param + ' must be an integer' };
      }
      addFilter(clauses, params, filter.param, column + ' = @' + filter.param, value);
    } else if (filter.kind === 'date-from' || filter.kind === 'date-to') {
      const value = dateParam(q[filter.param]);
      if (!value && strParam(q[filter.param])) {
        return { error: filter.param + ' must be YYYY-MM-DD' };
      }
      if (!value) continue;
      const op = filter.kind === 'date-from' ? '>=' : '<=';
      addFilter(clauses, params, filter.param, 'CAST(' + column + ' AS date) ' + op + ' @' + filter.param, value);
    } else {
      addFilter(clauses, params, filter.param, column + ' = @' + filter.param, strParam(q[filter.param]));
    }
  }

  const org = organisation(spec);
  for (const name of org.names) {
    const value = strParam(q[name]);
    if (value == null) continue;
    addFilter(clauses, params, name, `o.[${name}] = @${name}`, value);
    join = org.join;
  }

  return { clauses, params, join };
}

const CONTROL_PARAMS = ['limit', 'group_by', 'metrics', 'sort'];

function unknownParams(spec, q) {
  const known = new Set([...CONTROL_PARAMS, ...(spec.dateColumn ? ['from', 'to'] : []), ...spec.filters.map((f) => f.param), ...organisation(spec).names]);
  return Object.keys(q).filter((name) => !known.has(name));
}

function list(value) {
  return [...new Set((strParam(value) || '').split(',').map((s) => s.trim()).filter(Boolean))];
}

// Object.hasOwn, so names such as "constructor" are not mistaken for columns.
function columnKind(spec, name) {
  return Object.hasOwn(spec.columns, name) ? spec.columns[name] : null;
}

/**
 * SELECT, GROUP BY and ORDER BY parts for group_by / metrics / sort.
 * Returns null when neither group_by nor metrics is given, or { error }.
 */
function aggregation(spec, q) {
  const groupBy = list(q.group_by);
  const metrics = list(q.metrics);
  if (!groupBy.length && !metrics.length) return null;

  const org = organisation(spec);
  const p = period(spec);
  let join = '';
  const groups = [];
  for (const name of groupBy) {
    if (columnKind(spec, name)) groups.push({ alias: name, expr: `t.[${name}]` });
    else if (org.names.includes(name)) {
      groups.push({ alias: name, expr: `o.[${name}]` });
      join = org.join;
    } else if (p && p[name] && ['month', 'quarter', 'year'].includes(name)) {
      groups.push({ alias: name, expr: p[name](`t.[${spec.dateColumn}]`), period: true });
    } else {
      return { error: `group_by ${name} is not a column of ${spec.table}. Call apex_tables for its group_by list.` };
    }
  }

  const selects = [];
  for (const metric of metrics.length ? metrics : ['count']) {
    if (metric === 'count') {
      selects.push({ alias: 'count', expr: 'COUNT(*)' });
      continue;
    }
    const [fn, column] = metric.split(':');
    if (fn === 'distinct' && (columnKind(spec, column) || org.names.includes(column))) {
      const expr = columnKind(spec, column) ? `t.[${column}]` : `o.[${column}]`;
      if (!columnKind(spec, column)) join = org.join;
      selects.push({ alias: `distinct_${column}`, expr: `COUNT(DISTINCT ${expr})` });
    } else if (['sum', 'avg', 'min', 'max'].includes(fn) && columnKind(spec, column) === 'number') {
      selects.push({ alias: `${fn}_${column}`, expr: `ROUND(${fn.toUpperCase()}(CAST(t.[${column}] AS float)), 4)` });
    } else {
      return {
        error: `metrics ${metric} is not valid for ${spec.table}. Use count, distinct:<column>, or sum|avg|min|max:<measure>; ` +
          'call apex_tables for the measures.',
      };
    }
  }

  const aliases = [...groups, ...selects].map((c) => c.alias);
  let order;
  const sort = strParam(q.sort);
  if (sort) {
    const alias = sort.replace(/^-/, '');
    if (!aliases.includes(alias)) return { error: `sort ${alias} must be one of: ${aliases.join(', ')}` };
    order = `[${alias}] ${sort.startsWith('-') ? 'DESC' : 'ASC'}`;
  } else {
    const periodGroup = groups.find((g) => g.period);
    order = periodGroup ? `[${periodGroup.alias}] ASC` : `[${selects[0].alias}] DESC`;
  }

  return {
    join,
    select: [...groups, ...selects].map((c) => `${c.expr} AS [${c.alias}]`).join(', '),
    groupBy: groups.length ? 'GROUP BY ' + groups.map((g) => g.expr).join(', ') : '',
    order,
    groups: groupBy,
    metrics: selects.map((s) => s.alias),
  };
}

function handler(key) {
  const spec = TABLES[key];
  return async function getTable(req, res) {
    try {
      const unknown = unknownParams(spec, req.query);
      if (unknown.length) {
        const valid = [...spec.filters.map((f) => f.param), ...organisation(spec).names];
        return res.status(400).json({
          success: false,
          error: `${unknown.join(', ')} is not a filter of ${key}. Valid filters: ${valid.join(', ') || 'none'}`,
        });
      }
      const agg = aggregation(spec, req.query);
      if (agg && agg.error) return res.status(400).json({ success: false, error: agg.error });

      const limit = agg ? intParam(req.query.limit, AGGREGATE_LIMIT, 1, AGGREGATE_LIMIT) : intParam(req.query.limit, spec.defaultLimit, 1, spec.maxLimit);
      const filters = tableFilters(spec, req.query, { limit });
      if (filters.error) return res.status(400).json({ success: false, error: filters.error });
      const from = `${source(spec.table)} t ${filters.join || (agg && agg.join) || ''} ${whereSql(filters.clauses)}`;

      if (!agg) {
        const data = await query(`SELECT TOP (@limit) t.* FROM ${from} ORDER BY t.[${spec.orderBy}] ${spec.orderDir}`, filters.params);
        return res.json({ success: true, count: data.length, table: spec.table, rows_in_database: spec.rows, data });
      }

      const rows = await query(
        `SELECT TOP (@limit) ${agg.select}, SUM(COUNT(*)) OVER () AS [_rows_matched], COUNT(*) OVER () AS [_groups]
         FROM ${from} ${agg.groupBy} ORDER BY ${agg.order}`,
        filters.params
      );
      const rowsMatched = rows.length ? rows[0]._rows_matched : 0;
      const groups = rows.length ? rows[0]._groups : 0;
      const data = rows.map(({ _rows_matched, _groups, ...row }) => row);
      res.json({
        success: true,
        count: data.length,
        table: spec.table,
        rows_in_database: spec.rows,
        rows_matched: rowsMatched,
        groups_total: groups,
        truncated: groups > data.length,
        group_by: agg.groups,
        metrics: agg.metrics,
        data,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  };
}

module.exports = { TABLES, APEX_DB, listTables, handler, tableFilters, aggregation, organisation };
