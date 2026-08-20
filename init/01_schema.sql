-- Sales Agent Database Schema
-- Doctors, Call Planning, and Secondary Sales data model

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============= DIMENSION TABLES =============

CREATE TABLE sales_reps (
  rep_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  territory VARCHAR(255),
  region VARCHAR(100) NOT NULL,
  manager_id UUID REFERENCES sales_reps(rep_id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
  product_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku VARCHAR(50) NOT NULL UNIQUE,
  brand VARCHAR(255) NOT NULL,
  therapy_area VARCHAR(255),
  launch_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE pharmacies (
  pharmacy_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  region VARCHAR(100),
  channel VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============= FACT TABLES =============

CREATE TABLE doctors (
  doctor_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_name VARCHAR(255) NOT NULL,
  specialty VARCHAR(100),
  tier CHAR(1) CHECK (tier IN ('A', 'B', 'C')),
  hospital_clinic VARCHAR(255),
  region VARCHAR(100) NOT NULL,
  territory VARCHAR(255),
  city VARCHAR(100),
  market VARCHAR(100),
  onboarded_date DATE,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE call_planning (
  call_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  doctor_id UUID NOT NULL REFERENCES doctors(doctor_id) ON DELETE CASCADE,
  rep_id UUID NOT NULL REFERENCES sales_reps(rep_id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  planned_date DATE NOT NULL,
  actual_call_date DATE,
  call_type VARCHAR(50),
  frequency_target INT,
  call_status VARCHAR(50) DEFAULT 'planned',
  feedback_score INT CHECK (feedback_score >= 0 AND feedback_score <= 10),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE secondary_sales (
  sale_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_date DATE NOT NULL,
  product_id UUID NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(pharmacy_id) ON DELETE CASCADE,
  rep_id UUID NOT NULL REFERENCES sales_reps(rep_id) ON DELETE CASCADE,
  region VARCHAR(100) NOT NULL,
  quantity_sold INT,
  value_sold DECIMAL(15, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============= INDEXES =============

CREATE INDEX idx_doctors_region ON doctors(region);
CREATE INDEX idx_doctors_territory ON doctors(territory);
CREATE INDEX idx_doctors_tier ON doctors(tier);
CREATE INDEX idx_doctors_status ON doctors(status);

CREATE INDEX idx_call_planning_doctor_id ON call_planning(doctor_id);
CREATE INDEX idx_call_planning_rep_id ON call_planning(rep_id);
CREATE INDEX idx_call_planning_product_id ON call_planning(product_id);
CREATE INDEX idx_call_planning_planned_date ON call_planning(planned_date);
CREATE INDEX idx_call_planning_actual_call_date ON call_planning(actual_call_date);
CREATE INDEX idx_call_planning_call_status ON call_planning(call_status);

CREATE INDEX idx_secondary_sales_sale_date ON secondary_sales(sale_date);
CREATE INDEX idx_secondary_sales_product_id ON secondary_sales(product_id);
CREATE INDEX idx_secondary_sales_pharmacy_id ON secondary_sales(pharmacy_id);
CREATE INDEX idx_secondary_sales_rep_id ON secondary_sales(rep_id);
CREATE INDEX idx_secondary_sales_region ON secondary_sales(region);

CREATE INDEX idx_sales_reps_region ON sales_reps(region);
CREATE INDEX idx_sales_reps_territory ON sales_reps(territory);

-- ============= AUDIT TRAIL =============

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name VARCHAR(255),
  operation VARCHAR(10),
  record_id UUID,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  changed_by VARCHAR(255)
);

CREATE INDEX idx_audit_log_table_name ON audit_log(table_name);
CREATE INDEX idx_audit_log_changed_at ON audit_log(changed_at);
