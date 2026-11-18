const test = require('node:test');
const assert = require('node:assert');
const { TABLES, tableFilters, aggregation, organisation, related, selectClause, joins, wantsLean } = require('./apex-table-routes');

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

test('selectClause narrows non-aggregate reads to named columns', () => {
  const customer = TABLES['dim-customer'];
  assert.equal(selectClause(customer).sql, 't.*', 'omitted select defaults to every column');
  assert.equal(selectClause(customer, '').sql, 't.*', 'empty select defaults to every column');
  assert.equal(
    selectClause(customer, 'customer_id,customer_name').sql,
    't.[customer_id], t.[customer_name]',
    'validated columns are bracket-quoted and comma-joined',
  );
  assert.equal(
    selectClause(customer, 'customer_id, customer_name , customer_id').sql,
    't.[customer_id], t.[customer_name]',
    'whitespace is trimmed and duplicates are dropped (via list)',
  );
  assert.ok(selectClause(customer, 'nope').error, 'unknown column is rejected');
  assert.ok(selectClause(customer, 'constructor').error, 'Object.prototype names are not columns');
  assert.ok(selectClause(customer, 'customer_id,nope').error, 'any unknown column rejects the whole clause');
});

test('customer, vendor and offering names join in through their ids', () => {
  const sales = TABLES['fact-sales-transaction'];
  assert.deepEqual(related(sales).map((r) => r.name).filter((n) => n.endsWith('_name')), ['customer_name', 'offering_name']);
  assert.deepEqual(related(TABLES['dim-customer']).map((r) => r.name), [], 'dim_customer has its own name');

  const f = tableFilters(TABLES['pred-customer-risk'], { customer_name: 'Indus Power Limited' }, {});
  assert.ok(f.clauses.includes('c.[customer_name] = @customer_name'));
  assert.match(f.join, /dim_customer\] c ON c\.\[customer_id\] = t\.\[customer_id\]/);

  const agg = aggregation(sales, { group_by: 'customer_name,region', metrics: 'sum:net_revenue' });
  assert.match(agg.groupBy, /^GROUP BY c\.\[customer_name\], o\.\[region\]$/);
  assert.equal((agg.join.match(/LEFT JOIN/g) || []).length, 2, 'one join per dimension');
  assert.match(aggregation(TABLES['fact-ap-invoice-payment'], { metrics: 'distinct:vendor_name' }).select, /COUNT\(DISTINCT v\.\[vendor_name\]\)/);

  const rows = selectClause(sales);
  assert.equal(rows.sql, 't.*, c.[customer_name] AS [customer_name], ps.[offering_name] AS [offering_name]', 'rows carry the names by default');
  const picked = selectClause(sales, 'customer_name,net_revenue');
  assert.equal(picked.sql, 'c.[customer_name] AS [customer_name], t.[net_revenue]');
  assert.doesNotMatch(picked.join, /dim_product_service/, 'only the joins the selected columns need');
  assert.ok(selectClause(sales, 'vendor_name').error, 'sales rows have no vendor');
  assert.equal(selectClause(TABLES['dim-customer'], 'customer_name').sql, 't.[customer_name]', 'own column, no join');
});

test('wantsLean reads the lean query flag', () => {
  assert.equal(wantsLean({}), false, 'missing flag defaults to false (verbose)');
  assert.equal(wantsLean({ lean: '' }), false, 'empty value stays verbose');
  assert.equal(wantsLean({ lean: '0' }), false, '0 is not lean');
  assert.equal(wantsLean({ lean: 'false' }), false, 'false is not lean');
  assert.equal(wantsLean({ lean: '1' }), true, '1 opts in');
  assert.equal(wantsLean({ lean: 'true' }), true, 'true opts in');
});

test('a dimension is joined once however many filters and groups need it', () => {
  const sales = TABLES['fact-sales-transaction'];
  const f = tableFilters(sales, { region: 'North', customer_name: 'x' }, {});
  const agg = aggregation(sales, { group_by: 'customer_name,region', metrics: 'count' });
  assert.equal(joins([f.join, agg.join]).split('\n').length, 2, 'one org join and one customer join, not three');
});
