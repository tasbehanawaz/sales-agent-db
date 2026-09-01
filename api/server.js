require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { query } = require('./db');
const { getForecast, getActions } = require('./insights');

const app = express();
const PORT = process.env.API_PORT || 3000;
const API_KEY = process.env.API_KEY || 'sk_prod_b0d7dc8f51089eecc448914107945db024b1d8383f176fea';

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(morgan('short'));
app.use(express.json());

const validateApiKey = (req, res, next) => {
  const key = req.headers['x-api-key'];
  if (!key || key !== API_KEY) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or missing API key' });
  }
  next();
};

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.use('/api', validateApiKey);

app.get('/api/doctors', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
    const data = await query(`SELECT TOP (@limit) * FROM dbo.doctors ORDER BY doctor_id`, { limit });
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/doctors/:id', async (req, res) => {
  try {
    const data = await query(`SELECT * FROM dbo.doctors WHERE doctor_id = @id`, { id: req.params.id });
    res.json({ success: true, data: data[0] || null });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/sales-reps', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
    const data = await query(`SELECT TOP (@limit) * FROM dbo.sales_reps ORDER BY rep_id`, { limit });
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const data = await query(`SELECT * FROM dbo.products ORDER BY product_id`, {});
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/pharmacies', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
    const data = await query(`SELECT TOP (@limit) * FROM dbo.pharmacies ORDER BY pharmacy_id`, { limit });
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/call-planning', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 1000);
    const data = await query(`SELECT TOP (@limit) * FROM dbo.call_planning ORDER BY call_id`, { limit });
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/secondary-sales', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 1000);
    const data = await query(`SELECT TOP (@limit) * FROM dbo.secondary_sales ORDER BY sale_id`, { limit });
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/rep-performance', async (req, res) => {
  try {
    // Aggregate sales and calls separately to avoid a cartesian join.
    const data = await query(`
      SELECT
        r.[rep_id],
        r.[name],
        r.[territory],
        r.[region],
        ISNULL(s.[total_sales], 0) AS [total_sales],
        ISNULL(s.[unique_pharmacies], 0) AS [unique_pharmacies],
        ISNULL(c.[total_calls], 0) AS [total_calls],
        ISNULL(c.[completed_calls], 0) AS [completed_calls],
        ROUND(
          CAST(ISNULL(c.[completed_calls], 0) AS FLOAT) * 100.0 /
          NULLIF(c.[total_calls], 0),
          2
        ) AS [call_adherence_pct]
      FROM [dbo].[sales_reps] r
      LEFT JOIN (
        SELECT
          [rep_id],
          SUM([value_sold]) AS [total_sales],
          COUNT(DISTINCT [pharmacy_id]) AS [unique_pharmacies]
        FROM [dbo].[secondary_sales]
        GROUP BY [rep_id]
      ) s ON r.[rep_id] = s.[rep_id]
      LEFT JOIN (
        SELECT
          [rep_id],
          COUNT(*) AS [total_calls],
          SUM(CASE WHEN [actual_call_date] IS NOT NULL THEN 1 ELSE 0 END) AS [completed_calls]
        FROM [dbo].[call_planning]
        GROUP BY [rep_id]
      ) c ON r.[rep_id] = c.[rep_id]
      ORDER BY r.[name]
    `);
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
    const days = Math.max(parseInt(req.query.days) || 30, 0);
    const data = await query(`SELECT * FROM dbo.vw_inactive_doctors WHERE days_since_last_call >= @days ORDER BY days_since_last_call DESC`, { days });
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/at-risk-territories', async (req, res) => {
  try {
    // Anchor to the last sale date in the seed, not GETDATE(). The view
    // looks at the last 90 days from today, so 2023–2025 data never matches.
    const data = await query(`
      WITH as_of AS (
        SELECT CAST(MAX(sale_date) AS DATE) AS d FROM dbo.secondary_sales
      ),
      sales AS (
        SELECT
          ss.rep_id,
          SUM(CASE WHEN ss.sale_date > DATEADD(YEAR, -1, a.d) AND ss.sale_date <= a.d THEN ss.value_sold ELSE 0 END) AS recent,
          SUM(CASE WHEN ss.sale_date > DATEADD(YEAR, -2, a.d) AND ss.sale_date <= DATEADD(YEAR, -1, a.d) THEN ss.value_sold ELSE 0 END) AS prior
        FROM dbo.secondary_sales ss
        CROSS JOIN as_of a
        WHERE ss.sale_date > DATEADD(YEAR, -2, a.d)
        GROUP BY ss.rep_id
      ),
      calls AS (
        SELECT
          cp.rep_id,
          COUNT(*) AS planned,
          SUM(CASE WHEN cp.actual_call_date IS NOT NULL THEN 1 ELSE 0 END) AS done
        FROM dbo.call_planning cp
        CROSS JOIN as_of a
        WHERE cp.planned_date > DATEADD(DAY, -90, a.d) AND cp.planned_date <= a.d
        GROUP BY cp.rep_id
      )
      SELECT
        r.rep_id,
        r.name,
        r.territory,
        r.region,
        ROUND((s.recent - s.prior) * 100.0 / NULLIF(s.prior, 0), 2) AS sales_trend_pct,
        ROUND(CAST(c.done AS FLOAT) * 100.0 / NULLIF(c.planned, 0), 2) AS call_adherence_pct
      FROM dbo.sales_reps r
      LEFT JOIN sales s ON r.rep_id = s.rep_id
      LEFT JOIN calls c ON r.rep_id = c.rep_id
      WHERE ROUND((s.recent - s.prior) * 100.0 / NULLIF(s.prior, 0), 2) < -5
         OR ROUND(CAST(c.done AS FLOAT) * 100.0 / NULLIF(c.planned, 0), 2) < 70
      ORDER BY sales_trend_pct ASC
    `);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/territory-coverage', async (req, res) => {
  try {
    // Aggregate doctors by territory and calls by rep. The view joins
    // every doctor to every rep (ON r.rep_id IS NOT NULL) then to calls.
    const data = await query(`
      SELECT
        r.[rep_id],
        r.[name],
        r.[territory],
        r.[region],
        ISNULL(d.[total_doctors], 0) AS [total_doctors],
        ISNULL(d.[tier_a_count], 0) AS [tier_a_count],
        ISNULL(d.[tier_b_count], 0) AS [tier_b_count],
        ISNULL(d.[tier_c_count], 0) AS [tier_c_count],
        ISNULL(c.[total_calls], 0) AS [total_calls],
        ISNULL(c.[completed_calls], 0) AS [completed_calls],
        ROUND(
          CAST(ISNULL(c.[completed_calls], 0) AS FLOAT) * 100.0 /
          NULLIF(c.[total_calls], 0),
          2
        ) AS [coverage_pct]
      FROM [dbo].[sales_reps] r
      LEFT JOIN (
        SELECT
          [territory],
          [region],
          COUNT(*) AS [total_doctors],
          SUM(CASE WHEN [tier] = 'A' THEN 1 ELSE 0 END) AS [tier_a_count],
          SUM(CASE WHEN [tier] = 'B' THEN 1 ELSE 0 END) AS [tier_b_count],
          SUM(CASE WHEN [tier] = 'C' THEN 1 ELSE 0 END) AS [tier_c_count]
        FROM [dbo].[doctors]
        GROUP BY [territory], [region]
      ) d ON r.[territory] = d.[territory] AND r.[region] = d.[region]
      LEFT JOIN (
        SELECT
          [rep_id],
          COUNT(*) AS [total_calls],
          SUM(CASE WHEN [actual_call_date] IS NOT NULL THEN 1 ELSE 0 END) AS [completed_calls]
        FROM [dbo].[call_planning]
        GROUP BY [rep_id]
      ) c ON r.[rep_id] = c.[rep_id]
      ORDER BY [coverage_pct] DESC
    `);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/insights/forecast', async (req, res) => {
  try {
    const data = await getForecast(query);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/insights/actions', async (req, res) => {
  try {
    const data = await getActions(query);
    res.json({ success: true, count: data.actions.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/insights', async (req, res) => {
  try {
    const [forecast, actions] = await Promise.all([getForecast(query), getActions(query)]);
    res.json({
      success: true,
      data: {
        as_of: forecast.as_of,
        summary: `${forecast.summary} ${actions.summary}`,
        forecast,
        actions: actions.actions,
        chart: forecast.chart
      }
    });
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
