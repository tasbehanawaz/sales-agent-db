const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { TOOLS, requestPath, mcpHandler } = require('./mcp');

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
    requestPath('/api/apex/tables/{table}', { table: 'action-catalog', limit: 2, region: 'North East' }),
    '/api/apex/tables/action-catalog?limit=2&region=North+East'
  );
});

test('plain JSON clients get a JSON reply whatever Accept they send', async () => {
  const app = express();
  app.use(express.json());
  app.post('/mcp', mcpHandler({ port: 0, apiKey: 'unused' }));
  const server = app.listen(0);
  const url = `http://127.0.0.1:${server.address().port}/mcp`;
  try {
    for (const accept of ['application/json', '*/*', null]) {
      const headers = { 'content-type': 'application/json', ...(accept && { accept }) };
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) });
      assert.equal(res.status, 200, `accept=${accept}`);
      assert.equal((await res.json()).result.tools.length, TOOLS.size);
    }
  } finally {
    server.close();
  }
});
