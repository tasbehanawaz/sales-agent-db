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
      'REST API for the Sales Agent, Manufacturing Agent, and Apex Group databases. All `/api/*` endpoints require an `x-api-key` header.',
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
    { name: 'Apex Group', description: 'Apex Group scorecards, predictions, and one list endpoint per database table' },
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
          { in: 'query', name: 'start_date', schema: { type: 'string', format: 'date' }, description: 'Start date (YYYY-MM-DD)' },
          { in: 'query', name: 'end_date', schema: { type: 'string', format: 'date' }, description: 'End date (YYYY-MM-DD)' },
          { in: 'query', name: 'months', schema: { type: 'integer', minimum: 1, maximum: 24, default: 12 }, description: 'Fallback if start_date/end_date not provided' },
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
        parameters: [
          { in: 'query', name: 'start_date', schema: { type: 'string', format: 'date' }, description: 'Start date (YYYY-MM-DD)' },
          { in: 'query', name: 'end_date', schema: { type: 'string', format: 'date' }, description: 'End date (YYYY-MM-DD)' },
        ],
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
        { in: 'query', name: 'plant_id', schema: { type: 'string', format: 'uuid' }, description: 'Filter by plant (NEW)' },
        { in: 'query', name: 'line_id', schema: { type: 'string', format: 'uuid' } },
        { in: 'query', name: 'product_id', schema: { type: 'string', format: 'uuid' } },
        ...dateRangeParams,
      ]),
    },
    '/api/mfg/maintenance-records': {
      get: commonListPath('List maintenance records', '', 'Manufacturing - Facts', [
        { in: 'query', name: 'plant_id', schema: { type: 'string', format: 'uuid' }, description: 'Filter by plant (NEW)' },
        { in: 'query', name: 'line_id', schema: { type: 'string', format: 'uuid' }, description: 'Filter by production line (NEW)' },
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
    '/api/mfg/downtime-summary': {
      get: {
        tags: ['Manufacturing - KPIs'],
        summary: 'Downtime totals for the full date range',
        description: 'Sums every downtime event in the range. No row sample. Use group_by to match the chart: plant, failure_mode, line, or a monthly series.',
        parameters: [
          {
            in: 'query',
            name: 'group_by',
            schema: {
              type: 'string',
              enum: ['plant', 'failure_mode', 'line', 'plant_month', 'failure_mode_month'],
              default: 'plant',
            },
            description: 'How to group the totals. plant_month and failure_mode_month add a month field (YYYY-MM).',
          },
          { in: 'query', name: 'plant_id', schema: { type: 'string', format: 'uuid' }, description: 'Limit totals to one plant' },
          ...dateRangeParams,
        ],
        responses: {
          200: {
            description: 'Aggregated downtime totals',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    count: { type: 'integer', example: 11 },
                    group_by: { type: 'string', example: 'plant' },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          label: { type: 'string', example: 'Dubai Manufacturing', description: 'Plant, failure mode, or line name' },
                          plant_name: { type: 'string', description: 'Present when group_by is line' },
                          month: { type: 'string', example: '2025-07', description: 'Present for plant_month and failure_mode_month' },
                          event_count: { type: 'integer', example: 173 },
                          duration_minutes: { type: 'integer', example: 30284 },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { $ref: '#/components/responses/BadRequest' },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/mfg/metric-summary': {
      get: {
        tags: ['Manufacturing - KPIs'],
        summary: 'Full-range totals for production, quality, cost, inventory, and maintenance',
        description: 'Sums every row in the date range. No row sample. Use this for plant comparisons. Production returns average good quantity and attainment, not raw totals.',
        parameters: [
          {
            in: 'query',
            name: 'metric',
            required: true,
            schema: { type: 'string', enum: ['production', 'quality', 'cost', 'inventory', 'maintenance'] },
          },
          {
            in: 'query',
            name: 'group_by',
            schema: {
              type: 'string',
              enum: ['plant', 'line', 'product', 'month', 'type'],
              default: 'plant',
            },
            description: 'plant for every metric. line for production. product for quality. month for production, quality, cost, inventory, and maintenance. type for maintenance.',
          },
          { in: 'query', name: 'plant_id', schema: { type: 'string', format: 'uuid' } },
          ...dateRangeParams,
        ],
        responses: {
          200: {
            description: 'Aggregated metric totals',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    count: { type: 'integer', example: 11 },
                    metric: { type: 'string', example: 'production' },
                    group_by: { type: 'string', example: 'plant' },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          label: { type: 'string', example: 'Tokyo Manufacturing' },
                          run_count: { type: 'integer' },
                          avg_good: { type: 'number', example: 14891 },
                          attainment_pct: { type: 'number', example: 94.4 },
                          rejection_pct: { type: 'number', example: 1.0 },
                          avg_unit_cost: { type: 'number' },
                          shortages: { type: 'integer' },
                          event_count: { type: 'integer' },
                          maintenance_cost: { type: 'number' },
                        },
                      },
                    },
                  },
                },
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
    '/api/mfg/production-summary': {
      get: commonListPath('Production summary (aggregated)', 'Server-side aggregated production metrics grouped by line', 'Manufacturing - KPIs', [
        { in: 'query', name: 'plant_id', schema: { type: 'string', format: 'uuid' } },
        { in: 'query', name: 'line_id', schema: { type: 'string', format: 'uuid' } },
        ...dateRangeParams,
      ]),
    },
    '/api/mfg/cost-summary': {
      get: commonListPath('Cost summary (aggregated)', 'Server-side aggregated cost analysis grouped by line', 'Manufacturing - KPIs', [
        { in: 'query', name: 'plant_id', schema: { type: 'string', format: 'uuid' } },
        { in: 'query', name: 'line_id', schema: { type: 'string', format: 'uuid' } },
        ...dateRangeParams,
      ]),
    },
    '/api/mfg/inventory-summary': {
      get: commonListPath('Inventory summary (aggregated)', 'Server-side aggregated inventory transactions grouped by material', 'Manufacturing - KPIs', [
        { in: 'query', name: 'plant_id', schema: { type: 'string', format: 'uuid' } },
        ...dateRangeParams,
      ]),
    },
    '/api/mfg/maintenance-summary': {
      get: commonListPath('Maintenance summary (aggregated)', 'Server-side aggregated maintenance records grouped by machine', 'Manufacturing - KPIs', [
        { in: 'query', name: 'plant_id', schema: { type: 'string', format: 'uuid' } },
        { in: 'query', name: 'line_id', schema: { type: 'string', format: 'uuid' } },
        ...dateRangeParams,
      ]),
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
    '/api/apex/executive-scorecard': {
      get: {
        tags: ['Apex Group'],
        summary: 'Monthly executive scorecard',
        description: 'Revenue, EBITDA, cash, DSO, workforce, and control KPIs from serving_executive_scorecard_monthly. Optional filters: region, business_unit, scope_id, from, to, limit.',
        parameters: [
          { in: 'query', name: 'region', schema: { type: 'string' } },
          { in: 'query', name: 'business_unit', schema: { type: 'string' } },
          { in: 'query', name: 'scope_id', schema: { type: 'string' } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 1000, maximum: 2000 } },
          ...dateRangeParams,
        ],
        responses: {
          200: { description: 'Scorecard rows', content: { 'application/json': { schema: successEnvelope({ type: 'array', items: { type: 'object', additionalProperties: true } }) } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/apex/performance-drivers': {
      get: {
        tags: ['Apex Group'],
        summary: 'Margin bridge and monthly performance drivers',
        description: 'Returns the full margin bridge plus latent drivers. Optional filters on drivers: org_unit_id, from, to, limit.',
        parameters: [
          { in: 'query', name: 'org_unit_id', schema: { type: 'string' } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 500, maximum: 2000 } },
          ...dateRangeParams,
        ],
        responses: {
          200: { description: 'Bridge and drivers', content: { 'application/json': { schema: successEnvelope({ type: 'object', additionalProperties: true }) } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/apex/customer-risk': {
      get: {
        tags: ['Apex Group'],
        summary: 'Customer churn, renewal, and cash exposure',
        description: 'Highest revenue-at-risk customers first. Optional filters: risk_band, customer_id, from, to, limit. from and to apply to forecast_month.',
        parameters: [
          { in: 'query', name: 'risk_band', schema: { type: 'string' } },
          { in: 'query', name: 'customer_id', schema: { type: 'string' } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 100, maximum: 1000 } },
          ...dateRangeParams,
        ],
        responses: {
          200: { description: 'Customer risk rows', content: { 'application/json': { schema: successEnvelope({ type: 'array', items: { type: 'object', additionalProperties: true } }) } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/apex/financial-forecast': {
      get: {
        tags: ['Apex Group'],
        summary: 'Revenue, EBITDA, cash, and DSO forecast',
        description: 'Optional filters: scenario_id, region, business_unit, org_unit_id, from, to, limit. from and to apply to forecast_month.',
        parameters: [
          { in: 'query', name: 'scenario_id', schema: { type: 'string' } },
          { in: 'query', name: 'region', schema: { type: 'string' } },
          { in: 'query', name: 'business_unit', schema: { type: 'string' } },
          { in: 'query', name: 'org_unit_id', schema: { type: 'string' } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 200, maximum: 1000 } },
          ...dateRangeParams,
        ],
        responses: {
          200: { description: 'Forecast rows', content: { 'application/json': { schema: successEnvelope({ type: 'array', items: { type: 'object', additionalProperties: true } }) } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/apex/workforce-risk': {
      get: {
        tags: ['Apex Group'],
        summary: 'Attrition and capacity risk by cohort',
        description: 'Highest attrition probability first. Optional filters: region, business_unit, risk_band, role_cohort, limit.',
        parameters: [
          { in: 'query', name: 'region', schema: { type: 'string' } },
          { in: 'query', name: 'business_unit', schema: { type: 'string' } },
          { in: 'query', name: 'risk_band', schema: { type: 'string' } },
          { in: 'query', name: 'role_cohort', schema: { type: 'string' } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 200, maximum: 1000 } },
        ],
        responses: {
          200: { description: 'Workforce risk rows', content: { 'application/json': { schema: successEnvelope({ type: 'array', items: { type: 'object', additionalProperties: true } }) } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/apex/control-risk': {
      get: {
        tags: ['Apex Group'],
        summary: 'Control-exception risk by process and entity',
        description: 'Ordered by expected monetary exposure. Optional filters: region, process, risk_band, limit.',
        parameters: [
          { in: 'query', name: 'region', schema: { type: 'string' } },
          { in: 'query', name: 'process', schema: { type: 'string' } },
          { in: 'query', name: 'risk_band', schema: { type: 'string' } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 320, maximum: 1000 } },
        ],
        responses: {
          200: { description: 'Control risk rows', content: { 'application/json': { schema: successEnvelope({ type: 'array', items: { type: 'object', additionalProperties: true } }) } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/apex/recommendations': {
      get: {
        tags: ['Apex Group'],
        summary: 'Ranked intervention recommendations',
        description: 'Recommendations joined to the action catalog, highest priority first. Optional filters: action_id, scope_id, limit.',
        parameters: [
          { in: 'query', name: 'action_id', schema: { type: 'string' } },
          { in: 'query', name: 'scope_id', schema: { type: 'string' } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 100, maximum: 1000 } },
        ],
        responses: {
          200: { description: 'Recommendations', content: { 'application/json': { schema: successEnvelope({ type: 'array', items: { type: 'object', additionalProperties: true } }) } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/apex/scenario-simulation': {
      get: {
        tags: ['Apex Group'],
        summary: 'Scenario outcomes and decision constraints',
        description: 'Returns every scenario result and every decision constraint.',
        responses: {
          200: { description: 'Scenarios and constraints', content: { 'application/json': { schema: successEnvelope({ type: 'object', additionalProperties: true }) } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/apex/finance/gl': {
      get: {
        tags: ['Apex Group'],
        summary: 'General ledger totals plus recent lines',
        description: 'Summary covers every matching journal line. The row list is capped. Optional filters: org_unit_id, account_id, manual (0 or 1), from, to, limit.',
        parameters: [
          { in: 'query', name: 'org_unit_id', schema: { type: 'string' } },
          { in: 'query', name: 'account_id', schema: { type: 'string' } },
          { in: 'query', name: 'manual', schema: { type: 'integer', enum: [0, 1] } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 100, maximum: 1000 } },
          ...dateRangeParams,
        ],
        responses: {
          200: { description: 'GL summary and lines', content: { 'application/json': { schema: successEnvelope({ type: 'array', items: { type: 'object', additionalProperties: true } }) } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/apex/finance/receivables': {
      get: {
        tags: ['Apex Group'],
        summary: 'Receivables totals plus the most overdue invoices',
        description: 'Summary covers every matching invoice. Optional filters: customer_id, collection_status, dispute (0 or 1), from, to, limit.',
        parameters: [
          { in: 'query', name: 'customer_id', schema: { type: 'string' } },
          { in: 'query', name: 'collection_status', schema: { type: 'string' } },
          { in: 'query', name: 'dispute', schema: { type: 'integer', enum: [0, 1] } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 100, maximum: 1000 } },
          ...dateRangeParams,
        ],
        responses: {
          200: { description: 'Receivables summary and invoices', content: { 'application/json': { schema: successEnvelope({ type: 'array', items: { type: 'object', additionalProperties: true } }) } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/apex/hr/workforce': {
      get: {
        tags: ['Apex Group'],
        summary: 'Workforce snapshot, movement, vacancies, and attendance',
        description: 'Counts cover the full tables. Lists are capped to the latest employee month plus recent movement and vacancies. Optional filters: org_unit_id, limit.',
        parameters: [
          { in: 'query', name: 'org_unit_id', schema: { type: 'string' } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 50, maximum: 500 } },
        ],
        responses: {
          200: { description: 'Workforce summary and lists', content: { 'application/json': { schema: successEnvelope({ type: 'object', additionalProperties: true }) } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
    '/api/apex/audit/exceptions': {
      get: {
        tags: ['Apex Group'],
        summary: 'Control tests, exceptions, findings, and remediation',
        description: 'Counts and exposure cover every matching row. Lists are capped. Optional filters: org_unit_id, severity, status, limit. Tests ignore severity and status.',
        parameters: [
          { in: 'query', name: 'org_unit_id', schema: { type: 'string' } },
          { in: 'query', name: 'severity', schema: { type: 'string' } },
          { in: 'query', name: 'status', schema: { type: 'string' } },
          { in: 'query', name: 'limit', schema: { type: 'integer', default: 50, maximum: 500 } },
        ],
        responses: {
          200: { description: 'Audit summary and lists', content: { 'application/json': { schema: successEnvelope({ type: 'object', additionalProperties: true }) } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/ServerError' },
        },
      },
    },
  },
};

const { TABLES: apexTableCatalog } = require('./apex-table-catalog');

spec.paths['/api/apex/tables'] = {
  get: {
    tags: ['Apex Group'],
    summary: 'List every Apex table endpoint',
    description: 'Returns the path, row count, date column, and filter names for each table.',
    responses: {
      200: { description: 'Table index', content: { 'application/json': { schema: successEnvelope({ type: 'array', items: { type: 'object', additionalProperties: true } }) } } },
      401: { $ref: '#/components/responses/Unauthorized' },
      500: { $ref: '#/components/responses/ServerError' },
    },
  },
};

for (const [key, table] of Object.entries(apexTableCatalog)) {
  const parameters = [
    { in: 'query', name: 'limit', schema: { type: 'integer', default: table.defaultLimit, maximum: table.maxLimit } },
  ];
  if (table.dateColumn) parameters.push(...dateRangeParams);
  for (const filter of table.filters) {
    const schema = { type: filter.kind === 'int' || filter.kind === 'flag' ? 'integer' : 'string' };
    if (filter.kind === 'flag') schema.enum = [0, 1];
    if (filter.kind === 'date' || filter.kind === 'date-from' || filter.kind === 'date-to') schema.format = 'date';
    parameters.push({ in: 'query', name: filter.param, schema });
  }
  spec.paths['/api/apex/tables/' + key] = {
    get: {
      tags: ['Apex Group'],
      summary: table.table,
      description: table.rows + ' rows in ' + table.table + '.' + (table.dateColumn ? ' from and to filter ' + table.dateColumn + '.' : ''),
      parameters,
      responses: {
        200: { description: 'Table rows', content: { 'application/json': { schema: successEnvelope({ type: 'array', items: { type: 'object', additionalProperties: true } }) } } },
        400: { $ref: '#/components/responses/BadRequest' },
        401: { $ref: '#/components/responses/Unauthorized' },
        500: { $ref: '#/components/responses/ServerError' },
      },
    },
  };
}

const swaggerSpec = swaggerJSDoc({
  definition: spec,
  apis: [],
});

module.exports = { swaggerSpec };
