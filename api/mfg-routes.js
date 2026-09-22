/**
 * Manufacturing Agent API Routes
 * Endpoints for manufacturing data retrieval and KPI analysis
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query } = require('./db');
const { intParam, strParam, dateParam, uuidParams, addFilter, whereSql } = require('./queryParams');

const MFG_DB = process.env.DB_NAME_MFG || 'manufacturing_agent_demo';
const reportsDir = path.join(__dirname, 'reports', 'generated');

// Create reports directory if it doesn't exist
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

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
    const ids = uuidParams(req.query, ['line_id', 'product_id']);
    if (ids.error) return res.status(400).json({ success: false, error: ids.error });
    const { line_id: lineId, product_id: productId } = ids.values;
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
    const ids = uuidParams(req.query, ['asset_id']);
    if (ids.error) return res.status(400).json({ success: false, error: ids.error });
    const assetId = ids.values.asset_id;
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
    const ids = uuidParams(req.query, ['plant_id']);
    if (ids.error) return res.status(400).json({ success: false, error: ids.error });
    const plantId = ids.values.plant_id;
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
    const ids = uuidParams(req.query, ['plant_id']);
    if (ids.error) return res.status(400).json({ success: false, error: ids.error });
    const plantId = ids.values.plant_id;
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
    const ids = uuidParams(req.query, ['plant_id', 'product_id']);
    if (ids.error) return res.status(400).json({ success: false, error: ids.error });
    const { plant_id: plantId, product_id: productId } = ids.values;
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

// ============= REPORT GENERATION =============

const ReportGenerator = require('./reports/reportGenerator');

async function generateReport(req, res) {
  try {
    const reportType = strParam(req.query.report_type);
    const fromDate = dateParam(req.query.from);
    const toDate = dateParam(req.query.to);
    const ids = uuidParams(req.query, ['plant_id']);
    if (ids.error) return res.status(400).json({ success: false, error: ids.error });
    const plantId = ids.values.plant_id;

    if (!reportType) {
      return res.status(400).json({ success: false, error: 'report_type parameter required' });
    }

    let reportData = {};

    // Fetch data based on report type
    switch (reportType) {
      case 'oee-dashboard':
        reportData = await getOEEReportData(fromDate, toDate, plantId);
        break;
      case 'downtime-analysis':
        reportData = await getDowntimeReportData(fromDate, toDate, plantId);
        break;
      case 'quality-trends':
        reportData = await getQualityReportData(fromDate, toDate, plantId);
        break;
      case 'cost-analysis':
        reportData = await getCostReportData(fromDate, toDate, plantId);
        break;
      case 'executive-summary':
        reportData = await getExecutiveReportData(fromDate, toDate, plantId);
        break;
      default:
        return res.status(400).json({ success: false, error: `Unknown report type: ${reportType}` });
    }

    // Generate PPTX
    const generator = new ReportGenerator(reportType, reportData);
    const prs = await generator.generateReport();

    // Save to persistent reports directory
    const filename = `mfg-${reportType}_${Date.now()}.pptx`;
    const filepath = path.join(reportsDir, filename);
    await prs.writeFile({ fileName: filepath });

    // Return download link
    const downloadUrl = `${req.protocol}://${req.get('host')}/reports/download/${filename}`;

    res.json({
      success: true,
      report_type: reportType,
      filename: filename,
      download_url: downloadUrl,
      message: 'Manufacturing report generated successfully. Use download_url to download.'
    });
  } catch (err) {
    console.error('Report generation error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// Helper functions to fetch report-specific data
async function getOEEReportData(fromDate, toDate, plantId) {
  // OEE metrics are computed — production_runs has no oee_pct column
  let sql = `SELECT
    AVG(CASE WHEN planned_quantity > 0
      THEN CAST(actual_quantity AS FLOAT) / planned_quantity * 100 ELSE NULL END) as overall_availability,
    AVG(CASE WHEN planned_quantity > 0
      THEN CAST(actual_quantity AS FLOAT) / planned_quantity * 100 ELSE NULL END) as overall_performance,
    AVG(CASE WHEN actual_quantity > 0
      THEN CAST(good_quantity AS FLOAT) / actual_quantity * 100 ELSE NULL END) as overall_quality,
    AVG(CASE WHEN planned_quantity > 0
      THEN CAST(good_quantity AS FLOAT) / planned_quantity * 100 ELSE NULL END) as overall
  FROM [${MFG_DB}].dbo.production_runs WHERE 1=1`;

  const params = {};
  if (fromDate) sql += ` AND date >= @from_date`, params.from_date = fromDate;
  if (toDate) sql += ` AND date <= @to_date`, params.to_date = toDate;
  if (plantId) sql += ` AND plant_id = @plant_id`, params.plant_id = plantId;

  const summary = await query(sql, params);

  let lineSql = `SELECT TOP 10
    pl.line_name,
    CAST(AVG(CASE WHEN pr.planned_quantity > 0
      THEN CAST(pr.good_quantity AS FLOAT) / pr.planned_quantity * 100 ELSE NULL END) AS DECIMAL(10,2)) as oee_pct
  FROM [${MFG_DB}].dbo.production_runs pr
  JOIN [${MFG_DB}].dbo.production_lines pl ON pr.line_id = pl.line_id
  WHERE 1=1`;

  if (fromDate) lineSql += ` AND pr.date >= @from_date`;
  if (toDate) lineSql += ` AND pr.date <= @to_date`;
  if (plantId) lineSql += ` AND pr.plant_id = @plant_id`;
  lineSql += ` GROUP BY pl.line_name ORDER BY oee_pct DESC`;

  const oeeByLine = await query(lineSql, params);

  return {
    oee_summary: summary[0] || {},
    oee_by_line: oeeByLine || [],
    top_line: oeeByLine?.[0]?.line_name || 'N/A',
    poor_performers: oeeByLine?.filter(l => (Number(l.oee_pct) || 0) < 80).length || 0,
  };
}

async function getDowntimeReportData(fromDate, toDate, plantId) {
  let sql = `SELECT
    COUNT(*) as incident_count,
    SUM(duration_minutes) / 60.0 as total_hours,
    AVG(CAST(duration_minutes AS FLOAT)) as avg_duration
  FROM [${MFG_DB}].dbo.downtime_events WHERE 1=1`;

  const params = {};
  if (fromDate) sql += ` AND CAST(event_start_datetime AS DATE) >= @from_date`, params.from_date = fromDate;
  if (toDate) sql += ` AND CAST(event_start_datetime AS DATE) <= @to_date`, params.to_date = toDate;
  if (plantId) sql += ` AND plant_id = @plant_id`, params.plant_id = plantId;

  const summary = await query(sql, params);

  let reasonSql = `SELECT TOP 10
    ISNULL(failure_mode, ISNULL(reason_code, category)) as reason_code,
    COUNT(*) as count,
    SUM(duration_minutes) / 60.0 as total_hours
  FROM [${MFG_DB}].dbo.downtime_events
  WHERE 1=1`;

  if (fromDate) reasonSql += ` AND CAST(event_start_datetime AS DATE) >= @from_date`;
  if (toDate) reasonSql += ` AND CAST(event_start_datetime AS DATE) <= @to_date`;
  if (plantId) reasonSql += ` AND plant_id = @plant_id`;
  reasonSql += ` GROUP BY ISNULL(failure_mode, ISNULL(reason_code, category)) ORDER BY total_hours DESC`;

  const topReasons = await query(reasonSql, params);
  const totalHours = Number(summary[0]?.total_hours) || 1;
  const reasonsWithPct = (topReasons || []).map(r => ({
    ...r,
    pct: (Number(r.total_hours) || 0) / totalHours
  }));

  return {
    summary: summary[0] || {},
    top_reasons: reasonsWithPct || [],
  };
}

async function getQualityReportData(fromDate, toDate, plantId) {
  // quality_tests uses produced_quantity / rejected_quantity (no good_qty column)
  let sql = `SELECT
    AVG(CASE WHEN produced_quantity > 0
      THEN ((produced_quantity - rejected_quantity) * 100.0 / produced_quantity) ELSE 0 END) as avg_yield,
    AVG(CASE WHEN produced_quantity > 0
      THEN (rejected_quantity * 100.0 / produced_quantity) ELSE 0 END) as avg_rejection,
    SUM(produced_quantity - rejected_quantity) as total_good,
    SUM(rejected_quantity) as total_rejected
  FROM [${MFG_DB}].dbo.quality_tests WHERE 1=1`;

  const params = {};
  if (fromDate) sql += ` AND date >= @from_date`, params.from_date = fromDate;
  if (toDate) sql += ` AND date <= @to_date`, params.to_date = toDate;
  if (plantId) sql += ` AND plant_id = @plant_id`, params.plant_id = plantId;

  const summary = await query(sql, params);

  let prodSql = `SELECT TOP 10
    p.product_name,
    AVG(CASE WHEN qt.produced_quantity > 0
      THEN ((qt.produced_quantity - qt.rejected_quantity) * 100.0 / qt.produced_quantity) ELSE 0 END) as yield_pct,
    AVG(CASE WHEN qt.produced_quantity > 0
      THEN (qt.rejected_quantity * 100.0 / qt.produced_quantity) ELSE 0 END) as rejection_pct
  FROM [${MFG_DB}].dbo.quality_tests qt
  JOIN [${MFG_DB}].dbo.products p ON qt.product_id = p.product_id
  WHERE 1=1`;

  if (fromDate) prodSql += ` AND qt.date >= @from_date`;
  if (toDate) prodSql += ` AND qt.date <= @to_date`;
  if (plantId) prodSql += ` AND qt.plant_id = @plant_id`;
  prodSql += ` GROUP BY p.product_name ORDER BY yield_pct DESC`;

  const byProduct = await query(prodSql, params);

  return {
    summary: summary[0] || {},
    by_product: byProduct || [],
  };
}

async function getCostReportData(fromDate, toDate, plantId) {
  let sql = `SELECT
    AVG(actual_cost_per_unit) as avg_cost,
    SUM(energy_cost) as energy_cost,
    SUM(scrap_cost) as scrap_cost,
    SUM(actual_cost_per_unit * units_produced) as total_cost
  FROM [${MFG_DB}].dbo.cost_records WHERE 1=1`;

  const params = {};
  if (fromDate) sql += ` AND date >= @from_date`, params.from_date = fromDate;
  if (toDate) sql += ` AND date <= @to_date`, params.to_date = toDate;
  if (plantId) sql += ` AND plant_id = @plant_id`, params.plant_id = plantId;

  const summary = await query(sql, params);

  // By line
  let lineSql = `SELECT TOP 10
    pl.line_name,
    AVG(cr.actual_cost_per_unit) as unit_cost,
    AVG(cr.energy_kwh / NULLIF(cr.units_produced, 0)) as energy_per_unit,
    SUM(cr.actual_cost_per_unit * cr.units_produced) as total_cost
  FROM [${MFG_DB}].dbo.cost_records cr
  JOIN [${MFG_DB}].dbo.production_lines pl ON cr.line_id = pl.line_id
  WHERE 1=1`;

  if (fromDate) lineSql += ` AND cr.date >= @from_date`;
  if (toDate) lineSql += ` AND cr.date <= @to_date`;
  if (plantId) lineSql += ` AND cr.plant_id = @plant_id`;
  lineSql += ` GROUP BY pl.line_name ORDER BY total_cost DESC`;

  const byLine = await query(lineSql, params);

  return {
    summary: summary[0] || {},
    by_line: byLine || [],
  };
}

async function getExecutiveReportData(fromDate, toDate, plantId) {
  // Fetch all KPIs
  const oeeData = await getOEEReportData(fromDate, toDate, plantId);
  const downtimeData = await getDowntimeReportData(fromDate, toDate, plantId);
  const qualityData = await getQualityReportData(fromDate, toDate, plantId);
  const costData = await getCostReportData(fromDate, toDate, plantId);

  return {
    kpis: {
      oee: oeeData.oee_summary?.overall || 0,
      yield: qualityData.summary?.avg_yield || 0,
      cost: costData.summary?.avg_cost || 0,
      downtime: downtimeData.summary?.total_hours || 0,
    },
    top_issues: [
      { title: 'Downtime Incidents', impact: `${downtimeData.summary?.incident_count} events` },
      { title: 'Quality Concerns', impact: `${(qualityData.summary?.avg_rejection || 0).toFixed(1)}% rejection rate` },
      { title: 'Cost Variance', impact: `$${(costData.summary?.avg_cost || 0).toFixed(2)}/unit` },
    ],
    recommended_actions: [
      { action: 'Review top downtime drivers and implement preventive maintenance' },
      { action: 'Investigate quality trends and implement process controls' },
      { action: 'Analyze cost drivers and optimize line efficiency' },
      { action: 'Schedule weekly performance review meetings' },
    ],
  };
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
  getQualityTrends,

  // Reports
  generateReport
};
