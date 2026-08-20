require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { query } = require('./db');

const app = express();
const PORT = process.env.API_PORT || 3000;

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(morgan('short'));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.get('/api/doctors', async (req, res) => {
  try {
    const limit = req.query.limit || 100;
    const data = await query(`SELECT TOP ${limit} * FROM dbo.doctors ORDER BY doctor_id`);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/doctors/:id', async (req, res) => {
  try {
    const data = await query(`SELECT * FROM dbo.doctors WHERE doctor_id = '${req.params.id}'`);
    res.json({ success: true, data: data[0] || null });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/sales-reps', async (req, res) => {
  try {
    const limit = req.query.limit || 100;
    const data = await query(`SELECT TOP ${limit} * FROM dbo.sales_reps ORDER BY rep_id`);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const data = await query(`SELECT * FROM dbo.products ORDER BY product_id`);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/pharmacies', async (req, res) => {
  try {
    const limit = req.query.limit || 100;
    const data = await query(`SELECT TOP ${limit} * FROM dbo.pharmacies ORDER BY pharmacy_id`);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/call-planning', async (req, res) => {
  try {
    const limit = req.query.limit || 50;
    const data = await query(`SELECT TOP ${limit} * FROM dbo.call_planning ORDER BY call_id`);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/secondary-sales', async (req, res) => {
  try {
    const limit = req.query.limit || 50;
    const data = await query(`SELECT TOP ${limit} * FROM dbo.secondary_sales ORDER BY sale_id`);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/rep-performance', async (req, res) => {
  try {
    const data = await query(`SELECT * FROM dbo.vw_rep_performance ORDER BY name`);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/product-trends', async (req, res) => {
  try {
    const data = await query(`SELECT TOP 100 * FROM dbo.vw_product_region_trends ORDER BY [month] DESC`);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/call-effectiveness', async (req, res) => {
  try {
    const data = await query(`SELECT * FROM dbo.vw_call_effectiveness ORDER BY [month] DESC`);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/inactive-doctors', async (req, res) => {
  try {
    const days = req.query.days || 30;
    const data = await query(`SELECT * FROM dbo.vw_inactive_doctors WHERE days_since_last_call >= ${days} ORDER BY days_since_last_call DESC`);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/at-risk-territories', async (req, res) => {
  try {
    const data = await query(`SELECT * FROM dbo.vw_at_risk_territories ORDER BY sales_trend_pct ASC`);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/territory-coverage', async (req, res) => {
  try {
    const data = await query(`SELECT * FROM dbo.vw_territory_coverage ORDER BY coverage_pct DESC`);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const stats = await query(`
      SELECT
        (SELECT COUNT(*) FROM dbo.doctors) as total_doctors,
        (SELECT COUNT(*) FROM dbo.sales_reps) as total_reps,
        (SELECT COUNT(*) FROM dbo.products) as total_products,
        (SELECT COUNT(*) FROM dbo.pharmacies) as total_pharmacies,
        (SELECT COUNT(*) FROM dbo.call_planning) as total_calls,
        (SELECT COUNT(*) FROM dbo.secondary_sales) as total_sales
    `);
    res.json({ success: true, data: stats[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

app.listen(PORT, () => {
  console.log(`\n✓ Sales Agent API running on http://localhost:${PORT}`);
  console.log(`✓ Health check: http://localhost:${PORT}/health`);
  console.log(`✓ Database: ${process.env.DB_HOST}:${process.env.DB_PORT}\n`);
});
