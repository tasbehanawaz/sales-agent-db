const test = require('node:test');
const assert = require('node:assert');
const { TOOLS, requestPath } = require('./mcp');

test('every tool has a unique, client-safe name', () => {
  assert.ok(TOOLS.size > 50);
  for (const name of TOOLS.keys()) assert.match(name, /^[a-zA-Z0-9_-]{1,64}$/);
});

test('arguments are checked against the endpoint schema', () => {
  const doctor = TOOLS.get('sales_doctors_by_id').validate;
  assert.equal(doctor({}), false, 'missing path param');
  assert.equal(doctor({ id: { a: 1 } }), false, 'object path param');
  assert.equal(doctor({ id: 'D1', foo: 'bar' }), false, 'unknown key');

  const runs = TOOLS.get('mfg_production_runs').validate;
  assert.equal(runs({ plant_id: 'PLANT-001' }), false, 'non-UUID plant_id');
  assert.equal(runs({ shift: ['a', 'b'] }), false, 'array value');
  const args = { limit: '5', from: '2025-01-01' };
  assert.equal(runs(args), true);
  assert.strictEqual(args.limit, 5, 'workflow string coerced to integer');

  const table = TOOLS.get('apex_table').validate;
  assert.equal(table({ table: 'no-such-table' }), false);
  assert.equal(table({ table: 'action-catalog', region: 'North' }), true, 'per-table filters pass through');
});

test('requestPath fills path params and encodes the query', () => {
  assert.equal(requestPath('/api/doctors/{id}', { id: 'a/b' }), '/api/doctors/a%2Fb');
  assert.equal(
    requestPath('/api/apex/tables/{table}', { table: 'action-catalog', limit: 2, region: 'North East', to: null }),
    '/api/apex/tables/action-catalog?limit=2&region=North+East'
  );
});
