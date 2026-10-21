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
    description:
      'Rows from one Apex Group table. Call apex_tables first to see each table\'s row count, date column and filter names; ' +
      'pass those filters as extra arguments.',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string', enum: Object.keys(APEX_TABLES) },
        limit: { type: 'integer', minimum: 1 },
        from: { type: 'string', format: 'date', description: 'Start date (YYYY-MM-DD), for tables with a date column' },
        to: { type: 'string', format: 'date', description: 'End date (YYYY-MM-DD), for tables with a date column' },
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

function createServer(ctx) {
  const server = new Server({ name, version }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [...TOOLS.values()].map((t) => t.definition),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = TOOLS.get(request.params.name);
    if (!tool) {
      return { isError: true, content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }] };
    }
    // Workflows send null for empty fields; drop them before coercion turns null into "" or 0.
    const args = Object.fromEntries(Object.entries(request.params.arguments || {}).filter(([, v]) => v != null));
    if (!tool.validate(args)) {
      const problems = tool.validate.errors.map((e) => `${e.instancePath || 'arguments'} ${e.message}`).join('; ');
      return { isError: true, content: [{ type: 'text', text: `Invalid arguments for ${tool.definition.name}: ${problems}` }] };
    }
    const { status, body } = await loopback({ ...ctx, path: requestPath(tool.route, args) });
    return { isError: status >= 400, content: [{ type: 'text', text: body }] };
  });

  return server;
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
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error('MCP error:', err);
      if (!res.headersSent) {
        res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
      }
    }
  };
}

module.exports = { mcpHandler, TOOLS, requestPath };
