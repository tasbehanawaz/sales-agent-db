-- Sales Agent Database Schema (MSSQL)
-- Doctors, Call Planning, and Secondary Sales data model

USE [sales_agent_demo]
GO

-- ============= DIMENSION TABLES =============

CREATE TABLE [dbo].[sales_reps] (
  [rep_id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [name] NVARCHAR(255) NOT NULL,
  [territory] NVARCHAR(255),
  [region] NVARCHAR(100) NOT NULL,
  [manager_id] UNIQUEIDENTIFIER REFERENCES [dbo].[sales_reps]([rep_id]),
  [created_at] DATETIME DEFAULT GETUTCDATE(),
  [updated_at] DATETIME DEFAULT GETUTCDATE()
);

CREATE TABLE [dbo].[products] (
  [product_id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [sku] NVARCHAR(50) NOT NULL UNIQUE,
  [brand] NVARCHAR(255) NOT NULL,
  [therapy_area] NVARCHAR(255),
  [launch_date] DATE,
  [created_at] DATETIME DEFAULT GETUTCDATE(),
  [updated_at] DATETIME DEFAULT GETUTCDATE()
);

CREATE TABLE [dbo].[pharmacies] (
  [pharmacy_id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [name] NVARCHAR(255) NOT NULL,
  [region] NVARCHAR(100),
  [channel] NVARCHAR(100),
  [created_at] DATETIME DEFAULT GETUTCDATE(),
  [updated_at] DATETIME DEFAULT GETUTCDATE()
);

-- ============= FACT TABLES =============

CREATE TABLE [dbo].[doctors] (
  [doctor_id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [doctor_name] NVARCHAR(255) NOT NULL,
  [specialty] NVARCHAR(100),
  [tier] CHAR(1) CHECK ([tier] IN ('A', 'B', 'C')),
  [hospital_clinic] NVARCHAR(255),
  [region] NVARCHAR(100) NOT NULL,
  [territory] NVARCHAR(255),
  [city] NVARCHAR(100),
  [market] NVARCHAR(100),
  [onboarded_date] DATE,
  [status] NVARCHAR(50) DEFAULT 'active',
  [created_at] DATETIME DEFAULT GETUTCDATE(),
  [updated_at] DATETIME DEFAULT GETUTCDATE()
);

CREATE TABLE [dbo].[call_planning] (
  [call_id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [doctor_id] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[doctors]([doctor_id]) ON DELETE CASCADE,
  [rep_id] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[sales_reps]([rep_id]) ON DELETE CASCADE,
  [product_id] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[products]([product_id]) ON DELETE CASCADE,
  [planned_date] DATE NOT NULL,
  [actual_call_date] DATE,
  [call_type] NVARCHAR(50),
  [frequency_target] INT,
  [call_status] NVARCHAR(50) DEFAULT 'planned',
  [feedback_score] INT CHECK ([feedback_score] >= 0 AND [feedback_score] <= 10),
  [notes] NVARCHAR(MAX),
  [created_at] DATETIME DEFAULT GETUTCDATE(),
  [updated_at] DATETIME DEFAULT GETUTCDATE()
);

CREATE TABLE [dbo].[secondary_sales] (
  [sale_id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
  [sale_date] DATE NOT NULL,
  [product_id] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[products]([product_id]) ON DELETE CASCADE,
  [pharmacy_id] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[pharmacies]([pharmacy_id]) ON DELETE CASCADE,
  [rep_id] UNIQUEIDENTIFIER NOT NULL REFERENCES [dbo].[sales_reps]([rep_id]) ON DELETE CASCADE,
  [region] NVARCHAR(100) NOT NULL,
  [quantity_sold] INT,
  [value_sold] DECIMAL(15, 2),
  [created_at] DATETIME DEFAULT GETUTCDATE(),
  [updated_at] DATETIME DEFAULT GETUTCDATE()
);

-- ============= INDEXES =============

CREATE INDEX [idx_doctors_region] ON [dbo].[doctors]([region]);
CREATE INDEX [idx_doctors_territory] ON [dbo].[doctors]([territory]);
CREATE INDEX [idx_doctors_tier] ON [dbo].[doctors]([tier]);
CREATE INDEX [idx_doctors_status] ON [dbo].[doctors]([status]);

CREATE INDEX [idx_call_planning_doctor_id] ON [dbo].[call_planning]([doctor_id]);
CREATE INDEX [idx_call_planning_rep_id] ON [dbo].[call_planning]([rep_id]);
CREATE INDEX [idx_call_planning_product_id] ON [dbo].[call_planning]([product_id]);
CREATE INDEX [idx_call_planning_planned_date] ON [dbo].[call_planning]([planned_date]);
CREATE INDEX [idx_call_planning_actual_call_date] ON [dbo].[call_planning]([actual_call_date]);
CREATE INDEX [idx_call_planning_call_status] ON [dbo].[call_planning]([call_status]);

CREATE INDEX [idx_secondary_sales_sale_date] ON [dbo].[secondary_sales]([sale_date]);
CREATE INDEX [idx_secondary_sales_product_id] ON [dbo].[secondary_sales]([product_id]);
CREATE INDEX [idx_secondary_sales_pharmacy_id] ON [dbo].[secondary_sales]([pharmacy_id]);
CREATE INDEX [idx_secondary_sales_rep_id] ON [dbo].[secondary_sales]([rep_id]);
CREATE INDEX [idx_secondary_sales_region] ON [dbo].[secondary_sales]([region]);

CREATE INDEX [idx_sales_reps_region] ON [dbo].[sales_reps]([region]);
CREATE INDEX [idx_sales_reps_territory] ON [dbo].[sales_reps]([territory]);

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
