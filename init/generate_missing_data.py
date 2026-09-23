#!/usr/bin/env python3
"""
Manufacturing Data Generator - Missing Tables Only
Generates data for: quality_tests, maintenance_records, inventory_transactions, cost_records
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import pyodbc
import os
from dotenv import load_dotenv

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

def get_dimension_ids(conn):
    """Fetch all dimension IDs from database"""
    cursor = conn.cursor()
    dimensions = {}

    dimensions['plants'] = [row[0] for row in cursor.execute("SELECT plant_id FROM dbo.plants").fetchall()]
    print(f"✓ Found {len(dimensions['plants'])} plants")

    dimensions['lines'] = [row[0] for row in cursor.execute("SELECT line_id FROM dbo.production_lines").fetchall()]
    print(f"✓ Found {len(dimensions['lines'])} production lines")

    dimensions['machines'] = [row[0] for row in cursor.execute("SELECT asset_id FROM dbo.machines").fetchall()]
    print(f"✓ Found {len(dimensions['machines'])} machines")

    dimensions['products'] = [row[0] for row in cursor.execute("SELECT product_id FROM dbo.products").fetchall()]
    print(f"✓ Found {len(dimensions['products'])} products")

    dimensions['suppliers'] = [row[0] for row in cursor.execute("SELECT supplier_id FROM dbo.suppliers").fetchall()]
    print(f"✓ Found {len(dimensions['suppliers'])} suppliers")

    dimensions['materials'] = [row[0] for row in cursor.execute("SELECT material_id FROM dbo.materials").fetchall()]
    print(f"✓ Found {len(dimensions['materials'])} materials")

    dimensions['operators'] = [row[0] for row in cursor.execute("SELECT operator_id FROM dbo.operators").fetchall()]
    print(f"✓ Found {len(dimensions['operators'])} operators")

    cursor.close()
    return dimensions

def generate_production_runs(conn, dimensions):
    """Generate production run records (daily/shift level)"""
    print("\n📊 Generating production run records...")

    start_date = datetime(2024, 9, 1)
    end_date = datetime(2026, 9, 30)
    shifts = ['Morning', 'Evening', 'Night']

    records = []
    current_date = start_date

    cursor = conn.cursor()
    line_map = {}

    # Get machine-to-line mapping
    machine_lines = cursor.execute("SELECT asset_id, line_id FROM dbo.machines").fetchall()
    for machine, line in machine_lines:
        line_map[machine] = line

    # Generate data - one record per shift per line per day
    record_id = 0
    while current_date <= end_date:
        if current_date.weekday() < 5:  # Weekdays only
            cursor.execute(f"SELECT is_planned_shutdown FROM dbo.calendar WHERE date = '{current_date.date()}'")
            result = cursor.fetchone()

            if result is None or result[0] == 0:  # Not a shutdown
                # Generate records for ALL lines and shifts
                for line_id in dimensions['lines']:
                    for shift in shifts:
                        record_id += 1

                        planned_qty = 10000
                        actual_qty = int(np.random.randint(9200, 9800))
                        good_qty = int(actual_qty * 0.97)
                        rejected_qty = actual_qty - good_qty

                        records.append({
                            'date': current_date.date(),
                            'shift': shift,
                            'plant_id': dimensions['plants'][0],
                            'line_id': line_id,
                            'product_id': np.random.choice(dimensions['products']),
                            'operator_id': np.random.choice(dimensions['operators']) if (dimensions['operators'] and len(dimensions['operators']) > 0) else None,
                            'planned_quantity': planned_qty,
                            'actual_quantity': actual_qty,
                            'good_quantity': good_qty,
                            'rejected_quantity': rejected_qty,
                            'cycle_time_minutes': float(round(np.random.uniform(6.0, 7.5), 2)),
                            'runtime_hours': float(round(np.random.uniform(8.0, 8.8), 2)),
                            'planned_production_time_hours': 9,
                            'changeover_time_minutes': int(np.random.randint(35, 50))
                        })

        current_date += timedelta(days=1)

    print(f"  Inserting {len(records)} production run records...")

    for row in records:
        values = (
            convert_numpy_types(row['date']),
            convert_numpy_types(row['shift']),
            convert_numpy_types(row['plant_id']),
            convert_numpy_types(row['line_id']),
            convert_numpy_types(row['product_id']),
            convert_numpy_types(row['operator_id']),
            convert_numpy_types(row['planned_quantity']),
            convert_numpy_types(row['actual_quantity']),
            convert_numpy_types(row['good_quantity']),
            convert_numpy_types(row['rejected_quantity']),
            convert_numpy_types(row['cycle_time_minutes']),
            convert_numpy_types(row['runtime_hours']),
            convert_numpy_types(row['planned_production_time_hours']),
            convert_numpy_types(row['changeover_time_minutes'])
        )
        cursor.execute(f"""
            INSERT INTO dbo.production_runs
            (date, shift, plant_id, line_id, product_id, operator_id, planned_quantity, actual_quantity, good_quantity, rejected_quantity, cycle_time_minutes, runtime_hours, planned_production_time_hours, changeover_time_minutes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, values)

    cursor.close()
    print(f"✓ Inserted {len(records)} production records")
    return len(records)

def generate_quality_tests(conn, dimensions):
    """Generate quality test records for batches"""
    print("\n🧪 Generating quality test records...")

    cursor = conn.cursor()
    records = []

    start_date = datetime(2024, 9, 1)
    end_date = datetime(2026, 9, 30)
    current = start_date

    defect_types = ['Surface Defect', 'Dimension', 'Color', 'Contamination', 'Seal Failure', 'Packaging', 'Weight']
    scrap_reasons = ['Out of Spec', 'Contaminated', 'Damaged', 'Wrong Color', 'Dimensions Off']

    batch_num = 1000

    while current <= end_date:
        if current.weekday() < 5:  # Weekdays only
            for line_id in dimensions['lines']:  # ALL lines for comprehensive coverage
                if np.random.random() < 0.95:  # 95% chance per line per day
                    produced_qty = int(np.random.randint(5000, 15000))

                    pass_rate = np.random.uniform(0.94, 0.99)
                    rejected_qty = int(produced_qty * (1 - pass_rate))
                    rework_qty = int(rejected_qty * np.random.uniform(0.3, 0.7))

                    inspection_result = 'Pass' if rejected_qty == 0 else ('Rework' if rework_qty > 0 else 'Fail')

                    records.append({
                        'batch_id': f'BATCH-{batch_num:06d}',
                        'date': current.date(),
                        'plant_id': dimensions['plants'][0],
                        'line_id': line_id,
                        'product_id': np.random.choice(dimensions['products']),
                        'produced_quantity': produced_qty,
                        'rejected_quantity': rejected_qty,
                        'rework_quantity': rework_qty,
                        'defect_type': np.random.choice(defect_types) if rejected_qty > 0 else None,
                        'inspection_result': inspection_result,
                        'defect_severity': np.random.choice(['Critical', 'Major', 'Minor']) if rejected_qty > 0 else None,
                        'scrap_reason': np.random.choice(scrap_reasons) if rejected_qty - rework_qty > 0 else None
                    })
                    batch_num += 1

        current += timedelta(days=1)

    print(f"  Inserting {len(records)} quality test records...")

    for row in records:
        values = (
            convert_numpy_types(row['batch_id']),
            convert_numpy_types(row['date']),
            convert_numpy_types(row['plant_id']),
            convert_numpy_types(row['line_id']),
            convert_numpy_types(row['product_id']),
            convert_numpy_types(row['produced_quantity']),
            convert_numpy_types(row['rejected_quantity']),
            convert_numpy_types(row['rework_quantity']),
            convert_numpy_types(row['defect_type']),
            convert_numpy_types(row['inspection_result']),
            convert_numpy_types(row['defect_severity']),
            convert_numpy_types(row['scrap_reason'])
        )
        cursor.execute(f"""
            INSERT INTO dbo.quality_tests
            (batch_id, date, plant_id, line_id, product_id, produced_quantity, rejected_quantity, rework_quantity, defect_type, inspection_result, defect_severity, scrap_reason)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, values)

    cursor.close()
    print(f"✓ Inserted {len(records)} quality test records")
    return len(records)

def generate_maintenance_records(conn, dimensions):
    """Generate maintenance work orders"""
    print("\n🔧 Generating maintenance records...")

    records = []
    start_date = datetime(2024, 9, 1)
    end_date = datetime(2026, 9, 30)
    current = start_date

    wo_num = 5000

    maintenance_types = ['Preventive', 'Corrective', 'Emergency']
    spare_parts = [
        'Belt Assembly', 'Motor', 'Bearing', 'Seal Kit', 'Filter',
        'Pump', 'Gasket', 'Valve', 'Sensor', 'Coupling'
    ]

    while current <= end_date:
        if np.random.random() < 0.25:  # 25% chance per day (increased from 15%)
            asset_id = np.random.choice(dimensions['machines'])

            duration_hours = np.random.uniform(1, 8)
            start_time = current.replace(hour=np.random.randint(6, 22))
            end_time = start_time + timedelta(hours=duration_hours)

            maint_type = np.random.choice(maintenance_types)
            cost = np.random.uniform(500, 5000) if maint_type == 'Preventive' else np.random.uniform(2000, 12000)

            if maint_type == 'Preventive':
                planned_start = current + timedelta(days=np.random.randint(7, 30))
                planned_complete = planned_start + timedelta(days=np.random.randint(1, 5))
            else:
                planned_start = None
                planned_complete = None

            records.append({
                'asset_id': asset_id,
                'work_order_id': f'WO-{wo_num:06d}',
                'maintenance_type': maint_type,
                'failure_date': current.date() if maint_type != 'Preventive' else None,
                'repair_start_datetime': start_time,
                'repair_end_datetime': end_time,
                'labor_hours': float(round(duration_hours, 2)),
                'spare_parts_used': ', '.join(np.random.choice(spare_parts, np.random.randint(1, 4), replace=False)),
                'maintenance_cost': float(round(cost, 2)),
                'planned_maintenance_due_date': planned_start,
                'planned_maintenance_completed_date': planned_complete
            })
            wo_num += 1

        current += timedelta(days=1)

    print(f"  Inserting {len(records)} maintenance records...")
    cursor = conn.cursor()

    for row in records:
        values = (
            convert_numpy_types(row['asset_id']),
            convert_numpy_types(row['work_order_id']),
            convert_numpy_types(row['maintenance_type']),
            convert_numpy_types(row['failure_date']),
            convert_numpy_types(row['repair_start_datetime']),
            convert_numpy_types(row['repair_end_datetime']),
            convert_numpy_types(row['labor_hours']),
            convert_numpy_types(row['spare_parts_used']),
            convert_numpy_types(row['maintenance_cost']),
            convert_numpy_types(row['planned_maintenance_due_date']),
            convert_numpy_types(row['planned_maintenance_completed_date'])
        )
        cursor.execute(f"""
            INSERT INTO dbo.maintenance_records
            (asset_id, work_order_id, maintenance_type, failure_date, repair_start_datetime, repair_end_datetime, labor_hours, spare_parts_used, maintenance_cost, planned_maintenance_due_date, planned_maintenance_completed_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, values)

    cursor.close()
    print(f"✓ Inserted {len(records)} maintenance records")
    return len(records)

def generate_inventory_transactions(conn, dimensions):
    """Generate inventory stock movements"""
    print("\n📦 Generating inventory transactions...")

    records = []
    start_date = datetime(2024, 9, 1)
    end_date = datetime(2026, 9, 30)
    current = start_date

    inventory_levels = {mat_id: np.random.randint(10000, 50000) for mat_id in dimensions['materials']}

    while current <= end_date:
        if current.weekday() < 5:
            for material_id in dimensions['materials']:
                if np.random.random() < 0.85:  # 85% chance per material per day (increased from 60%)
                    opening_stock = inventory_levels[material_id]

                    if np.random.random() < 0.7:
                        issued_qty = int(np.random.randint(100, 2000))
                        closing_stock = max(opening_stock - issued_qty, 0)
                        shortages = max(issued_qty - opening_stock, 0) if opening_stock < issued_qty else 0
                        purchase_cost = None
                    else:
                        received_qty = int(np.random.randint(5000, 15000))
                        closing_stock = opening_stock + received_qty
                        issued_qty = 0
                        shortages = 0
                        purchase_cost = float(round(np.random.uniform(5, 50), 2))

                    records.append({
                        'date': current.date(),
                        'plant_id': dimensions['plants'][0],
                        'material_id': material_id,
                        'supplier_id': np.random.choice(dimensions['suppliers']) if purchase_cost else None,
                        'opening_stock_units': opening_stock,
                        'closing_stock_units': closing_stock,
                        'stock_issued_to_production': issued_qty,
                        'shortages_quantity': shortages,
                        'batch_lot_number': f'LOT-{current.strftime("%Y%m%d")}-{np.random.randint(1, 99):02d}',
                        'standard_usage_quantity': float(issued_qty * 1.02) if issued_qty > 0 else 0,
                        'actual_usage_quantity': issued_qty,
                        'purchase_cost_per_unit': purchase_cost,
                        'standard_cost': float(closing_stock * 10) if purchase_cost is None else float(received_qty * purchase_cost)
                    })

                    inventory_levels[material_id] = closing_stock

        current += timedelta(days=1)

    print(f"  Inserting {len(records)} inventory transactions...")
    cursor = conn.cursor()

    for row in records:
        values = (
            convert_numpy_types(row['date']),
            convert_numpy_types(row['plant_id']),
            convert_numpy_types(row['material_id']),
            convert_numpy_types(row['supplier_id']),
            convert_numpy_types(row['opening_stock_units']),
            convert_numpy_types(row['closing_stock_units']),
            convert_numpy_types(row['stock_issued_to_production']),
            convert_numpy_types(row['shortages_quantity']),
            convert_numpy_types(row['batch_lot_number']),
            convert_numpy_types(row['standard_usage_quantity']),
            convert_numpy_types(row['actual_usage_quantity']),
            convert_numpy_types(row['purchase_cost_per_unit']),
            convert_numpy_types(row['standard_cost'])
        )
        cursor.execute(f"""
            INSERT INTO dbo.inventory_transactions
            (date, plant_id, material_id, supplier_id, opening_stock_units, closing_stock_units, stock_issued_to_production, shortages_quantity, batch_lot_number, standard_usage_quantity, actual_usage_quantity, purchase_cost_per_unit, standard_cost)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, values)

    cursor.close()
    print(f"✓ Inserted {len(records)} inventory transactions")
    return len(records)

def generate_cost_records(conn, dimensions):
    """Generate production cost records"""
    print("\n💰 Generating cost records...")

    cursor = conn.cursor()
    records = []

    start_date = datetime(2024, 9, 1)
    end_date = datetime(2026, 9, 30)
    current = start_date

    po_num = 10000

    while current <= end_date:
        if current.weekday() < 5:
            for line_id in dimensions['lines']:  # ALL lines for comprehensive coverage
                if np.random.random() < 0.95:  # 95% chance per line per day
                    units = int(np.random.randint(5000, 12000))
                    labor_cost = float(round(units * np.random.uniform(2, 5), 2))
                    maintenance_cost = float(round(np.random.uniform(500, 3000), 2))
                    scrap_cost = float(round(units * 0.05 * np.random.uniform(1, 15), 2))
                    energy_kwh = float(round(units * np.random.uniform(0.5, 2.5), 2))
                    energy_cost = float(round(energy_kwh * np.random.uniform(0.08, 0.15), 2))

                    standard_cost_per_unit = float(round(np.random.uniform(15, 50), 2))
                    actual_cost_per_unit = float(round(standard_cost_per_unit * np.random.uniform(0.95, 1.08), 2))

                    records.append({
                        'production_order_id': f'PO-{po_num:06d}',
                        'date': current.date(),
                        'plant_id': dimensions['plants'][0],
                        'line_id': line_id,
                        'product_id': np.random.choice(dimensions['products']),
                        'labor_cost': labor_cost,
                        'maintenance_cost': maintenance_cost,
                        'scrap_cost': scrap_cost,
                        'energy_kwh': energy_kwh,
                        'energy_cost': energy_cost,
                        'standard_cost_per_unit': standard_cost_per_unit,
                        'actual_cost_per_unit': actual_cost_per_unit,
                        'units_produced': units
                    })
                    po_num += 1

        current += timedelta(days=1)

    print(f"  Inserting {len(records)} cost records...")
    cursor = conn.cursor()

    for row in records:
        values = (
            convert_numpy_types(row['production_order_id']),
            convert_numpy_types(row['date']),
            convert_numpy_types(row['plant_id']),
            convert_numpy_types(row['line_id']),
            convert_numpy_types(row['product_id']),
            convert_numpy_types(row['labor_cost']),
            convert_numpy_types(row['maintenance_cost']),
            convert_numpy_types(row['scrap_cost']),
            convert_numpy_types(row['energy_kwh']),
            convert_numpy_types(row['energy_cost']),
            convert_numpy_types(row['standard_cost_per_unit']),
            convert_numpy_types(row['actual_cost_per_unit']),
            convert_numpy_types(row['units_produced'])
        )
        cursor.execute(f"""
            INSERT INTO dbo.cost_records
            (production_order_id, date, plant_id, line_id, product_id, labor_cost, maintenance_cost, scrap_cost, energy_kwh, energy_cost, standard_cost_per_unit, actual_cost_per_unit, units_produced)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, values)

    cursor.close()
    print(f"✓ Inserted {len(records)} cost records")
    return len(records)

def main():
    """Main execution"""
    print("=" * 60)
    print("Manufacturing Data Generator - Missing Tables Only")
    print("=" * 60)

    conn = connect_db()
    if not conn:
        return

    try:
        print("\n📂 Fetching dimensions...")
        dimensions = get_dimension_ids(conn)

        prod_count = generate_production_runs(conn, dimensions)
        quality_count = generate_quality_tests(conn, dimensions)
        maintenance_count = generate_maintenance_records(conn, dimensions)
        inventory_count = generate_inventory_transactions(conn, dimensions)
        cost_count = generate_cost_records(conn, dimensions)

        print("\n" + "=" * 60)
        print("✓ Missing Data Generation Complete!")
        print("=" * 60)
        print(f"Production Runs:       {prod_count:,}")
        print(f"Quality Tests:         {quality_count:,}")
        print(f"Maintenance Records:   {maintenance_count:,}")
        print(f"Inventory Transactions: {inventory_count:,}")
        print(f"Cost Records:          {cost_count:,}")
        print(f"\nTotal Records Added:   {prod_count + quality_count + maintenance_count + inventory_count + cost_count:,}")
        print("=" * 60)

    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == '__main__':
    main()
