const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function intParam(value, fallback, min, max) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function strParam(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
}

function dateParam(value) {
  const s = strParam(value);
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

/**
 * Validate optional UUID query params (UNIQUEIDENTIFIER columns).
 * Returns { values } on success, or { error } if any provided value is not a UUID.
 */
function uuidParams(query, fieldNames) {
  const values = {};
  for (const name of fieldNames) {
    const s = strParam(query[name]);
    if (!s) {
      values[name] = null;
      continue;
    }
    if (!UUID_RE.test(s)) {
      return {
        error:
          `${name} must be a UUID (e.g. from GET /api/mfg/plants). ` +
          `Placeholder values like "PLANT-001" or "LINE-ID" are not valid. Received: "${s}"`,
      };
    }
    values[name] = s;
  }
  return { values };
}

// Period keys used by Apex tables: month_id (YYYYMM), date_id (YYYYMMDD), quarter_id (2026Q3).
function monthId(date) {
  return parseInt(date.slice(0, 7).replace('-', ''), 10);
}

function dateId(date) {
  return parseInt(date.replace(/-/g, ''), 10);
}

function quarterId(date) {
  return `${date.slice(0, 4)}Q${Math.ceil(parseInt(date.slice(5, 7), 10) / 3)}`;
}

function addFilter(clauses, params, name, sqlFragment, value) {
  if (value == null || value === '') return;
  params[name] = value;
  clauses.push(sqlFragment);
}

function whereSql(clauses) {
  return clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
}

module.exports = { intParam, strParam, dateParam, uuidParams, monthId, dateId, quarterId, addFilter, whereSql };
