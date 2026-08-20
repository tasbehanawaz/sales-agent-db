-- Optional rollup views for common agent queries

USE [sales_agent_demo]
GO

-- ============= REP PERFORMANCE =============

CREATE VIEW [dbo].[vw_rep_performance] AS
SELECT
  r.[rep_id],
  r.[name],
  r.[territory],
  r.[region],
  DATEFROMPARTS(YEAR(ss.[sale_date]), MONTH(ss.[sale_date]), 1) AS [month],
  ISNULL(SUM(ss.[value_sold]), 0) AS [total_sales],
  COUNT(DISTINCT ss.[pharmacy_id]) AS [unique_pharmacies],
  COUNT(DISTINCT ss.[product_id]) AS [unique_products],
  COUNT(cp.[call_id]) AS [total_planned_calls],
  COUNT(CASE WHEN cp.[actual_call_date] IS NOT NULL THEN 1 END) AS [completed_calls],
  ROUND(
    CAST(COUNT(CASE WHEN cp.[actual_call_date] IS NOT NULL THEN 1 END) AS FLOAT) * 100.0 /
    NULLIF(COUNT(cp.[call_id]), 0),
    2
  ) AS [call_adherence_pct],
  AVG(CAST(cp.[feedback_score] AS FLOAT)) AS [avg_feedback_score]
FROM [dbo].[sales_reps] r
LEFT JOIN [dbo].[secondary_sales] ss ON r.[rep_id] = ss.[rep_id]
LEFT JOIN [dbo].[call_planning] cp ON r.[rep_id] = cp.[rep_id]
GROUP BY r.[rep_id], r.[name], r.[territory], r.[region], DATEFROMPARTS(YEAR(ss.[sale_date]), MONTH(ss.[sale_date]), 1)
GO

-- ============= PRODUCT × REGION TRENDS =============

CREATE VIEW [dbo].[vw_product_region_trends] AS
SELECT
  p.[product_id],
  p.[sku],
  p.[brand],
  p.[therapy_area],
  ss.[region],
  DATEFROMPARTS(YEAR(ss.[sale_date]), MONTH(ss.[sale_date]), 1) AS [month],
  SUM(ss.[quantity_sold]) AS [qty_sold],
  SUM(ss.[value_sold]) AS [value_sold],
  COUNT(DISTINCT ss.[pharmacy_id]) AS [pharmacy_count],
  COUNT(DISTINCT ss.[rep_id]) AS [rep_count]
FROM [dbo].[products] p
LEFT JOIN [dbo].[secondary_sales] ss ON p.[product_id] = ss.[product_id]
GROUP BY p.[product_id], p.[sku], p.[brand], p.[therapy_area], ss.[region], DATEFROMPARTS(YEAR(ss.[sale_date]), MONTH(ss.[sale_date]), 1)
GO

-- ============= CALL EFFECTIVENESS =============

CREATE VIEW [dbo].[vw_call_effectiveness] AS
SELECT
  d.[tier],
  d.[region],
  d.[market],
  DATEFROMPARTS(YEAR(cp.[planned_date]), MONTH(cp.[planned_date]), 1) AS [month],
  COUNT(cp.[call_id]) AS [total_calls],
  COUNT(CASE WHEN cp.[actual_call_date] IS NOT NULL THEN 1 END) AS [completed_calls],
  ROUND(
    CAST(COUNT(CASE WHEN cp.[actual_call_date] IS NOT NULL THEN 1 END) AS FLOAT) * 100.0 /
    NULLIF(COUNT(cp.[call_id]), 0),
    2
  ) AS [adherence_pct],
  AVG(CAST(cp.[feedback_score] AS FLOAT)) AS [avg_feedback],
  ISNULL(SUM(COALESCE(ss.[value_sold], 0)), 0) AS [sales_value_post_call],
  COUNT(DISTINCT ss.[sale_id]) AS [sales_count]
FROM [dbo].[call_planning] cp
JOIN [dbo].[doctors] d ON cp.[doctor_id] = d.[doctor_id]
LEFT JOIN [dbo].[secondary_sales] ss ON cp.[rep_id] = ss.[rep_id]
  AND cp.[product_id] = ss.[product_id]
  AND ss.[sale_date] BETWEEN cp.[actual_call_date] AND DATEADD(DAY, 30, cp.[actual_call_date])
GROUP BY d.[tier], d.[region], d.[market], DATEFROMPARTS(YEAR(cp.[planned_date]), MONTH(cp.[planned_date]), 1)
GO

-- ============= INACTIVE DOCTORS =============

CREATE VIEW [dbo].[vw_inactive_doctors] AS
SELECT
  d.[doctor_id],
  d.[doctor_name],
  d.[specialty],
  d.[tier],
  d.[region],
  d.[market],
  MAX(cp.[actual_call_date]) AS [last_call_date],
  DATEDIFF(DAY, MAX(cp.[actual_call_date]), CAST(GETDATE() AS DATE)) AS [days_since_last_call],
  COUNT(cp.[call_id]) AS [total_calls_made]
FROM [dbo].[doctors] d
LEFT JOIN [dbo].[call_planning] cp ON d.[doctor_id] = cp.[doctor_id] AND cp.[actual_call_date] IS NOT NULL
WHERE d.[status] = 'active'
GROUP BY d.[doctor_id], d.[doctor_name], d.[specialty], d.[tier], d.[region], d.[market]
HAVING DATEDIFF(DAY, MAX(cp.[actual_call_date]), CAST(GETDATE() AS DATE)) >= 30 OR MAX(cp.[actual_call_date]) IS NULL
GO

-- ============= AT-RISK TERRITORIES =============

CREATE VIEW [dbo].[vw_at_risk_territories] AS
SELECT
  r.[rep_id],
  r.[name],
  r.[territory],
  r.[region],
  -- Sales trend (previous 3 months avg vs current month)
  ROUND(
    CAST(
      SUM(CASE WHEN DATEFROMPARTS(YEAR(ss.[sale_date]), MONTH(ss.[sale_date]), 1) = DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1) THEN ss.[value_sold] ELSE 0 END) -
      (SUM(CASE WHEN DATEFROMPARTS(YEAR(ss.[sale_date]), MONTH(ss.[sale_date]), 1) < DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1)
           AND DATEFROMPARTS(YEAR(ss.[sale_date]), MONTH(ss.[sale_date]), 1) >= DATEADD(MONTH, -3, DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1))
        THEN ss.[value_sold] ELSE 0 END) / 3.0)
    AS FLOAT) * 100.0 /
    NULLIF(SUM(CASE WHEN DATEFROMPARTS(YEAR(ss.[sale_date]), MONTH(ss.[sale_date]), 1) < DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1)
           AND DATEFROMPARTS(YEAR(ss.[sale_date]), MONTH(ss.[sale_date]), 1) >= DATEADD(MONTH, -3, DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1))
        THEN ss.[value_sold] ELSE 0 END) / 3.0, 0),
    2
  ) AS [sales_trend_pct],
  ROUND(
    CAST(COUNT(CASE WHEN cp.[actual_call_date] IS NOT NULL THEN 1 END) AS FLOAT) * 100.0 /
    NULLIF(COUNT(cp.[call_id]), 0),
    2
  ) AS [call_adherence_pct]
FROM [dbo].[sales_reps] r
LEFT JOIN [dbo].[secondary_sales] ss ON r.[rep_id] = ss.[rep_id] AND ss.[sale_date] >= DATEADD(DAY, -90, CAST(GETDATE() AS DATE))
LEFT JOIN [dbo].[call_planning] cp ON r.[rep_id] = cp.[rep_id] AND cp.[planned_date] >= DATEADD(DAY, -90, CAST(GETDATE() AS DATE))
GROUP BY r.[rep_id], r.[name], r.[territory], r.[region]
HAVING
  ROUND(CAST(
    SUM(CASE WHEN DATEFROMPARTS(YEAR(ss.[sale_date]), MONTH(ss.[sale_date]), 1) = DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1) THEN ss.[value_sold] ELSE 0 END) -
    (SUM(CASE WHEN DATEFROMPARTS(YEAR(ss.[sale_date]), MONTH(ss.[sale_date]), 1) < DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1)
         AND DATEFROMPARTS(YEAR(ss.[sale_date]), MONTH(ss.[sale_date]), 1) >= DATEADD(MONTH, -3, DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1))
      THEN ss.[value_sold] ELSE 0 END) / 3.0)
  AS FLOAT) * 100.0 /
  NULLIF(SUM(CASE WHEN DATEFROMPARTS(YEAR(ss.[sale_date]), MONTH(ss.[sale_date]), 1) < DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1)
         AND DATEFROMPARTS(YEAR(ss.[sale_date]), MONTH(ss.[sale_date]), 1) >= DATEADD(MONTH, -3, DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1))
      THEN ss.[value_sold] ELSE 0 END) / 3.0, 0), 2) < -5
  OR ROUND(CAST(COUNT(CASE WHEN cp.[actual_call_date] IS NOT NULL THEN 1 END) AS FLOAT) * 100.0 / NULLIF(COUNT(cp.[call_id]), 0), 2) < 70
GO

-- ============= TERRITORY COVERAGE SUMMARY =============

CREATE VIEW [dbo].[vw_territory_coverage] AS
SELECT
  r.[rep_id],
  r.[name],
  r.[territory],
  r.[region],
  COUNT(DISTINCT d.[doctor_id]) AS [total_doctors],
  COUNT(DISTINCT CASE WHEN d.[tier] = 'A' THEN d.[doctor_id] END) AS [tier_a_count],
  COUNT(DISTINCT CASE WHEN d.[tier] = 'B' THEN d.[doctor_id] END) AS [tier_b_count],
  COUNT(DISTINCT CASE WHEN d.[tier] = 'C' THEN d.[doctor_id] END) AS [tier_c_count],
  COUNT(DISTINCT cp.[call_id]) AS [total_calls],
  COUNT(DISTINCT CASE WHEN cp.[actual_call_date] IS NOT NULL THEN cp.[call_id] END) AS [completed_calls],
  ROUND(
    CAST(COUNT(DISTINCT CASE WHEN cp.[actual_call_date] IS NOT NULL THEN cp.[call_id] END) AS FLOAT) * 100.0 /
    NULLIF(COUNT(DISTINCT cp.[call_id]), 0),
    2
  ) AS [coverage_pct]
FROM [dbo].[sales_reps] r
LEFT JOIN [dbo].[doctors] d ON r.[rep_id] IS NOT NULL
LEFT JOIN [dbo].[call_planning] cp ON r.[rep_id] = cp.[rep_id]
GROUP BY r.[rep_id], r.[name], r.[territory], r.[region]
GO
