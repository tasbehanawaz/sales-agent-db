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

function addFilter(clauses, params, name, sqlFragment, value) {
  if (value == null || value === '') return;
  params[name] = value;
  clauses.push(sqlFragment);
}

function whereSql(clauses) {
  return clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
}

module.exports = { intParam, strParam, dateParam, addFilter, whereSql };
