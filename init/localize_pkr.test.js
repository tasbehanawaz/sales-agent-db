const test = require('node:test');
const assert = require('node:assert');
const { MONEY, renamed } = require('./localize_pkr');
const COLUMNS = require('../api/apex-table-columns');
const { TABLES } = require('../api/apex-table-catalog');

test('every Apex money column the script converts is a measure the API knows, under its new name', () => {
  const byTable = Object.fromEntries(Object.entries(TABLES).map(([key, t]) => [t.table, COLUMNS[key]]));
  for (const [table, cols] of Object.entries(MONEY.apex)) {
    assert.ok(byTable[table], `${table} is an API table`);
    for (const col of cols) assert.equal(byTable[table][renamed(col)], 'number', `${table}.${renamed(col)}`);
  }
  assert.equal(renamed('investment_usd_m'), 'investment_pkr_m');
  assert.equal(renamed('implementation_cost_usd'), 'implementation_cost_pkr');
  assert.equal(renamed('revenue'), 'revenue');
});
