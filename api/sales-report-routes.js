/**
 * Sales report generation (PPTX, PDF, CSV) from sales_agent_demo:
 * secondary sales, products, pharmacies, doctors, reps and call planning.
 *
 * from/to filter sale_date and planned_date; region filters every table
 * through its own region column (calls through the rep's region).
 */

require('dotenv').config();
const { query } = require('./db');
const { strParam, dateParam } = require('./queryParams');
const { FORMATS, writeReport } = require('./reports/writeReport');
const { n, money, count, dec, share, limit } = require('./reports/format');


function where(f, { date, region, extra = [] } = {}) {
  const c = [...extra];
  if (date && f.from) c.push(`${date} >= @from_date`);
  if (date && f.to) c.push(`${date} <= @to_date`);
  if (region && f.region) c.push(`${region} = @region`);
  return c.length ? `WHERE ${c.join(' AND ')}` : '';
}

function q(f, text) {
  return query(text, f.params);
}

const SECTIONS = {
  async 'sales-summary'(f) {
    const w = where(f, { date: 's.sale_date', region: 's.region' });
    const [s] = await q(f, `SELECT SUM(s.value_sold) value, SUM(s.quantity_sold) units, COUNT(*) transactions,
        COUNT(DISTINCT s.pharmacy_id) pharmacies FROM dbo.secondary_sales s ${w}`);
    const rows = await q(f, `SELECT s.region, SUM(s.value_sold) value, SUM(s.quantity_sold) units, COUNT(DISTINCT s.pharmacy_id) pharmacies,
        COUNT(DISTINCT s.rep_id) reps FROM dbo.secondary_sales s ${w} GROUP BY s.region ORDER BY value DESC`);
    const years = await q(f, `SELECT YEAR(s.sale_date) yr, SUM(s.value_sold) value FROM dbo.secondary_sales s ${w}
      GROUP BY YEAR(s.sale_date) ORDER BY yr`);
    const growth = years.length >= 2
      ? `${years[years.length - 1].yr} sales were ${money(years[years.length - 1].value)}, ` +
        `${share(n(years[years.length - 1].value) - n(years[years.length - 2].value), years[years.length - 2].value)} ` +
        `against ${years[years.length - 2].yr} (${money(years[years.length - 2].value)}).`
      : '';
    return {
      id: 'sales-summary',
      title: 'Secondary Sales by Region',
      about: 'Sell-out value and units recorded at pharmacies, by region.',
      sources: ['secondary_sales'],
      narrative: [
        `Pharmacies recorded ${money(s.value)} of sales across ${count(s.units)} units in ${count(s.transactions)} transactions, ` +
        `an average of ${money(n(s.value) / (n(s.units) || 1))} per unit. ${count(s.pharmacies)} pharmacies placed orders. ${growth}`,
      ],
      kpis: [
        { label: 'Sales Value', value: money(s.value), color: 'primary' },
        { label: 'Units Sold', value: count(s.units), color: 'success' },
        { label: 'Avg Price/Unit', value: money(n(s.value) / (n(s.units) || 1)), color: 'warning' },
        { label: 'Buying Pharmacies', value: count(s.pharmacies), color: 'neutral' },
      ],
      table: {
        headers: ['Region', 'Sales Value', 'Share', 'Units', 'Pharmacies', 'Reps', 'Value per Rep'],
        rows: rows.map((r) => [r.region, money(r.value), share(r.value, s.value), count(r.units), count(r.pharmacies), count(r.reps),
          money(n(r.value) / (n(r.reps) || 1))]),
        weights: [1.2, 1.2, 0.9, 1.2, 1, 0.8, 1.2],
        metric: 'Sales Value',
      },
      bullets: years.map((y) => `${y.yr}: ${money(y.value)}`),
    };
  },

  async 'sales-trend'(f) {
    const period = f.detail ? "FORMAT(s.sale_date, 'yyyy-MM')" : "CONCAT(YEAR(s.sale_date), '-Q', DATEPART(quarter, s.sale_date))";
    const rows = await q(f, `SELECT ${period} period, SUM(s.value_sold) value, SUM(s.quantity_sold) units, COUNT(DISTINCT s.pharmacy_id) pharmacies
      FROM dbo.secondary_sales s ${where(f, { date: 's.sale_date', region: 's.region' })} GROUP BY ${period} ORDER BY period`);
    return {
      id: 'sales-trend',
      title: f.detail ? 'Monthly Sales Trend' : 'Quarterly Sales Trend',
      about: `Sales value and units by ${f.detail ? 'month' : 'quarter'}, with the change on the previous period.`,
      sources: ['secondary_sales'],
      table: {
        headers: [f.detail ? 'Month' : 'Quarter', 'Sales Value', 'Change', 'Units', 'Pharmacies'],
        rows: rows.map((r, i) => [r.period, money(r.value), i ? share(n(r.value) - n(rows[i - 1].value), rows[i - 1].value) : '-',
          count(r.units), count(r.pharmacies)]),
        weights: [1, 1.2, 1, 1.2, 1],
        metric: 'Sales Value',
      },
    };
  },

  async 'sales-by-product'(f) {
    const w = where(f, { date: 's.sale_date', region: 's.region' });
    const [{ total }] = await q(f, `SELECT SUM(s.value_sold) total FROM dbo.secondary_sales s ${w}`);
    const rows = await q(f, `SELECT p.sku, p.brand, p.therapy_area, SUM(s.value_sold) value, SUM(s.quantity_sold) units,
        COUNT(DISTINCT s.pharmacy_id) pharmacies
      FROM dbo.secondary_sales s JOIN dbo.products p ON p.product_id = s.product_id ${w}
      GROUP BY p.sku, p.brand, p.therapy_area ORDER BY value DESC`);
    return {
      id: 'sales-by-product',
      title: 'Sales by Product',
      about: 'Sales value, units and pharmacy reach for every SKU.',
      sources: ['secondary_sales', 'products'],
      table: {
        headers: ['SKU', 'Brand', 'Therapy Area', 'Sales Value', 'Share', 'Units', 'Avg Price', 'Pharmacies'],
        rows: rows.map((r) => [r.sku, r.brand, r.therapy_area, money(r.value), share(r.value, total), count(r.units),
          money(n(r.value) / (n(r.units) || 1)), count(r.pharmacies)]),
        weights: [1, 1.2, 1.4, 1.1, 0.8, 1, 0.9, 1],
        metric: 'Sales Value',
      },
    };
  },

  async 'sales-by-therapy'(f) {
    const w = where(f, { date: 's.sale_date', region: 's.region' });
    const rows = await q(f, `SELECT p.therapy_area, COUNT(DISTINCT p.product_id) products, SUM(s.value_sold) value, SUM(s.quantity_sold) units
      FROM dbo.secondary_sales s JOIN dbo.products p ON p.product_id = s.product_id ${w}
      GROUP BY p.therapy_area ORDER BY value DESC`);
    const total = rows.reduce((x, r) => x + n(r.value), 0);
    return {
      id: 'sales-by-therapy',
      title: 'Sales by Therapy Area',
      about: 'Sales grouped by the therapy area of each product.',
      sources: ['secondary_sales', 'products'],
      table: {
        headers: ['Therapy Area', 'Products', 'Sales Value', 'Share', 'Units'],
        rows: rows.map((r) => [r.therapy_area, count(r.products), money(r.value), share(r.value, total), count(r.units)]),
        weights: [1.6, 0.9, 1.2, 0.9, 1.2],
        metric: 'Sales Value',
      },
    };
  },

  async 'sales-by-rep'(f) {
    const rows = await q(f, `SELECT TOP ${limit(f, 10)} r.name, r.territory, r.region, SUM(s.value_sold) value, SUM(s.quantity_sold) units,
        COUNT(DISTINCT s.pharmacy_id) pharmacies
      FROM dbo.secondary_sales s JOIN dbo.sales_reps r ON r.rep_id = s.rep_id
      ${where(f, { date: 's.sale_date', region: 's.region' })}
      GROUP BY r.name, r.territory, r.region ORDER BY value DESC`);
    return {
      id: 'sales-by-rep',
      title: 'Sales by Representative',
      about: 'Sales credited to each representative, ranked by value.',
      sources: ['secondary_sales', 'sales_reps'],
      table: {
        headers: ['Representative', 'Territory', 'Region', 'Sales Value', 'Units', 'Pharmacies'],
        rows: rows.map((r) => [r.name, r.territory, r.region, money(r.value), count(r.units), count(r.pharmacies)]),
        weights: [1.6, 1.3, 1, 1.1, 1, 1],
        metric: 'Sales Value',
      },
    };
  },

  async 'pharmacies'(f) {
    const rows = await q(f, `SELECT ph.channel, COUNT(DISTINCT ph.pharmacy_id) pharmacies, COUNT(DISTINCT s.pharmacy_id) buying,
        SUM(s.value_sold) value, SUM(s.quantity_sold) units
      FROM dbo.pharmacies ph LEFT JOIN dbo.secondary_sales s ON s.pharmacy_id = ph.pharmacy_id
        ${f.from ? 'AND s.sale_date >= @from_date' : ''} ${f.to ? 'AND s.sale_date <= @to_date' : ''}
      ${where(f, { region: 'ph.region' })} GROUP BY ph.channel ORDER BY value DESC`);
    const total = rows.reduce((x, r) => x + n(r.value), 0);
    const pharmacies = rows.reduce((x, r) => x + n(r.pharmacies), 0);
    return {
      id: 'pharmacies',
      title: 'Pharmacy Network by Channel',
      about: 'Pharmacies in each channel, how many bought in the period, and their sales.',
      sources: ['pharmacies', 'secondary_sales'],
      kpis: [
        { label: 'Pharmacies', value: count(pharmacies), color: 'primary' },
        { label: 'Channels', value: count(rows.length), color: 'success' },
        { label: 'Sales Value', value: money(total), color: 'warning' },
        { label: 'Avg per Pharmacy', value: money(total / (pharmacies || 1)), color: 'neutral' },
      ],
      table: {
        headers: ['Channel', 'Pharmacies', 'Buying', 'Sales Value', 'Share', 'Units', 'Avg per Pharmacy'],
        rows: rows.map((r) => [r.channel, count(r.pharmacies), count(r.buying), money(r.value), share(r.value, total), count(r.units),
          money(n(r.value) / (n(r.pharmacies) || 1))]),
        weights: [1.2, 1, 0.9, 1.2, 0.8, 1.1, 1.3],
        metric: 'Sales Value',
      },
    };
  },

  async 'top-pharmacies'(f) {
    const rows = await q(f, `SELECT TOP ${limit(f, 10)} ph.name, ph.channel, ph.region, SUM(s.value_sold) value, SUM(s.quantity_sold) units,
        COUNT(DISTINCT s.product_id) products
      FROM dbo.secondary_sales s JOIN dbo.pharmacies ph ON ph.pharmacy_id = s.pharmacy_id
      ${where(f, { date: 's.sale_date', region: 'ph.region' })}
      GROUP BY ph.name, ph.channel, ph.region ORDER BY value DESC`);
    return {
      id: 'top-pharmacies',
      title: 'Top Pharmacies by Sales',
      about: 'The pharmacies with the highest sales value in the period.',
      sources: ['secondary_sales', 'pharmacies'],
      table: {
        headers: ['Pharmacy', 'Channel', 'Region', 'Sales Value', 'Units', 'Products Bought'],
        rows: rows.map((r) => [r.name, r.channel, r.region, money(r.value), count(r.units), count(r.products)]),
        weights: [2, 1, 1, 1.1, 1, 1.1],
        metric: 'Sales Value',
      },
    };
  },

  async 'doctors'(f) {
    const rows = await q(f, `SELECT d.specialty, COUNT(*) doctors, SUM(CASE WHEN d.status = 'active' THEN 1 ELSE 0 END) active,
        SUM(CASE WHEN d.tier = 'A' THEN 1 ELSE 0 END) tier_a, SUM(CASE WHEN d.tier = 'B' THEN 1 ELSE 0 END) tier_b,
        SUM(CASE WHEN d.tier = 'C' THEN 1 ELSE 0 END) tier_c,
        (SELECT COUNT(*) FROM dbo.call_planning c JOIN dbo.doctors d2 ON d2.doctor_id = c.doctor_id
          WHERE d2.specialty = d.specialty AND c.call_status = 'completed'
          ${f.from ? 'AND c.planned_date >= @from_date' : ''} ${f.to ? 'AND c.planned_date <= @to_date' : ''}
          ${f.region ? 'AND d2.region = @region' : ''}) calls
      FROM dbo.doctors d ${where(f, { region: 'd.region' })} GROUP BY d.specialty ORDER BY doctors DESC`);
    const sum = (k) => rows.reduce((x, r) => x + n(r[k]), 0);
    return {
      id: 'doctors',
      title: 'Doctor Network by Specialty',
      about: 'Doctors by specialty and tier (A is the highest priority), with completed calls in the period.',
      sources: ['doctors', 'call_planning'],
      narrative: [
        `The network has ${count(sum('doctors'))} doctors, ${count(sum('active'))} of them active (${share(sum('active'), sum('doctors'))}). ` +
        `${count(sum('tier_a'))} are tier A, ${count(sum('tier_b'))} tier B and ${count(sum('tier_c'))} tier C. ` +
        `Representatives completed ${count(sum('calls'))} calls on them in the period.`,
      ],
      kpis: [
        { label: 'Doctors', value: count(sum('doctors')), color: 'primary' },
        { label: 'Active', value: count(sum('active')), color: 'success' },
        { label: 'Tier A', value: count(sum('tier_a')), color: 'warning' },
        { label: 'Completed Calls', value: count(sum('calls')), color: 'neutral' },
      ],
      table: {
        headers: ['Specialty', 'Doctors', 'Active', 'Tier A', 'Tier B', 'Tier C', 'Completed Calls', 'Calls per Doctor'],
        rows: rows.map((r) => [r.specialty, count(r.doctors), count(r.active), count(r.tier_a), count(r.tier_b), count(r.tier_c),
          count(r.calls), dec(n(r.calls) / (n(r.doctors) || 1))]),
        weights: [1.6, 0.9, 0.8, 0.7, 0.7, 0.7, 1.2, 1.2],
        metric: 'Doctors',
      },
    };
  },

  async 'doctors-by-region'(f) {
    const rows = await q(f, `SELECT d.region, COUNT(*) doctors, SUM(CASE WHEN d.status = 'active' THEN 1 ELSE 0 END) active,
        COUNT(DISTINCT d.territory) territories, COUNT(DISTINCT d.market) markets,
        (SELECT COUNT(*) FROM dbo.sales_reps r WHERE r.region = d.region) reps
      FROM dbo.doctors d ${where(f, { region: 'd.region' })} GROUP BY d.region ORDER BY doctors DESC`);
    return {
      id: 'doctors-by-region',
      title: 'Doctor Coverage by Region',
      about: 'Doctors, territories and markets per region, against the representatives who cover them.',
      sources: ['doctors', 'sales_reps'],
      table: {
        headers: ['Region', 'Doctors', 'Active', 'Territories', 'Markets', 'Reps', 'Doctors per Rep'],
        rows: rows.map((r) => [r.region, count(r.doctors), count(r.active), count(r.territories), count(r.markets), count(r.reps),
          dec(n(r.doctors) / (n(r.reps) || 1))]),
        weights: [1.2, 1, 0.9, 1, 0.9, 0.8, 1.2],
        metric: 'Doctors',
      },
    };
  },

  async 'calls'(f) {
    const rows = await q(f, `SELECT c.call_type, COUNT(*) calls, SUM(CASE WHEN c.call_status = 'completed' THEN 1 ELSE 0 END) completed,
        AVG(CAST(c.feedback_score AS float)) feedback, COUNT(DISTINCT c.doctor_id) doctors
      FROM dbo.call_planning c JOIN dbo.sales_reps r ON r.rep_id = c.rep_id
      ${where(f, { date: 'c.planned_date', region: 'r.region' })} GROUP BY c.call_type ORDER BY calls DESC`);
    const sum = (k) => rows.reduce((x, r) => x + n(r[k]), 0);
    return {
      id: 'calls',
      title: 'Call Planning and Completion',
      about: 'Planned calls by type, how many were completed, and the average doctor feedback score (out of 10).',
      sources: ['call_planning', 'sales_reps'],
      narrative: [
        `${count(sum('calls'))} calls were planned and ${count(sum('completed'))} completed, a completion rate of ${share(sum('completed'), sum('calls'))}.`,
      ],
      kpis: [
        { label: 'Planned Calls', value: count(sum('calls')), color: 'primary' },
        { label: 'Completed', value: count(sum('completed')), color: 'success' },
        { label: 'Completion Rate', value: share(sum('completed'), sum('calls')), color: 'warning' },
        { label: 'Call Types', value: count(rows.length), color: 'neutral' },
      ],
      table: {
        headers: ['Call Type', 'Planned', 'Completed', 'Completion Rate', 'Avg Feedback', 'Doctors Reached'],
        rows: rows.map((r) => [r.call_type, count(r.calls), count(r.completed), share(r.completed, r.calls), dec(r.feedback, 2), count(r.doctors)]),
        weights: [1.4, 1, 1, 1.2, 1.1, 1.2],
        metric: 'Planned',
      },
    };
  },

  async 'calls-by-rep'(f) {
    const rows = await q(f, `SELECT TOP ${limit(f, 10)} r.name, r.region, COUNT(*) calls,
        SUM(CASE WHEN c.call_status = 'completed' THEN 1 ELSE 0 END) completed, AVG(CAST(c.feedback_score AS float)) feedback,
        COUNT(DISTINCT c.doctor_id) doctors
      FROM dbo.call_planning c JOIN dbo.sales_reps r ON r.rep_id = c.rep_id
      ${where(f, { date: 'c.planned_date', region: 'r.region' })}
      GROUP BY r.name, r.region ORDER BY SUM(CASE WHEN c.call_status = 'completed' THEN 1.0 ELSE 0 END) / COUNT(*)`);
    return {
      id: 'calls-by-rep',
      title: 'Call Completion by Representative',
      about: 'Representatives ordered from the lowest completion rate, so the reps who most need support come first.',
      sources: ['call_planning', 'sales_reps'],
      table: {
        headers: ['Representative', 'Region', 'Planned', 'Completed', 'Completion Rate', 'Avg Feedback', 'Doctors'],
        rows: rows.map((r) => [r.name, r.region, count(r.calls), count(r.completed), share(r.completed, r.calls), dec(r.feedback, 2), count(r.doctors)]),
        weights: [1.6, 1, 0.9, 1, 1.2, 1.1, 0.9],
        metric: 'Planned',
      },
    };
  },
};

const REPORT_TYPES = {
  'sales-overview': {
    title: 'Sales Overview Report',
    subtitle: 'Secondary sales by region, period, product, therapy area and representative',
    sections: ['sales-summary', 'sales-trend', 'sales-by-product', 'sales-by-therapy', 'sales-by-rep'],
  },
  'doctor-distribution': {
    title: 'Doctor Network Report',
    subtitle: 'Doctors by specialty and region, and call activity',
    sections: ['doctors', 'doctors-by-region', 'calls', 'calls-by-rep'],
  },
  'pharmacy-network': {
    title: 'Pharmacy Network Report',
    subtitle: 'Pharmacy channels, top accounts and product reach',
    sections: ['pharmacies', 'top-pharmacies', 'sales-by-product'],
  },
  'full-report': {
    title: 'Sales Full Report',
    subtitle: 'Sales, pharmacies, doctors and call activity',
    sections: Object.keys(SECTIONS),
  },
};

async function overviewKpis(f) {
  const [s] = await q(f, `SELECT SUM(value_sold) value, SUM(quantity_sold) units FROM dbo.secondary_sales
    ${where(f, { date: 'sale_date', region: 'region' })}`);
  const [c] = await q(f, `SELECT COUNT(*) calls, SUM(CASE WHEN c.call_status = 'completed' THEN 1 ELSE 0 END) completed
    FROM dbo.call_planning c JOIN dbo.sales_reps r ON r.rep_id = c.rep_id ${where(f, { date: 'c.planned_date', region: 'r.region' })}`);
  const [d] = await q(f, `SELECT
      (SELECT COUNT(*) FROM dbo.doctors ${where(f, { region: 'region', extra: ["status = 'active'"] })}) doctors,
      (SELECT COUNT(*) FROM dbo.pharmacies ${where(f, { region: 'region' })}) pharmacies,
      (SELECT COUNT(*) FROM dbo.sales_reps ${where(f, { region: 'region' })}) reps`);
  return [
    { label: 'Sales Value', value: money(s.value), color: 'primary' },
    { label: 'Units Sold', value: count(s.units), color: 'success' },
    { label: 'Call Completion', value: share(c.completed, c.calls), color: 'warning' },
    { label: 'Active Doctors', value: count(d.doctors), color: 'neutral' },
    { label: 'Pharmacies', value: count(d.pharmacies), color: 'primary' },
    { label: 'Representatives', value: count(d.reps), color: 'neutral' },
  ];
}

async function recommendedActions(f) {
  const [region] = await q(f, `SELECT TOP 1 region, SUM(value_sold) value FROM dbo.secondary_sales
    ${where(f, { date: 'sale_date', region: 'region' })} GROUP BY region ORDER BY value`);
  const [rep] = await q(f, `SELECT TOP 1 r.name, SUM(CASE WHEN c.call_status = 'completed' THEN 1.0 ELSE 0 END) / COUNT(*) rate
    FROM dbo.call_planning c JOIN dbo.sales_reps r ON r.rep_id = c.rep_id ${where(f, { date: 'c.planned_date', region: 'r.region' })}
    GROUP BY r.name ORDER BY rate`);
  const [channel] = await q(f, `SELECT TOP 1 ph.channel, COUNT(DISTINCT ph.pharmacy_id) - COUNT(DISTINCT s.pharmacy_id) idle
    FROM dbo.pharmacies ph LEFT JOIN dbo.secondary_sales s ON s.pharmacy_id = ph.pharmacy_id
      ${f.from ? 'AND s.sale_date >= @from_date' : ''} ${f.to ? 'AND s.sale_date <= @to_date' : ''}
    ${where(f, { region: 'ph.region' })} GROUP BY ph.channel ORDER BY idle DESC`);
  const out = [];
  if (region && !f.region) out.push({ action: `Review coverage and targets in ${region.region}, the lowest-selling region (${money(region.value)}).` });
  if (rep) out.push({ action: `Support ${rep.name}, whose call completion rate is the lowest at ${(n(rep.rate) * 100).toFixed(1)}%.` });
  if (channel && n(channel.idle) > 0) out.push({ action: `Reactivate the ${count(channel.idle)} ${channel.channel} pharmacies with no sales in the period.` });
  return out;
}

async function buildReportData(spec, f) {
  const [built, kpis, actions] = await Promise.all([
    Promise.all(spec.sections.map((id) => SECTIONS[id](f))),
    overviewKpis(f),
    recommendedActions(f),
  ]);
  return {
    brand: 'Sales',
    title: spec.title,
    subtitle: spec.subtitle,
    kpis,
    sections: built.flat(),
    top_issues: [],
    recommended_actions: actions,
  };
}

async function generateReport(req, res) {
  try {
    const reportType = strParam(req.query.report_type);
    const format = (strParam(req.query.format) || 'pptx').toLowerCase();
    const spec = REPORT_TYPES[reportType];
    if (!spec) {
      return res.status(400).json({ success: false, error: `Invalid report_type (${Object.keys(REPORT_TYPES).join('|')})` });
    }
    if (!FORMATS.includes(format)) {
      return res.status(400).json({ success: false, error: `format must be one of ${FORMATS.join(', ')}` });
    }
    const f = { from: dateParam(req.query.from), to: dateParam(req.query.to), region: strParam(req.query.region), detail: format !== 'pptx' };
    f.params = {};
    if (f.from) f.params.from_date = f.from;
    if (f.to) f.params.to_date = f.to;
    if (f.region) f.params.region = f.region;

    const data = await buildReportData(spec, f);
    const filename = await writeReport({
      prefix: 'sales',
      slug: reportType.replace(/^sales-/, ''),
      format,
      reportType,
      data,
      filters: { from: f.from, to: f.to, region: f.region },
    });

    res.json({
      success: true,
      report_type: reportType,
      title: data.title,
      sections: data.sections.map((s) => s.title),
      format,
      filename,
      download_url: `${req.protocol}://${req.get('host')}/api/sales/reports/download/${filename}`,
      message: 'Report generated successfully. Use download_url to download.',
    });
  } catch (err) {
    console.error('Sales report generation error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { REPORT_TYPES, SECTIONS, generateReport };
