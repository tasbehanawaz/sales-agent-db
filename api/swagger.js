const swaggerJSDoc = require('swagger-jsdoc');

const PORT = process.env.API_PORT || 3000;
const HOST = process.env.API_HOST || 'localhost';
const SERVER_URL = process.env.SWAGGER_SERVER_URL || `http://${HOST}:${PORT}`;

const successEnvelope = (dataSchema, withCount = true) => {
  const props = { success: { type: 'boolean', example: true } };
  if (withCount) props.count = { type: 'integer', example: 1 };
  props.data = dataSchema;
  return { type: 'object', properties: props };
};

const errorEnvelope = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    error: { type: 'string' },
  },
};

const commonListPath = (summary, description, tag, extraParams = []) => ({
  tags: [tag],
  summary,
  description,
  parameters: [
    { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 1000, default: 100 } },
    ...extraParams,
  ],
  responses: {
    200: {
      description: 'Success',
      content: {
        'application/json': {
          schema: successEnvelope({ type: 'array', items: { type: 'object', additionalProperties: true } }),
        },
      },
    },
    401: { $ref: '#/components/responses/Unauthorized' },
    500: { $ref: '#/components/responses/ServerError' },
  },
});

const dateRangeParams = [
  { in: 'query', name: 'from', schema: { type: 'string', format: 'date' }, description: 'Start date (YYYY-MM-DD)' },
  { in: 'query', name: 'to', schema: { type: 'string', format: 'date' }, description: 'End date (YYYY-MM-DD)' },
];

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'Sales & Manufacturing Agent API',
    version: '1.0.0',
    description:
      'REST API for the Sales Agent and Manufacturing Agent databases. All `/api/*` endpoints require an `x-api-key` header.',
    contact: { name: 'Sales Agent API' },
    license: { name: 'MIT' },
  },
  servers: [{ url: SERVER_URL, description: 'Configured server' }],
  tags: [
    { name: 'Health', description: 'Service health' },
    { name: 'Sales - Core', description: 'Core sales entities' },
    { name: 'Sales - Analytics', description: 'Aggregated sales analytics' },
    { name: 'Sales - Insights', description: 'Forecasts and recommended actions' },
    { name: 'Sales - Reports', description: 'PPTX report generation and downloads' },
    { name: 'Manufacturing - Dimensions', description: 'Plants, lines, machines, products' },
    { name: 'Manufacturing - Facts', description: 'Production, downtime, quality, maintenance, inventory, cost' },
    { name: 'Manufacturing - KPIs', description: 'OEE, downtime analysis, quality trends' },
    { name: 'Manufacturing - Reports', description: 'PPTX/PDF report generation and downloads' },
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
        description: 'API key from the `API_KEY` env variable',
      },
    },
    responses: {
      Unauthorized: {
        description: 'Missing or invalid API key',
        content: { 'application/json': { schema: errorEnvelope } },
      },
      BadRequest: {
        description: 'Invalid request parameters',
        content: { 'application/json': { schema: errorEnvelope } },
      },
      NotFound: {
        description: 'Resource not found',
        content: { 'application/json': { schema: errorEnvelope } },
      },
      ServerError: {
        description: 'Server error',
        content: { 'application/json': { schema: errorEnvelope } },
      },
    },
    schemas: {
      ErrorEnvelope: errorEnvelope,
      HealthResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'ok' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      ReportGenerateResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          report_type: { type: 'string' },
          format: { type: 'string', enum: ['pptx', 'pdf'], description: 'Output format of the report' },
          filename: { type: 'string' },
          download_url: { type: 'string', format: 'uri' },
          message: { type: 'string' },
        },
      },
      QueryReportResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          query: { type: 'string', description: 'User query that was processed' },
          title: { type: 'string', description: 'Report title derived from the query' },
          report_type: { type: 'string', example: 'query-driven', description: 'Always query-driven for this endpoint' },
          inferred_report_type: { type: 'string', description: 'Same as report_type (query-driven)' },
          topics: { type: 'array', items: { type: 'string' }, description: 'DB topics used to build the report' },
          matched_template: { type: 'string', description: 'Closest legacy template name (for reference only)' },
          format: { type: 'string', enum: ['pptx', 'pdf'], description: 'Output format of the report' },
          filename: { type: 'string' },
          download_url: { type: 'string', format: 'uri' },
          message: { type: 'string' },
        },
      },
    },
  },
  security: [{ ApiKeyAuth: [] }],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        security: [],
        responses: {
          200: {
            description: 'Service is up',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } } },
          },
        },
      },
    },
    '/api/doctors': { get: commonListPath('List doctors', 'Return doctors (up to `limit`).', 'Sales - Core') },
    '/api/doctors/{id}': {
      get: {
        tags: ['Sales - Core'],
        summary: 'Get doctor by id',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'object', additionalProperties: true, nullable: true },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/sales-reps': { get: commonListPath('List sales reps', 'Return sales reps.', 'Sales - Core') },
    '/api/products': {
      get: {
        tags: ['Sales - Core'],
        summary: 'List products',
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: successEnvelope({ type: 'array', items: { type: 'object', additionalProperties: true } }),
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/pharmacies': { get: commonListPath('List pharmacies', 'Return pharmacies.', 'Sales - Core') },
    '/api/call-planning': {
      get: commonListPath('List call planning entries', 'Filterable planned/actual calls.', 'Sales - Core', [
        { in: 'query', name: 'region', schema: { type: 'string' } },
        { in: 'query', name: 'rep_id', schema: { type: 'string' } },
        ...dateRangeParams,
      ]),
    },
    '/api/secondary-sales': {
      get: commonListPath('List secondary sales', 'Filterable secondary sales rows.', 'Sales - Core', [
        { in: 'query', name: 'sku', schema: { type: 'string' } },
        { in: 'query', name: 'region', schema: { type: 'string' } },
        ...dateRangeParams,
      ]),
    },
    '/api/rep-performance': {
      get: {
        tags: ['Sales - Analytics'],
        summary: 'Rep performance summary',
        description: 'Sales totals, unique pharmacies, calls and adherence per rep.',
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: successEnvelope({ type: 'array', items: { type: 'object', additionalProperties: true } }),
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/product-trends': {
      get: {
        tags: ['Sales - Analytics'],
        summary: 'Product monthly trends',
        parameters: [
          { in: 'query', name: 'months', schema: { type: 'integer', minimum: 1, maximum: 24, default: 12 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 1000, default: 200 } },
          { in: 'query', name: 'region', schema: { type: 'string' } },
          { in: 'query', name: 'sku', schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: successEnvelope({ type: 'array', items: { type: 'object', additionalProperties: true } }),
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/call-effectiveness': {
      get: {
        tags: ['Sales - Analytics'],
        summary: 'Call effectiveness by tier/region/market',
        parameters: [
          { in: 'query', name: 'months', schema: { type: 'integer', minimum: 1, maximum: 24, default: 12 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 1000, default: 200 } },
          { in: 'query', name: 'region', schema: { type: 'string' } },
          { in: 'query', name: 'tier', schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: successEnvelope({ type: 'array', items: { type: 'object', additionalProperties: true } }),
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/inactive-doctors': {
      get: {
        tags: ['Sales - Analytics'],
        summary: 'Doctors inactive beyond N days',
        parameters: [{ in: 'query', name: 'days', schema: { type: 'integer', minimum: 0, default: 30 } }],
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: successEnvelope({ type: 'array', items: { type: 'object', additionalProperties: true } }),
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/at-risk-territories': {
      get: {
        tags: ['Sales - Analytics'],
        summary: 'Territories at risk (sales/adherence)',
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: successEnvelope({ type: 'array', items: { type: 'object', additionalProperties: true } }),
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/territory-coverage': {
      get: {
        tags: ['Sales - Analytics'],
        summary: 'Territory coverage by rep',
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: successEnvelope({ type: 'array', items: { type: 'object', additionalProperties: true } }),
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/insights/forecast': {
      get: {
        tags: ['Sales - Insights'],
        summary: 'Aggregate sales forecast',
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: successEnvelope({ type: 'object', additionalProperties: true }, false),
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/insights/forecast/product': {
      get: {
        tags: ['Sales - Insights'],
        summary: 'Per-product sales forecast',
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: successEnvelope({ type: 'object', additionalProperties: true }, false),
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/insights/actions': {
      get: {
        tags: ['Sales - Insights'],
        summary: 'Recommended next-best actions',
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: successEnvelope({ type: 'object', additionalProperties: true }),
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/insights': {
      get: {
        tags: ['Sales - Insights'],
        summary: 'Combined forecast + actions summary',
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: successEnvelope({ type: 'object', additionalProperties: true }, false),
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/stats': {
      get: {
        tags: ['Sales - Analytics'],
        summary: 'Row counts across core tables',
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: successEnvelope({ type: 'object', additionalProperties: true }, false),
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/sales/reports/generate': {
      get: {
        tags: ['Sales - Reports'],
        summary: 'Generate a sales PPTX report',
        parameters: [
          {
            in: 'query',
            name: 'report_type',
            required: true,
            schema: { type: 'string', enum: ['sales-overview', 'doctor-distribution', 'pharmacy-network'] },
          },
        ],
        responses: {
          200: {
            description: 'Report generated',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ReportGenerateResponse' } },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/sales/reports/download/{filename}': {
      get: {
        tags: ['Sales - Reports'],
        summary: 'Download a generated sales report',
        parameters: [
          {
            in: 'path',
            name: 'filename',
            required: true,
            schema: { type: 'string', pattern: '^[a-z-]+_\\d+\\.pptx$' },
          },
        ],
        responses: {
          200: {
            description: 'PPTX file download',
            content: {
              'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/reports/download/{filename}': {
      get: {
        tags: ['Manufacturing - Reports'],
        summary: 'Download a generated manufacturing report (PPTX or PDF, no auth)',
        security: [],
        parameters: [
          {
            in: 'path',
            name: 'filename',
            required: true,
            schema: { type: 'string', pattern: '^mfg-[a-z-]+_\\d+\\.(pptx|pdf)$' },
            description: 'Generated report filename (mfg-{type}_{timestamp}.pptx or .pdf)',
          },
        ],
        responses: {
          200: {
            description: 'Report file download (PPTX or PDF)',
            content: {
              'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
                schema: { type: 'string', format: 'binary' },
              },
              'application/pdf': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/mfg/plants': {
      get: {
        tags: ['Manufacturing - Dimensions'],
        summary: 'List plants',
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: successEnvelope({ type: 'array', items: { type: 'object', additionalProperties: true } }),
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/mfg/production-lines': {
      get: {
        tags: ['Manufacturing - Dimensions'],
        summary: 'List production lines',
        parameters: [{ in: 'query', name: 'plant_id', schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: successEnvelope({ type: 'array', items: { type: 'object', additionalProperties: true } }),
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/mfg/machines': {
      get: {
        tags: ['Manufacturing - Dimensions'],
        summary: 'List machines',
        parameters: [
          { in: 'query', name: 'line_id', schema: { type: 'string', format: 'uuid' } },
          { in: 'query', name: 'criticality', schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: successEnvelope({ type: 'array', items: { type: 'object', additionalProperties: true } }),
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/mfg/products': {
      get: {
        tags: ['Manufacturing - Dimensions'],
        summary: 'List manufacturing products',
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: successEnvelope({ type: 'array', items: { type: 'object', additionalProperties: true } }),
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/mfg/production-runs': {
      get: commonListPath('List production runs', '', 'Manufacturing - Facts', [
        { in: 'query', name: 'plant_id', schema: { type: 'string', format: 'uuid' } },
        { in: 'query', name: 'line_id', schema: { type: 'string', format: 'uuid' } },
        { in: 'query', name: 'product_id', schema: { type: 'string', format: 'uuid' } },
        { in: 'query', name: 'shift', schema: { type: 'string' } },
        ...dateRangeParams,
      ]),
    },
    '/api/mfg/downtime-events': {
      get: commonListPath('List downtime events', '', 'Manufacturing - Facts', [
        { in: 'query', name: 'plant_id', schema: { type: 'string', format: 'uuid' } },
        { in: 'query', name: 'line_id', schema: { type: 'string', format: 'uuid' } },
        { in: 'query', name: 'category', schema: { type: 'string' } },
        ...dateRangeParams,
      ]),
    },
    '/api/mfg/quality-tests': {
      get: commonListPath('List quality tests', '', 'Manufacturing - Facts', [
        { in: 'query', name: 'line_id', schema: { type: 'string', format: 'uuid' } },
        { in: 'query', name: 'product_id', schema: { type: 'string', format: 'uuid' } },
        ...dateRangeParams,
      ]),
    },
    '/api/mfg/maintenance-records': {
      get: commonListPath('List maintenance records', '', 'Manufacturing - Facts', [
        { in: 'query', name: 'asset_id', schema: { type: 'string', format: 'uuid' } },
        { in: 'query', name: 'maintenance_type', schema: { type: 'string' } },
        ...dateRangeParams,
      ]),
    },
    '/api/mfg/inventory': {
      get: commonListPath('List inventory transactions', '', 'Manufacturing - Facts', [
        { in: 'query', name: 'plant_id', schema: { type: 'string', format: 'uuid' } },
        { in: 'query', name: 'material_id', schema: { type: 'string', format: 'uuid' } },
        ...dateRangeParams,
      ]),
    },
    '/api/mfg/costs': {
      get: commonListPath('List cost records', '', 'Manufacturing - Facts', [
        { in: 'query', name: 'plant_id', schema: { type: 'string', format: 'uuid' } },
        { in: 'query', name: 'line_id', schema: { type: 'string', format: 'uuid' } },
        { in: 'query', name: 'product_id', schema: { type: 'string', format: 'uuid' } },
        ...dateRangeParams,
      ]),
    },
    '/api/mfg/oee-dashboard': {
      get: {
        tags: ['Manufacturing - KPIs'],
        summary: 'OEE dashboard (availability/performance/quality)',
        parameters: [
          { in: 'query', name: 'plant_id', schema: { type: 'string', format: 'uuid' } },
          ...dateRangeParams,
        ],
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: successEnvelope({ type: 'array', items: { type: 'object', additionalProperties: true } }),
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/mfg/downtime-analysis': {
      get: {
        tags: ['Manufacturing - KPIs'],
        summary: 'Top downtime categories and modes',
        parameters: [
          { in: 'query', name: 'plant_id', schema: { type: 'string', format: 'uuid' } },
          ...dateRangeParams,
        ],
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: successEnvelope({ type: 'array', items: { type: 'object', additionalProperties: true } }),
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/mfg/quality-trends': {
      get: {
        tags: ['Manufacturing - KPIs'],
        summary: 'Quality yield and rejection trends',
        parameters: [
          { in: 'query', name: 'plant_id', schema: { type: 'string', format: 'uuid' } },
          { in: 'query', name: 'product_id', schema: { type: 'string', format: 'uuid' } },
          ...dateRangeParams,
        ],
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: successEnvelope({ type: 'array', items: { type: 'object', additionalProperties: true } }),
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/mfg/reports/generate': {
      get: {
        tags: ['Manufacturing - Reports'],
        summary: 'Generate a manufacturing report (PPTX or PDF)',
        parameters: [
          {
            in: 'query',
            name: 'report_type',
            required: true,
            schema: {
              type: 'string',
              enum: ['oee-dashboard', 'downtime-analysis', 'quality-trends', 'cost-analysis', 'executive-summary'],
            },
            description: 'Type of manufacturing report to generate',
          },
          {
            in: 'query',
            name: 'format',
            schema: { type: 'string', enum: ['pptx', 'pdf'], default: 'pptx' },
            description: 'Output format: pptx (PowerPoint) or pdf',
          },
          { in: 'query', name: 'plant_id', schema: { type: 'string', format: 'uuid' }, description: 'Filter by plant UUID' },
          ...dateRangeParams,
        ],
        responses: {
          200: {
            description: 'Report generated',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ReportGenerateResponse' } },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/mfg/reports/generate-query': {
      get: {
        tags: ['Manufacturing - Reports'],
        summary: 'Generate report from natural language query',
        description: 'Analyzes the query for topics (OEE, downtime, quality, products, costs, production runs, lines), fetches matching DB data, and builds a custom report — not limited to the 5 fixed templates',
        parameters: [
          {
            in: 'query',
            name: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'Natural language query (e.g., "show me OEE trends", "what about downtime")',
          },
          {
            in: 'query',
            name: 'format',
            schema: { type: 'string', enum: ['pptx', 'pdf'], default: 'pptx' },
            description: 'Output format: pptx (PowerPoint) or pdf',
          },
          { in: 'query', name: 'plant_id', schema: { type: 'string', format: 'uuid' }, description: 'Filter by plant UUID' },
          ...dateRangeParams,
        ],
        responses: {
          200: {
            description: 'Report generated with inferred type',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/QueryReportResponse' } },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
      post: {
        tags: ['Manufacturing - Reports'],
        summary: 'Generate report from natural language query (POST)',
        description: 'Same as GET: builds a custom DB-backed report from query topics (not limited to the 5 fixed templates)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['query'],
                properties: {
                  query: { type: 'string', description: 'Natural language query' },
                  format: { type: 'string', enum: ['pptx', 'pdf'], default: 'pptx', description: 'Output format' },
                  plant_id: { type: 'string', format: 'uuid', description: 'Filter by plant UUID' },
                  from: { type: 'string', format: 'date', description: 'Start date (YYYY-MM-DD)' },
                  to: { type: 'string', format: 'date', description: 'End date (YYYY-MM-DD)' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Report generated with inferred type',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/QueryReportResponse' } },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
  },
};

const swaggerSpec = swaggerJSDoc({
  definition: spec,
  apis: [],
});

module.exports = { swaggerSpec };
