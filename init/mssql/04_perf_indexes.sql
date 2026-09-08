USE [sales_agent_demo]
GO

-- Cover the date-range aggregations used by forecast, product-trends, and insights.
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'idx_ss_sale_date_region' AND object_id = OBJECT_ID('dbo.secondary_sales')
)
CREATE NONCLUSTERED INDEX [idx_ss_sale_date_region]
ON [dbo].[secondary_sales] ([sale_date], [region])
INCLUDE ([value_sold], [quantity_sold], [product_id], [rep_id], [pharmacy_id]);
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'idx_ss_sale_date_product_region' AND object_id = OBJECT_ID('dbo.secondary_sales')
)
CREATE NONCLUSTERED INDEX [idx_ss_sale_date_product_region]
ON [dbo].[secondary_sales] ([sale_date], [product_id], [region])
INCLUDE ([value_sold], [quantity_sold]);
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'idx_ss_rep_sale_date' AND object_id = OBJECT_ID('dbo.secondary_sales')
)
CREATE NONCLUSTERED INDEX [idx_ss_rep_sale_date]
ON [dbo].[secondary_sales] ([rep_id], [sale_date])
INCLUDE ([value_sold]);
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'idx_cp_rep_planned_date' AND object_id = OBJECT_ID('dbo.call_planning')
)
CREATE NONCLUSTERED INDEX [idx_cp_rep_planned_date]
ON [dbo].[call_planning] ([rep_id], [planned_date])
INCLUDE ([actual_call_date], [product_id], [doctor_id], [feedback_score]);
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'idx_cp_doctor_actual_call_date' AND object_id = OBJECT_ID('dbo.call_planning')
)
CREATE NONCLUSTERED INDEX [idx_cp_doctor_actual_call_date]
ON [dbo].[call_planning] ([doctor_id], [actual_call_date])
INCLUDE ([call_id]);
GO
