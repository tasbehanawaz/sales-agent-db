function round2(n) {
  if (n == null || Number.isNaN(Number(n))) return null;
  return Math.round(Number(n) * 100) / 100;
}

function monthKey(value) {
  const d = value instanceof Date ? value : new Date(value);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(yyyymm, delta) {
  const [year, month] = yyyymm.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthRangeEnding(lastMonth, count) {
  const months = [];
  for (let i = count - 1; i >= 0; i--) months.push(shiftMonth(lastMonth, -i));
  return months;
}

function sumMonths(byMonth, months) {
  return months.reduce((total, month) => total + (Number(byMonth[month]) || 0), 0);
}

async function getForecast(query) {
  const asOfRows = await query(`SELECT CAST(MAX(sale_date) AS DATE) AS d FROM dbo.secondary_sales`);
  const asOf = asOfRows[0].d;
  const lastMonth = monthKey(asOf);

  const monthly = await query(`
    WITH as_of AS (
      SELECT CAST(MAX(sale_date) AS DATE) AS d FROM dbo.secondary_sales
    )
    SELECT
      ss.region,
      DATEFROMPARTS(YEAR(ss.sale_date), MONTH(ss.sale_date), 1) AS month,
      SUM(ss.value_sold) AS value_sold
    FROM dbo.secondary_sales ss
    CROSS JOIN as_of a
    WHERE ss.sale_date > DATEADD(YEAR, -2, a.d) AND ss.sale_date <= a.d
    GROUP BY ss.region, DATEFROMPARTS(YEAR(ss.sale_date), MONTH(ss.sale_date), 1)
    ORDER BY ss.region, month
  `);

  const byRegion = {};
  for (const row of monthly) {
    const region = row.region;
    if (!byRegion[region]) byRegion[region] = {};
    byRegion[region][monthKey(row.month)] = Number(row.value_sold);
  }

  const actualMonths = monthRangeEnding(lastMonth, 12);
  const priorMonths = monthRangeEnding(shiftMonth(lastMonth, -12), 12);
  const forecastMonths = [1, 2, 3].map((i) => shiftMonth(lastMonth, i));
  const chartLabels = [...actualMonths, ...forecastMonths];
  const regions = Object.keys(byRegion).sort();

  const regionForecasts = regions.map((region) => {
    const byMonth = byRegion[region];
    const last12 = sumMonths(byMonth, actualMonths);
    const prior12 = sumMonths(byMonth, priorMonths);
    const yoyPct = prior12 ? round2(((last12 - prior12) / prior12) * 100) : null;
    const factor = prior12 ? last12 / prior12 : 1;

    const history = actualMonths.map((month) => ({
      month,
      actual: round2(byMonth[month] || 0),
      forecast: null
    }));

    const projected = forecastMonths.map((month) => {
      const sameLastYear = byMonth[shiftMonth(month, -12)] || 0;
      return {
        month,
        actual: null,
        forecast: round2(sameLastYear * factor)
      };
    });

    return {
      region,
      last_12m: round2(last12),
      prior_12m: round2(prior12),
      yoy_pct: yoyPct,
      next_3m_forecast: round2(projected.reduce((s, p) => s + p.forecast, 0)),
      months: [...history, ...projected]
    };
  });

  const chart = {
    type: 'line',
    title: 'Secondary sales by region (last 12 months + 3-month forecast)',
    x_axis: 'month',
    y_axis: 'value_sold',
    labels: chartLabels,
    forecast_start: forecastMonths[0],
    series: regionForecasts.map((r) => ({
      name: r.region,
      data: r.months.map((m) => m.actual != null ? m.actual : m.forecast)
    }))
  };

  const south = regionForecasts.find((r) => r.region === 'South');
  const others = regionForecasts.filter((r) => r.region !== 'South');
  const otherYoy = others.length
    ? round2(others.reduce((s, r) => s + (r.yoy_pct || 0), 0) / others.length)
    : null;

  const summary = south
    ? `As of ${monthKey(asOf)}, South sales are ${south.yoy_pct}% vs the prior 12 months (other regions about ${otherYoy}%). The next 3 months are projected at ${south.next_3m_forecast} if that trend holds.`
    : `Forecast built from monthly sales through ${monthKey(asOf)}.`;

  return {
    as_of: monthKey(asOf),
    method: "Same month last year, scaled by each region’s latest 12-month vs prior 12-month change.",
    summary,
    regions: regionForecasts.map(r => ({
      region: r.region,
      last_12m: r.last_12m,
      prior_12m: r.prior_12m,
      yoy_pct: r.yoy_pct,
      next_3m_forecast: r.next_3m_forecast,
      data: r.months.map(m => [m.month, m.actual != null ? m.actual : m.forecast])
    })),
    chart
  };
}

async function getProductForecast(query) {
  const asOfRows = await query(`SELECT CAST(MAX(sale_date) AS DATE) AS d FROM dbo.secondary_sales`);
  const asOf = asOfRows[0].d;
  const lastMonth = monthKey(asOf);

  const monthly = await query(`
    WITH as_of AS (
      SELECT CAST(MAX(sale_date) AS DATE) AS d FROM dbo.secondary_sales
    )
    SELECT
      p.product_id,
      p.sku,
      p.brand,
      ss.region,
      DATEFROMPARTS(YEAR(ss.sale_date), MONTH(ss.sale_date), 1) AS month,
      SUM(ss.value_sold) AS value_sold
    FROM dbo.secondary_sales ss
    JOIN dbo.products p ON p.product_id = ss.product_id
    CROSS JOIN as_of a
    WHERE ss.sale_date > DATEADD(YEAR, -2, a.d) AND ss.sale_date <= a.d
    GROUP BY p.product_id, p.sku, p.brand, ss.region, DATEFROMPARTS(YEAR(ss.sale_date), MONTH(ss.sale_date), 1)
    ORDER BY p.sku, ss.region, month
  `);

  const byProduct = {};
  for (const row of monthly) {
    const productKey = row.sku;
    if (!byProduct[productKey]) {
      byProduct[productKey] = {
        product_id: row.product_id,
        sku: row.sku,
        brand: row.brand,
        byRegion: {}
      };
    }
    if (!byProduct[productKey].byRegion[row.region]) {
      byProduct[productKey].byRegion[row.region] = {};
    }
    byProduct[productKey].byRegion[row.region][monthKey(row.month)] = Number(row.value_sold);
  }

  const actualMonths = monthRangeEnding(lastMonth, 12);
  const priorMonths = monthRangeEnding(shiftMonth(lastMonth, -12), 12);
  const forecastMonths = [1, 2, 3].map((i) => shiftMonth(lastMonth, i));
  const chartLabels = [...actualMonths, ...forecastMonths];
  const products = Object.keys(byProduct).sort();

  const productForecasts = products.map((sku) => {
    const product = byProduct[sku];
    const regionForecasts = Object.keys(product.byRegion).map((region) => {
      const byMonth = product.byRegion[region];
      const last12 = sumMonths(byMonth, actualMonths);
      const prior12 = sumMonths(byMonth, priorMonths);
      const yoyPct = prior12 ? round2(((last12 - prior12) / prior12) * 100) : null;
      const factor = prior12 ? last12 / prior12 : 1;

      const history = actualMonths.map((month) => ({
        month,
        actual: round2(byMonth[month] || 0),
        forecast: null
      }));

      const projected = forecastMonths.map((month) => {
        const sameLastYear = byMonth[shiftMonth(month, -12)] || 0;
        return {
          month,
          actual: null,
          forecast: round2(sameLastYear * factor)
        };
      });

      return {
        region,
        last_12m: round2(last12),
        prior_12m: round2(prior12),
        yoy_pct: yoyPct,
        next_3m_forecast: round2(projected.reduce((s, p) => s + p.forecast, 0)),
        months: [...history, ...projected]
      };
    });

    const totalForecast = regionForecasts.reduce((sum, r) => sum + r.next_3m_forecast, 0);
    const totalLast12m = regionForecasts.reduce((sum, r) => sum + r.last_12m, 0);

    return {
      product_id: product.product_id,
      sku: product.sku,
      brand: product.brand,
      total_last_12m: round2(totalLast12m),
      total_next_3m_forecast: round2(totalForecast),
      by_region: regionForecasts
    };
  });

  const chart = {
    type: 'line',
    title: 'Secondary sales by product (last 12 months + 3-month forecast)',
    x_axis: 'month',
    y_axis: 'value_sold',
    labels: chartLabels,
    forecast_start: forecastMonths[0],
    series: productForecasts.map((p) => ({
      name: p.sku,
      data: p.by_region[0]?.months.map((m) => m.actual != null ? m.actual : m.forecast) || []
    }))
  };

  const summary = `Product forecast built from monthly sales through ${monthKey(asOf)}. Shows 12-month actual sales and 3-month projections for each product across regions.`;

  return {
    as_of: monthKey(asOf),
    method: 'Same month last year, scaled by each product region\'s latest 12-month vs prior 12-month change.',
    summary,
    products: productForecasts.map(p => ({
      product_id: p.product_id,
      sku: p.sku,
      brand: p.brand,
      total_last_12m: p.total_last_12m,
      total_next_3m_forecast: p.total_next_3m_forecast,
      by_region: p.by_region.map(r => ({
        region: r.region,
        last_12m: r.last_12m,
        prior_12m: r.prior_12m,
        yoy_pct: r.yoy_pct,
        next_3m_forecast: r.next_3m_forecast,
        data: r.months.map(m => [m.month, m.actual != null ? m.actual : m.forecast])
      }))
    })),
    chart
  };
}

async function getActions(query) {
  const asOfRows = await query(`SELECT CAST(MAX(sale_date) AS DATE) AS d FROM dbo.secondary_sales`);
  const asOf = asOfRows[0].d;

  const coldDoctors = await query(`
    WITH as_of AS (
      SELECT CAST(MAX(sale_date) AS DATE) AS d FROM dbo.secondary_sales
    )
    SELECT
      d.doctor_name,
      d.specialty,
      d.tier,
      d.region,
      DATEDIFF(DAY, MAX(cp.actual_call_date), a.d) AS days_since_last_call
    FROM dbo.doctors d
    CROSS JOIN as_of a
    LEFT JOIN dbo.call_planning cp
      ON d.doctor_id = cp.doctor_id AND cp.actual_call_date IS NOT NULL
    WHERE d.status = 'active'
    GROUP BY d.doctor_name, d.specialty, d.tier, d.region, a.d
    HAVING MAX(cp.actual_call_date) IS NULL
        OR DATEDIFF(DAY, MAX(cp.actual_call_date), a.d) >= 30
    ORDER BY days_since_last_call DESC
  `);

  const south = await query(`
    WITH as_of AS (
      SELECT CAST(MAX(sale_date) AS DATE) AS d FROM dbo.secondary_sales
    )
    SELECT
      SUM(CASE WHEN ss.sale_date > DATEADD(YEAR, -1, a.d) AND ss.sale_date <= a.d THEN ss.value_sold ELSE 0 END) AS recent,
      SUM(CASE WHEN ss.sale_date > DATEADD(YEAR, -2, a.d) AND ss.sale_date <= DATEADD(YEAR, -1, a.d) THEN ss.value_sold ELSE 0 END) AS prior
    FROM dbo.secondary_sales ss
    CROSS JOIN as_of a
    WHERE ss.region = 'South'
  `);

  const lowAdherence = await query(`
    WITH as_of AS (
      SELECT CAST(MAX(sale_date) AS DATE) AS d FROM dbo.secondary_sales
    )
    SELECT
      r.name,
      r.territory,
      r.region,
      COUNT(*) AS planned,
      SUM(CASE WHEN cp.actual_call_date IS NOT NULL THEN 1 ELSE 0 END) AS done,
      ROUND(
        CAST(SUM(CASE WHEN cp.actual_call_date IS NOT NULL THEN 1 ELSE 0 END) AS FLOAT) * 100.0 /
        NULLIF(COUNT(*), 0),
        2
      ) AS adherence_pct
    FROM dbo.call_planning cp
    JOIN dbo.sales_reps r ON cp.rep_id = r.rep_id
    CROSS JOIN as_of a
    WHERE cp.planned_date > DATEADD(DAY, -90, a.d) AND cp.planned_date <= a.d
    GROUP BY r.name, r.territory, r.region
    HAVING ROUND(
      CAST(SUM(CASE WHEN cp.actual_call_date IS NOT NULL THEN 1 ELSE 0 END) AS FLOAT) * 100.0 /
      NULLIF(COUNT(*), 0),
      2
    ) < 70
    ORDER BY adherence_pct ASC
  `);

  const recent = Number(south[0].recent) || 0;
  const prior = Number(south[0].prior) || 0;
  const southYoy = prior ? round2(((recent - prior) / prior) * 100) : null;

  const actions = [];

  if (coldDoctors.length) {
    actions.push({
      priority: 1,
      type: 'call_coverage',
      title: 'Revisit doctors with no call in 30+ days',
      detail: `${coldDoctors.length} active doctors have not been called in 30 or more days as of the last sale date. Start with the longest gaps.`,
      count: coldDoctors.length,
      items: coldDoctors.slice(0, 8).map((d) => ({
        name: d.doctor_name,
        specialty: d.specialty,
        tier: d.tier,
        region: d.region,
        days_since_last_call: d.days_since_last_call
      }))
    });
  }

  if (southYoy != null && southYoy < -5) {
    actions.push({
      priority: 2,
      type: 'territory_risk',
      title: 'Put extra resource into South',
      detail: `South secondary sales are ${southYoy}% vs the prior 12 months. Review coverage, product mix, and call plans in South territories before the gap widens.`,
      count: 1,
      items: [{ region: 'South', yoy_pct: southYoy, last_12m: round2(recent), prior_12m: round2(prior) }]
    });
  }

  if (lowAdherence.length) {
    actions.push({
      priority: 3,
      type: 'coaching',
      title: 'Coach reps with call adherence under 70%',
      detail: `${lowAdherence.length} reps completed under 70% of planned calls in the last 90 days of the dataset.`,
      count: lowAdherence.length,
      items: lowAdherence.map((r) => ({
        name: r.name,
        territory: r.territory,
        region: r.region,
        planned: r.planned,
        completed: r.done,
        adherence_pct: r.adherence_pct
      }))
    });
  }

  return {
    as_of: monthKey(asOf),
    summary: actions.length
      ? actions.map((a) => a.title).join(' ')
      : 'No prescriptive actions matched the current thresholds.',
    actions
  };
}

module.exports = { getForecast, getProductForecast, getActions };
