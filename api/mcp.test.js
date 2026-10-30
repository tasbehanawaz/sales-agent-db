const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { TOOLS, RUN_MANY, requestPath, mcpHandler } = require('./mcp');

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

test('apex_chart requires what a chart needs and passes table filters through', () => {
  const chart = TOOLS.get('apex_chart').validate;
  const args = { table: 'action-catalog', chart_type: 'bar', title: 'T', group_by: 'function', metrics: 'count' };
  assert.equal(chart(args), true);
  assert.equal(chart({ ...args, region: 'North' }), true, 'per-table filters pass through');
  assert.equal(chart({ ...args, chart_type: 'sankey' }), false);
  for (const missing of ['chart_type', 'title', 'group_by', 'metrics']) {
    const { [missing]: _, ...rest } = args;
    assert.equal(chart(rest), false, `missing ${missing}`);
  }
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
      assert.equal((await res.json()).result.tools.length, TOOLS.size + 1, 'every endpoint tool plus run_many');
    }
  } finally {
    server.close();
  }
});

test('run_many validates each call like a single call and keeps the order', async () => {
  const app = express();
  app.use(express.json());
  app.post('/mcp', mcpHandler({ port: 0, apiKey: 'unused' }));
  const server = app.listen(0);
  const url = `http://127.0.0.1:${server.address().port}/mcp`;
  const call = async (args) => {
    const body = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'run_many', arguments: args } };
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return (await res.json()).result;
  };
  try {
    const both = await call({ calls: [{ tool: 'sales_doctors_by_id' }, { tool: 'apex_table', arguments: { table: 'no-such-table' } }] });
    const { results } = JSON.parse(both.content[0].text);
    assert.deepEqual(results.map((r) => [r.tool, r.isError]), [['sales_doctors_by_id', true], ['apex_table', true]]);
    assert.match(results[0].result, /Invalid arguments for sales_doctors_by_id/);
    assert.equal(both.isError, true, 'all calls failed');

    const nulls = JSON.parse((await call({ calls: [{ tool: 'sales_stats', arguments: null }] })).content[0].text);
    assert.doesNotMatch(String(nulls.results[0].result), /Invalid arguments/, 'null arguments are accepted as in a single call');

    assert.equal((await call({ calls: [] })).isError, true, 'empty list');
    assert.equal((await call({ calls: [{ tool: 'run_many' }] })).isError, true, 'no nesting');
    const tooMany = Array.from({ length: RUN_MANY.inputSchema.properties.calls.maxItems + 1 }, () => ({ tool: 'sales_stats' }));
    assert.equal((await call({ calls: tooMany })).isError, true, 'capped');
  } finally {
    server.close();
  }
});

test('run_many returns every result even when some calls cannot reach the API', async () => {
  const app = express();
  app.use(express.json());
  const server = app.listen(0);
  const closed = app.listen(0);
  const closedPort = closed.address().port;
  closed.close();
  app.post('/mcp', mcpHandler({ port: closedPort, apiKey: 'unused' }));
  const url = `http://127.0.0.1:${server.address().port}/mcp`;
  try {
    const calls = Array.from({ length: 7 }, (_, i) => ({ tool: i % 2 ? 'sales_stats' : 'apex_tables' }));
    const body = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'run_many', arguments: { calls } } };
    const res = await (await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json();
    assert.ok(res.result, 'a per-call failure is not a JSON-RPC error for the whole batch');
    const { results } = JSON.parse(res.result.content[0].text);
    assert.deepEqual(results.map((r) => r.tool), calls.map((c) => c.tool), 'order kept across parallel groups');
    assert.ok(results.every((r) => r.isError && /ECONNREFUSED/.test(r.result)));
  } finally {
    server.close();
  }
});
