/**
 * Manufacturing Agent API Routes
 * Endpoints for manufacturing data retrieval and KPI analysis
 */

require('dotenv').config();
const { query } = require('./db');
const { intParam, strParam, dateParam, uuidParams, addFilter, whereSql } = require('./queryParams');

const MFG_DB = process.env.DB_NAME_MFG || 'manufacturing_agent_demo';

// ============= DIMENSION ENDPOINTS =============

async function getPlants(req, res) {
  try {
    const limit = intParam(req.query.limit, 100, 1, 1000);
    const region = strParam(req.query.region);

    const params = { limit };
    const clauses = [];
    let sql = `SELECT TOP (@limit) * FROM [${MFG_DB}].dbo.plants WHERE 1=1`;

    if (region) {
      addFilter(clauses, params, 'region', 'region = @region', region);
    }

    if (clauses.length > 0) {
      sql += ` AND ${clauses.join(' AND ')}`;
    }
    sql += ` ORDER BY plant_name`;

    const data = await query(sql, params);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getProductionLines(req, res) {
  try {
    const ids = uuidParams(req.query, ['plant_id']);
    if (ids.error) return res.status(400).json({ success: false, error: ids.error });
    const plantId = ids.values.plant_id;

    let sql = `SELECT pl.*, p.plant_name FROM [${MFG_DB}].dbo.production_lines pl
               JOIN [${MFG_DB}].dbo.plants p ON pl.plant_id = p.plant_id`;
    const params = {};
    const clauses = [];

    if (plantId) {
      addFilter(clauses, params, 'plant_id', 'pl.plant_id = @plant_id', plantId);
    }

    if (clauses.length > 0) {
      sql += ` WHERE ${clauses.join(' AND ')}`;
    }
    sql += ` ORDER BY pl.line_name`;

    const data = await query(sql, params);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getMachines(req, res) {
  try {
    const ids = uuidParams(req.query, ['line_id']);
    if (ids.error) return res.status(400).json({ success: false, error: ids.error });
    const lineId = ids.values.line_id;
    const criticality = strParam(req.query.criticality);

    let sql = `SELECT m.*, l.line_name, p.plant_name FROM [${MFG_DB}].dbo.machines m
               JOIN [${MFG_DB}].dbo.production_lines l ON m.line_id = l.line_id
               JOIN [${MFG_DB}].dbo.plants p ON m.plant_id = p.plant_id`;
    const params = {};
    const clauses = [];

    if (lineId) {
      addFilter(clauses, params, 'line_id', 'm.line_id = @line_id', lineId);
    }
    if (criticality) {
      addFilter(clauses, params, 'criticality', 'm.criticality = @criticality', criticality);
    }

    if (clauses.length > 0) {
      sql += ` WHERE ${clauses.join(' AND ')}`;
    }
    sql += ` ORDER BY m.machine_name`;

    const data = await query(sql, params);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getProducts(req, res) {
  try {
    const limit = intParam(req.query.limit, 100, 1, 1000);
    const category = strParam(req.query.category);

    const params = { limit };
    const clauses = [];
    let sql = `SELECT TOP (@limit) * FROM [${MFG_DB}].dbo.products WHERE 1=1`;

    if (category) {
      addFilter(clauses, params, 'category', 'category = @category', category);
    }

    if (clauses.length > 0) {
      sql += ` AND ${clauses.join(' AND ')}`;
    }
    sql += ` ORDER BY product_name`;

    const data = await query(sql, params);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ============= FACT TABLE ENDPOINTS =============

async function getProductionRuns(req, res) {
  try {
    const limit = intParam(req.query.limit, 100, 1, 1000);
    const ids = uuidParams(req.query, ['plant_id', 'line_id', 'product_id']);
    if (ids.error) return res.status(400).json({ success: false, error: ids.error });
    const { plant_id: plantId, line_id: lineId, product_id: productId } = ids.values;
    const fromDate = dateParam(req.query.from);
    const toDate = dateParam(req.query.to);
    const shift = strParam(req.query.shift);

    let sql = `SELECT TOP (@limit) pr.*, p.product_name, l.line_name, pl.plant_name
               FROM [${MFG_DB}].dbo.production_runs pr
               JOIN [${MFG_DB}].dbo.products p ON pr.product_id = p.product_id
               JOIN [${MFG_DB}].dbo.production_lines l ON pr.line_id = l.line_id
               JOIN [${MFG_DB}].dbo.plants pl ON pr.plant_id = pl.plant_id`;

    const params = { limit };
    const clauses = [];

    if (plantId) addFilter(clauses, params, 'plant_id', 'pr.plant_id = @plant_id', plantId);
    if (lineId) addFilter(clauses, params, 'line_id', 'pr.line_id = @line_id', lineId);
    if (productId) addFilter(clauses, params, 'product_id', 'pr.product_id = @product_id', productId);
    if (shift) addFilter(clauses, params, 'shift', 'pr.shift = @shift', shift);
    if (fromDate) addFilter(clauses, params, 'from_date', 'pr.date >= @from_date', fromDate);
    if (toDate) addFilter(clauses, params, 'to_date', 'pr.date <= @to_date', toDate);

    if (clauses.length > 0) {
      sql += ` WHERE ${clauses.join(' AND ')}`;
    }
    sql += ` ORDER BY pr.date DESC`;

    const data = await query(sql, params);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getDowntimeEvents(req, res) {
  try {
    const limit = intParam(req.query.limit, 100, 1, 1000);
    const ids = uuidParams(req.query, ['plant_id', 'line_id']);
    if (ids.error) return res.status(400).json({ success: false, error: ids.error });
    const { plant_id: plantId, line_id: lineId } = ids.values;
    const category = strParam(req.query.category);
    const fromDate = dateParam(req.query.from);
    const toDate = dateParam(req.query.to);

    let sql = `SELECT TOP (@limit) de.*, l.line_name, m.machine_name, p.plant_name
               FROM [${MFG_DB}].dbo.downtime_events de
               JOIN [${MFG_DB}].dbo.production_lines l ON de.line_id = l.line_id
               JOIN [${MFG_DB}].dbo.machines m ON de.asset_id = m.asset_id
               JOIN [${MFG_DB}].dbo.plants p ON de.plant_id = p.plant_id`;

    const params = { limit };
    const clauses = [];

    if (plantId) addFilter(clauses, params, 'plant_id', 'de.plant_id = @plant_id', plantId);
    if (lineId) addFilter(clauses, params, 'line_id', 'de.line_id = @line_id', lineId);
    if (category) addFilter(clauses, params, 'category', 'de.category = @category', category);
    if (fromDate) addFilter(clauses, params, 'from_date', 'CAST(de.event_start_datetime AS DATE) >= @from_date', fromDate);
    if (toDate) addFilter(clauses, params, 'to_date', 'CAST(de.event_start_datetime AS DATE) <= @to_date', toDate);

    if (clauses.length > 0) {
      sql += ` WHERE ${clauses.join(' AND ')}`;
    }
    sql += ` ORDER BY de.event_start_datetime DESC`;

    const data = await query(sql, params);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getQualityTests(req, res) {
  try {
    const limit = intParam(req.query.limit, 100, 1, 1000);
    const ids = uuidParams(req.query, ['plant_id', 'line_id', 'product_id']);
    if (ids.error) return res.status(400).json({ success: false, error: ids.error });
    const { plant_id: plantId, line_id: lineId, product_id: productId } = ids.values;
    const fromDate = dateParam(req.query.from);
    const toDate = dateParam(req.query.to);

    let sql = `SELECT TOP (@limit) qt.*, p.product_name, l.line_name, pl.plant_name
               FROM [${MFG_DB}].dbo.quality_tests qt
               JOIN [${MFG_DB}].dbo.products p ON qt.product_id = p.product_id
               JOIN [${MFG_DB}].dbo.production_lines l ON qt.line_id = l.line_id
               JOIN [${MFG_DB}].dbo.plants pl ON qt.plant_id = pl.plant_id`;

    const params = { limit };
    const clauses = [];

    if (plantId) addFilter(clauses, params, 'plant_id', 'qt.plant_id = @plant_id', plantId);
    if (lineId) addFilter(clauses, params, 'line_id', 'qt.line_id = @line_id', lineId);
    if (productId) addFilter(clauses, params, 'product_id', 'qt.product_id = @product_id', productId);
    if (fromDate) addFilter(clauses, params, 'from_date', 'qt.date >= @from_date', fromDate);
    if (toDate) addFilter(clauses, params, 'to_date', 'qt.date <= @to_date', toDate);

    if (clauses.length > 0) {
      sql += ` WHERE ${clauses.join(' AND ')}`;
    }
    sql += ` ORDER BY qt.date DESC`;

    const data = await query(sql, params);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getMaintenanceRecords(req, res) {
  try {
    const limit = intParam(req.query.limit, 100, 1, 1000);
    const ids = uuidParams(req.query, ['plant_id', 'line_id', 'asset_id']);
    if (ids.error) return res.status(400).json({ success: false, error: ids.error });
    const { plant_id: plantId, line_id: lineId, asset_id: assetId } = ids.values;
    const maintType = strParam(req.query.maintenance_type);
    const fromDate = dateParam(req.query.from);
    const toDate = dateParam(req.query.to);

    let sql = `SELECT TOP (@limit) mr.*, m.machine_name, m.criticality, l.line_name, p.plant_name
               FROM [${MFG_DB}].dbo.maintenance_records mr
               JOIN [${MFG_DB}].dbo.machines m ON mr.asset_id = m.asset_id
               JOIN [${MFG_DB}].dbo.production_lines l ON m.line_id = l.line_id
               JOIN [${MFG_DB}].dbo.plants p ON m.plant_id = p.plant_id`;

    const params = { limit };
    const clauses = [];

    if (plantId) addFilter(clauses, params, 'plant_id', 'm.plant_id = @plant_id', plantId);
    if (lineId) addFilter(clauses, params, 'line_id', 'm.line_id = @line_id', lineId);
    if (assetId) addFilter(clauses, params, 'asset_id', 'mr.asset_id = @asset_id', assetId);
    if (maintType) addFilter(clauses, params, 'maintenance_type', 'mr.maintenance_type = @maintenance_type', maintType);
    if (fromDate) addFilter(clauses, params, 'from_date', 'CAST(mr.repair_start_datetime AS DATE) >= @from_date', fromDate);
    if (toDate) addFilter(clauses, params, 'to_date', 'CAST(mr.repair_start_datetime AS DATE) <= @to_date', toDate);

    if (clauses.length > 0) {
      sql += ` WHERE ${clauses.join(' AND ')}`;
    }
    sql += ` ORDER BY mr.repair_start_datetime DESC`;

    const data = await query(sql, params);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getInventory(req, res) {
  try {
    const limit = intParam(req.query.limit, 100, 1, 1000);
    const ids = uuidParams(req.query, ['plant_id', 'material_id']);
    if (ids.error) return res.status(400).json({ success: false, error: ids.error });
    const { plant_id: plantId, material_id: materialId } = ids.values;
    const fromDate = dateParam(req.query.from);
    const toDate = dateParam(req.query.to);

    let sql = `SELECT TOP (@limit) inv.*, m.material_name, s.supplier_name, p.plant_name
               FROM [${MFG_DB}].dbo.inventory_transactions inv
               JOIN [${MFG_DB}].dbo.materials m ON inv.material_id = m.material_id
               LEFT JOIN [${MFG_DB}].dbo.suppliers s ON inv.supplier_id = s.supplier_id
               JOIN [${MFG_DB}].dbo.plants p ON inv.plant_id = p.plant_id`;

    const params = { limit };
    const clauses = [];

    if (plantId) addFilter(clauses, params, 'plant_id', 'inv.plant_id = @plant_id', plantId);
    if (materialId) addFilter(clauses, params, 'material_id', 'inv.material_id = @material_id', materialId);
    if (fromDate) addFilter(clauses, params, 'from_date', 'inv.date >= @from_date', fromDate);
    if (toDate) addFilter(clauses, params, 'to_date', 'inv.date <= @to_date', toDate);

    if (clauses.length > 0) {
      sql += ` WHERE ${clauses.join(' AND ')}`;
    }
    sql += ` ORDER BY inv.date DESC`;

    const data = await query(sql, params);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getCostRecords(req, res) {
  try {
    const limit = intParam(req.query.limit, 100, 1, 1000);
    const ids = uuidParams(req.query, ['plant_id', 'line_id', 'product_id']);
    if (ids.error) return res.status(400).json({ success: false, error: ids.error });
    const { plant_id: plantId, line_id: lineId, product_id: productId } = ids.values;
    const fromDate = dateParam(req.query.from);
    const toDate = dateParam(req.query.to);

    let sql = `SELECT TOP (@limit) cr.*, p.product_name, l.line_name, pl.plant_name
               FROM [${MFG_DB}].dbo.cost_records cr
               JOIN [${MFG_DB}].dbo.products p ON cr.product_id = p.product_id
               JOIN [${MFG_DB}].dbo.production_lines l ON cr.line_id = l.line_id
               JOIN [${MFG_DB}].dbo.plants pl ON cr.plant_id = pl.plant_id`;

    const params = { limit };
    const clauses = [];

    if (plantId) addFilter(clauses, params, 'plant_id', 'cr.plant_id = @plant_id', plantId);
    if (lineId) addFilter(clauses, params, 'line_id', 'cr.line_id = @line_id', lineId);
    if (productId) addFilter(clauses, params, 'product_id', 'cr.product_id = @product_id', productId);
    if (fromDate) addFilter(clauses, params, 'from_date', 'cr.date >= @from_date', fromDate);
    if (toDate) addFilter(clauses, params, 'to_date', 'cr.date <= @to_date', toDate);

    if (clauses.length > 0) {
      sql += ` WHERE ${clauses.join(' AND ')}`;
    }
    sql += ` ORDER BY cr.date DESC`;

    const data = await query(sql, params);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ============= KPI ENDPOINTS =============

async function getOEEDashboard(req, res) {
  try {
    const ids = uuidParams(req.query, ['plant_id', 'line_id']);
    if (ids.error) return res.status(400).json({ success: false, error: ids.error });
    const { plant_id: plantId, line_id: lineId } = ids.values;
    const fromDate = dateParam(req.query.from);
    const toDate = dateParam(req.query.to);
    const shift = strParam(req.query.shift);

    let sql = `
      SELECT
        pl.plant_name,
        l.line_name,
        p.product_name,
        pr.shift,
        COUNT(*) as shift_count,
        AVG(CAST(pr.actual_quantity AS FLOAT) / pr.planned_quantity * 100) as availability_pct,
        AVG(CAST(pr.good_quantity AS FLOAT) / pr.actual_quantity * 100) as quality_pct,
        AVG(CAST(pr.actual_quantity AS FLOAT) / pr.planned_quantity * 100) as performance_pct,
        CAST(AVG(CAST(pr.good_quantity AS FLOAT) / pr.planned_quantity * 100) AS DECIMAL(10,2)) as oee_pct
      FROM [${MFG_DB}].dbo.production_runs pr
      JOIN [${MFG_DB}].dbo.production_lines l ON pr.line_id = l.line_id
      JOIN [${MFG_DB}].dbo.plants pl ON pr.plant_id = pl.plant_id
      JOIN [${MFG_DB}].dbo.products p ON pr.product_id = p.product_id
    `;

    const params = {};
    const clauses = [];

    if (plantId) addFilter(clauses, params, 'plant_id', 'pr.plant_id = @plant_id', plantId);
    if (lineId) addFilter(clauses, params, 'line_id', 'pr.line_id = @line_id', lineId);
    if (shift) addFilter(clauses, params, 'shift', 'pr.shift = @shift', shift);
    if (fromDate) addFilter(clauses, params, 'from_date', 'pr.date >= @from_date', fromDate);
    if (toDate) addFilter(clauses, params, 'to_date', 'pr.date <= @to_date', toDate);

    if (clauses.length > 0) {
      sql += ` WHERE ${clauses.join(' AND ')}`;
    }

    sql += ` GROUP BY pl.plant_name, l.line_name, p.product_name, pr.shift ORDER BY oee_pct DESC`;

    const data = await query(sql, params);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getDowntimeAnalysis(req, res) {
  try {
    const limit = intParam(req.query.limit, 20, 1, 100);
    const ids = uuidParams(req.query, ['plant_id', 'line_id']);
    if (ids.error) return res.status(400).json({ success: false, error: ids.error });
    const { plant_id: plantId, line_id: lineId } = ids.values;
    const fromDate = dateParam(req.query.from);
    const toDate = dateParam(req.query.to);
    const category = strParam(req.query.category);

    let sql = `
      SELECT TOP (@limit)
        de.category,
        de.failure_mode,
        COUNT(*) as event_count,
        SUM(de.duration_minutes) as total_downtime_minutes,
        CAST(AVG(CAST(de.duration_minutes AS FLOAT)) AS DECIMAL(10,2)) as avg_duration_minutes,
        l.line_name,
        m.machine_name
      FROM [${MFG_DB}].dbo.downtime_events de
      JOIN [${MFG_DB}].dbo.production_lines l ON de.line_id = l.line_id
      JOIN [${MFG_DB}].dbo.machines m ON de.asset_id = m.asset_id
    `;

    const params = { limit };
    const clauses = [];

    if (plantId) addFilter(clauses, params, 'plant_id', 'de.plant_id = @plant_id', plantId);
    if (lineId) addFilter(clauses, params, 'line_id', 'de.line_id = @line_id', lineId);
    if (category) addFilter(clauses, params, 'category', 'de.category = @category', category);
    if (fromDate) addFilter(clauses, params, 'from_date', 'CAST(de.event_start_datetime AS DATE) >= @from_date', fromDate);
    if (toDate) addFilter(clauses, params, 'to_date', 'CAST(de.event_start_datetime AS DATE) <= @to_date', toDate);

    if (clauses.length > 0) {
      sql += ` WHERE ${clauses.join(' AND ')}`;
    }

    sql += ` GROUP BY de.category, de.failure_mode, l.line_name, m.machine_name ORDER BY total_downtime_minutes DESC`;

    const data = await query(sql, params);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getDowntimeSummary(req, res) {
  try {
    const groupBy = String(strParam(req.query.group_by) || 'plant').toLowerCase();
    const allowed = ['plant', 'failure_mode', 'line', 'plant_month', 'failure_mode_month'];
    if (!allowed.includes(groupBy)) {
      return res.status(400).json({
        success: false,
        error: 'group_by must be plant, failure_mode, line, plant_month, or failure_mode_month'
      });
    }
    const ids = uuidParams(req.query, ['plant_id']);
    if (ids.error) return res.status(400).json({ success: false, error: ids.error });
    const plantId = ids.values.plant_id;
    const fromDate = dateParam(req.query.from);
    const toDate = dateParam(req.query.to);
    const params = {};
    const clauses = [];
    if (plantId) addFilter(clauses, params, 'plant_id', 'de.plant_id = @plant_id', plantId);
    if (fromDate) addFilter(clauses, params, 'from_date', 'CAST(de.event_start_datetime AS DATE) >= @from_date', fromDate);
    if (toDate) addFilter(clauses, params, 'to_date', 'CAST(de.event_start_datetime AS DATE) <= @to_date', toDate);

    let labelExpr;
    let extraSelect = '';
    let groupExpr;
    if (groupBy === 'plant') {
      labelExpr = 'p.plant_name';
      groupExpr = 'p.plant_name';
    } else if (groupBy === 'line') {
      labelExpr = 'l.line_name';
      extraSelect = ', p.plant_name';
      groupExpr = 'l.line_name, p.plant_name';
    } else if (groupBy === 'plant_month') {
      labelExpr = 'p.plant_name';
      extraSelect = ', CONVERT(char(7), de.event_start_datetime, 126) AS month';
      groupExpr = 'p.plant_name, CONVERT(char(7), de.event_start_datetime, 126)';
    } else if (groupBy === 'failure_mode_month') {
      labelExpr = "ISNULL(de.failure_mode, ISNULL(de.category, 'Unknown'))";
      extraSelect = ', CONVERT(char(7), de.event_start_datetime, 126) AS month';
      groupExpr = `${labelExpr}, CONVERT(char(7), de.event_start_datetime, 126)`;
    } else {
      labelExpr = "ISNULL(de.failure_mode, ISNULL(de.category, 'Unknown'))";
      groupExpr = labelExpr;
    }

    const sql = `
      SELECT ${labelExpr} AS label${extraSelect},
        COUNT(*) AS event_count,
        SUM(de.duration_minutes) AS duration_minutes
      FROM [${MFG_DB}].dbo.downtime_events de
      JOIN [${MFG_DB}].dbo.plants p ON p.plant_id = de.plant_id
      JOIN [${MFG_DB}].dbo.production_lines l ON l.line_id = de.line_id
      ${whereSql(clauses)}
      GROUP BY ${groupExpr}
      ORDER BY SUM(de.duration_minutes) DESC`;

    const data = await query(sql, params);
    res.json({ success: true, count: data.length, group_by: groupBy, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getQualityTrends(req, res) {
  try {
    const limit = intParam(req.query.limit, 200, 1, 1000);
    const ids = uuidParams(req.query, ['plant_id', 'product_id', 'line_id']);
    if (ids.error) return res.status(400).json({ success: false, error: ids.error });
    const { plant_id: plantId, product_id: productId, line_id: lineId } = ids.values;
    const fromDate = dateParam(req.query.from);
    const toDate = dateParam(req.query.to);

    let sql = `
      SELECT TOP (@limit)
        qt.date,
        p.product_name,
        l.line_name,
        SUM(qt.produced_quantity) as total_produced,
        SUM(qt.rejected_quantity) as total_rejected,
        CAST(SUM(qt.rejected_quantity) * 100.0 / SUM(qt.produced_quantity) AS DECIMAL(10,2)) as rejection_rate_pct,
        CAST(SUM(qt.produced_quantity - qt.rejected_quantity) * 100.0 / SUM(qt.produced_quantity) AS DECIMAL(10,2)) as yield_pct
      FROM [${MFG_DB}].dbo.quality_tests qt
      JOIN [${MFG_DB}].dbo.products p ON qt.product_id = p.product_id
      JOIN [${MFG_DB}].dbo.production_lines l ON qt.line_id = l.line_id
    `;

    const params = { limit };
    const clauses = [];

    if (plantId) addFilter(clauses, params, 'plant_id', 'qt.plant_id = @plant_id', plantId);
    if (productId) addFilter(clauses, params, 'product_id', 'qt.product_id = @product_id', productId);
    if (lineId) addFilter(clauses, params, 'line_id', 'qt.line_id = @line_id', lineId);
    if (fromDate) addFilter(clauses, params, 'from_date', 'qt.date >= @from_date', fromDate);
    if (toDate) addFilter(clauses, params, 'to_date', 'qt.date <= @to_date', toDate);

    if (clauses.length > 0) {
      sql += ` WHERE ${clauses.join(' AND ')}`;
    }

    sql += ` GROUP BY qt.date, p.product_name, l.line_name ORDER BY qt.date DESC`;

    const data = await query(sql, params);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getMetricSummary(req, res) {
  try {
    const metric = String(strParam(req.query.metric) || '').toLowerCase();
    const groupBy = String(strParam(req.query.group_by) || 'plant').toLowerCase();
    const allowed = {
      production: ['plant', 'line', 'month'],
      quality: ['plant', 'product', 'month'],
      cost: ['plant', 'line', 'month'],
      inventory: ['plant', 'month'],
      maintenance: ['plant', 'type', 'month']
    };
    if (!allowed[metric] || !allowed[metric].includes(groupBy)) {
      return res.status(400).json({
        success: false,
        error: 'metric must be production, quality, cost, inventory, or maintenance, with a supported group_by'
      });
    }
    const ids = uuidParams(req.query, ['plant_id']);
    if (ids.error) return res.status(400).json({ success: false, error: ids.error });
    const plantId = ids.values.plant_id;
    const fromDate = dateParam(req.query.from);
    const toDate = dateParam(req.query.to);
    const params = {};
    const clauses = [];

    const dateCol = {
      production: 'r.date',
      quality: 'q.date',
      cost: 'c.date',
      inventory: 'i.date',
      maintenance: 'CAST(mr.repair_start_datetime AS DATE)'
    }[metric];
    const plantCol = metric === 'maintenance' ? 'm.plant_id' : {
      production: 'r.plant_id',
      quality: 'q.plant_id',
      cost: 'c.plant_id',
      inventory: 'i.plant_id'
    }[metric];
    if (plantId) addFilter(clauses, params, 'plant_id', `${plantCol} = @plant_id`, plantId);
    if (fromDate) addFilter(clauses, params, 'from_date', `${dateCol} >= @from_date`, fromDate);
    if (toDate) addFilter(clauses, params, 'to_date', `${dateCol} <= @to_date`, toDate);
    const where = whereSql(clauses);

    let sql;
    if (metric === 'production' && groupBy === 'plant') {
      sql = `
        SELECT p.plant_name AS label,
          COUNT(*) AS run_count,
          CAST(AVG(CAST(r.good_quantity AS float)) AS decimal(12,0)) AS avg_good,
          CAST(SUM(CAST(r.good_quantity AS bigint)) * 100.0 / NULLIF(SUM(CAST(r.planned_quantity AS bigint)), 0) AS decimal(6,1)) AS attainment_pct
        FROM [${MFG_DB}].dbo.production_runs r
        JOIN [${MFG_DB}].dbo.plants p ON p.plant_id = r.plant_id
        ${where}
        GROUP BY p.plant_name
        ORDER BY avg_good DESC`;
    } else if (metric === 'production' && groupBy === 'line') {
      sql = `
        SELECT p.plant_name + ' / ' + l.line_name AS label,
          COUNT(*) AS run_count,
          CAST(AVG(CAST(r.good_quantity AS float)) AS decimal(12,0)) AS avg_good,
          CAST(SUM(CAST(r.good_quantity AS bigint)) * 100.0 / NULLIF(SUM(CAST(r.planned_quantity AS bigint)), 0) AS decimal(6,1)) AS attainment_pct
        FROM [${MFG_DB}].dbo.production_runs r
        JOIN [${MFG_DB}].dbo.plants p ON p.plant_id = r.plant_id
        JOIN [${MFG_DB}].dbo.production_lines l ON l.line_id = r.line_id
        ${where}
        GROUP BY p.plant_name, l.line_name
        ORDER BY avg_good DESC`;
    } else if (metric === 'production') {
      sql = `
        SELECT CONVERT(char(7), r.date, 126) AS label,
          COUNT(*) AS run_count,
          CAST(AVG(CAST(r.good_quantity AS float)) AS decimal(12,0)) AS avg_good,
          CAST(SUM(CAST(r.good_quantity AS bigint)) * 100.0 / NULLIF(SUM(CAST(r.planned_quantity AS bigint)), 0) AS decimal(6,1)) AS attainment_pct
        FROM [${MFG_DB}].dbo.production_runs r
        ${where}
        GROUP BY CONVERT(char(7), r.date, 126)
        ORDER BY label`;
    } else if (metric === 'quality' && groupBy === 'plant') {
      sql = `
        SELECT p.plant_name AS label,
          COUNT(*) AS test_count,
          CAST(SUM(CAST(q.rejected_quantity AS bigint)) * 100.0 / NULLIF(SUM(CAST(q.produced_quantity AS bigint)), 0) AS decimal(6,2)) AS rejection_pct
        FROM [${MFG_DB}].dbo.quality_tests q
        JOIN [${MFG_DB}].dbo.plants p ON p.plant_id = q.plant_id
        ${where}
        GROUP BY p.plant_name
        ORDER BY rejection_pct DESC`;
    } else if (metric === 'quality' && groupBy === 'product') {
      sql = `
        SELECT pr.product_name AS label,
          COUNT(*) AS test_count,
          CAST(SUM(CAST(q.rejected_quantity AS bigint)) * 100.0 / NULLIF(SUM(CAST(q.produced_quantity AS bigint)), 0) AS decimal(6,2)) AS rejection_pct
        FROM [${MFG_DB}].dbo.quality_tests q
        JOIN [${MFG_DB}].dbo.products pr ON pr.product_id = q.product_id
        ${where}
        GROUP BY pr.product_name
        ORDER BY rejection_pct DESC`;
    } else if (metric === 'quality') {
      sql = `
        SELECT CONVERT(char(7), q.date, 126) AS label,
          COUNT(*) AS test_count,
          CAST(SUM(CAST(q.rejected_quantity AS bigint)) * 100.0 / NULLIF(SUM(CAST(q.produced_quantity AS bigint)), 0) AS decimal(6,2)) AS rejection_pct
        FROM [${MFG_DB}].dbo.quality_tests q
        ${where}
        GROUP BY CONVERT(char(7), q.date, 126)
        ORDER BY label`;
    } else if (metric === 'cost' && groupBy === 'plant') {
      sql = `
        SELECT p.plant_name AS label,
          COUNT(*) AS record_count,
          CAST(AVG(c.actual_cost_per_unit) AS decimal(10,2)) AS avg_unit_cost
        FROM [${MFG_DB}].dbo.cost_records c
        JOIN [${MFG_DB}].dbo.plants p ON p.plant_id = c.plant_id
        ${where}
        GROUP BY p.plant_name
        ORDER BY avg_unit_cost DESC`;
    } else if (metric === 'cost' && groupBy === 'line') {
      sql = `
        SELECT p.plant_name + ' / ' + l.line_name AS label,
          COUNT(*) AS record_count,
          CAST(AVG(c.actual_cost_per_unit) AS decimal(10,2)) AS avg_unit_cost
        FROM [${MFG_DB}].dbo.cost_records c
        JOIN [${MFG_DB}].dbo.plants p ON p.plant_id = c.plant_id
        JOIN [${MFG_DB}].dbo.production_lines l ON l.line_id = c.line_id
        ${where}
        GROUP BY p.plant_name, l.line_name
        ORDER BY avg_unit_cost DESC`;
    } else if (metric === 'cost') {
      sql = `
        SELECT CONVERT(char(7), c.date, 126) AS label,
          COUNT(*) AS record_count,
          CAST(AVG(c.actual_cost_per_unit) AS decimal(10,2)) AS avg_unit_cost
        FROM [${MFG_DB}].dbo.cost_records c
        ${where}
        GROUP BY CONVERT(char(7), c.date, 126)
        ORDER BY label`;
    } else if (metric === 'inventory' && groupBy === 'month') {
      sql = `
        SELECT CONVERT(char(7), i.date, 126) AS label,
          COUNT(*) AS transaction_count,
          SUM(CAST(i.shortages_quantity AS bigint)) AS shortages
        FROM [${MFG_DB}].dbo.inventory_transactions i
        ${where}
        GROUP BY CONVERT(char(7), i.date, 126)
        ORDER BY label`;
    } else if (metric === 'inventory') {
      sql = `
        SELECT p.plant_name AS label,
          COUNT(*) AS transaction_count,
          SUM(CAST(i.shortages_quantity AS bigint)) AS shortages
        FROM [${MFG_DB}].dbo.inventory_transactions i
        JOIN [${MFG_DB}].dbo.plants p ON p.plant_id = i.plant_id
        ${where}
        GROUP BY p.plant_name
        ORDER BY shortages DESC`;
    } else if (metric === 'maintenance' && groupBy === 'type') {
      sql = `
        SELECT mr.maintenance_type AS label,
          COUNT(*) AS event_count,
          SUM(mr.maintenance_cost) AS maintenance_cost
        FROM [${MFG_DB}].dbo.maintenance_records mr
        JOIN [${MFG_DB}].dbo.machines m ON m.asset_id = mr.asset_id
        ${where}
        GROUP BY mr.maintenance_type
        ORDER BY event_count DESC`;
    } else if (metric === 'maintenance' && groupBy === 'month') {
      sql = `
        SELECT CONVERT(char(7), mr.repair_start_datetime, 126) AS label,
          COUNT(*) AS event_count,
          SUM(mr.maintenance_cost) AS maintenance_cost
        FROM [${MFG_DB}].dbo.maintenance_records mr
        JOIN [${MFG_DB}].dbo.machines m ON m.asset_id = mr.asset_id
        ${where}
        GROUP BY CONVERT(char(7), mr.repair_start_datetime, 126)
        ORDER BY label`;
    } else {
      sql = `
        SELECT p.plant_name AS label,
          COUNT(*) AS event_count,
          SUM(mr.maintenance_cost) AS maintenance_cost
        FROM [${MFG_DB}].dbo.maintenance_records mr
        JOIN [${MFG_DB}].dbo.machines m ON m.asset_id = mr.asset_id
        JOIN [${MFG_DB}].dbo.plants p ON p.plant_id = m.plant_id
        ${where}
        GROUP BY p.plant_name
        ORDER BY event_count DESC`;
    }

    const data = await query(sql, params);
    res.json({ success: true, count: data.length, metric, group_by: groupBy, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ============= SUMMARY ENDPOINTS =============

async function getProductionSummary(req, res) {
  try {
    const ids = uuidParams(req.query, ['plant_id', 'line_id']);
    if (ids.error) return res.status(400).json({ success: false, error: ids.error });
    const { plant_id: plantId, line_id: lineId } = ids.values;
    const fromDate = dateParam(req.query.from);
    const toDate = dateParam(req.query.to);

    let sql = `
      SELECT
        COUNT(*) as total_runs,
        SUM(planned_quantity) as total_planned,
        SUM(actual_quantity) as total_actual,
        SUM(good_quantity) as total_good,
        SUM(rejected_quantity) as total_rejected,
        CAST(AVG(CAST(actual_quantity AS FLOAT) / NULLIF(planned_quantity, 0) * 100) AS DECIMAL(10,2)) as avg_output_pct,
        CAST(AVG(CAST(good_quantity AS FLOAT) / NULLIF(actual_quantity, 0) * 100) AS DECIMAL(10,2)) as avg_quality_pct
      FROM [${MFG_DB}].dbo.production_runs WHERE 1=1`;

    const params = {};
    const clauses = [];

    if (plantId) addFilter(clauses, params, 'plant_id', 'plant_id = @plant_id', plantId);
    if (lineId) addFilter(clauses, params, 'line_id', 'line_id = @line_id', lineId);
    if (fromDate) addFilter(clauses, params, 'from_date', 'date >= @from_date', fromDate);
    if (toDate) addFilter(clauses, params, 'to_date', 'date <= @to_date', toDate);

    if (clauses.length > 0) {
      sql += ` AND ${clauses.join(' AND ')}`;
    }

    const summary = await query(sql, params);

    let byLineSql = `SELECT TOP 20
      pl.plant_name,
      l.line_name,
      COUNT(*) as run_count,
      SUM(pr.good_quantity) as good_qty,
      SUM(pr.actual_quantity) as actual_qty,
      CAST(AVG(CAST(pr.good_quantity AS FLOAT) / NULLIF(pr.actual_quantity, 0) * 100) AS DECIMAL(10,2)) as quality_pct
    FROM [${MFG_DB}].dbo.production_runs pr
    JOIN [${MFG_DB}].dbo.production_lines l ON pr.line_id = l.line_id
    JOIN [${MFG_DB}].dbo.plants pl ON pr.plant_id = pl.plant_id
    WHERE 1=1`;

    if (plantId) byLineSql += ` AND pr.plant_id = @plant_id`;
    if (lineId) byLineSql += ` AND pr.line_id = @line_id`;
    if (fromDate) byLineSql += ` AND pr.date >= @from_date`;
    if (toDate) byLineSql += ` AND pr.date <= @to_date`;
    byLineSql += ` GROUP BY pl.plant_name, l.line_name ORDER BY good_qty DESC`;

    const byLine = await query(byLineSql, params);

    res.json({
      success: true,
      summary: summary[0] || {},
      by_line: byLine || [],
      message: 'Production summary aggregated by line'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getCostSummary(req, res) {
  try {
    const ids = uuidParams(req.query, ['plant_id', 'line_id']);
    if (ids.error) return res.status(400).json({ success: false, error: ids.error });
    const { plant_id: plantId, line_id: lineId } = ids.values;
    const fromDate = dateParam(req.query.from);
    const toDate = dateParam(req.query.to);

    let sql = `
      SELECT
        COUNT(*) as record_count,
        SUM(units_produced) as total_units,
        CAST(AVG(actual_cost_per_unit) AS DECIMAL(10,2)) as avg_unit_cost,
        CAST(SUM(actual_cost_per_unit * units_produced) AS DECIMAL(12,2)) as total_production_cost,
        CAST(SUM(energy_cost) AS DECIMAL(12,2)) as total_energy_cost,
        CAST(SUM(scrap_cost) AS DECIMAL(12,2)) as total_scrap_cost,
        CAST(SUM(labor_cost) AS DECIMAL(12,2)) as total_labor_cost,
        CAST(AVG(energy_kwh / NULLIF(units_produced, 0)) AS DECIMAL(10,2)) as avg_energy_per_unit
      FROM [${MFG_DB}].dbo.cost_records WHERE 1=1`;

    const params = {};
    const clauses = [];

    if (plantId) addFilter(clauses, params, 'plant_id', 'plant_id = @plant_id', plantId);
    if (lineId) addFilter(clauses, params, 'line_id', 'line_id = @line_id', lineId);
    if (fromDate) addFilter(clauses, params, 'from_date', 'date >= @from_date', fromDate);
    if (toDate) addFilter(clauses, params, 'to_date', 'date <= @to_date', toDate);

    if (clauses.length > 0) {
      sql += ` AND ${clauses.join(' AND ')}`;
    }

    const summary = await query(sql, params);

    let byLineSql = `SELECT TOP 20
      pl.plant_name,
      l.line_name,
      SUM(cr.units_produced) as units,
      CAST(AVG(cr.actual_cost_per_unit) AS DECIMAL(10,2)) as avg_unit_cost,
      CAST(SUM(cr.energy_cost) AS DECIMAL(12,2)) as energy_cost,
      CAST(SUM(cr.scrap_cost) AS DECIMAL(12,2)) as scrap_cost
    FROM [${MFG_DB}].dbo.cost_records cr
    JOIN [${MFG_DB}].dbo.production_lines l ON cr.line_id = l.line_id
    JOIN [${MFG_DB}].dbo.plants pl ON cr.plant_id = pl.plant_id
    WHERE 1=1`;

    if (plantId) byLineSql += ` AND cr.plant_id = @plant_id`;
    if (lineId) byLineSql += ` AND cr.line_id = @line_id`;
    if (fromDate) byLineSql += ` AND cr.date >= @from_date`;
    if (toDate) byLineSql += ` AND cr.date <= @to_date`;
    byLineSql += ` GROUP BY pl.plant_name, l.line_name ORDER BY scrap_cost DESC`;

    const byLine = await query(byLineSql, params);

    res.json({
      success: true,
      summary: summary[0] || {},
      by_line: byLine || [],
      message: 'Cost summary aggregated by line'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getInventorySummary(req, res) {
  try {
    const ids = uuidParams(req.query, ['plant_id']);
    if (ids.error) return res.status(400).json({ success: false, error: ids.error });
    const plantId = ids.values.plant_id;
    const fromDate = dateParam(req.query.from);
    const toDate = dateParam(req.query.to);

    let sql = `
      SELECT
        COUNT(*) as transaction_count,
        COUNT(DISTINCT material_id) as unique_materials,
        COUNT(DISTINCT supplier_id) as unique_suppliers
      FROM [${MFG_DB}].dbo.inventory_transactions WHERE 1=1`;

    const params = {};
    const clauses = [];

    if (plantId) addFilter(clauses, params, 'plant_id', 'plant_id = @plant_id', plantId);
    if (fromDate) addFilter(clauses, params, 'from_date', 'date >= @from_date', fromDate);
    if (toDate) addFilter(clauses, params, 'to_date', 'date <= @to_date', toDate);

    if (clauses.length > 0) {
      sql += ` AND ${clauses.join(' AND ')}`;
    }

    const summary = await query(sql, params);

    let byMaterialSql = `SELECT TOP 25
      m.material_name,
      COUNT(*) as transaction_count
    FROM [${MFG_DB}].dbo.inventory_transactions it
    JOIN [${MFG_DB}].dbo.materials m ON it.material_id = m.material_id
    WHERE 1=1`;

    if (plantId) byMaterialSql += ` AND it.plant_id = @plant_id`;
    if (fromDate) byMaterialSql += ` AND it.date >= @from_date`;
    if (toDate) byMaterialSql += ` AND it.date <= @to_date`;
    byMaterialSql += ` GROUP BY m.material_name ORDER BY transaction_count DESC`;

    const byMaterial = await query(byMaterialSql, params);

    res.json({
      success: true,
      summary: summary[0] || {},
      by_material: byMaterial || [],
      message: 'Inventory summary aggregated by material'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getMaintenanceSummary(req, res) {
  try {
    const ids = uuidParams(req.query, ['plant_id', 'line_id']);
    if (ids.error) return res.status(400).json({ success: false, error: ids.error });
    const { plant_id: plantId, line_id: lineId } = ids.values;
    const fromDate = dateParam(req.query.from);
    const toDate = dateParam(req.query.to);

    let sql = `
      SELECT
        COUNT(*) as total_records,
        SUM(CASE WHEN maintenance_type = 'preventive' THEN 1 ELSE 0 END) as preventive_count,
        SUM(CASE WHEN maintenance_type = 'corrective' THEN 1 ELSE 0 END) as corrective_count,
        COUNT(DISTINCT asset_id) as unique_machines
      FROM [${MFG_DB}].dbo.maintenance_records WHERE 1=1`;

    const params = {};
    const clauses = [];

    if (plantId) addFilter(clauses, params, 'plant_id', 'plant_id = @plant_id', plantId);
    if (lineId) {
      sql = sql.replace('FROM [${MFG_DB}].dbo.maintenance_records',
        `FROM [${MFG_DB}].dbo.maintenance_records mr
         JOIN [${MFG_DB}].dbo.machines m ON mr.asset_id = m.asset_id`);
      addFilter(clauses, params, 'line_id', 'm.line_id = @line_id', lineId);
    }
    if (fromDate) addFilter(clauses, params, 'from_date', 'CAST(repair_start_datetime AS DATE) >= @from_date', fromDate);
    if (toDate) addFilter(clauses, params, 'to_date', 'CAST(repair_start_datetime AS DATE) <= @to_date', toDate);

    if (clauses.length > 0) {
      sql += ` AND ${clauses.join(' AND ')}`;
    }

    const summary = await query(sql, params);

    let byMachineSQL = `SELECT TOP 25
      p.plant_name,
      l.line_name,
      m.machine_name,
      COUNT(*) as maintenance_count,
      SUM(CASE WHEN mr.maintenance_type = 'preventive' THEN 1 ELSE 0 END) as preventive,
      SUM(CASE WHEN mr.maintenance_type = 'corrective' THEN 1 ELSE 0 END) as corrective
    FROM [${MFG_DB}].dbo.maintenance_records mr
    JOIN [${MFG_DB}].dbo.machines m ON mr.asset_id = m.asset_id
    JOIN [${MFG_DB}].dbo.production_lines l ON m.line_id = l.line_id
    JOIN [${MFG_DB}].dbo.plants p ON m.plant_id = p.plant_id
    WHERE 1=1`;

    if (plantId) byMachineSQL += ` AND m.plant_id = @plant_id`;
    if (lineId) byMachineSQL += ` AND m.line_id = @line_id`;
    if (fromDate) byMachineSQL += ` AND CAST(mr.repair_start_datetime AS DATE) >= @from_date`;
    if (toDate) byMachineSQL += ` AND CAST(mr.repair_start_datetime AS DATE) <= @to_date`;
    byMachineSQL += ` GROUP BY p.plant_name, l.line_name, m.machine_name ORDER BY maintenance_count DESC`;

    const byMachine = await query(byMachineSQL, params);

    res.json({
      success: true,
      summary: summary[0] || {},
      by_machine: byMachine || [],
      message: 'Maintenance summary aggregated by machine'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// Export all handlers
module.exports = {
  // Dimensions
  getPlants,
  getProductionLines,
  getMachines,
  getProducts,

  // Facts
  getProductionRuns,
  getDowntimeEvents,
  getQualityTests,
  getMaintenanceRecords,
  getInventory,
  getCostRecords,

  // KPIs
  getOEEDashboard,
  getDowntimeAnalysis,
  getDowntimeSummary,
  getMetricSummary,
  getQualityTrends,

  // Summaries
  getProductionSummary,
  getCostSummary,
  getInventorySummary,
  getMaintenanceSummary
};
