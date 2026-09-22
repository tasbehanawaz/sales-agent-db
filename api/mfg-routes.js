/**
 * Manufacturing Agent API Routes
 * Endpoints for manufacturing data retrieval and KPI analysis
 */

require('dotenv').config();
const { query } = require('./db');
const { intParam, strParam, dateParam, addFilter, whereSql } = require('./queryParams');

const MFG_DB = process.env.DB_NAME_MFG || 'manufacturing_agent_demo';

// ============= DIMENSION ENDPOINTS =============

async function getPlants(req, res) {
  try {
    const data = await query(`SELECT * FROM [${MFG_DB}].dbo.plants ORDER BY plant_name`, {});
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getProductionLines(req, res) {
  try {
    const plantId = strParam(req.query.plant_id);
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
    const lineId = strParam(req.query.line_id);
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
    const data = await query(`SELECT * FROM [${MFG_DB}].dbo.products ORDER BY product_name`, {});
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ============= FACT TABLE ENDPOINTS =============

async function getProductionRuns(req, res) {
  try {
    const limit = intParam(req.query.limit, 100, 1, 1000);
    const plantId = strParam(req.query.plant_id);
    const lineId = strParam(req.query.line_id);
    const productId = strParam(req.query.product_id);
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
    const plantId = strParam(req.query.plant_id);
    const lineId = strParam(req.query.line_id);
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
    const lineId = strParam(req.query.line_id);
    const productId = strParam(req.query.product_id);
    const fromDate = dateParam(req.query.from);
    const toDate = dateParam(req.query.to);

    let sql = `SELECT TOP (@limit) qt.*, p.product_name, l.line_name, pl.plant_name
               FROM [${MFG_DB}].dbo.quality_tests qt
               JOIN [${MFG_DB}].dbo.products p ON qt.product_id = p.product_id
               JOIN [${MFG_DB}].dbo.production_lines l ON qt.line_id = l.line_id
               JOIN [${MFG_DB}].dbo.plants pl ON qt.plant_id = pl.plant_id`;

    const params = { limit };
    const clauses = [];

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
    const assetId = strParam(req.query.asset_id);
    const maintType = strParam(req.query.maintenance_type);
    const fromDate = dateParam(req.query.from);
    const toDate = dateParam(req.query.to);

    let sql = `SELECT TOP (@limit) mr.*, m.machine_name, m.criticality
               FROM [${MFG_DB}].dbo.maintenance_records mr
               JOIN [${MFG_DB}].dbo.machines m ON mr.asset_id = m.asset_id`;

    const params = { limit };
    const clauses = [];

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
    const plantId = strParam(req.query.plant_id);
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
    const lineId = strParam(req.query.line_id);
    const productId = strParam(req.query.product_id);
    const fromDate = dateParam(req.query.from);
    const toDate = dateParam(req.query.to);

    let sql = `SELECT TOP (@limit) cr.*, p.product_name, l.line_name, pl.plant_name
               FROM [${MFG_DB}].dbo.cost_records cr
               JOIN [${MFG_DB}].dbo.products p ON cr.product_id = p.product_id
               JOIN [${MFG_DB}].dbo.production_lines l ON cr.line_id = l.line_id
               JOIN [${MFG_DB}].dbo.plants pl ON cr.plant_id = pl.plant_id`;

    const params = { limit };
    const clauses = [];

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
    const plantId = strParam(req.query.plant_id);
    const fromDate = dateParam(req.query.from);
    const toDate = dateParam(req.query.to);

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
    const plantId = strParam(req.query.plant_id);
    const fromDate = dateParam(req.query.from);
    const toDate = dateParam(req.query.to);

    let sql = `
      SELECT TOP 20
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

    const params = {};
    const clauses = [];

    if (plantId) addFilter(clauses, params, 'plant_id', 'de.plant_id = @plant_id', plantId);
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

async function getQualityTrends(req, res) {
  try {
    const plantId = strParam(req.query.plant_id);
    const productId = strParam(req.query.product_id);
    const fromDate = dateParam(req.query.from);
    const toDate = dateParam(req.query.to);

    let sql = `
      SELECT
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

    const params = {};
    const clauses = [];

    if (plantId) addFilter(clauses, params, 'plant_id', 'qt.plant_id = @plant_id', plantId);
    if (productId) addFilter(clauses, params, 'product_id', 'qt.product_id = @product_id', productId);
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
  getQualityTrends
};
