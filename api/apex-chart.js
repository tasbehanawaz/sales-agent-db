// Turns one apex_table totals reply into a QuickChart image. The numbers always come from the
// API reply, never from the model, and the first group_by column is the chart's x axis.
const { randomUUID } = require('crypto');

const PALETTE = ['#4C78A8', '#F58518', '#54A24B', '#E45756', '#72B7B2', '#B279A2', '#FF9DA6', '#9D755D', '#BAB0AC', '#EECA3B', '#3B7A57', '#8E6C8A'];
const CHART_TYPES = ['bar', 'horizontal_bar', 'stacked_bar', 'line', 'area', 'combo', 'pie', 'donut', 'heatmap', 'scatter', 'bubble', 'radar', 'histogram', 'waterfall'];
// Shares, distributions and running totals are wrong unless every group is present.
const NEEDS_EVERY_GROUP = ['pie', 'donut', 'histogram', 'waterfall'];
// Past these a chart stops being readable, so the agent is told to narrow it instead of getting a cut-off chart.
const MAX_CATEGORIES = 40;
const MAX_SERIES = PALETTE.length;
const MAX_SLICES = 12;
const MAX_HORIZONTAL_BARS = 25;
const MAX_POINTS = 100;
const POINT_LABEL_LIMIT = 15;
const MAX_RADAR_AXES = 12;
const MAX_RADAR_SERIES = 6;
const MAX_HISTOGRAM_BINS = 12;
const POSITIVE = '#54A24B';
const NEGATIVE = '#E45756';
// Keeps a value label on the tallest bar clear of the title.
const LABEL_ROOM = { padding: { top: 22, right: 12 } };
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
const pieLabel = (v, c) => { if (!v) return ''; const total = c.dataset.data.reduce((a, b) => a + b, 0); const n = Math.abs(v) >= 1e6 ? +(v / 1e6).toFixed(1) + 'm' : (+v.toFixed(3)).toLocaleString(); return n + ' (' + Math.round((v / total) * 100) + '%)'; };

const waterfallLabel = (v) => { const n = v[1] - v[0]; return Math.abs(n) >= 1e6 ? +(n / 1e6).toFixed(1) + 'm' : (+n.toFixed(3)).toLocaleString(); };
const pointLabel = (_, c) => c.dataset.data[c.dataIndex].l;

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

function axisTitle(text) {
  return { display: true, text };
}

function cartesian(kind, chartTitle, xs, series) {
  const single = series.length === 1;
  const isLine = kind === 'line' || kind === 'area';
  const horizontal = kind === 'horizontal_bar';
  const stacked = kind === 'stacked_bar';
  // A filled area reads as an amount, so its axis has to start at zero.
  const valueAxis = { stacked, beginAtZero: kind === 'area', ticks: { callback: formatValue } };
  const categoryAxis = { stacked, grid: { display: false }, ticks: horizontal ? { autoSkip: false } : { maxRotation: 40, minRotation: 0, autoSkip: true } };
  return {
    type: isLine ? 'line' : 'bar',
    data: {
      labels: xs,
      datasets: series.map((s, i) => ({
        label: s.name,
        data: s.data,
        borderColor: PALETTE[i],
        backgroundColor: kind === 'area' ? `${PALETTE[i]}40` : PALETTE[i],
        ...(isLine ? { fill: kind === 'area', pointRadius: 2, tension: 0, spanGaps: false } : { maxBarThickness: 56 }),
      })),
    },
    options: {
      ...(horizontal && { indexAxis: 'y' }),
      layout: LABEL_ROOM,
      plugins: {
        title: title(chartTitle),
        legend: { display: !single, position: 'bottom' },
        datalabels: !isLine && !stacked && single && xs.length <= BAR_LABEL_LIMIT
          ? { display: true, anchor: 'end', align: 'end', font: { size: 11 }, formatter: formatValue }
          : { display: false },
      },
      scales: horizontal ? { x: valueAxis, y: categoryAxis } : { y: valueAxis, x: categoryAxis },
    },
  };
}

// Bars and a line on separate scales, so a percentage stays readable beside a total.
function comboConfig(chartTitle, xs, [barSeries, lineSeries]) {
  return {
    type: 'bar',
    data: {
      labels: xs,
      datasets: [
        { type: 'line', label: lineSeries.name, data: lineSeries.data, yAxisID: 'y1', borderColor: PALETTE[1], backgroundColor: PALETTE[1], fill: false, pointRadius: 3, tension: 0 },
        { type: 'bar', label: barSeries.name, data: barSeries.data, yAxisID: 'y', backgroundColor: PALETTE[0], maxBarThickness: 56 },
      ],
    },
    options: {
      plugins: { title: title(chartTitle), legend: { display: true, position: 'bottom' }, datalabels: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { position: 'left', title: axisTitle(barSeries.name), ticks: { callback: formatValue } },
        y1: { position: 'right', title: axisTitle(lineSeries.name), grid: { display: false }, ticks: { callback: formatValue } },
      },
    },
  };
}

function pointsConfig(type, chartTitle, points, xName, yName) {
  return {
    type,
    data: { datasets: [{ data: points, backgroundColor: `${PALETTE[0]}B0`, borderColor: PALETTE[0], ...(type === 'scatter' && { pointRadius: 5 }) }] },
    options: {
      plugins: {
        title: title(chartTitle),
        legend: { display: false },
        datalabels: points.length <= POINT_LABEL_LIMIT
          ? { display: true, align: 'top', font: { size: 10 }, formatter: pointLabel }
          : { display: false },
      },
      scales: {
        x: { title: axisTitle(xName), ticks: { callback: formatValue } },
        y: { title: axisTitle(yName), ticks: { callback: formatValue } },
      },
    },
  };
}

function radarConfig(chartTitle, axes, series, scaled) {
  return {
    type: 'radar',
    data: {
      labels: axes,
      datasets: series.map((s, i) => ({ label: s.name, data: s.data, borderColor: PALETTE[i], backgroundColor: `${PALETTE[i]}20`, pointRadius: 3, fill: true })),
    },
    options: {
      plugins: { title: title(chartTitle), legend: { display: series.length > 1, position: 'bottom' }, datalabels: { display: false } },
      scales: { r: { ...(scaled && { min: 0, max: 100 }), ticks: { callback: formatValue } } },
    },
  };
}

function compact(v) {
  return Math.abs(v) >= 1e6 ? `${+(v / 1e6).toFixed(1)}m` : (+v.toFixed(3)).toLocaleString('en');
}

function histogramBins(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const count = min === max ? 1 : Math.min(MAX_HISTOGRAM_BINS, Math.ceil(Math.log2(values.length)) + 1);
  const width = (max - min) / count || 1;
  const bins = Array.from({ length: count }, (_, i) => ({ range: `${compact(min + i * width)} to ${compact(min + (i + 1) * width)}`, count: 0 }));
  // The last bin includes the maximum.
  for (const v of values) bins[Math.min(count - 1, Math.floor((v - min) / width))].count += 1;
  return bins;
}

function histogramConfig(chartTitle, bins, metric) {
  return {
    type: 'bar',
    data: { labels: bins.map((b) => b.range), datasets: [{ label: 'Count', data: bins.map((b) => b.count), backgroundColor: PALETTE[0], barPercentage: 1, categoryPercentage: 0.98 }] },
    options: {
      layout: LABEL_ROOM,
      plugins: {
        title: title(chartTitle),
        legend: { display: false },
        datalabels: { display: true, anchor: 'end', align: 'end', font: { size: 11 } },
      },
      scales: {
        x: { title: axisTitle(`Range of ${humanize(metric)}`), grid: { display: false }, ticks: { maxRotation: 40, minRotation: 0 } },
        y: { title: axisTitle('Number of groups'), beginAtZero: true },
      },
    },
  };
}

function waterfallConfig(chartTitle, xs, values) {
  let running = 0;
  const bars = values.map((v) => {
    const start = running;
    running = plotted(running + v);
    return [start, running];
  });
  return {
    type: 'bar',
    data: {
      labels: [...xs, 'Total'],
      datasets: [{
        data: [...bars, [0, running]],
        backgroundColor: [...values.map((v) => (v < 0 ? NEGATIVE : POSITIVE)), PALETTE[0]],
        maxBarThickness: 56,
      }],
    },
    options: {
      layout: LABEL_ROOM,
      plugins: {
        title: title(chartTitle),
        legend: { display: false },
        datalabels: { display: true, anchor: 'end', align: 'end', font: { size: 11 }, formatter: waterfallLabel },
      },
      scales: { y: { ticks: { callback: formatValue } }, x: { grid: { display: false }, ticks: { maxRotation: 40, minRotation: 0 } } },
    },
  };
}

function pieConfig(type, chartTitle, xs, values) {
  return {
    type,
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
  if (truncated && NEEDS_EVERY_GROUP.includes(chartType)) {
    return { error: `A ${chartType} chart needs every group to be correct. Remove limit, or use a bar chart for a top N.` };
  }

  // Each row is one value, so any number of group_by columns can define what a row is.
  if (chartType === 'histogram') {
    if (metrics.length !== 1) return { error: 'histogram needs exactly 1 metric. group_by sets what is counted: use customer_id to count customers in each range.' };
    const values = rows.map((r) => plotted(r[metrics[0]])).filter((v) => v != null);
    if (!values.length) return { error: 'Every value is empty, so there is nothing to draw.' };
    const bins = histogramBins(values);
    return { config: histogramConfig(chartTitle, bins, metrics[0]), data: bins, notes: [`Counts ${values.length} groups, one per ${groups.join(' and ')}.`] };
  }

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

  if (chartType === 'pie' || chartType === 'donut') {
    if (groups.length !== 1 || metrics.length !== 1) return { error: `${chartType} needs exactly 1 group_by column and 1 metric.` };
    if (rows.length > MAX_SLICES) return { error: `${chartType} has ${rows.length} slices and can show ${MAX_SLICES}. Add a filter or use a coarser group_by.` };
    const values = rows.map((r) => plotted(r[metrics[0]]));
    if (values.some((v) => v == null || v < 0)) return { error: 'pie cannot show negative or empty values. Use a bar chart.' };
    if (values.every((v) => v === 0)) return { error: `${metrics[0]} is zero for every row, so a pie has no shares to show.` };
    return { config: pieConfig(chartType === 'pie' ? 'pie' : 'doughnut', chartTitle, rows.map((r) => r[xName]), values) };
  }

  if (chartType === 'scatter' || chartType === 'bubble') {
    const wanted = chartType === 'scatter' ? 2 : 3;
    if (groups.length !== 1 || metrics.length !== wanted) {
      return { error: `${chartType} needs exactly 1 group_by column (one point per value) and ${wanted} metrics (${chartType === 'scatter' ? 'x, y' : 'x, y, size'}).` };
    }
    const [xMetric, yMetric, sizeMetric] = metrics;
    const present = rows.filter((r) => metrics.every((m) => r[m] != null));
    if (!present.length) return { error: 'No group has a value for every metric, so there is nothing to draw.' };
    if (present.length > MAX_POINTS) return { error: `This chart has ${present.length} points and can show ${MAX_POINTS}. Add a filter, a coarser group_by, or limit with sort.` };
    const sizes = sizeMetric ? present.map((r) => Math.abs(Number(r[sizeMetric]))) : [];
    const largest = Math.max(...sizes, 0) || 1;
    const points = present.map((r, i) => ({
      x: plotted(r[xMetric]),
      y: plotted(r[yMetric]),
      l: r[xName],
      // Area, not radius, carries the value.
      ...(sizeMetric && { r: Math.round(3 + 17 * Math.sqrt(sizes[i] / largest)) }),
    }));
    return {
      config: pointsConfig(chartType, chartTitle, points, humanize(xMetric), humanize(yMetric)),
      notes: sizeMetric ? [`Bubble area shows ${humanize(sizeMetric)}.`] : [],
    };
  }

  if (chartType === 'radar') {
    if (metrics.length >= 3) {
      if (groups.length !== 1) return { error: 'radar with several metrics takes 1 group_by column: one shape per value, one axis per metric.' };
      if (metrics.length > MAX_RADAR_AXES) return { error: `radar can show ${MAX_RADAR_AXES} axes. Use fewer metrics.` };
      if (rows.length > MAX_RADAR_SERIES) return { error: `radar has ${rows.length} shapes and can show ${MAX_RADAR_SERIES}. Add a filter or use a coarser group_by.` };
      // Metrics have different units, so each axis is scaled to its own highest value.
      const highest = metrics.map((m) => Math.max(...rows.map((r) => Number(r[m]) || 0)));
      if (highest.some((h) => h <= 0)) return { error: 'radar with several metrics needs a positive value on every axis. Use bars for negative or empty metrics.' };
      const series = rows.map((r) => ({ name: r[xName], data: metrics.map((m, i) => plotted(((Number(r[m]) || 0) / highest[i]) * 100)) }));
      return {
        config: radarConfig(chartTitle, metrics.map(humanize), series, true),
        notes: ['Each axis is scaled so its highest value is 100. Quote real figures from data, not the scaled ones on the chart.'],
      };
    }
    if (metrics.length !== 1) return { error: 'radar takes 1 metric, or 3 or more metrics. Use a bar chart for 2 metrics.' };
    const { xs, series } = groups.length === 2
      ? pivot(rows, xName, seriesName, metrics[0])
      : { xs: rows.map((r) => r[xName]), series: [{ name: humanize(metrics[0]), data: rows.map((r) => plotted(r[metrics[0]])) }] };
    if (xs.length < 3) return { error: 'radar needs at least 3 axes. Use a bar chart.' };
    if (xs.length > MAX_RADAR_AXES) return { error: `radar has ${xs.length} axes and can show ${MAX_RADAR_AXES}. Add a filter or use a coarser group_by.` };
    if (series.length > MAX_RADAR_SERIES) return { error: `radar has ${series.length} shapes and can show ${MAX_RADAR_SERIES}. Add a filter, or swap the group_by order.` };
    if (series.every((s) => s.data.every((v) => v == null))) return { error: 'Every value is empty, so there is nothing to draw.' };
    return { config: radarConfig(chartTitle, xs, series, false) };
  }

  if (chartType === 'waterfall') {
    if (groups.length !== 1) return { error: 'waterfall needs exactly 1 group_by column, with 1 metric to plot. Set the bar order with sort.' };
    const values = rows.map((r) => plotted(r[metrics[0]]));
    if (values.some((v) => v == null)) return { error: 'waterfall cannot show empty values. Add a filter to remove them.' };
    if (values.length > MAX_CATEGORIES) return { error: `waterfall has ${values.length} bars and can show ${MAX_CATEGORIES}. Add a filter or use a coarser group_by.` };
    return {
      config: waterfallConfig(chartTitle, rows.map((r) => r[xName]), values),
      notes: ['Bars add up in the order shown, and Total is their sum. Only the first metric is plotted, so a second can set the order through sort.'],
    };
  }

  if (chartType === 'combo' && (groups.length !== 1 || metrics.length !== 2)) {
    return { error: 'combo needs exactly 1 group_by column and 2 metrics: the first as bars, the second as a line.' };
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
  if (chartType === 'horizontal_bar' && xs.length > MAX_HORIZONTAL_BARS) {
    return { error: `horizontal_bar has ${xs.length} bars and can show ${MAX_HORIZONTAL_BARS}. Add a filter, or use limit with sort.` };
  }
  return { config: chartType === 'combo' ? comboConfig(chartTitle, xs, series) : cartesian(chartType, chartTitle, xs, series) };
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
  const notes = [...(built.notes || [])];
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
    data: built.data || rows,
    ...(notes.length && { notes }),
    agent_instruction:
      'The chart is already drawn. Show it by copying the markdown value exactly, then describe it using only the figures in data. ' +
      'Do not redraw it and do not say you cannot generate images.',
  };
}

module.exports = { CHART_TYPES, buildChart, MAX_CATEGORIES, MAX_SLICES };
