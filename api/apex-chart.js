// Turns one apex_table totals reply into a QuickChart image. The numbers always come from the
// API reply, never from the model, and the first group_by column is the chart's x axis.
const { randomBytes, randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');
const { reportsDir } = require('./reports/writeReport');

const PALETTE = ['#2563EB', '#0D9488', '#D97706', '#DB2777', '#7C3AED', '#65A30D', '#0891B2', '#DC2626', '#4F46E5', '#B45309', '#059669', '#9333EA'];
const INK = '#1F2937';
const MUTED = '#6B7280';
const GRID = '#EEF0F3';
const RADAR_GRID = '#D9DDE3';
const FONT = 'Roboto';
const CHART_TYPES = ['bar', 'horizontal_bar', 'stacked_bar', 'line', 'area', 'combo', 'pie', 'donut', 'heatmap', 'scatter', 'bubble', 'radar', 'histogram', 'waterfall'];
// Shares, distributions and running totals are wrong unless every group is present.
const NEEDS_EVERY_GROUP = ['pie', 'donut', 'stacked_bar', 'histogram', 'waterfall'];
// Past these a chart stops being readable, so the agent is told to narrow it instead of getting a cut-off chart.
const MAX_CATEGORIES = 40;
const MAX_SERIES = PALETTE.length;
const MAX_SLICES = PALETTE.length;
const MAX_HORIZONTAL_BARS = 25;
const MAX_POINTS = 100;
const POINT_LABEL_LIMIT = 15;
const MAX_RADAR_AXES = 12;
const MAX_RADAR_SERIES = 6;
const MAX_HISTOGRAM_BINS = 12;
const POSITIVE = '#16A34A';
const NEGATIVE = '#DC2626';
const BAR_LABEL_LIMIT = 15;
const WIDTH = 900;
const HEIGHT = 500;
// QuickChart accepted 64,000 characters and refused 128,000. The largest Vertx heatmap is about 13,000,
// so this leaves room while staying well inside what is known to work.
const MAX_URL_LENGTH = 20000;
const RENDER_TIMEOUT_MS = 20000;

// These run inside QuickChart, so they cannot use anything from this file or contain a double quote.
const formatValue = (v) => (v == null ? '' : Math.abs(v) >= 1e6 ? +(v / 1e6).toFixed(1) + 'm' : (+v.toFixed(3)).toLocaleString());
const heatLabel = (p) => { const v = p.v; return Math.abs(v) >= 1e6 ? +(v / 1e6).toFixed(1) + 'm' : (+v.toFixed(3)).toLocaleString(); };
const heatLabelColor = (c) => (c.dataset.data[c.dataIndex].d ? '#ffffff' : '#1F2937');
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
  // The bottom padding keeps a value label on the tallest bar clear of the title.
  return { display: true, text, align: 'start', color: INK, font: { family: FONT, size: 18, weight: '600' }, padding: { bottom: 22 } };
}

function axisTitle(text) {
  return { display: true, text, color: MUTED, font: { family: FONT, size: 13 } };
}

function styledScale(scale, radial) {
  return {
    ...scale,
    grid: { color: radial ? RADAR_GRID : GRID, drawBorder: false, ...scale.grid },
    // Only value axes format their ticks, and they recede behind the category names.
    ticks: { color: scale.ticks?.callback ? MUTED : INK, font: { family: FONT, size: 13 }, ...(radial ? { z: 1, showLabelBackdrop: false } : { padding: 8 }), ...scale.ticks },
    ...(radial && { angleLines: { color: RADAR_GRID }, pointLabels: { color: INK, font: { family: FONT, size: 13 } } }),
  };
}

// The look shared by every chart type, so each chart only states what is particular to it.
function styled(config) {
  const { plugins, scales = {} } = config.options;
  const { legend, datalabels } = plugins;
  return {
    ...config,
    options: {
      ...config.options,
      layout: { padding: 16 },
      plugins: {
        ...plugins,
        legend: legend.display
          ? { ...legend, align: 'start', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, padding: 18, color: INK, font: { family: FONT, size: 13 } } }
          : legend,
        datalabels: datalabels.display
          ? { color: INK, ...datalabels, font: { family: FONT, size: 13, weight: '600', ...datalabels.font } }
          : datalabels,
      },
      scales: Object.fromEntries(Object.entries(scales).map(([name, scale]) => [name, styledScale(scale, name === 'r')])),
    },
  };
}

// A value with an empty month on both sides has no line to appear on, so it needs a dot.
function linePoints(data) {
  const lone = data.map((v, i) => (v != null && data[i - 1] == null && data[i + 1] == null ? 4 : 0));
  return lone.some(Boolean) ? lone : 0;
}

function cartesian(kind, chartTitle, xs, series) {
  const single = series.length === 1;
  const isLine = kind === 'line' || kind === 'area';
  const horizontal = kind === 'horizontal_bar';
  const stacked = kind === 'stacked_bar';
  // A filled area reads as an amount, so its axis has to start at zero.
  const valueAxis = { stacked, ...(kind === 'area' && { beginAtZero: true }), ticks: { callback: formatValue } };
  const categoryAxis = { stacked, grid: { display: false }, ticks: horizontal ? { autoSkip: false } : { maxRotation: 40, minRotation: 0, autoSkip: true } };
  return {
    type: isLine ? 'line' : 'bar',
    data: {
      labels: xs,
      datasets: series.map((s, i) => ({
        label: s.name,
        data: s.data,
        borderColor: stacked ? '#ffffff' : PALETTE[i],
        backgroundColor: kind === 'area' ? `${PALETTE[i]}22` : PALETTE[i],
        // Monotone smoothing cannot bend past a real value.
        ...(isLine
          ? { fill: kind === 'area', borderWidth: 2.5, pointRadius: linePoints(s.data), pointBackgroundColor: PALETTE[i], cubicInterpolationMode: 'monotone', spanGaps: false }
          : { maxBarThickness: 56, ...(stacked ? { borderWidth: 1 } : { borderRadius: 6, borderSkipped: 'start' }) }),
      })),
    },
    options: {
      ...(horizontal && { indexAxis: 'y' }),
      plugins: {
        title: title(chartTitle),
        legend: { display: !single, position: 'top' },
        datalabels: !isLine && !stacked && single && xs.length <= BAR_LABEL_LIMIT
          ? { display: true, anchor: 'end', align: 'end', formatter: formatValue }
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
        { type: 'line', label: lineSeries.name, data: lineSeries.data, yAxisID: 'y1', borderColor: PALETTE[1], backgroundColor: PALETTE[1], fill: false, borderWidth: 2.5, pointRadius: 3, cubicInterpolationMode: 'monotone' },
        { type: 'bar', label: barSeries.name, data: barSeries.data, yAxisID: 'y', backgroundColor: PALETTE[0], maxBarThickness: 56, borderRadius: 6, borderSkipped: 'start' },
      ],
    },
    options: {
      plugins: { title: title(chartTitle), legend: { display: true, position: 'top' }, datalabels: { display: false } },
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
          ? { display: true, anchor: 'end', align: 'top', font: { size: 11, weight: '400' }, formatter: pointLabel }
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
      plugins: { title: title(chartTitle), legend: { display: series.length > 1, position: 'top' }, datalabels: { display: false } },
      // A filled shape reads as an amount, so its centre has to be zero.
      scales: { r: { ...(scaled ? { min: 0, max: 100 } : { beginAtZero: true }), ticks: { callback: formatValue } } },
    },
  };
}

// Enough decimals for the bin width, so narrow bins never share a label.
function rangeEnd(v, largest, width) {
  const scale = largest >= 1e6 ? 1e6 : 1;
  const decimals = Math.min(10, Math.max(0, Math.ceil(-Math.log10(width / scale)) + 1));
  const text = (v / scale).toLocaleString('en', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return scale === 1e6 ? `${text}m` : text;
}

function histogramBins(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const count = min === max ? 1 : Math.min(MAX_HISTOGRAM_BINS, Math.ceil(Math.log2(values.length)) + 1);
  const width = (max - min) / count || 1;
  const largest = Math.max(Math.abs(min), Math.abs(max));
  const edges = Array.from({ length: count + 1 }, (_, i) => min + i * width);
  const bins = edges.slice(0, count).map((edge, i) => ({ range: `${rangeEnd(edge, largest, width)} to ${rangeEnd(edges[i + 1], largest, width)}`, count: 0 }));
  // A value on an edge goes in the bin that starts there, and the last bin includes the maximum.
  // The tolerance absorbs float error in the edges: 0.1 * 3 is not exactly 0.3.
  const tolerance = width * 1e-9;
  for (const v of values) {
    let i = count - 1;
    while (i > 0 && v < edges[i] - tolerance) i -= 1;
    bins[i].count += 1;
  }
  return bins;
}

function histogramConfig(chartTitle, bins, metric) {
  return {
    type: 'bar',
    data: { labels: bins.map((b) => b.range), datasets: [{ label: 'Count', data: bins.map((b) => b.count), backgroundColor: PALETTE[0], borderRadius: 4, borderSkipped: 'start', barPercentage: 1, categoryPercentage: 0.96 }] },
    options: {
      plugins: {
        title: title(chartTitle),
        legend: { display: false },
        datalabels: { display: true, anchor: 'end', align: 'end' },
      },
      scales: {
        x: { title: axisTitle(`Range of ${humanize(metric)}`), grid: { display: false }, ticks: { maxRotation: 40, minRotation: 0 } },
        y: { title: axisTitle('Number of groups'), beginAtZero: true },
      },
    },
  };
}

// Running totals are never rounded along the way, or the error would build up. Totals from the API
// have 4 decimals at most, so 6 only removes float noise, including what is left when steps cancel out.
function exact(v) {
  return Number(v.toFixed(6));
}

function waterfallConfig(chartTitle, xs, values) {
  let running = 0;
  const bars = values.map((v) => {
    const start = running;
    running += v;
    return [exact(start), exact(running)];
  });
  return {
    type: 'bar',
    data: {
      labels: [...xs, 'Total'],
      datasets: [{
        data: [...bars, [0, exact(running)]],
        backgroundColor: [...values.map((v) => (v < 0 ? NEGATIVE : POSITIVE)), PALETTE[0]],
        maxBarThickness: 56,
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      plugins: {
        title: title(chartTitle),
        legend: { display: false },
        datalabels: { display: true, anchor: 'end', align: 'end', formatter: waterfallLabel },
      },
      scales: { y: { ticks: { callback: formatValue } }, x: { grid: { display: false }, ticks: { maxRotation: 40, minRotation: 0 } } },
    },
  };
}

function pieConfig(type, chartTitle, xs, values) {
  return {
    type,
    data: { labels: xs, datasets: [{ data: values, backgroundColor: xs.map((_, i) => PALETTE[i]), borderColor: '#ffffff', borderWidth: 2, borderRadius: 4 }] },
    options: {
      plugins: {
        title: title(chartTitle),
        legend: { display: true, position: 'right' },
        datalabels: { display: true, color: '#ffffff', font: { size: 12 }, formatter: pieLabel },
      },
    },
  };
}

function heatColor(t) {
  return `rgb(${Math.round(219 - t * 190)},${Math.round(234 - t * 156)},${Math.round(254 - t * 38)})`;
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
        data: cells.map((c) => ({ x: c.x, y: c.y, v: c.v, ...(share(c.v) > 0.7 && { d: 1 }) })),
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
        datalabels: { display: true, align: 'center', anchor: 'center', font: { size: 12 }, formatter: heatLabel, color: heatLabelColor },
      },
      scales: {
        x: { type: 'category', labels: xs, offset: true, grid: { display: false } },
        y: { type: 'category', labels: ys, offset: true, grid: { display: false } },
      },
    },
  };
}

function groupCount(count) {
  return `${count} ${count === 1 ? 'group' : 'groups'}`;
}

function leftOut(count) {
  return count ? [`Left out ${groupCount(count)} with an empty value.`] : [];
}

function buildConfig(chartType, chartTitle, rows, groups, metrics, truncated, sorted) {
  const [xName, seriesName] = groups;
  if (truncated && NEEDS_EVERY_GROUP.includes(chartType)) {
    return { error: `A ${chartType} chart needs every group to be correct. Remove limit, or use a bar chart for a top N.` };
  }

  // Each row is one value, so any number of group_by columns can define what a row is.
  if (chartType === 'histogram') {
    if (metrics.length !== 1) return { error: 'histogram needs exactly 1 metric. group_by sets what is counted: use customer_id to count customers in each range.' };
    const values = rows.map((r) => r[metrics[0]]).filter((v) => v != null).map(Number);
    if (!values.length) return { error: 'Every value is empty, so there is nothing to draw.' };
    const bins = histogramBins(values);
    return {
      config: histogramConfig(chartTitle, bins, metrics[0]),
      data: bins,
      notes: [`Counts ${groupCount(values.length)}, one per ${groups.join(' and ')}.`, ...leftOut(rows.length - values.length)],
    };
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
    if (values.some((v) => v == null || v < 0)) return { error: `${chartType} cannot show negative or empty values. Use a bar chart.` };
    if (values.every((v) => v === 0)) return { error: `${metrics[0]} is zero for every row, so a ${chartType} has no shares to show.` };
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
    const sizes = sizeMetric ? present.map((r) => Number(r[sizeMetric])) : [];
    if (sizes.some((v) => v < 0)) return { error: 'bubble size cannot be negative. Use a metric with no negative values as the third metric.' };
    const largest = Math.max(...sizes, 0) || 1;
    const points = present.map((r, i) => ({
      x: plotted(r[xMetric]),
      y: plotted(r[yMetric]),
      l: r[xName],
      // Area, not radius, carries the value. The floor keeps the smallest bubbles visible.
      ...(sizeMetric && { r: Math.max(2, Math.round(20 * Math.sqrt(sizes[i] / largest))) }),
    }));
    return {
      config: pointsConfig(chartType, chartTitle, points, humanize(xMetric), humanize(yMetric)),
      data: present,
      notes: [...(sizeMetric ? [`Bubble area shows ${humanize(sizeMetric)}.`] : []), ...leftOut(rows.length - present.length)],
    };
  }

  if (chartType === 'radar') {
    if (metrics.length >= 3) {
      if (groups.length !== 1) return { error: 'radar with several metrics takes 1 group_by column: one shape per value, one axis per metric.' };
      if (metrics.length > MAX_RADAR_AXES) return { error: `radar can show ${MAX_RADAR_AXES} axes. Use fewer metrics.` };
      if (rows.length > MAX_RADAR_SERIES) return { error: `radar has ${rows.length} shapes and can show ${MAX_RADAR_SERIES}. Add a filter or use a coarser group_by.` };
      if (rows.length < 2) return { error: 'radar with several metrics compares groups, so it needs at least 2. Use a bar chart for one group.' };
      if (rows.some((r) => metrics.some((m) => r[m] == null || Number(r[m]) < 0))) {
        return { error: 'radar with several metrics cannot show negative or empty values. Use a bar chart.' };
      }
      // Metrics have different units, so each axis is scaled to its own highest value.
      const highest = metrics.map((m) => Math.max(...rows.map((r) => Number(r[m]))));
      if (highest.some((h) => h === 0)) return { error: 'One of these metrics is zero for every group, so radar has no scale for its axis. Use a bar chart.' };
      const series = rows.map((r) => ({ name: r[xName], data: metrics.map((m, i) => plotted((Number(r[m]) / highest[i]) * 100)) }));
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
    // The lowest value would become the centre, so the shape would no longer show the amounts.
    if (series.some((s) => s.data.some((v) => v < 0))) return { error: 'radar cannot show negative values. Use a bar chart.' };
    return { config: radarConfig(chartTitle, xs, series, false) };
  }

  if (chartType === 'waterfall') {
    if (groups.length !== 1) return { error: 'waterfall needs exactly 1 group_by column, with 1 metric to plot. Set the bar order with sort.' };
    if (rows.some((r) => r[metrics[0]] == null)) return { error: 'waterfall cannot show empty values. Add a filter to remove them.' };
    if (rows.length > MAX_CATEGORIES) return { error: `waterfall has ${rows.length} bars and can show ${MAX_CATEGORIES}. Add a filter or use a coarser group_by.` };
    const byLabel = new Map(rows.map((r) => [r[xName], r]));
    // An explicit sort is the order the agent asked for; without one, time still reads left to right.
    const xs = sorted ? rows.map((r) => r[xName]) : inOrder(xName, rows.map((r) => r[xName]));
    const values = xs.map((x) => Number(byLabel.get(x)[metrics[0]]));
    return {
      config: waterfallConfig(chartTitle, xs, values),
      data: [...xs.map((x) => byLabel.get(x)), { [xName]: 'Total', [metrics[0]]: exact(values.reduce((a, b) => a + b, 0)) }],
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
function buildChart({ chartType, title: chartTitle, reply, limited, sorted }) {
  const rows = reply.data || [];
  const groups = reply.group_by || [];
  const metrics = reply.metrics || [];
  if (!groups.length || !metrics.length) return { error: 'A chart needs at least 1 group_by column and 1 metric.' };
  if (!rows.length) return { error: 'No rows matched these filters, so there is nothing to draw.' };
  if (reply.truncated && !limited) {
    return { error: `There are ${reply.groups_total} groups, more than one chart can hold. Add a filter or use a coarser group_by.` };
  }
  const built = buildConfig(chartType, chartTitle, withUniqueLabels(rows, groups), groups, metrics, reply.truncated, sorted);
  if (built.error) return built;

  const url = imageUrl(styled(built.config));
  if (url.length > MAX_URL_LENGTH) return { error: 'This chart holds too many values for one image. Add a filter, a coarser group_by, or limit with sort.' };
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

/**
 * Save the drawn chart and point the reply at a short link on this API, served by /charts/:filename.
 * The QuickChart URL fills the chat while the agent types it, and QuickChart's own short links expire after 3 days.
 */
async function publishChart(chart, req) {
  const filename = `chart-${randomBytes(8).toString('hex')}.png`;
  try {
    const image = await fetch(chart.image_url, { signal: AbortSignal.timeout(RENDER_TIMEOUT_MS) });
    if (!image.ok) throw new Error(`QuickChart answered ${image.status}`);
    await fs.promises.writeFile(path.join(reportsDir, filename), Buffer.from(await image.arrayBuffer()));
  } catch (err) {
    return { error: `The chart image could not be drawn (${err.message}). Try once more.` };
  }
  const url = `${req.protocol}://${req.get('host')}/charts/${filename}`;
  const altText = chart.title.replace(/[\[\]\\\r\n]+/g, ' ');
  return { ...chart, image_url: url, markdown: `![${altText}](${url})` };
}

module.exports = { CHART_TYPES, buildChart, publishChart, MAX_CATEGORIES, MAX_SLICES };
