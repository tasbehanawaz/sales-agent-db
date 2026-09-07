// API Response Optimization Utilities
// Reduces payload size while maintaining data integrity

function round2(n) {
  if (n == null || Number.isNaN(Number(n))) return null;
  return Math.round(Number(n) * 100) / 100;
}

function compactDate(dateString) {
  if (!dateString) return null;
  const d = new Date(dateString);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function compactNumber(n, decimals = 2) {
  if (n == null || Number.isNaN(Number(n))) return null;
  if (Number.isInteger(n)) return n;
  const factor = Math.pow(10, decimals);
  return Math.round(Number(n) * factor) / factor;
}

function compactObject(obj, fieldConfig = {}) {
  if (!obj || typeof obj !== 'object') return obj;

  const compacted = {};
  for (const [key, value] of Object.entries(obj)) {
    const config = fieldConfig[key] || {};

    if (config.skip) continue;

    if (config.type === 'date') {
      compacted[key] = compactDate(value);
    } else if (config.type === 'number') {
      compacted[key] = compactNumber(value, config.decimals || 2);
    } else if (config.type === 'array' && Array.isArray(value)) {
      compacted[key] = value.map(item => compactObject(item, config.itemConfig));
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      compacted[key] = compactObject(value, config.itemConfig);
    } else {
      compacted[key] = value;
    }
  }

  return compacted;
}

function compactArray(data, fieldConfig = {}) {
  if (!Array.isArray(data)) return data;
  return data.map(item => compactObject(item, fieldConfig));
}

// Common field configurations for different endpoint types
const fieldConfigs = {
  // For endpoints with time-series data
  timeSeries: {
    month: { type: 'date' },
    sale_date: { type: 'date' },
    created_at: { type: 'date' },
    updated_at: { skip: true },
    planned_date: { type: 'date' },
    actual_call_date: { type: 'date' }
  },

  // For endpoints with sales/financial data
  financial: {
    value_sold: { type: 'number', decimals: 2 },
    sales_value: { type: 'number', decimals: 2 },
    sales_value_post_call: { type: 'number', decimals: 2 },
    qty_sold: { type: 'number', decimals: 0 },
    quantity_sold: { type: 'number', decimals: 0 },
    avg_feedback: { type: 'number', decimals: 1 },
    adherence_pct: { type: 'number', decimals: 2 },
    yoy_pct: { type: 'number', decimals: 2 }
  },

  // For endpoints with geographic data (reduce fields)
  geographic: {
    rep_count: { type: 'number', decimals: 0 },
    pharmacy_count: { type: 'number', decimals: 0 },
    doctor_count: { type: 'number', decimals: 0 }
  },

  // For call/metric data
  metrics: {
    total_calls: { type: 'number', decimals: 0 },
    completed_calls: { type: 'number', decimals: 0 },
    sales_count: { type: 'number', decimals: 0 }
  }
};

// Merge multiple configs
function mergeConfigs(...configs) {
  return Object.assign({}, ...configs);
}

// Optimize response for specific endpoint types
function optimizeResponse(data, type = 'default') {
  if (!data) return data;

  let config = {};

  switch (type) {
    case 'timeSeries':
      config = fieldConfigs.timeSeries;
      break;
    case 'financial':
      config = mergeConfigs(fieldConfigs.timeSeries, fieldConfigs.financial);
      break;
    case 'callData':
      config = mergeConfigs(fieldConfigs.timeSeries, fieldConfigs.financial, fieldConfigs.metrics);
      break;
    case 'geographic':
      config = mergeConfigs(fieldConfigs.timeSeries, fieldConfigs.financial, fieldConfigs.geographic);
      break;
    default:
      config = mergeConfigs(fieldConfigs.timeSeries, fieldConfigs.financial);
  }

  if (Array.isArray(data)) {
    return compactArray(data, config);
  } else {
    return compactObject(data, config);
  }
}

module.exports = {
  round2,
  compactDate,
  compactNumber,
  compactObject,
  compactArray,
  optimizeResponse,
  mergeConfigs,
  fieldConfigs
};
