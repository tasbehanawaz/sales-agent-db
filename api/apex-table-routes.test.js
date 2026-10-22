const test = require('node:test');
const assert = require('node:assert');
const { TABLES, tableFilters, aggregation, organisation } = require('./apex-table-routes');

test('from/to use the period key of tables without a date column', () => {
  const scorecard = tableFilters(TABLES['serving-executive-scorecard-monthly'], { from: '2025-10-01', to: '2026-09-30' }, {});
  assert.deepEqual(scorecard.params, { from_date: 202510, to_date: 202609 });
  assert.match(scorecard.clauses[0], /t\.\[month_id\] >= @from_date/);

  const sales = tableFilters(TABLES['fact-sales-transaction'], { from: '2026-01-01' }, {});
  assert.equal(sales.params.from_date, 20260101);

  const quarterly = tableFilters(TABLES['serving-control-risk-scorecard-quarterly'], { to: '2026-08-15' }, {});
  assert.equal(quarterly.params.to_date, '2026Q3');

  assert.ok(tableFilters(TABLES['fact-gl-transaction'], { from: '2026/01/01' }, {}).error);
});

test('business unit and region come from dim_organisation unless the table has them', () => {
  assert.deepEqual(organisation(TABLES['fact-control-exception']).names, ['business_unit', 'region', 'entity', 'department']);
  assert.deepEqual(organisation(TABLES['fact-reconciliation-close']).names, ['entity', 'region'], 'entity_id tables have no single business unit');
  assert.deepEqual(organisation(TABLES['serving-executive-scorecard-monthly']).names, [], 'own region and business_unit columns');

  const f = tableFilters(TABLES['fact-control-exception'], { business_unit: 'Managed Services' }, {});
  assert.match(f.join, /dim_organisation\] o ON o\.org_unit_id = t\.org_unit_id/);
  assert.ok(f.clauses.includes('o.[business_unit] = @business_unit'));
});

test('aggregation totals in SQL with float averages and validated names', () => {
  const close = TABLES['fact-reconciliation-close'];
  const agg = aggregation(close, { group_by: 'task_name,month', metrics: 'count,avg:late_flag' });
  assert.match(agg.select, /AVG\(CAST\(t\.\[late_flag\] AS float\)\)/, 'AVG of an int flag must not truncate to 0');
  assert.match(agg.groupBy, /^GROUP BY t\.\[task_name\], STUFF/);
  assert.equal(agg.order, '[month] ASC', 'period groups sort chronologically');
  assert.deepEqual(agg.metrics, ['count', 'avg_late_flag']);

  assert.equal(aggregation(close, {}), null, 'plain rows without group_by or metrics');
  assert.equal(aggregation(close, { group_by: 'region' }).join.includes('dim_organisation'), true);
  assert.equal(aggregation(close, { group_by: 'task_name' }).order, '[count] DESC');
  assert.ok(aggregation(close, { metrics: 'sum:task_name' }).error, 'sum of a text column');
  assert.ok(aggregation(close, { group_by: 'business_unit' }).error, 'no business unit on entity tables');
  assert.ok(aggregation(close, { group_by: 'task_name', sort: 'revenue' }).error);
  assert.ok(aggregation(TABLES['serving-control-risk-scorecard-quarterly'], { group_by: 'month' }).error, 'quarterly table has no month');
  assert.ok(aggregation(close, { group_by: 'constructor' }).error, 'Object.prototype names are not columns');
  assert.ok(aggregation(close, { metrics: 'distinct:toString' }).error);
  assert.deepEqual(aggregation(close, { group_by: 'status,status', metrics: 'count,count' }).metrics, ['count'], 'repeated names are dropped');
});
