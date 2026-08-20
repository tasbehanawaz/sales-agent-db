-- Optional rollup views for common agent queries

-- ============= REP PERFORMANCE =============

CREATE VIEW vw_rep_performance AS
SELECT
  r.rep_id,
  r.name,
  r.territory,
  r.region,
  DATE_TRUNC('month', ss.sale_date)::DATE AS month,
  SUM(ss.value_sold) AS total_sales,
  COUNT(DISTINCT ss.pharmacy_id) AS unique_pharmacies,
  COUNT(DISTINCT ss.product_id) AS unique_products,
  COUNT(cp.call_id) AS total_planned_calls,
  COUNT(CASE WHEN cp.actual_call_date IS NOT NULL THEN 1 END) AS completed_calls,
  ROUND(
    100.0 * COUNT(CASE WHEN cp.actual_call_date IS NOT NULL THEN 1 END) /
    NULLIF(COUNT(cp.call_id), 0),
    2
  ) AS call_adherence_pct,
  AVG(cp.feedback_score) AS avg_feedback_score
FROM sales_reps r
LEFT JOIN secondary_sales ss ON r.rep_id = ss.rep_id
LEFT JOIN call_planning cp ON r.rep_id = cp.rep_id
GROUP BY r.rep_id, r.name, r.territory, r.region, DATE_TRUNC('month', ss.sale_date)::DATE
ORDER BY r.rep_id, month DESC;

-- ============= PRODUCT × REGION TRENDS =============

CREATE VIEW vw_product_region_trends AS
SELECT
  p.product_id,
  p.sku,
  p.brand,
  p.therapy_area,
  ss.region,
  DATE_TRUNC('month', ss.sale_date)::DATE AS month,
  SUM(ss.quantity_sold) AS qty_sold,
  SUM(ss.value_sold) AS value_sold,
  COUNT(DISTINCT ss.pharmacy_id) AS pharmacy_count,
  COUNT(DISTINCT ss.rep_id) AS rep_count
FROM products p
LEFT JOIN secondary_sales ss ON p.product_id = ss.product_id
GROUP BY p.product_id, p.sku, p.brand, p.therapy_area, ss.region, DATE_TRUNC('month', ss.sale_date)::DATE
ORDER BY month DESC, value_sold DESC NULLS LAST;

-- ============= CALL EFFECTIVENESS =============

CREATE VIEW vw_call_effectiveness AS
SELECT
  d.tier,
  d.region,
  d.market,
  DATE_TRUNC('month', cp.planned_date)::DATE AS month,
  COUNT(cp.call_id) AS total_calls,
  COUNT(CASE WHEN cp.actual_call_date IS NOT NULL THEN 1 END) AS completed_calls,
  ROUND(
    100.0 * COUNT(CASE WHEN cp.actual_call_date IS NOT NULL THEN 1 END) /
    NULLIF(COUNT(cp.call_id), 0),
    2
  ) AS adherence_pct,
  AVG(cp.feedback_score) AS avg_feedback,
  SUM(COALESCE(ss.value_sold, 0)) AS sales_value_post_call,
  COUNT(DISTINCT ss.sale_id) AS sales_count
FROM call_planning cp
JOIN doctors d ON cp.doctor_id = d.doctor_id
LEFT JOIN secondary_sales ss ON cp.rep_id = ss.rep_id
  AND cp.product_id = ss.product_id
  AND ss.sale_date BETWEEN cp.actual_call_date AND cp.actual_call_date + INTERVAL '30 days'
GROUP BY d.tier, d.region, d.market, DATE_TRUNC('month', cp.planned_date)::DATE
ORDER BY month DESC, total_calls DESC;

-- ============= INACTIVE DOCTORS =============

CREATE VIEW vw_inactive_doctors AS
SELECT
  d.doctor_id,
  d.doctor_name,
  d.specialty,
  d.tier,
  d.region,
  d.market,
  MAX(cp.actual_call_date) AS last_call_date,
  CURRENT_DATE - MAX(cp.actual_call_date)::DATE AS days_since_last_call,
  COUNT(cp.call_id) AS total_calls_made
FROM doctors d
LEFT JOIN call_planning cp ON d.doctor_id = cp.doctor_id AND cp.actual_call_date IS NOT NULL
WHERE d.status = 'active'
GROUP BY d.doctor_id, d.doctor_name, d.specialty, d.tier, d.region, d.market
HAVING CURRENT_DATE - MAX(cp.actual_call_date)::DATE >= 30 OR MAX(cp.actual_call_date) IS NULL
ORDER BY days_since_last_call DESC NULLS FIRST;

-- ============= AT-RISK TERRITORIES =============

CREATE VIEW vw_at_risk_territories AS
SELECT
  r.rep_id,
  r.name,
  r.territory,
  r.region,
  -- Sales trend (previous 3 months avg vs current month)
  ROUND(
    100.0 * (
      SUM(CASE WHEN DATE_TRUNC('month', ss.sale_date)::DATE = DATE_TRUNC('month', CURRENT_DATE)::DATE THEN ss.value_sold ELSE 0 END) -
      (SUM(CASE WHEN DATE_TRUNC('month', ss.sale_date)::DATE < DATE_TRUNC('month', CURRENT_DATE)::DATE
           AND DATE_TRUNC('month', ss.sale_date)::DATE >= CURRENT_DATE - INTERVAL '90 days'
        THEN ss.value_sold ELSE 0 END) / 3)
    ) / NULLIF(SUM(CASE WHEN DATE_TRUNC('month', ss.sale_date)::DATE < DATE_TRUNC('month', CURRENT_DATE)::DATE
           AND DATE_TRUNC('month', ss.sale_date)::DATE >= CURRENT_DATE - INTERVAL '90 days'
        THEN ss.value_sold ELSE 0 END) / 3, 0),
    2
  ) AS sales_trend_pct,
  ROUND(
    100.0 * COUNT(CASE WHEN cp.actual_call_date IS NOT NULL THEN 1 END) /
    NULLIF(COUNT(cp.call_id), 0),
    2
  ) AS call_adherence_pct
FROM sales_reps r
LEFT JOIN secondary_sales ss ON r.rep_id = ss.rep_id AND ss.sale_date >= CURRENT_DATE - INTERVAL '90 days'
LEFT JOIN call_planning cp ON r.rep_id = cp.rep_id AND cp.planned_date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY r.rep_id, r.name, r.territory, r.region
HAVING
  ROUND(100.0 * (
    SUM(CASE WHEN DATE_TRUNC('month', ss.sale_date)::DATE = DATE_TRUNC('month', CURRENT_DATE)::DATE THEN ss.value_sold ELSE 0 END) -
    (SUM(CASE WHEN DATE_TRUNC('month', ss.sale_date)::DATE < DATE_TRUNC('month', CURRENT_DATE)::DATE
         AND DATE_TRUNC('month', ss.sale_date)::DATE >= CURRENT_DATE - INTERVAL '90 days'
      THEN ss.value_sold ELSE 0 END) / 3)
  ) / NULLIF(SUM(CASE WHEN DATE_TRUNC('month', ss.sale_date)::DATE < DATE_TRUNC('month', CURRENT_DATE)::DATE
         AND DATE_TRUNC('month', ss.sale_date)::DATE >= CURRENT_DATE - INTERVAL '90 days'
      THEN ss.value_sold ELSE 0 END) / 3, 0), 2) < -5
  OR ROUND(100.0 * COUNT(CASE WHEN cp.actual_call_date IS NOT NULL THEN 1 END) /
    NULLIF(COUNT(cp.call_id), 0), 2) < 70
ORDER BY sales_trend_pct ASC NULLS LAST, call_adherence_pct ASC;

-- ============= TERRITORY COVERAGE SUMMARY =============

CREATE VIEW vw_territory_coverage AS
SELECT
  r.rep_id,
  r.name,
  r.territory,
  r.region,
  COUNT(DISTINCT d.doctor_id) AS total_doctors,
  COUNT(DISTINCT CASE WHEN d.tier = 'A' THEN d.doctor_id END) AS tier_a_count,
  COUNT(DISTINCT CASE WHEN d.tier = 'B' THEN d.doctor_id END) AS tier_b_count,
  COUNT(DISTINCT CASE WHEN d.tier = 'C' THEN d.doctor_id END) AS tier_c_count,
  COUNT(DISTINCT cp.call_id) AS total_planned_calls,
  COUNT(DISTINCT CASE WHEN cp.actual_call_date IS NOT NULL THEN cp.call_id END) AS completed_calls,
  ROUND(
    100.0 * COUNT(DISTINCT CASE WHEN cp.actual_call_date IS NOT NULL THEN cp.call_id END) /
    NULLIF(COUNT(DISTINCT cp.call_id), 0),
    2
  ) AS coverage_pct
FROM sales_reps r
LEFT JOIN doctors d ON r.rep_id IS NOT NULL  -- This is simplified; adjust based on rep-doctor assignment logic
LEFT JOIN call_planning cp ON r.rep_id = cp.rep_id
GROUP BY r.rep_id, r.name, r.territory, r.region
ORDER BY coverage_pct DESC NULLS LAST;
