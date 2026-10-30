// Turns one apex_table totals reply into a QuickChart image. The numbers always come from the
// API reply, never from the model, and the first group_by column is the chart's x axis.
const { randomUUID } = require('crypto');

const PALETTE = ['#4C78A8', '#F58518', '#54A24B', '#E45756', '#72B7B2', '#B279A2', '#FF9DA6', '#9D755D', '#BAB0AC', '#EECA3B', '#3B7A57', '#8E6C8A'];
const CHART_TYPES = ['bar', 'line', 'pie', 'heatmap'];
// Past these a chart stops being readable, so the agent is told to narrow it instead of getting a cut-off chart.
const MAX_CATEGORIES = 40;
const MAX_SERIES = PALETTE.length;
const MAX_SLICES = 12;
const BAR_LABEL_LIMIT = 15;
const WIDTH = 900;
const HEIGHT = 500;
// QuickChart accepted 64,000 characters and refused 128,000, but the agent has to copy the URL into its
// reply. The current Vertx heatmap works at about 12,300, so this stays near what is known to work.
const MAX_URL_LENGTH = 16000;

// These run inside QuickChart, so they cannot use anything from this file or contain a double quote.
const formatValue = (v) => (v == null ? '' : Math.abs(v) >= 1e6 ? +(v / 1e6).toFixed(1) + 'm' : (+v.toFixed(3)).toLocaleString());
const heatLabel = (p) => { const v = p.v; return Math.abs(v) >= 1e6 ? +(v / 1e6).toFixed(1) + 'm' : (+v.toFixed(3)).toLocaleString(); };
const heatLabelColor = (c) => (c.dataset.data[c.dataIndex].d ? '#ffffff' : '#102033');
const pieLabel = (v, c) => { const total = c.dataset.data.reduce((a, b) => a + b, 0); const n = Math.abs(v) >= 1e6 ? +(v / 1e6).toFixed(1) + 'm' : (+v.toFixed(3)).toLocaleString(); return n + ' (' + Math.round((v / total) * 100) + '%)'; };

// Titles and labels are not trusted, so only a random per-call marker can turn a string into code.
function serialize(config) {
  const nonce = randomUUID();
  const functions = [];
  const json = JSON.stringify(config, (_, v) => (typeof v === 'function' ? `${nonce}:${functions.push(String(v)) - 1}` : v));
  return json.replace(new RegExp(`"${nonce}:(\\d+)"`, 'g'), (_, i) => functions[i]);
}

function imageUrl(config) {
  // encodeURIComponent leaves ( and ) alone, and those can end a markdown image link early.
  const encoded = encodeURIComponent(serialize(config)).replace(/[()'!*~]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `https://quickchart.io/chart?w=${WIDTH}&h=${HEIGHT}&bkg=white&version=3&c=${encoded}`;
}

function label(value) {
  if (value == null || value === '') return 'Unknown';
  const s = String(value);
  return /^\d{4}-\d{2}-\d{2}T/.test(s) ? s.slice(0, 10) : s;
}

// Different stored values can share a label (null and '' are both Unknown), and each must keep its own figure.
function withUniqueLabels(rows, groups) {
  const out = rows.map((r) => ({ ...r }));
  for (const name of groups) {
    const shown = new Map();
    const used = new Map();
    for (const row of out) {
      const raw = row[name] === null ? '\u0000null' : String(row[name]);
      if (!shown.has(raw)) {
        const base = label(row[name]);
        const n = (used.get(base) || 0) + 1;
        used.set(base, n);
        shown.set(raw, n === 1 ? base : `${base} (${n})`);
      }
      row[name] = shown.get(raw);
    }
  }
  return out;
}

function humanize(name) {
  const words = name.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Years, quarters, months and dates read left to right in time, whatever order the API sorted them in.
// The column name decides for bare numbers, because a 6-digit value can just as well be an ID.
function inOrder(column, labels) {
  const unique = [...new Set(labels)];
  const isTime = /(^|_)(month|quarter|year|date)(_id)?$/.test(column) || unique.every((l) => /^\d{4}(-\d{2}(-\d{2})?|Q[1-4])$/.test(l));
  return isTime ? unique.sort((a, b) => a.localeCompare(b, 'en', { numeric: true })) : unique;
}

// A chart does not need more than 6 significant digits, and every digit lengthens the URL.
function plotted(value) {
  return value == null ? null : Number(Number(value).toPrecision(6));
}

function pivot(rows, xName, seriesName, metric) {
  const xs = inOrder(xName, rows.map((r) => r[xName]));
  const names = [...new Set(rows.map((r) => r[seriesName]))].sort();
  const cells = new Map(rows.map((r) => [`${r[xName]}\u0000${r[seriesName]}`, plotted(r[metric])]));
  // A missing combination is a gap, not a zero.
  const series = names.map((name) => ({ name, data: xs.map((x) => cells.get(`${x}\u0000${name}`) ?? null) }));
  return { xs, series };
}

function title(text) {
  return { display: true, text, font: { size: 16 } };
}

function cartesian(type, chartTitle, xs, series) {
  const single = series.length === 1;
  return {
    type,
    data: {
      labels: xs,
      datasets: series.map((s, i) => ({
        label: s.name,
        data: s.data,
        borderColor: PALETTE[i],
        backgroundColor: PALETTE[i],
        ...(type === 'line' && { fill: false, pointRadius: 2, tension: 0, spanGaps: false }),
        ...(type === 'bar' && { maxBarThickness: 56 }),
      })),
    },
    options: {
      plugins: {
        title: title(chartTitle),
        legend: { display: !single, position: 'bottom' },
        datalabels: type === 'bar' && single && xs.length <= BAR_LABEL_LIMIT
          ? { display: true, anchor: 'end', align: 'end', font: { size: 11 }, formatter: formatValue }
          : { display: false },
      },
      scales: {
        y: { ticks: { callback: formatValue } },
        x: { grid: { display: false }, ticks: { maxRotation: 40, minRotation: 0, autoSkip: true } },
      },
    },
  };
}

function pieConfig(chartTitle, xs, values) {
  return {
    type: 'pie',
    data: { labels: xs, datasets: [{ data: values, backgroundColor: xs.map((_, i) => PALETTE[i]), borderColor: '#ffffff' }] },
    options: {
      plugins: {
        title: title(chartTitle),
        legend: { display: true, position: 'right' },
        datalabels: { display: true, color: '#ffffff', font: { size: 12, weight: 'bold' }, formatter: pieLabel },
      },
    },
  };
}

function heatColor(t) {
  return `rgb(${Math.round(232 - t * 176)},${Math.round(244 - t * 150)},${Math.round(255 - t * 70)})`;
}

function heatmapConfig(chartTitle, xs, ys, cells) {
  const values = cells.map((c) => c.v);
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const share = (v) => (v - min) / span;
  // A rect point's side is radius * sqrt(2). The fractions leave room for the title and axis labels.
  const side = Math.min((WIDTH * 0.8) / xs.length, (HEIGHT * 0.72) / ys.length) - 2;
  return {
    type: 'scatter',
    data: {
      datasets: [{
        data: cells.map((c) => ({ x: c.x, y: c.y, v: c.v, ...(share(c.v) > 0.62 && { d: 1 }) })),
        pointStyle: 'rect',
        pointRadius: Math.round(side / Math.SQRT2),
        pointBackgroundColor: cells.map((c) => heatColor(share(c.v))),
        pointBorderWidth: 0,
      }],
    },
    options: {
      plugins: {
        title: title(chartTitle),
        legend: { display: false },
        datalabels: { display: true, align: 'center', anchor: 'center', font: { size: 11, weight: 'bold' }, formatter: heatLabel, color: heatLabelColor },
      },
      scales: {
        x: { type: 'category', labels: xs, offset: true, grid: { display: false } },
        y: { type: 'category', labels: ys, offset: true, grid: { display: false } },
      },
    },
  };
}

function buildConfig(chartType, chartTitle, rows, groups, metrics, truncated) {
  const [xName, seriesName] = groups;
  if (groups.length > 2) return { error: 'A chart can show at most 2 group_by columns: the first is the x axis, the second the series.' };

  if (chartType === 'heatmap') {
    if (groups.length !== 2 || metrics.length !== 1) return { error: 'heatmap needs exactly 2 group_by columns (x axis, y axis) and 1 metric.' };
    const { xs, series } = pivot(rows, xName, seriesName, metrics[0]);
    if (xs.length > MAX_CATEGORIES || series.length > MAX_CATEGORIES) {
      return { error: `heatmap has ${xs.length} by ${series.length} cells and can show ${MAX_CATEGORIES} per axis. Add a filter or use a coarser group_by.` };
    }
    const ys = series.map((s) => s.name);
    const cells = series.flatMap((s) => s.data.map((v, i) => ({ x: xs[i], y: s.name, v })).filter((c) => c.v != null));
    if (!cells.length) return { error: `${metrics[0]} is empty for every row, so there is nothing to draw.` };
    return { config: heatmapConfig(chartTitle, xs, ys, cells) };
  }

  if (chartType === 'pie') {
    if (groups.length !== 1 || metrics.length !== 1) return { error: 'pie needs exactly 1 group_by column and 1 metric.' };
    if (truncated) return { error: 'A pie shows shares of the whole, so it needs every group. Remove limit, or use a bar chart for a top N.' };
    if (rows.length > MAX_SLICES) return { error: `pie has ${rows.length} slices and can show ${MAX_SLICES}. Add a filter, or use limit with sort to keep the largest.` };
    const values = rows.map((r) => plotted(r[metrics[0]]));
    if (values.some((v) => v == null || v < 0)) return { error: 'pie cannot show negative or empty values. Use a bar chart.' };
    if (values.every((v) => v === 0)) return { error: `${metrics[0]} is zero for every row, so a pie has no shares to show.` };
    return { config: pieConfig(chartTitle, rows.map((r) => r[xName]), values) };
  }

  if (groups.length === 2 && metrics.length > 1) return { error: 'With 2 group_by columns the second is the series, so use 1 metric.' };
  let xs;
  let series;
  if (groups.length === 2) {
    ({ xs, series } = pivot(rows, xName, seriesName, metrics[0]));
  } else {
    const byLabel = new Map(rows.map((r) => [r[xName], r]));
    xs = inOrder(xName, rows.map((r) => r[xName]));
    series = metrics.map((m) => ({ name: humanize(m), data: xs.map((x) => plotted(byLabel.get(x)[m])) }));
  }
  if (xs.length > MAX_CATEGORIES) return { error: `${xName} has ${xs.length} values and a chart can show ${MAX_CATEGORIES}. Add a filter, a coarser group_by, or limit with sort.` };
  if (series.length > MAX_SERIES) return { error: `This chart has ${series.length} series and can show ${MAX_SERIES}. Use fewer metrics, add a filter, or swap the group_by order.` };
  if (series.every((s) => s.data.every((v) => v == null))) return { error: 'Every value is empty, so there is nothing to draw.' };
  return { config: cartesian(chartType, chartTitle, xs, series) };
}

/**
 * Build the apex_chart reply from an apex_table totals reply. Returns { error } when the
 * totals cannot be drawn as asked, with the change that would fix it.
 */
function buildChart({ chartType, title: chartTitle, reply, limited }) {
  const rows = reply.data || [];
  const groups = reply.group_by || [];
  const metrics = reply.metrics || [];
  if (!groups.length || !metrics.length) return { error: 'A chart needs at least 1 group_by column and 1 metric.' };
  if (!rows.length) return { error: 'No rows matched these filters, so there is nothing to draw.' };
  if (reply.truncated && !limited) {
    return { error: `There are ${reply.groups_total} groups, more than one chart can hold. Add a filter or use a coarser group_by.` };
  }
  const built = buildConfig(chartType, chartTitle, withUniqueLabels(rows, groups), groups, metrics, reply.truncated);
  if (built.error) return built;

  const url = imageUrl(built.config);
  if (url.length > MAX_URL_LENGTH) return { error: 'This chart holds too many values for one image. Add a filter, a coarser group_by, or limit with sort.' };
  const altText = chartTitle.replace(/[\[\]\\\r\n]+/g, ' ');
  const notes = [];
  if (reply.truncated) notes.push(`Shows ${rows.length} of ${reply.groups_total} groups, chosen by limit and sort.`);
  if (metrics.some((m) => /^avg_.*_pct$/.test(m))) {
    notes.push('Averages of a percentage count every row equally, including rows at zero. Stored scale differs by column: 0.37 or 37 can both mean 37%.');
  }
  return {
    success: true,
    title: chartTitle,
    chart_type: chartType,
    image_url: url,
    markdown: `![${altText}](${url})`,
    group_by: groups,
    metrics,
    rows_matched: reply.rows_matched,
    data: rows,
    ...(notes.length && { notes }),
    agent_instruction:
      'The chart is already drawn. Show it by copying the markdown value exactly, then describe it using only the figures in data. ' +
      'Do not redraw it and do not say you cannot generate images.',
  };
}

module.exports = { CHART_TYPES, buildChart, MAX_CATEGORIES, MAX_SLICES };
