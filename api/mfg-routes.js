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

// ============= REPORT GENERATION =============

const ReportGenerator = require('./reports/reportGenerator');
const PDFReportGenerator = require('./reports/pdfReportGenerator');

async function generateReport(req, res) {
  try {
    const reportType = strParam(req.query.report_type);
    const format = strParam(req.query.format) || 'pptx';
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

    // Generate report in requested format
    if (format === 'pdf') {
      return await generateReportPDF(reportType, reportData, req, res, {
        from: fromDate,
        to: toDate,
        plant_id: plantId,
      });
    } else {
      // Default to PPTX
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
        format: 'pptx',
        filename: filename,
        download_url: downloadUrl,
        message: 'Manufacturing report generated successfully. Use download_url to download.'
      });
    }
  } catch (err) {
    console.error('Report generation error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function generateReportPDF(reportType, reportData, req, res, filters = {}, extra = {}) {
  try {
    const generator = new PDFReportGenerator(reportType, reportData, filters);
    await generator.generateReport();

    const fileSlug = extra.file_slug || reportType;
    const filename = `mfg-${fileSlug}_${Date.now()}.pdf`;
    const filepath = path.join(reportsDir, filename);

    await generator.save(fs.createWriteStream(filepath));

    // Return download link
    const downloadUrl = `${req.protocol}://${req.get('host')}/reports/download/${filename}`;

    // Don't leak file_slug into the JSON response
    const { file_slug: _fileSlug, ...publicExtra } = extra;

    res.json({
      success: true,
      report_type: reportType,
      format: 'pdf',
      filename: filename,
      download_url: downloadUrl,
      message: publicExtra.query
        ? `Manufacturing report generated from query topics: ${(publicExtra.topics || []).join(', ') || 'custom'}. Use download_url to download.`
        : 'Manufacturing report generated successfully. Use download_url to download.',
      ...publicExtra,
    });
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function generateReportQuery(req, res) {
  try {
    const userQuery = strParam(req.body.query) || strParam(req.query.query);
    const format = strParam(req.body.format) || strParam(req.query.format) || 'pptx';
    const fromDate = dateParam(req.body.from) || dateParam(req.query.from);
    const toDate = dateParam(req.body.to) || dateParam(req.query.to);
    const ids = uuidParams({ ...req.query, ...req.body }, ['plant_id']);
    if (ids.error) return res.status(400).json({ success: false, error: ids.error });
    const plantId = ids.values.plant_id;

    if (!userQuery) {
      return res.status(400).json({ success: false, error: 'query parameter required' });
    }

    // Analyze the user question → topics → fetch matching DB data → custom report
    const plan = analyzeQuery(userQuery);
    const reportData = await buildQueryDrivenReportData(plan, fromDate, toDate, plantId);
    const reportType = 'query-driven';
    const fileSlug = buildReportFileSlug(reportData.title || plan.title, plan.topics);
    const filters = { from: fromDate, to: toDate, plant_id: plantId, query: userQuery };

    if (format === 'pdf') {
      return await generateReportPDF(reportType, reportData, req, res, filters, {
        query: userQuery,
        title: reportData.title || plan.title,
        inferred_report_type: reportType,
        topics: plan.topics,
        matched_template: plan.primaryTemplate,
        file_slug: fileSlug,
      });
    }

    const generator = new ReportGenerator(reportType, reportData, filters);
    const prs = await generator.generateReport();
    const filename = `mfg-${fileSlug}_${Date.now()}.pptx`;
    const filepath = path.join(reportsDir, filename);
    await prs.writeFile({ fileName: filepath });
    const downloadUrl = `${req.protocol}://${req.get('host')}/reports/download/${filename}`;

    res.json({
      success: true,
      query: userQuery,
      title: reportData.title || plan.title,
      report_type: reportType,
      inferred_report_type: reportType,
      topics: plan.topics,
      matched_template: plan.primaryTemplate,
      format: 'pptx',
      filename,
      download_url: downloadUrl,
      message: `Report built from DB data for topics: ${plan.topics.join(', ') || 'general'}. Use download_url to download.`,
    });
  } catch (err) {
    console.error('Query-based report generation error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

/** Safe filename segment from title/topics, e.g. "production-runs" */
function buildReportFileSlug(title, topics) {
  let base = String(title || '')
    .replace(/\breport\b/gi, '')
    .trim();
  if (!base || base.length < 3) {
    base = (topics || []).join('-') || 'custom';
  }
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || 'custom';
}

/**
 * Turn a free-text question into topics we can fetch from the manufacturing DB.
 * Multiple topics allowed (e.g. "downtime and quality").
 */
function analyzeQuery(query) {
  const q = String(query || '').toLowerCase();
  const topics = new Set();

  if (/\boee\b|\bavailability\b|\bequipment effectiveness\b/.test(q)) topics.add('oee');
  if (/\bdowntime\b|\bfailure\b|\bbreakdown\b|\bpareto\b|\bunplanned\b/.test(q)) topics.add('downtime');
  if (/\bquality\b|\brejection\b|\byield\b|\bdefect\b|\bscrap\b/.test(q)) topics.add('quality');
  if (/\bproducts?\b|\bsku\b|\bskus\b/.test(q)) topics.add('products');
  if (/\bcosts?\b|\benergy\b|\blabor\b|\bunit cost\b|\bexpense\b/.test(q)) topics.add('costs');
  if (/\bproduction runs?\b|\boutput\b|\bthroughput\b|\bgood quantity\b|\bruntime\b/.test(q)) topics.add('production');
  if (/\bproduction lines?\b|\blines?\b/.test(q) && !/\bonline\b|\bdeadline\b/.test(q)) topics.add('lines');
  if (/\bexecutive\b|\boverview\b|\bkpis?\b|\bdashboard\b/.test(q)) topics.add('executive');

  // "report on production lines" → lines + oee/production
  if (topics.has('lines') && !topics.has('oee') && !topics.has('production') && !topics.has('costs')) {
    topics.add('oee');
    topics.add('production');
  }
  // products without explicit quality still get quality-by-product
  if (topics.has('products') && !topics.has('quality')) topics.add('quality');

  let topicList = [...topics];
  if (topicList.length === 0) topicList = ['executive'];

  // Map to a legacy template name for messaging (closest single fit)
  const primaryTemplate = inferReportType(query);

  const title = buildReportTitleFromQuery(query, topicList);
  return { topics: topicList, primaryTemplate, title };
}

function buildReportTitleFromQuery(query, topics) {
  const cleaned = String(query || '')
    .replace(/^(create|generate|make|give me|show me|build)\s+(a\s+)?/i, '')
    .replace(/\b(pdf|pptx|powerpoint|report)\b/gi, '')
    .replace(/^\s*(on|for|about)\s+/i, '')
    .replace(/^\s*the\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length >= 3 && cleaned.length <= 80) {
    const titled = cleaned.replace(/^\w/, (c) => c.toUpperCase());
    return /report$/i.test(titled) ? titled : `${titled} Report`;
  }
  const labels = {
    oee: 'OEE',
    downtime: 'Downtime',
    quality: 'Quality',
    products: 'Product',
    costs: 'Cost',
    production: 'Production',
    lines: 'Production Line',
    executive: 'Executive',
  };
  return topics.map((t) => labels[t] || t).join(' & ') + ' Report';
}

async function buildQueryDrivenReportData(plan, fromDate, toDate, plantId) {
  const sections = [];
  const kpis = [];
  const topics = plan.topics || [];

  const need = (t) => topics.includes(t);

  if (need('oee') || need('lines')) {
    const oee = await getOEEReportData(fromDate, toDate, plantId);
    const s = oee.oee_summary || {};
    kpis.push(
      { label: 'Overall OEE', value: `${Number(s.overall || 0).toFixed(1)}%`, color: 'primary' },
      { label: 'Availability', value: `${Number(s.overall_availability || 0).toFixed(1)}%`, color: 'success' },
    );
    sections.push({
      id: 'oee',
      title: 'OEE / Line Performance',
      kpis: [
        { label: 'Overall OEE', value: `${Number(s.overall || 0).toFixed(1)}%`, color: 'primary' },
        { label: 'Availability', value: `${Number(s.overall_availability || 0).toFixed(1)}%`, color: 'success' },
        { label: 'Performance', value: `${Number(s.overall_performance || 0).toFixed(1)}%`, color: 'warning' },
        { label: 'Quality', value: `${Number(s.overall_quality || 0).toFixed(1)}%`, color: 'danger' },
      ],
      table: {
        headers: ['Line', 'OEE %', 'Status'],
        rows: (oee.oee_by_line || []).slice(0, 12).map((line) => {
          const pct = Number(line.oee_pct || 0);
          return [line.line_name || 'N/A', `${pct.toFixed(1)}%`, pct >= 80 ? 'Good' : 'Needs Attention'];
        }),
        weights: [3, 1.2, 1.8],
      },
      bullets: [
        `Top performing line: ${oee.top_line || 'N/A'}`,
        `Lines below 80% OEE: ${oee.poor_performers || 0}`,
      ],
    });
  }

  if (need('production') || need('lines')) {
    const prod = await getProductionReportData(fromDate, toDate, plantId);
    const s = prod.summary || {};
    sections.push({
      id: 'production',
      title: 'Production Runs / Output',
      kpis: [
        { label: 'Good Qty', value: Number(s.total_good || 0).toLocaleString(), color: 'success' },
        { label: 'Actual Qty', value: Number(s.total_actual || 0).toLocaleString(), color: 'primary' },
        { label: 'Rejected', value: Number(s.total_rejected || 0).toLocaleString(), color: 'danger' },
        { label: 'Run Count', value: String(s.run_count || 0), color: 'neutral' },
      ],
      table: {
        headers: ['Line', 'Good Qty', 'Actual Qty', 'Runs'],
        rows: (prod.by_line || []).slice(0, 12).map((r) => [
          r.line_name || 'N/A',
          Number(r.good_quantity || 0).toLocaleString(),
          Number(r.actual_quantity || 0).toLocaleString(),
          String(r.run_count || 0),
        ]),
        weights: [2.5, 1.5, 1.5, 1],
      },
    });
  }

  if (need('downtime')) {
    const dt = await getDowntimeReportData(fromDate, toDate, plantId);
    const s = dt.summary || {};
    sections.push({
      id: 'downtime',
      title: 'Downtime Analysis',
      kpis: [
        { label: 'Total Hours', value: Number(s.total_hours || 0).toFixed(1), unit: 'hrs', color: 'danger' },
        { label: 'Incidents', value: String(s.incident_count || 0), color: 'warning' },
        { label: 'Avg Duration', value: Number(s.avg_duration || 0).toFixed(1), unit: 'min', color: 'primary' },
      ],
      table: {
        headers: ['Reason', 'Count', 'Hours', '% Total'],
        rows: (dt.top_reasons || []).slice(0, 12).map((r) => [
          r.reason_code || 'Unknown',
          String(r.count || 0),
          Number(r.total_hours || 0).toFixed(1),
          `${(Number(r.pct || 0) * 100).toFixed(1)}%`,
        ]),
        weights: [3, 1, 1, 1.2],
      },
    });
  }

  if (need('quality') || need('products')) {
    const q = await getQualityReportData(fromDate, toDate, plantId);
    const s = q.summary || {};
    sections.push({
      id: 'quality',
      title: need('products') ? 'Quality by Product' : 'Quality Trends',
      kpis: [
        { label: 'Avg Yield', value: `${Number(s.avg_yield || 0).toFixed(1)}%`, color: 'success' },
        { label: 'Rejection', value: `${Number(s.avg_rejection || 0).toFixed(1)}%`, color: 'danger' },
        { label: 'Good Units', value: Number(s.total_good || 0).toLocaleString(), color: 'success' },
        { label: 'Rejected', value: Number(s.total_rejected || 0).toLocaleString(), color: 'danger' },
      ],
      table: {
        headers: ['Product', 'Yield %', 'Rejection %', 'Status'],
        rows: (q.by_product || []).slice(0, 12).map((p) => {
          const y = Number(p.yield_pct || 0);
          return [p.product_name || 'Unknown', `${y.toFixed(1)}%`, `${Number(p.rejection_pct || 0).toFixed(1)}%`, y >= 95 ? 'Good' : 'Review'];
        }),
        weights: [3.2, 1.2, 1.4, 1.2],
      },
    });
  }

  if (need('costs')) {
    const c = await getCostReportData(fromDate, toDate, plantId);
    const s = c.summary || {};
    sections.push({
      id: 'costs',
      title: 'Cost Analysis',
      kpis: [
        { label: 'Unit Cost', value: `$${Number(s.avg_cost || 0).toFixed(2)}`, color: 'primary' },
        { label: 'Energy', value: `$${Math.round(Number(s.energy_cost || 0)).toLocaleString()}`, color: 'warning' },
        { label: 'Scrap', value: `$${Math.round(Number(s.scrap_cost || 0)).toLocaleString()}`, color: 'danger' },
        { label: 'Total', value: `$${Math.round(Number(s.total_cost || 0)).toLocaleString()}`, color: 'neutral' },
      ],
      table: {
        headers: ['Line', 'Unit Cost', 'Energy/Unit', 'Total'],
        rows: (c.by_line || []).slice(0, 12).map((line) => [
          line.line_name || 'Unknown',
          `$${Number(line.unit_cost || 0).toFixed(2)}`,
          `${Number(line.energy_per_unit || 0).toFixed(2)} kWh`,
          `$${Number(line.total_cost || 0).toFixed(0)}`,
        ]),
        weights: [2.5, 1.3, 1.5, 1.3],
      },
    });
  }

  if (need('executive') && sections.length === 0) {
    const exec = await getExecutiveReportData(fromDate, toDate, plantId);
    return {
      title: plan.title,
      query: plan.title,
      topics: topics,
      kpis: [
        { label: 'OEE', value: `${Number(exec.kpis?.oee || 0).toFixed(1)}%`, color: 'primary' },
        { label: 'Yield', value: `${Number(exec.kpis?.yield || 0).toFixed(1)}%`, color: 'success' },
        { label: 'Unit Cost', value: `$${Number(exec.kpis?.cost || 0).toFixed(2)}`, color: 'warning' },
        { label: 'Downtime', value: `${Number(exec.kpis?.downtime || 0).toFixed(0)}`, unit: 'hrs', color: 'danger' },
      ],
      sections: [],
      top_issues: exec.top_issues || [],
      recommended_actions: exec.recommended_actions || [],
      is_executive: true,
    };
  }

  return {
    title: plan.title,
    topics,
    kpis: kpis.slice(0, 4),
    sections,
    top_issues: [],
    recommended_actions: [
      { action: `Review the ${topics.join(', ')} metrics above and prioritize outliers` },
      { action: 'Compare against prior period and investigate largest gaps' },
    ],
    is_executive: false,
  };
}

async function getProductionReportData(fromDate, toDate, plantId) {
  let sql = `SELECT
    COUNT(*) as run_count,
    SUM(good_quantity) as total_good,
    SUM(actual_quantity) as total_actual,
    SUM(rejected_quantity) as total_rejected,
    SUM(planned_quantity) as total_planned
  FROM [${MFG_DB}].dbo.production_runs WHERE 1=1`;

  const params = {};
  if (fromDate) sql += ` AND date >= @from_date`, params.from_date = fromDate;
  if (toDate) sql += ` AND date <= @to_date`, params.to_date = toDate;
  if (plantId) sql += ` AND plant_id = @plant_id`, params.plant_id = plantId;

  const summary = await query(sql, params);

  let lineSql = `SELECT TOP 12
    pl.line_name,
    SUM(pr.good_quantity) as good_quantity,
    SUM(pr.actual_quantity) as actual_quantity,
    COUNT(*) as run_count
  FROM [${MFG_DB}].dbo.production_runs pr
  JOIN [${MFG_DB}].dbo.production_lines pl ON pr.line_id = pl.line_id
  WHERE 1=1`;
  if (fromDate) lineSql += ` AND pr.date >= @from_date`;
  if (toDate) lineSql += ` AND pr.date <= @to_date`;
  if (plantId) lineSql += ` AND pr.plant_id = @plant_id`;
  lineSql += ` GROUP BY pl.line_name ORDER BY good_quantity DESC`;

  const byLine = await query(lineSql, params);
  return { summary: summary[0] || {}, by_line: byLine || [] };
}

function inferReportType(query) {
  const q = String(query || '').toLowerCase();

  const scores = {
    'oee-dashboard': 0,
    'downtime-analysis': 0,
    'quality-trends': 0,
    'cost-analysis': 0,
    'executive-summary': 0,
  };

  const bump = (type, n = 1) => { scores[type] += n; };

  if (/\boee\b/.test(q)) bump('oee-dashboard', 5);
  if (/\bavailability\b|\bequipment effectiveness\b/.test(q)) bump('oee-dashboard', 3);
  if (/\bproduction lines?\b|\blines?\b/.test(q) && !/\bonline\b/.test(q)) bump('oee-dashboard', 4);
  if (/\bproduction runs?\b|\boutput\b|\bthroughput\b|\bruntime\b/.test(q)) bump('oee-dashboard', 4);

  if (/\bdowntime\b/.test(q)) bump('downtime-analysis', 5);
  if (/\bfailure\b|\bbreakdown\b|\bpareto\b|\bunplanned\b|\broot cause\b/.test(q)) bump('downtime-analysis', 3);

  if (/\bquality\b|\brejection\b|\byield\b|\bdefect\b|\bscrap\b/.test(q)) bump('quality-trends', 5);
  if (/\bproducts?\b|\bsku\b|\bskus\b|\bbrand\b/.test(q)) bump('quality-trends', 4);

  if (/\bcosts?\b|\benergy\b|\blabor\b|\bunit cost\b|\bexpense\b/.test(q)) bump('cost-analysis', 5);

  if (/\bexecutive\b|\boverview\b|\bkpi\b|\bdashboard summary\b/.test(q)) bump('executive-summary', 4);
  if (/\bsummary\b/.test(q) && !/\bproducts?\b|\bquality\b|\bdowntime\b|\boee\b|\bcost\b|\blines?\b|\bproduction\b/.test(q)) {
    bump('executive-summary', 2);
  }

  let best = 'executive-summary';
  let bestScore = 0;
  for (const [type, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      best = type;
    }
  }
  return bestScore > 0 ? best : 'executive-summary';
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
  generateReport,
  generateReportQuery
};
