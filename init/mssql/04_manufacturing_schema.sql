-- Manufacturing Agent Database Schema (MSSQL)
-- 7 Data Domains: Plant & Asset, Production & Shift, Downtime, Quality, Maintenance, Materials, Cost/Energy
-- Designed for connected operational events analysis

USE [manufacturing_agent_demo]
GO

-- ============= DIMENSION TABLES =============

-- 1. PLANT & ASSET MASTER
CREATE TABLE [dbo].[plants] (
  [plant_id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [plant_name] NVARCHAR(255) NOT NULL,
  [area] NVARCHAR(100),
  [location] NVARCHAR(255),
  [region] NVARCHAR(100) NOT NULL,
  [created_at] DATETIME DEFAULT GETUTCDATE(),
  [updated_at] DATETIME DEFAULT GETUTCDATE()
);

CREATE TABLE [dbo].[production_lines] (
  [line_id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [plant_id] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[plants]([plant_id]) ON DELETE NO ACTION,
  [line_name] NVARCHAR(100) NOT NULL,
  [line_area] NVARCHAR(100),
  [created_at] DATETIME DEFAULT GETUTCDATE(),
  [updated_at] DATETIME DEFAULT GETUTCDATE()
);

CREATE TABLE [dbo].[machines] (
  [asset_id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [line_id] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[production_lines]([line_id]) ON DELETE CASCADE,
  [plant_id] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[plants]([plant_id]) ON DELETE NO ACTION,
  [machine_name] NVARCHAR(255) NOT NULL,
  [machine_type] NVARCHAR(100) NOT NULL,
  [rated_capacity_units_per_hour] INT,
  [commissioning_date] DATE,
  [criticality] NVARCHAR(50) CHECK ([criticality] IN ('Critical', 'High', 'Medium', 'Low')),
  [product_capability] NVARCHAR(MAX),
  [created_at] DATETIME DEFAULT GETUTCDATE(),
  [updated_at] DATETIME DEFAULT GETUTCDATE()
);

CREATE TABLE [dbo].[products] (
  [product_id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [sku] NVARCHAR(50) NOT NULL UNIQUE,
  [product_name] NVARCHAR(255) NOT NULL,
  [category] NVARCHAR(100),
  [dosage] NVARCHAR(100),
  [created_at] DATETIME DEFAULT GETUTCDATE(),
  [updated_at] DATETIME DEFAULT GETUTCDATE()
);

CREATE TABLE [dbo].[operators] (
  [operator_id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [name] NVARCHAR(255) NOT NULL,
  [plant_id] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[plants]([plant_id]) ON DELETE NO ACTION,
  [shift] NVARCHAR(50),
  [certification_level] NVARCHAR(50),
  [experience_years] INT,
  [created_at] DATETIME DEFAULT GETUTCDATE(),
  [updated_at] DATETIME DEFAULT GETUTCDATE()
);

CREATE TABLE [dbo].[suppliers] (
  [supplier_id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [supplier_name] NVARCHAR(255) NOT NULL,
  [region] NVARCHAR(100),
  [created_at] DATETIME DEFAULT GETUTCDATE(),
  [updated_at] DATETIME DEFAULT GETUTCDATE()
);

CREATE TABLE [dbo].[materials] (
  [material_id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [material_name] NVARCHAR(255) NOT NULL,
  [supplier_id] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[suppliers]([supplier_id]) ON DELETE CASCADE,
  [created_at] DATETIME DEFAULT GETUTCDATE(),
  [updated_at] DATETIME DEFAULT GETUTCDATE()
);

CREATE TABLE [dbo].[calendar] (
  [date] DATE PRIMARY KEY,
  [year] INT NOT NULL,
  [month] INT NOT NULL,
  [quarter] INT NOT NULL,
  [day_of_week] INT NOT NULL,
  [is_holiday] BIT DEFAULT 0,
  [is_working_day] BIT DEFAULT 1,
  [is_planned_shutdown] BIT DEFAULT 0,
  [is_peak_season] BIT DEFAULT 0
);

-- ============= FACT TABLES =============

-- 2. PRODUCTION & SHIFT PERFORMANCE (Daily/Shift level)
CREATE TABLE [dbo].[production_runs] (
  [production_id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [date] DATE NOT NULL,
  [shift] NVARCHAR(50) NOT NULL,
  [plant_id] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[plants]([plant_id]) ON DELETE NO ACTION,
  [line_id] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[production_lines]([line_id]) ON DELETE CASCADE,
  [product_id] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[products]([product_id]) ON DELETE NO ACTION,
  [operator_id] UNIQUEIDENTIFIER REFERENCES [dbo].[operators]([operator_id]) ON DELETE NO ACTION,
  [planned_quantity] INT NOT NULL,
  [actual_quantity] INT NOT NULL,
  [good_quantity] INT NOT NULL,
  [rejected_quantity] INT,
  [cycle_time_minutes] DECIMAL(10, 2),
  [runtime_hours] DECIMAL(10, 2),
  [planned_production_time_hours] DECIMAL(10, 2),
  [changeover_time_minutes] INT,
  [created_at] DATETIME DEFAULT GETUTCDATE(),
  [updated_at] DATETIME DEFAULT GETUTCDATE()
);

-- 3. DOWNTIME & EVENTS (Event level - can be multiple per shift)
CREATE TABLE [dbo].[downtime_events] (
  [downtime_id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [event_start_datetime] DATETIME NOT NULL,
  [event_end_datetime] DATETIME NOT NULL,
  [duration_minutes] INT NOT NULL,
  [plant_id] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[plants]([plant_id]) ON DELETE NO ACTION,
  [line_id] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[production_lines]([line_id]) ON DELETE CASCADE,
  [asset_id] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[machines]([asset_id]) ON DELETE NO ACTION,
  [planned_vs_unplanned] NVARCHAR(50) CHECK ([planned_vs_unplanned] IN ('Planned', 'Unplanned')),
  [reason_code] NVARCHAR(100),
  [failure_mode] NVARCHAR(255),
  [category] NVARCHAR(100) CHECK ([category] IN ('Breakdown', 'Changeover', 'Material', 'Quality')),
  [comments] NVARCHAR(MAX),
  [created_at] DATETIME DEFAULT GETUTCDATE(),
  [updated_at] DATETIME DEFAULT GETUTCDATE()
);

-- 4. QUALITY & REJECTION
CREATE TABLE [dbo].[quality_tests] (
  [quality_id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [batch_id] NVARCHAR(100),
  [date] DATE NOT NULL,
  [plant_id] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[plants]([plant_id]) ON DELETE NO ACTION,
  [line_id] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[production_lines]([line_id]) ON DELETE CASCADE,
  [product_id] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[products]([product_id]) ON DELETE NO ACTION,
  [produced_quantity] INT NOT NULL,
  [rejected_quantity] INT NOT NULL,
  [rework_quantity] INT,
  [defect_type] NVARCHAR(255),
  [inspection_result] NVARCHAR(50) CHECK ([inspection_result] IN ('Pass', 'Fail', 'Rework')),
  [defect_severity] NVARCHAR(50) CHECK ([defect_severity] IN ('Critical', 'Major', 'Minor')),
  [scrap_reason] NVARCHAR(255),
  [created_at] DATETIME DEFAULT GETUTCDATE(),
  [updated_at] DATETIME DEFAULT GETUTCDATE()
);

-- 5. MAINTENANCE
CREATE TABLE [dbo].[maintenance_records] (
  [maintenance_id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [asset_id] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[machines]([asset_id]) ON DELETE NO ACTION,
  [work_order_id] NVARCHAR(100) UNIQUE,
  [maintenance_type] NVARCHAR(50) CHECK ([maintenance_type] IN ('Preventive', 'Corrective', 'Emergency')),
  [failure_date] DATE,
  [repair_start_datetime] DATETIME NOT NULL,
  [repair_end_datetime] DATETIME NOT NULL,
  [labor_hours] DECIMAL(10, 2),
  [spare_parts_used] NVARCHAR(MAX),
  [maintenance_cost] DECIMAL(15, 2),
  [planned_maintenance_due_date] DATE,
  [planned_maintenance_completed_date] DATE,
  [created_at] DATETIME DEFAULT GETUTCDATE(),
  [updated_at] DATETIME DEFAULT GETUTCDATE()
);

-- 6. MATERIALS & INVENTORY
CREATE TABLE [dbo].[inventory_transactions] (
  [inventory_id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [date] DATE NOT NULL,
  [plant_id] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[plants]([plant_id]) ON DELETE NO ACTION,
  [material_id] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[materials]([material_id]) ON DELETE CASCADE,
  [supplier_id] UNIQUEIDENTIFIER REFERENCES [dbo].[suppliers]([supplier_id]),
  [opening_stock_units] INT,
  [closing_stock_units] INT,
  [stock_issued_to_production] INT,
  [shortages_quantity] INT DEFAULT 0,
  [batch_lot_number] NVARCHAR(100),
  [standard_usage_quantity] DECIMAL(10, 2),
  [actual_usage_quantity] INT,
  [purchase_cost_per_unit] DECIMAL(15, 2),
  [standard_cost] DECIMAL(15, 2),
  [created_at] DATETIME DEFAULT GETUTCDATE(),
  [updated_at] DATETIME DEFAULT GETUTCDATE()
);

-- 7. COST, ENERGY & UTILITIES
CREATE TABLE [dbo].[cost_records] (
  [cost_id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [production_order_id] NVARCHAR(100),
  [date] DATE NOT NULL,
  [plant_id] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[plants]([plant_id]) ON DELETE NO ACTION,
  [line_id] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[production_lines]([line_id]) ON DELETE CASCADE,
  [product_id] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[products]([product_id]) ON DELETE NO ACTION,
  [labor_cost] DECIMAL(15, 2),
  [maintenance_cost] DECIMAL(15, 2),
  [scrap_cost] DECIMAL(15, 2),
  [energy_kwh] DECIMAL(15, 2),
  [energy_cost] DECIMAL(15, 2),
  [standard_cost_per_unit] DECIMAL(15, 2),
  [actual_cost_per_unit] DECIMAL(15, 2),
  [units_produced] INT,
  [created_at] DATETIME DEFAULT GETUTCDATE(),
  [updated_at] DATETIME DEFAULT GETUTCDATE()
);

-- ============= INDEXES =============

-- Plant & Line indexes
CREATE INDEX [idx_production_lines_plant_id] ON [dbo].[production_lines]([plant_id]);
CREATE INDEX [idx_machines_line_id] ON [dbo].[machines]([line_id]);
CREATE INDEX [idx_machines_plant_id] ON [dbo].[machines]([plant_id]);
CREATE INDEX [idx_machines_criticality] ON [dbo].[machines]([criticality]);

-- Production runs indexes
CREATE INDEX [idx_production_runs_date] ON [dbo].[production_runs]([date]);
CREATE INDEX [idx_production_runs_plant_id] ON [dbo].[production_runs]([plant_id]);
CREATE INDEX [idx_production_runs_line_id] ON [dbo].[production_runs]([line_id]);
CREATE INDEX [idx_production_runs_product_id] ON [dbo].[production_runs]([product_id]);
CREATE INDEX [idx_production_runs_shift] ON [dbo].[production_runs]([shift]);

-- Downtime events indexes
CREATE INDEX [idx_downtime_events_date] ON [dbo].[downtime_events]([event_start_datetime]);
CREATE INDEX [idx_downtime_events_line_id] ON [dbo].[downtime_events]([line_id]);
CREATE INDEX [idx_downtime_events_asset_id] ON [dbo].[downtime_events]([asset_id]);
CREATE INDEX [idx_downtime_events_category] ON [dbo].[downtime_events]([category]);
CREATE INDEX [idx_downtime_events_plant_id] ON [dbo].[downtime_events]([plant_id]);

-- Quality tests indexes
CREATE INDEX [idx_quality_tests_date] ON [dbo].[quality_tests]([date]);
CREATE INDEX [idx_quality_tests_line_id] ON [dbo].[quality_tests]([line_id]);
CREATE INDEX [idx_quality_tests_product_id] ON [dbo].[quality_tests]([product_id]);
CREATE INDEX [idx_quality_tests_plant_id] ON [dbo].[quality_tests]([plant_id]);

-- Maintenance indexes
CREATE INDEX [idx_maintenance_records_asset_id] ON [dbo].[maintenance_records]([asset_id]);
CREATE INDEX [idx_maintenance_records_date] ON [dbo].[maintenance_records]([repair_start_datetime]);
CREATE INDEX [idx_maintenance_records_type] ON [dbo].[maintenance_records]([maintenance_type]);

-- Inventory indexes
CREATE INDEX [idx_inventory_transactions_date] ON [dbo].[inventory_transactions]([date]);
CREATE INDEX [idx_inventory_transactions_plant_id] ON [dbo].[inventory_transactions]([plant_id]);
CREATE INDEX [idx_inventory_transactions_material_id] ON [dbo].[inventory_transactions]([material_id]);

-- Cost records indexes
CREATE INDEX [idx_cost_records_date] ON [dbo].[cost_records]([date]);
CREATE INDEX [idx_cost_records_line_id] ON [dbo].[cost_records]([line_id]);
CREATE INDEX [idx_cost_records_product_id] ON [dbo].[cost_records]([product_id]);
CREATE INDEX [idx_cost_records_plant_id] ON [dbo].[cost_records]([plant_id]);

-- ============= AUDIT TRAIL =============

CREATE TABLE [dbo].[audit_log] (
  [id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [table_name] NVARCHAR(255),
  [operation] NVARCHAR(10),
  [record_id] UNIQUEIDENTIFIER,
  [changed_at] DATETIME DEFAULT GETUTCDATE(),
  [changed_by] NVARCHAR(255)
);

CREATE INDEX [idx_audit_log_table_name] ON [dbo].[audit_log]([table_name]);
CREATE INDEX [idx_audit_log_changed_at] ON [dbo].[audit_log]([changed_at]);
