// MCP server (Streamable HTTP, stateless, JSON responses) over the REST API.
// Tools are generated from the OpenAPI spec, so every REST endpoint and its parameters
// stay the single source of truth. A tool call is replayed as a loopback HTTP request,
// which keeps auth, caching, validation and report download URLs identical to REST.
const http = require('http');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { swaggerSpec } = require('./swagger');
const { TABLES: APEX_TABLES } = require('./apex-table-routes');
const { name, version } = require('./package.json');

const APEX_TABLE_PREFIX = '/api/apex/tables/';

// Agents pick tables from this text, so it maps business topics to the table that holds them.
const APEX_TABLE_GUIDE = [
  'Read or total any Apex Group table. Without group_by or metrics it returns rows (capped by limit).',
  'With group_by and/or metrics it returns totals computed over every matching row: use that for any sum, average, rate, ranking or comparison instead of adding rows yourself.',
  'Filters: from/to (YYYY-MM-DD) on the table\'s period column; the column filters listed by apex_tables; and business_unit, region, entity, department on tables linked to an org unit or entity.',
  'Metrics: count, distinct:<column>, sum|avg|min|max:<numeric column>. avg of a 0/1 flag is a rate (avg:late_flag = share of late tasks).',
  'If the reply has truncated: true, only the first groups (by sort) were returned: narrow the filters or sort by what matters.',
  'Point-in-time values (headcount, balances, outstanding amounts) are per month: filter or group by month instead of summing across months.',
  'Example: {"table":"serving-executive-scorecard-monthly","group_by":"business_unit","metrics":"sum:revenue,sum:ebitda,sum:operating_cash_flow","from":"2025-10-01","to":"2026-09-30"}.',
  'Where to look:',
  'KPIs by region, business unit and month: serving-executive-scorecard-monthly. Control risk by quarter: serving-control-risk-scorecard-quarterly.',
  'Revenue, discount and margin by customer, offering or channel: fact-sales-transaction. Bookings, pipeline, renewals: fact-contract-pipeline.',
  'Customer health, disputes, SLA, credit notes: fact-customer-monthly, fact-customer-service. Discount overrides: fact-discount-approval.',
  'Budget vs actual vs forecast by cost centre and account: fact-budget-forecast. Ledger: fact-gl-transaction. Cash: fact-cash-position.',
  'Receivables, DSO, disputes, billing errors: fact-ar-invoice-payment. Payables: fact-ap-invoice-payment.',
  'Month-end close tasks and reconciliations: fact-reconciliation-close. Manual journals: fact-manual-journal.',
  'Vendor bank and master-data changes: fact-vendor-master-change. Access and segregation-of-duties events: fact-access-sod-event.',
  'Control tests and exceptions: fact-control-test, fact-control-exception. Audit findings and remediation: fact-audit-finding, fact-issue-remediation.',
  'Headcount, pay, workload, critical roles: fact-employee-monthly. Overtime and absence: fact-time-attendance. Hires and exits: fact-hire-exit.',
  'Vacancies: fact-vacancy-recruitment. Engagement and manager scores: fact-engagement-performance. Training, critical skills, pay changes: fact-learning-compensation.',
  'Names and attributes: dim-organisation, dim-customer, dim-product-service, dim-account, dim-cost-center, dim-vendor, dim-risk-control, dim-employee.',
  'KPI definitions: meta-kpi-definition. Prediction models and runs: meta-model-registry. Monthly driver indices: meta-latent-drivers-monthly.',
  'Call apex_tables for each table\'s filters, group_by columns and numeric measures.',
].join(' ');
const LOOPBACK_TIMEOUT_MS = 120000;

// Workflow variables often arrive as strings, so "5" is accepted where an integer is declared.
const ajv = addFormats(new Ajv({ strict: false, coerceTypes: true, allErrors: true }));

function inputSchema(parameters = []) {
  const properties = {};
  const required = [];
  for (const p of parameters) {
    properties[p.name] = p.description ? { ...p.schema, description: p.description } : { ...p.schema };
    if (p.required || p.in === 'path') required.push(p.name);
  }
  return { type: 'object', properties, ...(required.length && { required }), additionalProperties: false };
}

// One tool per GET operation under /api. File downloads are skipped (report tools already
// return a download_url), and the 48 per-table Apex endpoints collapse into apex_table.
function buildTools() {
  const tools = new Map();
  const add = (name, route, definition) => {
    if (tools.has(name)) throw new Error(`Duplicate MCP tool name ${name} (${tools.get(name).route} and ${route})`);
    tools.set(name, { route, definition, validate: ajv.compile(definition.inputSchema) });
  };
  for (const [route, ops] of Object.entries(swaggerSpec.paths)) {
    const op = ops.get;
    if (!op || !route.startsWith('/api/') || route.includes('/download/') || route.startsWith(APEX_TABLE_PREFIX)) continue;
    add(op.operationId, route, {
      name: op.operationId,
      title: op.summary,
      description: [op.summary, op.description].filter(Boolean).join('. '),
      inputSchema: inputSchema(op.parameters),
      annotations: { readOnlyHint: !route.includes('/reports/'), openWorldHint: false },
    });
  }
  add('apex_table', `${APEX_TABLE_PREFIX}{table}`, {
    name: 'apex_table',
    title: 'Read an Apex table',
    description: APEX_TABLE_GUIDE,
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string', enum: Object.keys(APEX_TABLES) },
        limit: { type: 'integer', minimum: 1 },
        from: { type: 'string', format: 'date', description: 'Start date (YYYY-MM-DD), for tables with a date column' },
        to: { type: 'string', format: 'date', description: 'End date (YYYY-MM-DD), for tables with a date column' },
        group_by: { type: 'string', description: 'Comma-separated columns to total by, e.g. business_unit,month' },
        metrics: { type: 'string', description: 'Comma-separated totals: count, distinct:<column>, sum|avg|min|max:<numeric column>' },
        sort: { type: 'string', description: 'Group or metric name to sort by, - prefix for descending, e.g. -sum_revenue' },
      },
      required: ['table'],
      additionalProperties: { type: ['string', 'integer', 'number'] },
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  });
  return tools;
}

const TOOLS = buildTools();

function requestPath(route, args) {
  const query = new URLSearchParams();
  const path = route.replace(/\{(\w+)\}/g, (_, key) => encodeURIComponent(args[key]));
  for (const [key, value] of Object.entries(args)) {
    if (route.includes(`{${key}}`)) continue;
    query.set(key, String(value));
  }
  const qs = query.toString();
  return qs ? `${path}?${qs}` : path;
}

// Host and protocol are forwarded so report download_url points at the public address, not loopback.
function loopback({ port, apiKey, req, signal, path }) {
  return new Promise((resolve, reject) => {
    const outgoing = http.request(
      {
        host: '127.0.0.1',
        port,
        path,
        method: 'GET',
        headers: { 'x-api-key': apiKey, host: req.get('host'), 'x-forwarded-proto': req.protocol },
        timeout: LOOPBACK_TIMEOUT_MS,
        signal,
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      }
    );
    outgoing.on('timeout', () => outgoing.destroy(new Error(`Endpoint did not answer within ${LOOPBACK_TIMEOUT_MS / 1000} seconds`)));
    outgoing.on('error', reject);
    outgoing.end();
  });
}

async function callTool(name, rawArgs, ctx) {
  const tool = TOOLS.get(name);
  if (!tool) return { isError: true, text: `Unknown tool: ${name}` };
  // Workflows send null for empty fields; drop them before coercion turns null into "" or 0.
  const args = Object.fromEntries(Object.entries(rawArgs || {}).filter(([, v]) => v != null));
  if (!tool.validate(args)) {
    const problems = tool.validate.errors.map((e) => `${e.instancePath || 'arguments'} ${e.message}`).join('; ');
    return { isError: true, text: `Invalid arguments for ${name}: ${problems}` };
  }
  const { status, body } = await loopback({ ...ctx, path: requestPath(tool.route, args) });
  return { isError: status >= 400, text: body };
}

// One model step instead of one per tool: an agent that needs several figures asks for all of them at once,
// and the calls run in parallel. Each call is validated and answered exactly as if it were made on its own.
const RUN_MANY_MAX = 10;
const RUN_MANY = {
  name: 'run_many',
  title: 'Run several tools at once',
  description:
    `Run up to ${RUN_MANY_MAX} tools from this server in one call, in parallel. Use it whenever an answer needs more than one tool. ` +
    'Returns {"results":[{"tool","isError","result"}]} in the same order as calls; each result is that tool\'s normal reply. ' +
    'Example: {"calls":[{"tool":"apex_table","arguments":{"table":"serving-executive-scorecard-monthly","metrics":"sum:revenue","from":"2025-10-01","to":"2026-09-30"}},' +
    '{"tool":"apex_customer_risk","arguments":{"limit":10}}]}',
  inputSchema: {
    type: 'object',
    properties: {
      calls: {
        type: 'array',
        minItems: 1,
        maxItems: RUN_MANY_MAX,
        items: {
          type: 'object',
          properties: {
            tool: { type: 'string', enum: [...TOOLS.keys()] },
            arguments: { type: 'object' },
          },
          required: ['tool'],
          additionalProperties: false,
        },
      },
    },
    required: ['calls'],
    additionalProperties: false,
  },
  annotations: { readOnlyHint: false, openWorldHint: false },
};
const validateRunMany = ajv.compile(RUN_MANY.inputSchema);

function createServer(ctx) {
  const server = new Server({ name, version }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [...[...TOOLS.values()].map((t) => t.definition), RUN_MANY],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    if (name === RUN_MANY.name) {
      if (!validateRunMany(args || {})) {
        const problems = validateRunMany.errors.map((e) => `${e.instancePath || 'arguments'} ${e.message}`).join('; ');
        return { isError: true, content: [{ type: 'text', text: `Invalid arguments for ${RUN_MANY.name}: ${problems}` }] };
      }
      const results = await Promise.all(args.calls.map(async (c) => {
        const { isError, text } = await callTool(c.tool, c.arguments, ctx);
        let result;
        try {
          result = JSON.parse(text);
        } catch {
          result = text;
        }
        return { tool: c.tool, isError, result };
      }));
      return { isError: results.every((r) => r.isError), content: [{ type: 'text', text: JSON.stringify({ results }) }] };
    }
    const { isError, text } = await callTool(name, args, ctx);
    return { isError, content: [{ type: 'text', text }] };
  });

  return server;
}

// Responses are always plain JSON (enableJsonResponse), never a stream, so the SDK's rule that clients
// must also accept text/event-stream only rejects plain HTTP callers such as Swagger UI and Vertx.
// The SDK reads req.headers, or rawHeaders as a fallback, so both are rewritten.
const MCP_ACCEPT = 'application/json, text/event-stream';
function acceptJsonAndStream(req) {
  req.headers.accept = MCP_ACCEPT;
  const i = req.rawHeaders.findIndex((h, n) => n % 2 === 0 && h.toLowerCase() === 'accept');
  if (i >= 0) req.rawHeaders[i + 1] = MCP_ACCEPT;
  else req.rawHeaders.push('Accept', MCP_ACCEPT);
}

// Stateless: a fresh server and transport per request, so any instance can answer any call.
function mcpHandler({ port, apiKey }) {
  return async (req, res) => {
    const aborter = new AbortController();
    const server = createServer({ port, apiKey, req, signal: aborter.signal });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
      aborter.abort();
      transport.close();
      server.close();
    });
    try {
      await server.connect(transport);
      acceptJsonAndStream(req);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error('MCP error:', err);
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
      }
    }
  };
}

module.exports = { mcpHandler, TOOLS, RUN_MANY, requestPath };
