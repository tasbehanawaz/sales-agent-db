/**
 * Number formatting and row limits shared by the report section builders.
 */

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function money(v) {
  const x = n(v);
  const abs = Math.abs(x);
  const sign = x < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(abs < 100 && abs % 1 ? 2 : 0)}`;
}

function count(v) {
  return Math.round(n(v)).toLocaleString('en-US');
}

function dec(v, digits = 1) {
  return n(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Fraction (0.45) to "45.0%" */
function frac(v, digits = 1) {
  return `${(n(v) * 100).toFixed(digits)}%`;
}

/** Value already in percent (16.5) to "16.5%" */
function pct(v, digits = 1) {
  return `${n(v).toFixed(digits)}%`;
}

function share(part, whole) {
  return n(whole) ? frac(n(part) / n(whole)) : '0.0%';
}

function day(d) {
  return d ? new Date(d).toISOString().slice(0, 10) : '';
}

function monthLabel(monthId) {
  const s = String(monthId);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}`;
}

/**
 * Row cap for a ranked table. Slides keep the short list; PDF and CSV
 * (f.detail) carry four times as many rows, at least 50.
 */
function limit(f, rows) {
  return f.detail ? Math.max(rows * 4, 50) : rows;
}

module.exports = { n, money, count, dec, frac, pct, share, day, monthLabel, limit };
