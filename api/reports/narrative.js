/**
 * Written analysis for document-style reports.
 *
 * Section builders may supply their own `narrative` paragraphs. Every section
 * also gets paragraphs derived from its table: which row leads and trails on
 * the main measure, how concentrated it is, and the range of a rate column.
 * Table cells are the formatted strings the builders produce ("$1.82B",
 * "43.4%", "1,234"), so they are parsed back into numbers here.
 */

const SCALE = { K: 1e3, M: 1e6, B: 1e9 };

/** "$1.82B" → { value: 1.82e9, kind: 'money' }; "43.4%" → { value: 43.4, kind: 'rate' } */
function parseCell(cell) {
  const s = String(cell ?? '').trim().replace(/ \*$/, '');
  let m = s.match(/^(-?)\$([\d,]+(?:\.\d+)?)([KMB])?$/);
  if (m) return { value: (m[1] ? -1 : 1) * parseFloat(m[2].replace(/,/g, '')) * (SCALE[m[3]] || 1), kind: 'money' };
  m = s.match(/^(-?[\d,]+(?:\.\d+)?)%$/);
  if (m) return { value: parseFloat(m[1].replace(/,/g, '')), kind: 'rate' };
  m = s.match(/^(-?[\d,]+(?:\.\d+)?)( pp)?$/);
  if (m) return { value: parseFloat(m[1].replace(/,/g, '')), kind: m[2] ? 'rate' : 'number' };
  return null;
}

function lower(header) {
  return /^[A-Z]{2,}/.test(header) ? header : header.charAt(0).toLowerCase() + header.slice(1);
}

/** Averages, rates and indexes do not add up across rows. */
function additive(header, kind) {
  if (kind === 'rate') return false;
  return !/\b(avg|average|mean|median|index|score|days|prob|rate|per|ratio|tenure|confidence|priority|dso|cost\/unit|unit cost|energy\/unit)\b/i.test(header);
}

function columnInfo(table) {
  const { headers, rows } = table;
  return headers.map((header, i) => {
    const parsed = rows.map((r) => parseCell(r[i]));
    const numeric = parsed.filter(Boolean);
    const kind = numeric.length ? numeric[0].kind : null;
    return { i, header, parsed, numeric: numeric.length >= Math.max(1, rows.length * 0.8), kind };
  });
}

function rowLabel(row, labelCols) {
  return labelCols.map((c) => row[c.i]).filter((v) => v != null && String(v).trim() && v !== '-').join(' ');
}

function describeTable(section, tableRef) {
  const table = section.table;
  if (!table || !table.rows || !table.rows.length) return [];
  const cols = columnInfo(table);
  const firstNumeric = cols.findIndex((c) => c.numeric);
  if (firstNumeric <= 0) return [];
  const labelCols = cols.slice(0, firstNumeric);
  const numericCols = cols.filter((c) => c.numeric);
  const metric = table.metric != null
    ? cols.find((c) => c.header === table.metric) || numericCols[0]
    : numericCols.find((c) => c.kind === 'money') || numericCols[0];

  const items = table.rows
    .map((row, r) => ({ label: rowLabel(row, labelCols), cell: row[metric.i], value: metric.parsed[r]?.value }))
    .filter((x) => x.value != null && x.label);
  if (!items.length) return [];

  const dimension = labelCols.map((c) => lower(c.header)).join(' and ');
  const sentences = [];

  if (items.length === 1) {
    sentences.push(`${tableRef} covers a single ${dimension}: ${items[0].label}, with ${lower(metric.header)} of ${items[0].cell}.`);
  } else {
    const sorted = [...items].sort((a, b) => b.value - a.value);
    const top = sorted[0];
    const bottom = sorted[sorted.length - 1];
    const total = sorted.reduce((s, x) => s + x.value, 0);
    const sums = additive(metric.header, metric.kind) && total > 0 && sorted.every((x) => x.value >= 0);
    sentences.push(`${tableRef} breaks the data down by ${dimension} across ${items.length} rows.`);
    if (top.value === bottom.value) {
      sentences.push(`Every row shows the same ${lower(metric.header)} (${top.cell}).`);
    } else {
      sentences.push(
        `${top.label} has the highest ${lower(metric.header)} at ${top.cell}` +
        (sums ? `, ${((top.value / total) * 100).toFixed(1)}% of the total` : '') +
        `, and ${bottom.label} the lowest at ${bottom.cell}.`
      );
      if (sums && sorted.length >= 6) {
        const top3 = sorted.slice(0, 3).reduce((s, x) => s + x.value, 0);
        sentences.push(`The top three account for ${((top3 / total) * 100).toFixed(1)}% of ${lower(metric.header)}.`);
      } else if (!sums && sorted.length >= 3) {
        const mean = total / sorted.length;
        const spread = Math.abs(mean) > 0 ? ((top.value - bottom.value) / Math.abs(mean)) * 100 : 0;
        if (spread < 5) sentences.push(`The spread is narrow: highest and lowest differ by ${spread.toFixed(1)}% of the average.`);
      }
    }
  }

  const rate = numericCols.find((c) => c !== metric && c.kind === 'rate');
  if (rate && items.length > 1) {
    const ranked = table.rows
      .map((row, r) => ({ label: rowLabel(row, labelCols), cell: row[rate.i], value: rate.parsed[r]?.value }))
      .filter((x) => x.value != null && x.label)
      .sort((a, b) => b.value - a.value);
    if (ranked.length > 1 && ranked[0].value !== ranked[ranked.length - 1].value) {
      sentences.push(
        `${rate.header} ranges from ${ranked[ranked.length - 1].cell} (${ranked[ranked.length - 1].label}) ` +
        `to ${ranked[0].cell} (${ranked[0].label}).`
      );
    }
  }
  return [sentences.join(' ')];
}

function joinList(parts) {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

function describeKpis(kpis) {
  if (!Array.isArray(kpis) || !kpis.length) return null;
  return joinList(kpis.map((k) => `${lower(k.label)} ${k.value}${k.unit ? ` ${k.unit}` : ''}`));
}

/** Paragraphs for one section: builder narrative first, then table analysis. */
function sectionParagraphs(section, tableRef) {
  const out = [...(section.narrative || [])];
  const kpiLine = describeKpis(section.kpis);
  if (kpiLine && !(section.narrative || []).length) out.push(`Headline figures: ${kpiLine}.`);
  out.push(...describeTable(section, tableRef));
  return out;
}

/** Executive summary paragraphs and "in brief" points for the whole report. */
function reportSummary(data, scope) {
  if (Array.isArray(data.summary) && data.summary.length) return { paragraphs: data.summary, brief: [] };
  const sections = data.sections || [];
  const paragraphs = [
    `This report covers ${scope}. It has ${sections.length} section${sections.length === 1 ? '' : 's'}, ` +
    'each with a written analysis, the key figures and a detailed table built from live data.',
  ];
  const kpiLine = describeKpis(data.kpis);
  if (kpiLine) paragraphs.push(`Across the whole scope, ${kpiLine}.`);
  const brief = sections
    .map((s, i) => {
      const lead = (s.narrative && s.narrative[0]) || describeTable(s, `Table ${i + 2}.1`)[0];
      if (!lead) return null;
      const first = lead.split(/(?<=\.)\s+(?=[A-Z])/).find((x) => !/^Table \d/.test(x)) || lead;
      return `${s.title}: ${first}`;
    })
    .filter(Boolean)
    .slice(0, 10);
  return { paragraphs, brief };
}

module.exports = { parseCell, describeTable, sectionParagraphs, reportSummary };
