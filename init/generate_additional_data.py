#!/usr/bin/env python3
"""
Manufacturing Data Generator - Additional Data for Dimensions & Audit Logs
Generates more data for: plants, operators, materials, downtime_events, audit_logs
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import pyodbc
import os
from dotenv import load_dotenv
import uuid

# Load environment variables
load_dotenv()

# Database connection
DB_HOST = os.getenv('DB_HOST', '34.88.207.18')
DB_PORT = int(os.getenv('DB_PORT', '1433'))
DB_NAME = os.getenv('DB_NAME_MFG', 'manufacturing_agent_demo')
DB_USER = os.getenv('DB_USER', 'sales@dmin')
DB_PASSWORD = os.getenv('DB_PASSWORD')

# Connection string
conn_str = (
    f'Driver={{ODBC Driver 18 for SQL Server}};'
    f'Server={DB_HOST},{DB_PORT};'
    f'Database={DB_NAME};'
    f'UID={DB_USER};'
    f'PWD={DB_PASSWORD};'
    f'Encrypt=yes;'
    f'TrustServerCertificate=yes;'
)

def convert_numpy_types(value):
    """Convert numpy types to Python native types for SQL compatibility"""
    if hasattr(value, 'item'):
        return value.item()
    return value

def connect_db():
    """Create database connection"""
    try:
        conn = pyodbc.connect(conn_str, autocommit=True)
        print(f"✓ Connected to {DB_NAME}")
        return conn
    except Exception as e:
        print(f"✗ Connection error: {e}")
        return None

def generate_additional_plants(conn):
    """Generate additional plant records"""
    print("\n🏭 Generating additional plant records...")

    cursor = conn.cursor()
    records = []

    regions = ['North America', 'Europe', 'Asia-Pacific', 'Latin America', 'Middle East']
    plant_prefixes = ['Berlin', 'Shanghai', 'Toronto', 'Singapore', 'Mexico City', 'Dubai', 'Tokyo', 'São Paulo']

    for i, plant_name in enumerate(plant_prefixes):
        records.append({
            'plant_name': f'{plant_name} Manufacturing',
            'area': f'Area-{i+1}',
            'location': plant_name,
            'region': np.random.choice(regions)
        })

    print(f"  Inserting {len(records)} additional plant records...")

    for row in records:
        plant_id = str(uuid.uuid4())
        values = (
            plant_id,
            convert_numpy_types(row['plant_name']),
            convert_numpy_types(row['area']),
            convert_numpy_types(row['location']),
            convert_numpy_types(row['region'])
        )
        cursor.execute(f"""
            INSERT INTO dbo.plants
            (plant_id, plant_name, area, location, region)
            VALUES (?, ?, ?, ?, ?)
        """, values)

    cursor.close()
    print(f"✓ Inserted {len(records)} additional plants")
    return len(records)

def generate_additional_operators(conn):
    """Generate additional operator records"""
    print("\n👥 Generating additional operator records...")

    cursor = conn.cursor()

    # Get all plants
    cursor.execute("SELECT plant_id FROM dbo.plants")
    plants = [row[0] for row in cursor.fetchall()]
    print(f"   Found {len(plants)} plants for operator assignment")

    records = []
    first_names = ['John', 'Maria', 'Ahmed', 'Yuki', 'Carlos', 'Anna', 'David', 'Priya', 'Michel', 'Lisa',
                   'Robert', 'Sophie', 'Raj', 'Elena', 'Miguel', 'Olivia', 'Kwame', 'Isabella']
    last_names = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
                  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson']
    shifts = ['Morning', 'Evening', 'Night']
    certifications = ['Level 1', 'Level 2', 'Level 3', 'Supervisor', 'Lead']

    # Generate 80-100 operators for comprehensive plant coverage
    for i in range(95):
        plant_id = np.random.choice(plants)

        records.append({
            'name': f"{np.random.choice(first_names)} {np.random.choice(last_names)}",
            'plant_id': plant_id,
            'shift': np.random.choice(shifts),
            'certification_level': np.random.choice(certifications),
            'experience_years': int(np.random.randint(1, 25))
        })

    print(f"  Inserting {len(records)} additional operator records...")

    for row in records:
        operator_id = str(uuid.uuid4())
        values = (
            operator_id,
            convert_numpy_types(row['name']),
            convert_numpy_types(row['plant_id']),
            convert_numpy_types(row['shift']),
            convert_numpy_types(row['certification_level']),
            convert_numpy_types(row['experience_years'])
        )
        cursor.execute(f"""
            INSERT INTO dbo.operators
            (operator_id, name, plant_id, shift, certification_level, experience_years)
            VALUES (?, ?, ?, ?, ?, ?)
        """, values)

    cursor.close()
    print(f"✓ Inserted {len(records)} additional operators")
    return len(records)

def generate_additional_materials(conn):
    """Generate additional material records"""
    print("\n📦 Generating additional material records...")

    cursor = conn.cursor()

    # Get all suppliers
    cursor.execute("SELECT supplier_id FROM dbo.suppliers")
    suppliers = [row[0] for row in cursor.fetchall()]
    print(f"   Found {len(suppliers)} suppliers for material assignment")

    records = []
    material_types = [
        'Steel Sheet', 'Aluminum Alloy', 'Plastic Pellets', 'Rubber Compound', 'Glass Panel',
        'Copper Wire', 'Brass Fitting', 'Silicone Sealant', 'Foam Padding', 'Fabric Roll',
        'PVC Tubing', 'Stainless Steel Bar', 'Carbon Fiber', 'Ceramic Tile', 'Cork Sheet',
        'Acetone', 'Epoxy Resin', 'Polyurethane', 'Fiberglass Mat', 'Lubricating Oil'
    ]

    # Generate 60-80 materials for comprehensive supplier coverage
    for i in range(70):
        records.append({
            'material_name': f"{np.random.choice(material_types)} (Grade-{i+1})",
            'supplier_id': np.random.choice(suppliers)
        })

    print(f"  Inserting {len(records)} additional material records...")

    for row in records:
        material_id = str(uuid.uuid4())
        values = (
            material_id,
            convert_numpy_types(row['material_name']),
            convert_numpy_types(row['supplier_id'])
        )
        cursor.execute(f"""
            INSERT INTO dbo.materials
            (material_id, material_name, supplier_id)
            VALUES (?, ?, ?)
        """, values)

    cursor.close()
    print(f"✓ Inserted {len(records)} additional materials")
    return len(records)

def generate_additional_downtime_events(conn):
    """Generate additional downtime events beyond what's already there"""
    print("\n⚙️  Generating additional downtime event records...")

    cursor = conn.cursor()

    # Get dimensions
    cursor.execute("SELECT plant_id FROM dbo.plants")
    plants = [row[0] for row in cursor.fetchall()]

    cursor.execute("SELECT line_id FROM dbo.production_lines")
    lines = [row[0] for row in cursor.fetchall()]

    cursor.execute("SELECT asset_id FROM dbo.machines")
    machines = [row[0] for row in cursor.fetchall()]

    print(f"   Found {len(plants)} plants, {len(lines)} lines, {len(machines)} machines")

    records = []
    start_date = datetime(2024, 9, 1)
    end_date = datetime(2026, 9, 30)
    current = start_date

    categories = ['Breakdown', 'Changeover', 'Material', 'Quality']
    failure_modes = ['Belt Slippage', 'Clog', 'Misalignment', 'Sensor Error', 'Pressure Issue',
                     'Electrical Failure', 'Hydraulic Leak', 'Temperature Alarm', 'Vibration Alert']
    reason_codes = ['MECH-001', 'MECH-002', 'MECH-003', 'ELEC-001', 'ELEC-002', 'MAT-001', 'MAT-002', 'QC-001']

    # Generate more frequent downtime events (20% chance per day for comprehensive 2-year coverage)
    while current <= end_date:
        if np.random.random() < 0.20:  # 20% chance per day (increased from 10%)
            if current.weekday() < 5:
                duration = int(np.random.randint(30, 180))
                category = np.random.choice(categories)

                records.append({
                    'event_start_datetime': current,
                    'event_end_datetime': current + timedelta(minutes=duration),
                    'duration_minutes': duration,
                    'plant_id': str(np.random.choice(plants)),
                    'line_id': str(np.random.choice(lines)),
                    'asset_id': str(np.random.choice(machines)),
                    'planned_vs_unplanned': str(np.random.choice(['Planned', 'Unplanned'])),
                    'reason_code': str(np.random.choice(reason_codes)),
                    'failure_mode': str(np.random.choice(failure_modes)),
                    'category': str(category),
                    'comments': f'{category} event on {current.date()}'
                })

        current += timedelta(days=1)

    print(f"  Inserting {len(records)} additional downtime event records...")
    cursor = conn.cursor()

    for row in records:
        downtime_id = str(uuid.uuid4())
        values = (
            downtime_id,
            convert_numpy_types(row['event_start_datetime']),
            convert_numpy_types(row['event_end_datetime']),
            convert_numpy_types(row['duration_minutes']),
            convert_numpy_types(row['plant_id']),
            convert_numpy_types(row['line_id']),
            convert_numpy_types(row['asset_id']),
            convert_numpy_types(row['planned_vs_unplanned']),
            convert_numpy_types(row['reason_code']),
            convert_numpy_types(row['failure_mode']),
            convert_numpy_types(row['category']),
            convert_numpy_types(row['comments'])
        )
        cursor.execute(f"""
            INSERT INTO dbo.downtime_events
            (downtime_id, event_start_datetime, event_end_datetime, duration_minutes, plant_id, line_id, asset_id, planned_vs_unplanned, reason_code, failure_mode, category, comments)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, values)

    cursor.close()
    print(f"✓ Inserted {len(records)} additional downtime events")
    return len(records)

def generate_audit_logs(conn):
    """Generate audit log entries for all table operations"""
    print("\n📋 Generating audit log records...")

    cursor = conn.cursor()
    records = []

    start_date = datetime(2024, 9, 1)
    end_date = datetime(2026, 9, 30)

    operations = ['INSERT', 'UPDATE', 'DELETE']
    tables = ['plants', 'production_lines', 'machines', 'products', 'operators', 'suppliers', 'materials',
              'production_runs', 'downtime_events', 'quality_tests', 'maintenance_records',
              'inventory_transactions', 'cost_records']
    users = ['system', 'admin', 'operator', 'scheduler', 'batch_job', 'data_loader']

    # Generate 5000+ audit log entries spread across the entire 2-year timeline
    current = start_date
    while current <= end_date:
        if np.random.random() < 0.5:  # 50% chance per day (increased from 30%)
            for _ in range(np.random.randint(5, 15)):  # 5-15 operations per day (increased from 2-8)
                records.append({
                    'table_name': np.random.choice(tables),
                    'operation': np.random.choice(operations),
                    'record_id': str(uuid.uuid4()),
                    'changed_at': current + timedelta(hours=np.random.randint(0, 24),
                                                     minutes=np.random.randint(0, 60)),
                    'changed_by': np.random.choice(users)
                })

        current += timedelta(days=1)

    print(f"  Inserting {len(records)} audit log records...")
    cursor = conn.cursor()

    for row in records:
        audit_id = str(uuid.uuid4())
        values = (
            audit_id,
            convert_numpy_types(row['table_name']),
            convert_numpy_types(row['operation']),
            convert_numpy_types(row['record_id']),
            convert_numpy_types(row['changed_at']),
            convert_numpy_types(row['changed_by'])
        )
        cursor.execute(f"""
            INSERT INTO dbo.audit_log
            (id, table_name, operation, record_id, changed_at, changed_by)
            VALUES (?, ?, ?, ?, ?, ?)
        """, values)

    cursor.close()
    print(f"✓ Inserted {len(records)} audit log records")
    return len(records)

def main():
    """Main execution"""
    print("=" * 60)
    print("Manufacturing Data Generator - Additional Dimensions & Logs")
    print("=" * 60)

    conn = connect_db()
    if not conn:
        return

    try:
        plants_count = generate_additional_plants(conn)
        operators_count = generate_additional_operators(conn)
        materials_count = generate_additional_materials(conn)
        downtime_count = generate_additional_downtime_events(conn)
        audit_count = generate_audit_logs(conn)

        print("\n" + "=" * 60)
        print("✓ Additional Data Generation Complete!")
        print("=" * 60)
        print(f"Additional Plants:     {plants_count:,}")
        print(f"Additional Operators:  {operators_count:,}")
        print(f"Additional Materials:  {materials_count:,}")
        print(f"Additional Downtime:   {downtime_count:,}")
        print(f"Audit Log Entries:     {audit_count:,}")
        print(f"\nTotal Records Added:   {plants_count + operators_count + materials_count + downtime_count + audit_count:,}")
        print("=" * 60)

    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == '__main__':
    main()
