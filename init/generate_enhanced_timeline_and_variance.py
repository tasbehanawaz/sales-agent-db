#!/usr/bin/env python3
"""
Manufacturing Data Generator - Enhanced Timeline & Variance
Generates 4-year historical data (Sept 2022 - Sept 2026) with realistic variance across:
- All plants with distinct operational profiles
- Seasonal demand patterns (Q1/Q4 peak, summer low)
- Product-specific characteristics
- Shift performance variations
- Year-over-year efficiency improvements
- Regional and maturity-based differences
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

def create_plant_profiles(conn, dimensions):
    """Create plant profiles with operational characteristics"""
    cursor = conn.cursor()

    # Map plants to their characteristics
    plant_profiles = {}

    for plant_id in dimensions['plants']:
        cursor.execute("SELECT plant_name, location, region FROM dbo.plants WHERE plant_id = ?", (plant_id,))
        result = cursor.fetchone()
        if result:
            plant_name, location, region = result

            # Assign characteristics based on plant metadata
            region_factor = {
                'North America': 0.95,
                'Europe': 1.0,
                'Asia-Pacific': 1.05,
                'Latin America': 0.90,
                'Middle East': 0.92,
                None: 1.0
            }.get(region, 1.0)

            # Plants with longer names (additional plants) are newer, less efficient
            is_newer = len(plant_name) > 25
            maturity_factor = 0.85 if is_newer else 1.0

            plant_profiles[plant_id] = {
                'name': plant_name,
                'location': location,
                'region': region,
                'efficiency_base': region_factor * maturity_factor,
                'is_newer_plant': is_newer,
                'startup_year': 2022 if is_newer else 2020,
                'quality_target': np.random.uniform(0.96, 0.99) if not is_newer else np.random.uniform(0.93, 0.97)
            }

    cursor.close()
    print(f"✓ Created profiles for {len(plant_profiles)} plants")
    return plant_profiles

def get_seasonal_multiplier(month):
    """Get production multiplier based on season"""
    # Q1 and Q4 are peak demand
    # Summer (June-Aug) is lower demand
    seasonal_map = {
        1: 1.15,  # Jan - post-holiday peak
        2: 1.10,  # Feb
        3: 1.08,  # Mar
        4: 0.95,  # Apr - spring slump
        5: 0.92,  # May - pre-summer
        6: 0.90,  # Jun - summer low
        7: 0.88,  # Jul - summer low
        8: 0.90,  # Aug - late summer
        9: 0.95,  # Sep - back to work
        10: 1.12, # Oct - pre-holiday peak
        11: 1.18, # Nov - holiday peak
        12: 1.15  # Dec - year-end push
    }
    return seasonal_map.get(month, 1.0)

def get_shift_multiplier(shift):
    """Get productivity multiplier by shift"""
    shift_map = {
        'Morning': 1.05,   # Most productive
        'Evening': 1.00,   # Normal
        'Night': 0.90      # Less productive
    }
    return shift_map.get(shift, 1.0)

def get_year_efficiency_improvement(year):
    """Get efficiency improvement factor over years"""
    # Slight efficiency gains each year due to learning, optimization
    base_year = 2022
    years_elapsed = year - base_year
    return 1.0 + (years_elapsed * 0.02)  # 2% improvement per year

def generate_production_runs_enhanced(conn, dimensions, plant_profiles):
    """Generate 4-year production runs with realistic variance"""
    print("\n📊 Generating 4-year production runs with variance...")

    start_date = datetime(2022, 9, 1)
    end_date = datetime(2026, 9, 30)
    shifts = ['Morning', 'Evening', 'Night']

    records = []
    current_date = start_date
    cursor = conn.cursor()

    # Get machine-to-line mapping
    machine_lines = cursor.execute("SELECT asset_id, line_id FROM dbo.machines").fetchall()
    line_map = {machine: line for machine, line in machine_lines}

    # Get plant-to-lines mapping
    plant_lines = {}
    for plant_id in dimensions['plants']:
        cursor.execute("SELECT line_id FROM dbo.production_lines WHERE plant_id = ?", (plant_id,))
        plant_lines[plant_id] = [row[0] for row in cursor.fetchall()]

    # Assign products to plants (some variation)
    plant_product_prefs = {}
    for plant_id in dimensions['plants']:
        # Each plant focuses on 3-4 products
        num_products = np.random.randint(3, 5)
        plant_product_prefs[plant_id] = list(np.random.choice(dimensions['products'], num_products, replace=False))

    record_count = 0
    while current_date <= end_date:
        if current_date.weekday() < 5:  # Weekdays only
            cursor.execute(f"SELECT is_planned_shutdown FROM dbo.calendar WHERE date = '{current_date.date()}'")
            result = cursor.fetchone()

            if result is None or result[0] == 0:  # Not a shutdown
                # Generate for ALL plants and their lines
                for plant_id in dimensions['plants']:
                    plant_profile = plant_profiles[plant_id]

                    for line_id in plant_lines.get(plant_id, []):
                        for shift in shifts:
                            record_count += 1

                            # Calculate base values with variance
                            seasonal_mult = get_seasonal_multiplier(current_date.month)
                            shift_mult = get_shift_multiplier(shift)
                            efficiency_mult = get_year_efficiency_improvement(current_date.year)
                            plant_efficiency = plant_profile['efficiency_base'] * efficiency_mult

                            # Base planned quantity (varies by plant and season)
                            planned_qty = int(10000 * seasonal_mult * plant_efficiency)

                            # Add random daily variation
                            planned_qty = int(planned_qty * np.random.uniform(0.95, 1.05))

                            # Actual quantity produced (80-98% of planned, with shift variation)
                            production_rate = (0.85 + (shift_mult - 0.90) * 0.15) * np.random.uniform(0.95, 1.0)
                            actual_qty = int(planned_qty * production_rate)

                            # Quality varies by plant and product
                            quality_rate = plant_profile['quality_target'] * np.random.uniform(0.98, 1.01)
                            quality_rate = min(quality_rate, 0.99)  # Cap at 99%
                            good_qty = int(actual_qty * quality_rate)
                            rejected_qty = actual_qty - good_qty

                            # Cycle time varies by shift and plant
                            cycle_time_base = 7.0 / (shift_mult * plant_efficiency)
                            cycle_time = float(round(np.random.uniform(cycle_time_base * 0.95, cycle_time_base * 1.05), 2))

                            # Runtime hours
                            runtime_hrs = float(round(np.random.uniform(7.5, 8.8), 2))
                            changeover_time = int(np.random.randint(30, 60))

                            # Choose product from plant's preferred products
                            product_id = np.random.choice(plant_product_prefs.get(plant_id, dimensions['products']))

                            # Assign operator if available
                            operator_id = None
                            if dimensions['operators']:
                                # Prefer operators from same plant if possible
                                cursor.execute("SELECT TOP 1 operator_id FROM dbo.operators WHERE plant_id = ?", (plant_id,))
                                op_result = cursor.fetchone()
                                operator_id = op_result[0] if op_result else np.random.choice(dimensions['operators'])

                            records.append({
                                'date': current_date.date(),
                                'shift': shift,
                                'plant_id': plant_id,
                                'line_id': line_id,
                                'product_id': product_id,
                                'operator_id': operator_id,
                                'planned_quantity': planned_qty,
                                'actual_quantity': actual_qty,
                                'good_quantity': good_qty,
                                'rejected_quantity': rejected_qty,
                                'cycle_time_minutes': cycle_time,
                                'runtime_hours': runtime_hrs,
                                'planned_production_time_hours': 9,
                                'changeover_time_minutes': changeover_time
                            })

        current_date += timedelta(days=1)

    # Bulk insert
    print(f"  Inserting {len(records)} production run records...")
    cursor = conn.cursor()

    for row in records:
        values = tuple(convert_numpy_types(v) for v in row.values())
        cursor.execute(f"""
            INSERT INTO dbo.production_runs
            (date, shift, plant_id, line_id, product_id, operator_id, planned_quantity, actual_quantity, good_quantity, rejected_quantity, cycle_time_minutes, runtime_hours, planned_production_time_hours, changeover_time_minutes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, values)

    cursor.close()
    print(f"✓ Inserted {len(records)} production records across all plants and 4-year timeline")
    return len(records)

def generate_quality_tests_enhanced(conn, dimensions, plant_profiles):
    """Generate quality tests with plant-specific variance"""
    print("\n🧪 Generating quality tests with plant-based variance...")

    cursor = conn.cursor()
    records = []

    start_date = datetime(2022, 9, 1)
    end_date = datetime(2026, 9, 30)
    current = start_date

    defect_types = ['Surface Defect', 'Dimension', 'Color', 'Contamination', 'Seal Failure', 'Packaging', 'Weight']
    scrap_reasons = ['Out of Spec', 'Contaminated', 'Damaged', 'Wrong Color', 'Dimensions Off']

    batch_num = 1000

    # Get plant-to-lines mapping
    plant_lines = {}
    for plant_id in dimensions['plants']:
        cursor.execute("SELECT line_id FROM dbo.production_lines WHERE plant_id = ?", (plant_id,))
        plant_lines[plant_id] = [row[0] for row in cursor.fetchall()]

    while current <= end_date:
        if current.weekday() < 5:
            for plant_id in dimensions['plants']:
                plant_profile = plant_profiles[plant_id]

                for line_id in plant_lines.get(plant_id, []):
                    if np.random.random() < 0.95:
                        produced_qty = int(np.random.randint(5000, 15000) * plant_profile['efficiency_base'])

                        # Quality varies by plant
                        pass_rate = plant_profile['quality_target'] * np.random.uniform(0.98, 1.01)
                        rejected_qty = int(produced_qty * (1 - pass_rate))
                        rework_qty = int(rejected_qty * np.random.uniform(0.3, 0.7))

                        inspection_result = 'Pass' if rejected_qty == 0 else ('Rework' if rework_qty > 0 else 'Fail')

                        records.append({
                            'batch_id': f'BATCH-{batch_num:06d}',
                            'date': current.date(),
                            'plant_id': plant_id,
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
    cursor = conn.cursor()

    for row in records:
        values = tuple(convert_numpy_types(v) for v in row.values())
        cursor.execute(f"""
            INSERT INTO dbo.quality_tests
            (batch_id, date, plant_id, line_id, product_id, produced_quantity, rejected_quantity, rework_quantity, defect_type, inspection_result, defect_severity, scrap_reason)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, values)

    cursor.close()
    print(f"✓ Inserted {len(records)} quality test records")
    return len(records)

def generate_maintenance_enhanced(conn, dimensions, plant_profiles):
    """Generate maintenance records with plant-based variance"""
    print("\n🔧 Generating maintenance records with plant-based variance...")

    records = []
    start_date = datetime(2022, 9, 1)
    end_date = datetime(2026, 9, 30)
    current = start_date

    wo_num = 5000
    maintenance_types = ['Preventive', 'Corrective', 'Emergency']
    spare_parts = [
        'Belt Assembly', 'Motor', 'Bearing', 'Seal Kit', 'Filter',
        'Pump', 'Gasket', 'Valve', 'Sensor', 'Coupling'
    ]

    cursor = conn.cursor()

    # Get plant to machines mapping
    plant_machines = {}
    for plant_id in dimensions['plants']:
        cursor.execute("""
            SELECT m.asset_id FROM dbo.machines m
            JOIN dbo.production_lines pl ON m.line_id = pl.line_id
            WHERE pl.plant_id = ?
        """, (plant_id,))
        plant_machines[plant_id] = [row[0] for row in cursor.fetchall()]

    while current <= end_date:
        # Newer plants need more maintenance
        for plant_id in dimensions['plants']:
            plant_profile = plant_profiles[plant_id]
            maintenance_frequency = 0.30 if plant_profile['is_newer_plant'] else 0.20

            if np.random.random() < maintenance_frequency:
                machines = plant_machines.get(plant_id, dimensions['machines'])
                if not machines:
                    continue

                asset_id = np.random.choice(machines)
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
        values = tuple(convert_numpy_types(v) for v in row.values())
        cursor.execute(f"""
            INSERT INTO dbo.maintenance_records
            (asset_id, work_order_id, maintenance_type, failure_date, repair_start_datetime, repair_end_datetime, labor_hours, spare_parts_used, maintenance_cost, planned_maintenance_due_date, planned_maintenance_completed_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, values)

    cursor.close()
    print(f"✓ Inserted {len(records)} maintenance records")
    return len(records)

def generate_downtime_enhanced(conn, dimensions, plant_profiles):
    """Generate downtime events with plant-based variance"""
    print("\n⚙️  Generating downtime events with plant-based variance...")

    cursor = conn.cursor()
    records = []

    start_date = datetime(2022, 9, 1)
    end_date = datetime(2026, 9, 30)
    current = start_date

    categories = ['Breakdown', 'Changeover', 'Material', 'Quality']
    failure_modes = ['Belt Slippage', 'Clog', 'Misalignment', 'Sensor Error', 'Pressure Issue',
                     'Electrical Failure', 'Hydraulic Leak', 'Temperature Alarm', 'Vibration Alert']
    reason_codes = ['MECH-001', 'MECH-002', 'MECH-003', 'ELEC-001', 'ELEC-002', 'MAT-001', 'MAT-002', 'QC-001']

    # Get plant to machines mapping
    plant_machines = {}
    for plant_id in dimensions['plants']:
        cursor.execute("""
            SELECT m.asset_id FROM dbo.machines m
            JOIN dbo.production_lines pl ON m.line_id = pl.line_id
            WHERE pl.plant_id = ?
        """, (plant_id,))
        plant_machines[plant_id] = [row[0] for row in cursor.fetchall()]

    # Get plant to lines mapping
    plant_lines = {}
    for plant_id in dimensions['plants']:
        cursor.execute("SELECT line_id FROM dbo.production_lines WHERE plant_id = ?", (plant_id,))
        plant_lines[plant_id] = [row[0] for row in cursor.fetchall()]

    while current <= end_date:
        for plant_id in dimensions['plants']:
            plant_profile = plant_profiles[plant_id]
            # Newer plants have higher downtime frequency
            downtime_frequency = 0.15 if plant_profile['is_newer_plant'] else 0.10

            if np.random.random() < downtime_frequency:
                if current.weekday() < 5:
                    duration = int(np.random.randint(30, 180))
                    category = np.random.choice(categories)

                    machines = plant_machines.get(plant_id, dimensions['machines'])
                    lines = plant_lines.get(plant_id, dimensions['lines'])

                    if not machines or not lines:
                        continue

                    records.append({
                        'event_start_datetime': current,
                        'event_end_datetime': current + timedelta(minutes=duration),
                        'duration_minutes': duration,
                        'plant_id': plant_id,
                        'line_id': np.random.choice(lines),
                        'asset_id': np.random.choice(machines),
                        'planned_vs_unplanned': np.random.choice(['Planned', 'Unplanned']),
                        'reason_code': np.random.choice(reason_codes),
                        'failure_mode': np.random.choice(failure_modes),
                        'category': category,
                        'comments': f'{category} event on {current.date()}'
                    })

        current += timedelta(days=1)

    print(f"  Inserting {len(records)} downtime event records...")
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
    print(f"✓ Inserted {len(records)} downtime events")
    return len(records)

def main():
    """Main execution"""
    print("=" * 70)
    print("Manufacturing Data Generator - Enhanced Timeline & Variance")
    print("=" * 70)

    conn = connect_db()
    if not conn:
        return

    try:
        # Fetch dimensions
        print("\n📂 Fetching dimensions...")
        dimensions = get_dimension_ids(conn)

        # Create plant profiles with operational characteristics
        print("\n🏭 Creating plant operational profiles...")
        plant_profiles = create_plant_profiles(conn, dimensions)

        # Generate 4-year data with variance
        prod_count = generate_production_runs_enhanced(conn, dimensions, plant_profiles)
        quality_count = generate_quality_tests_enhanced(conn, dimensions, plant_profiles)
        maintenance_count = generate_maintenance_enhanced(conn, dimensions, plant_profiles)
        downtime_count = generate_downtime_enhanced(conn, dimensions, plant_profiles)

        # Summary
        print("\n" + "=" * 70)
        print("✓ Enhanced Data Generation Complete!")
        print("=" * 70)
        print(f"Production Runs (4-year):       {prod_count:,}")
        print(f"Quality Tests:                  {quality_count:,}")
        print(f"Maintenance Records:            {maintenance_count:,}")
        print(f"Downtime Events:                {downtime_count:,}")
        print(f"\nTotal Records Added:            {prod_count + quality_count + maintenance_count + downtime_count:,}")
        print("\n✨ Key Improvements:")
        print("   • 4-year timeline (Sept 2022 - Sept 2026) for YoY analysis")
        print("   • All plants populated with production data")
        print("   • Seasonal demand patterns (Q1/Q4 peak, summer low)")
        print("   • Plant-specific efficiency profiles")
        print("   • Shift-based performance variations")
        print("   • Year-over-year efficiency improvements")
        print("   • Product-specific characteristics per plant")
        print("   • Regional variations in plant performance")
        print("=" * 70)

    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        conn.close()

if __name__ == '__main__':
    main()
