const test = require('node:test');
const assert = require('node:assert');
const { buildChart, MAX_CATEGORIES, MAX_SLICES } = require('./apex-chart');

function reply(data, group_by, metrics, extra = {}) {
  return { data, group_by, metrics, rows_matched: data.length, groups_total: data.length, truncated: false, ...extra };
}

function configOf(chart) {
  // QuickChart receives JavaScript, not JSON, because labels are formatted by functions.
  return new Function(`return ${decodeURIComponent(chart.image_url.split('&c=')[1])}`)();
}

const draw = (chartType, data, groups, metrics, extra) =>
  buildChart({ chartType, title: 'T', reply: reply(data, groups, metrics, extra), limited: false });

test('a line puts months in time order and one series per second group, with gaps not zeros', () => {
  const chart = draw('line', [
    { month: '2026-02', region: 'North', sum_revenue: 20 },
    { month: '2026-01', region: 'South', sum_revenue: 30 },
    { month: '2026-01', region: 'North', sum_revenue: 10 },
  ], ['month', 'region'], ['sum_revenue']);
  const { data } = configOf(chart);
  assert.deepEqual(data.labels, ['2026-01', '2026-02']);
  assert.deepEqual(data.datasets.map((d) => [d.label, d.data]), [['North', [10, 20]], ['South', [30, null]]]);
  assert.match(chart.markdown, /^!\[T\]\(https:\/\/quickchart\.io\/chart\?/);
  assert.equal(chart.data.length, 3, 'the agent gets the plotted figures');
});

test('a bar keeps the ranking the API sorted by, and several metrics become several series', () => {
  const rows = [{ unit: 'B', sum_a: 9, sum_b: 1 }, { unit: 'A', sum_a: 5, sum_b: 2 }];
  const { data } = configOf(draw('bar', rows, ['unit'], ['sum_a', 'sum_b']));
  assert.deepEqual(data.labels, ['B', 'A']);
  assert.deepEqual(data.datasets.map((d) => d.label), ['Sum a', 'Sum b']);
});

test('numeric IDs keep their ranking while a month_id column reads in time order', () => {
  const ids = [{ customer_no: 202602, sum_v: 9 }, { customer_no: 202601, sum_v: 5 }];
  assert.deepEqual(configOf(draw('bar', ids, ['customer_no'], ['sum_v'])).data.labels, ['202602', '202601']);
  const months = [{ month_id: 202602, sum_v: 9 }, { month_id: 202601, sum_v: 5 }];
  assert.deepEqual(configOf(draw('bar', months, ['month_id'], ['sum_v'])).data.labels, ['202601', '202602']);
});

test('the image URL has no parentheses, which would end a markdown image link early', () => {
  const chart = draw('pie', [{ a: 'x (y)', sum_v: 1 }], ['a'], ['sum_v']);
  assert.doesNotMatch(chart.image_url, /[()]/);
  assert.equal(configOf(chart).data.labels[0], 'x (y)');
  assert.equal(configOf(chart).options.plugins.datalabels.formatter(1, { dataset: { data: [1, 3] } }), '1 (25%)');
});

test('a heatmap has one cell per combination that exists and marks dark cells', () => {
  const { data } = configOf(draw('heatmap', [
    { region: 'North', unit: 'A', sum_x: 0 },
    { region: 'South', unit: 'A', sum_x: 10 },
    { region: 'North', unit: 'B', sum_x: 5 },
  ], ['region', 'unit'], ['sum_x']));
  assert.deepEqual(data.datasets[0].data, [
    { x: 'North', y: 'A', v: 0 },
    { x: 'South', y: 'A', v: 10, d: 1 },
    { x: 'North', y: 'B', v: 5 },
  ]);
});

test('a chart that cannot be drawn as asked says how to fix it', () => {
  const pair = [{ a: 'x', b: 'y', c: 'z', sum_v: 1, sum_w: 1 }];
  assert.match(draw('bar', pair, ['a', 'b', 'c'], ['sum_v']).error, /at most 2 group_by/);
  assert.match(draw('bar', pair, ['a', 'b'], ['sum_v', 'sum_w']).error, /use 1 metric/);
  assert.match(draw('pie', pair, ['a', 'b'], ['sum_v']).error, /pie needs/);
  assert.match(draw('heatmap', pair, ['a'], ['sum_v']).error, /heatmap needs/);
  assert.match(draw('pie', [{ a: 'x', sum_v: -1 }], ['a'], ['sum_v']).error, /negative/);
  assert.match(draw('bar', [], ['a'], ['sum_v']).error, /No rows/);

  const many = (n) => Array.from({ length: n }, (_, i) => ({ a: `v${i}`, sum_v: i }));
  assert.match(draw('bar', many(MAX_CATEGORIES + 1), ['a'], ['sum_v']).error, /can show 40/);
  assert.match(draw('pie', many(MAX_SLICES + 1), ['a'], ['sum_v']).error, /can show 12/);
});

test('cut-off totals are refused unless limit asked for a top N, which is then disclosed', () => {
  const rows = [{ a: 'x', sum_v: 1 }];
  const cut = reply(rows, ['a'], ['sum_v'], { truncated: true, groups_total: 1500 });
  assert.match(buildChart({ chartType: 'bar', title: 'T', reply: cut, limited: false }).error, /1500 groups/);
  const top = buildChart({ chartType: 'bar', title: 'T', reply: cut, limited: true });
  assert.match(top.notes[0], /1 of 1500/);
});

test('a title or label can never become code in the chart config', () => {
  const attack = '__JS__globalThis.injected=1__JS__';
  const old = `"__JS__x`;
  const chart = buildChart({
    chartType: 'bar',
    title: attack,
    reply: reply([{ a: attack, sum_v: 1 }, { a: old, sum_v: 2 }], ['a'], ['sum_v']),
    limited: false,
  });
  const config = configOf(chart);
  assert.deepEqual(config.data.labels, [attack, old]);
  assert.equal(config.options.plugins.title.text, attack);
  assert.equal(globalThis.injected, undefined);
  assert.equal(typeof config.options.plugins.datalabels.formatter, 'function', 'real formatters still run');
});

test('a title cannot break the markdown image', () => {
  const chart = buildChart({ chartType: 'bar', title: 'a]b\nc[d', reply: reply([{ a: 'x', sum_v: 1 }], ['a'], ['sum_v']), limited: false });
  assert.match(chart.markdown, /^!\[a b c d\]\(https:/);
  assert.equal(configOf(chart).options.plugins.title.text, 'a]b\nc[d', 'the drawn title is unchanged');
});

test('charts with nothing to show or too much for one image are refused', () => {
  assert.match(draw('heatmap', [{ a: 'x', b: 'y', sum_v: null }], ['a', 'b'], ['sum_v']).error, /empty for every row/);
  assert.match(draw('pie', [{ a: 'x', sum_v: 0 }, { a: 'y', sum_v: 0 }], ['a'], ['sum_v']).error, /zero for every row/);
  const grid = [];
  for (let x = 0; x < MAX_CATEGORIES; x++) for (let y = 0; y < MAX_CATEGORIES; y++) grid.push({ a: `x${x}`, b: `y${y}`, sum_v: x * y });
  assert.match(draw('heatmap', grid, ['a', 'b'], ['sum_v']).error, /too many values/);
});

test('values that share a label each keep their own figure', () => {
  const { data } = configOf(draw('bar', [
    { a: null, sum_v: 1 },
    { a: '', sum_v: 2 },
    { a: 'Unknown', sum_v: 3 },
    { a: 'x', sum_v: 4 },
  ], ['a'], ['sum_v']));
  assert.deepEqual(data.labels, ['Unknown', 'Unknown (2)', 'Unknown (3)', 'x']);
  assert.deepEqual(data.datasets[0].data, [1, 2, 3, 4]);
});

test('a pie of a cut-off list is refused, because its shares would be wrong', () => {
  const cut = reply([{ a: 'x', sum_v: 1 }], ['a'], ['sum_v'], { truncated: true, groups_total: 9 });
  assert.match(buildChart({ chartType: 'pie', title: 'T', reply: cut, limited: true }).error, /needs every group/);
});

test('a reply with nothing to plot is refused for every chart type', () => {
  assert.match(buildChart({ chartType: 'bar', title: 'T', reply: { data: [{ a: 1 }] }, limited: false }).error, /at least 1 group_by/);
  assert.match(draw('bar', [{ a: 'x', sum_v: 1 }], [], ['sum_v']).error, /at least 1 group_by/);
  assert.match(draw('bar', [{ a: 'x', sum_v: null }], ['a'], ['sum_v']).error, /Every value is empty/);
  assert.match(draw('line', [{ a: 'x', b: 'y', sum_v: null }], ['a', 'b'], ['sum_v']).error, /Every value is empty/);
});

test('week numbers read in numeric order', () => {
  const rows = [10, 2, 1].map((w) => ({ week_of_year: w, sum_v: w }));
  assert.deepEqual(configOf(draw('line', rows, ['week_of_year'], ['sum_v'])).data.labels, ['1', '2', '10']);
});

test('bar and line variations share their data and differ in shape', () => {
  const rows = [{ a: 'x', b: 'p', sum_v: 1 }, { a: 'x', b: 'q', sum_v: 2 }];
  const stacked = configOf(draw('stacked_bar', rows, ['a', 'b'], ['sum_v']));
  assert.equal(stacked.options.scales.y.stacked, true);
  assert.equal(stacked.options.scales.x.stacked, true);

  const horizontal = configOf(draw('horizontal_bar', rows, ['a', 'b'], ['sum_v']));
  assert.equal(horizontal.options.indexAxis, 'y');
  assert.equal(typeof horizontal.options.scales.x.ticks.callback, 'function', 'values run along x');

  const area = configOf(draw('area', rows, ['a', 'b'], ['sum_v']));
  assert.deepEqual([area.type, area.data.datasets[0].fill, area.options.scales.y.beginAtZero], ['line', true, true]);
  assert.equal(configOf(draw('donut', [{ a: 'x', sum_v: 1 }], ['a'], ['sum_v'])).type, 'doughnut');
});

test('combo puts the first metric in bars and the second in a line on its own scale', () => {
  const { data } = configOf(draw('combo', [{ a: 'x', sum_r: 100, avg_m: 0.4 }], ['a'], ['sum_r', 'avg_m']));
  const bar = data.datasets.find((d) => d.type === 'bar');
  const line = data.datasets.find((d) => d.type === 'line');
  assert.deepEqual([bar.data, bar.yAxisID, line.data, line.yAxisID], [[100], 'y', [0.4], 'y1']);
});

test('scatter and bubble plot one point per group, and bubble area follows the third metric', () => {
  const rows = [{ a: 'x', m1: 1, m2: 2, m3: 100 }, { a: 'y', m1: 3, m2: 4, m3: 25 }, { a: 'z', m1: null, m2: 4, m3: 1 }];
  const scatter = configOf(draw('scatter', rows, ['a'], ['m1', 'm2'])).data.datasets[0].data;
  assert.deepEqual(scatter, [{ x: 1, y: 2, l: 'x' }, { x: 3, y: 4, l: 'y' }], 'a point missing a value is left out');
  const bubble = configOf(draw('bubble', rows, ['a'], ['m1', 'm2', 'm3'])).data.datasets[0].data;
  assert.deepEqual(bubble.map((p) => p.r), [20, 10], 'the radius is proportional to the square root');
});

test('radar scales mixed metrics per axis and says so, but plots one metric as stored', () => {
  const rows = [{ a: 'x', m1: 10, m2: 0.5, m3: 200 }, { a: 'y', m1: 5, m2: 1, m3: 100 }];
  const scaled = draw('radar', rows, ['a'], ['m1', 'm2', 'm3']);
  assert.deepEqual(configOf(scaled).data.datasets.map((d) => d.data), [[100, 50, 100], [50, 100, 50]]);
  assert.match(scaled.notes[0], /scaled/);
  assert.deepEqual(scaled.data, rows.map((r) => r), 'data keeps the real figures');
  assert.match(draw('radar', [{ a: 'x', m1: 1, m2: 1, m3: 1 }], ['a'], ['m1', 'm2', 'm3']).error, /at least 2/);
  assert.match(draw('radar', [rows[0], { ...rows[1], m2: null }], ['a'], ['m1', 'm2', 'm3']).error, /negative or empty/);
  assert.match(draw('radar', [rows[0], { ...rows[1], m2: -1 }], ['a'], ['m1', 'm2', 'm3']).error, /negative or empty/);

  const axes = [{ a: 'x', v: 1 }, { a: 'y', v: 2 }, { a: 'z', v: 3 }];
  assert.deepEqual(configOf(draw('radar', axes, ['a'], ['v'])).data.datasets[0].data, [1, 2, 3]);
  assert.match(draw('radar', axes.slice(0, 2), ['a'], ['v']).error, /at least 3 axes/);
});

test('histogram counts every value exactly once, including the maximum', () => {
  const rows = Array.from({ length: 16 }, (_, i) => ({ a: `c${i}`, sum_v: i }));
  const chart = draw('histogram', rows, ['a'], ['sum_v']);
  assert.equal(chart.data.length, 5);
  assert.equal(chart.data.reduce((n, b) => n + b.count, 0), 16);
  assert.equal(chart.data[4].count, 4, 'the maximum falls in the last bin');
  assert.deepEqual(draw('histogram', [{ a: 'x', sum_v: 7 }, { a: 'y', sum_v: 7 }], ['a'], ['sum_v']).data.map((b) => b.count), [2], 'identical values do not divide by zero');
  assert.equal(draw('histogram', [{ a: 'x', b: 'y', c: 'z', sum_v: 1 }], ['a', 'b', 'c'], ['sum_v']).success, true, 'group_by only defines what is counted');
});

test('waterfall bars start where the last ended and finish on a total', () => {
  const { data } = configOf(draw('waterfall', [{ a: 'p', v: 10 }, { a: 'q', v: -4 }, { a: 'r', v: 1 }], ['a'], ['v']));
  assert.deepEqual(data.labels, ['p', 'q', 'r', 'Total']);
  assert.deepEqual(data.datasets[0].data, [[0, 10], [10, 6], [6, 7], [0, 7]]);
});

test('a waterfall total equals the sum of its data, with small steps after large ones intact', () => {
  const rows = [{ a: 'p', v: 123456.7 }, { a: 'q', v: 0.4 }, { a: 'r', v: 0.4 }, { a: 's', v: 0.4 }];
  const chart = draw('waterfall', rows, ['a'], ['v']);
  const bars = configOf(chart).data.datasets[0].data;
  assert.equal(bars.at(-1)[1], 123457.9);
  assert.ok(bars[2][1] > bars[2][0], 'a small step keeps its height');
  assert.deepEqual(chart.data.at(-1), { a: 'Total', v: 123457.9 }, 'the agent can quote the total');
  assert.deepEqual(configOf(draw('waterfall', [{ month: '2026-02', v: 1 }, { month: '2026-01', v: 2 }], ['month'], ['v'])).data.labels, ['2026-01', '2026-02', 'Total']);
});

test('steps that cancel out give a total of exactly zero', () => {
  const chart = draw('waterfall', [{ a: 'p', v: 0.1 }, { a: 'q', v: 0.2 }, { a: 'r', v: -0.3 }], ['a'], ['v']);
  assert.equal(chart.data.at(-1).v, 0);
  assert.deepEqual(configOf(chart).data.datasets[0].data.at(-1), [0, 0]);
});

test('a waterfall follows an explicit sort, and data is in drawn order', () => {
  const rows = [{ month: '2026-02', v: 1 }, { month: '2026-01', v: 2 }];
  const sorted = buildChart({ chartType: 'waterfall', title: 'T', reply: reply(rows, ['month'], ['v']), limited: false, sorted: true });
  assert.deepEqual(configOf(sorted).data.labels, ['2026-02', '2026-01', 'Total']);
  const unsorted = draw('waterfall', rows, ['month'], ['v']);
  assert.deepEqual(unsorted.data.map((r) => r.month), ['2026-01', '2026-02', 'Total']);
});

test('a one-metric radar has zero at its centre', () => {
  const axes = [{ a: 'x', v: 100 }, { a: 'y', v: 101 }, { a: 'z', v: 102 }];
  assert.equal(configOf(draw('radar', axes, ['a'], ['v'])).options.scales.r.beginAtZero, true);
});

test('a value exactly on a bin edge goes in the bin that starts there', () => {
  // The bins are 0.2 wide, and 0.2 * 3 is slightly above 0.6 in floating point.
  const rows = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].map((v, i) => ({ a: `c${i}`, v }));
  const { data } = draw('histogram', rows, ['a'], ['v']);
  assert.deepEqual(data.map((b) => b.count), [2, 2, 2, 2, 3]);
});

test('bars start at zero by default, however close the values are', () => {
  for (const chartType of ['bar', 'horizontal_bar', 'stacked_bar']) {
    const { options } = configOf(draw(chartType, [{ a: 'x', v: 100 }, { a: 'y', v: 101 }], ['a'], ['v']));
    assert.notEqual(options.scales[chartType === 'horizontal_bar' ? 'x' : 'y'].beginAtZero, false, chartType);
  }
});

test('narrow histogram bins keep distinct labels, and empty values are disclosed', () => {
  const rows = Array.from({ length: 16 }, (_, i) => ({ a: `c${i}`, v: 5000000 + i }));
  const chart = draw('histogram', [...rows, { a: 'none', v: null }], ['a'], ['v']);
  assert.equal(new Set(chart.data.map((b) => b.range)).size, chart.data.length);
  assert.match(chart.notes[1], /Left out 1 group with/);
});

test('points missing a value are disclosed and a negative bubble size is refused', () => {
  const rows = [{ a: 'x', m1: 1, m2: 2, m3: 3 }, { a: 'z', m1: null, m2: 4, m3: 1 }];
  const chart = draw('scatter', rows, ['a'], ['m1', 'm2']);
  assert.match(chart.notes[0], /Left out 1 group with/);
  assert.deepEqual(chart.data.map((r) => r.a), ['x'], 'data matches what is drawn');
  assert.match(draw('bubble', [{ a: 'x', m1: 1, m2: 2, m3: -3 }], ['a'], ['m1', 'm2', 'm3']).error, /cannot be negative/);
});

test('charts that would be wrong without every group refuse a cut-off list', () => {
  const cut = reply([{ a: 'x', sum_v: 1 }], ['a'], ['sum_v'], { truncated: true, groups_total: 9 });
  for (const chartType of ['pie', 'donut', 'stacked_bar', 'histogram', 'waterfall']) {
    assert.match(buildChart({ chartType, title: 'T', reply: cut, limited: true }).error, /needs every group/, chartType);
  }
});

test('each chart type says what shape it needs', () => {
  const row = [{ a: 'x', b: 'y', m1: 1, m2: 2 }];
  assert.match(draw('combo', row, ['a'], ['m1']).error, /combo needs/);
  assert.match(draw('scatter', row, ['a'], ['m1']).error, /scatter needs/);
  assert.match(draw('bubble', row, ['a'], ['m1', 'm2']).error, /bubble needs/);
  assert.match(draw('radar', row, ['a'], ['m1', 'm2']).error, /radar takes/);
  assert.match(draw('histogram', row, ['a'], ['m1', 'm2']).error, /histogram needs/);
  assert.match(draw('waterfall', row, ['a', 'b'], ['m1']).error, /waterfall needs/);
});

test('an average of a percentage carries a caveat, a sum does not', () => {
  const rows = [{ a: 'x', avg_gross_margin_pct: 0.4, sum_v: 1 }];
  assert.match(draw('bar', rows, ['a'], ['avg_gross_margin_pct']).notes[0], /count every row equally/);
  assert.equal(draw('bar', rows, ['a'], ['sum_v']).notes, undefined);
});
