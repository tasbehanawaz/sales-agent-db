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

test('an average of a percentage carries a caveat, a sum does not', () => {
  const rows = [{ a: 'x', avg_gross_margin_pct: 0.4, sum_v: 1 }];
  assert.match(draw('bar', rows, ['a'], ['avg_gross_margin_pct']).notes[0], /count every row equally/);
  assert.equal(draw('bar', rows, ['a'], ['sum_v']).notes, undefined);
});
