#!/usr/bin/env python3
"""
Manufacturing Data Seed Generator
Generates 18-24 months of realistic manufacturing data with 7 embedded business stories
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
DB_NAME = 'manufacturing_agent_demo'
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
    if hasattr(value, 'item'):  # numpy scalar
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

    # Get plants
    dimensions['plants'] = [row[0] for row in cursor.execute("SELECT plant_id FROM dbo.plants").fetchall()]
    print(f"✓ Found {len(dimensions['plants'])} plants")

    # Get lines
    dimensions['lines'] = [row[0] for row in cursor.execute("SELECT line_id FROM dbo.production_lines").fetchall()]
    print(f"✓ Found {len(dimensions['lines'])} production lines")

    # Get machines
    dimensions['machines'] = [row[0] for row in cursor.execute("SELECT asset_id FROM dbo.machines").fetchall()]
    print(f"✓ Found {len(dimensions['machines'])} machines")

    # Get products
    dimensions['products'] = [row[0] for row in cursor.execute("SELECT product_id FROM dbo.products").fetchall()]
    print(f"✓ Found {len(dimensions['products'])} products")

    # Get operators
    dimensions['operators'] = [row[0] for row in cursor.execute("SELECT operator_id FROM dbo.operators").fetchall()]
    print(f"✓ Found {len(dimensions['operators'])} operators")

    # Get suppliers
    dimensions['suppliers'] = [row[0] for row in cursor.execute("SELECT supplier_id FROM dbo.suppliers").fetchall()]
    print(f"✓ Found {len(dimensions['suppliers'])} suppliers")

    # Get materials
    dimensions['materials'] = [row[0] for row in cursor.execute("SELECT material_id FROM dbo.materials").fetchall()]
    print(f"✓ Found {len(dimensions['materials'])} materials")

    cursor.close()
    return dimensions

def generate_production_runs(conn, dimensions):
    """Generate 700+ production run records (daily/shift level)"""
    print("\n📊 Generating production run records...")

    start_date = datetime(2024, 9, 1)
    end_date = datetime(2026, 9, 30)
    shifts = ['Morning', 'Evening', 'Night']

    records = []
    current_date = start_date
    story_asset_id = dimensions['machines'][0]  # First machine for Story 1
    line_map = {}  # Map machine to line

    cursor = conn.cursor()

    # Get machine-to-line mapping
    machine_lines = cursor.execute("SELECT asset_id, line_id FROM dbo.machines").fetchall()
    for machine, line in machine_lines:
        line_map[machine] = line

    # Generate data
    record_id = 0
    while current_date <= end_date:
        # Skip weekends
        if current_date.weekday() < 5:
            # Check if planned shutdown
            cursor.execute(f"SELECT is_planned_shutdown FROM dbo.calendar WHERE date = '{current_date.date()}'")
            result = cursor.fetchone()

            if result and result[0] == 0:  # Not a shutdown
                # Generate 3 records (one per shift, per line)
                for line_id in dimensions['lines'][:5]:  # Use first 5 lines for demo
                    for shift in shifts:
                        record_id += 1

                        # Story 1: Asset 1 deteriorating OEE (Oct-Nov 2024)
                        if current_date >= datetime(2024, 10, 1) and current_date <= datetime(2024, 11, 30):
                            if line_id == line_map.get(story_asset_id):
                                # Degraded performance
                                planned_qty = 10000
                                actual_qty = np.random.randint(7800, 8700)  # Lower output
                                good_qty = int(actual_qty * 0.92)  # Lower yield
                                rejected_qty = actual_qty - good_qty
                                runtime_hrs = np.random.uniform(6.5, 7.5)
                                changeover_time = int(np.random.randint(80, 110))
                            else:
                                # Normal performance
                                planned_qty = 10000
                                actual_qty = int(np.random.randint(9200, 9800))
                                good_qty = int(actual_qty * 0.97)
                                rejected_qty = actual_qty - good_qty
                                runtime_hrs = np.random.uniform(8.0, 8.8)
                                changeover_time = int(np.random.randint(35, 50))
                        else:
                            # Normal performance
                            planned_qty = 10000
                            actual_qty = int(np.random.randint(9200, 9800))
                            good_qty = int(actual_qty * 0.97)
                            rejected_qty = actual_qty - good_qty
                            runtime_hrs = np.random.uniform(8.0, 8.8)
                            changeover_time = int(np.random.randint(35, 50))

                        product_id = np.random.choice(dimensions['products'])
                        operator_id = np.random.choice(dimensions['operators'])

                        records.append({
                            'date': current_date.date(),
                            'shift': shift,
                            'plant_id': dimensions['plants'][0],
                            'line_id': line_id,
                            'product_id': product_id,
                            'operator_id': operator_id,
                            'planned_quantity': planned_qty,
                            'actual_quantity': actual_qty,
                            'good_quantity': good_qty,
                            'rejected_quantity': rejected_qty,
                            'cycle_time_minutes': float(round(np.random.uniform(6.0, 7.5), 2)),
                            'runtime_hours': float(round(runtime_hrs, 2)),
                            'planned_production_time_hours': 9,
                            'changeover_time_minutes': changeover_time
                        })

        current_date += timedelta(days=1)

    # Bulk insert
    print(f"  Inserting {len(records)} production run records...")
    cursor.close()

    # Insert via pandas and pyodbc (batch insert for performance)
    df = pd.DataFrame(records)
    batch_size = 100

    for i in range(0, len(df), batch_size):
        batch = df.iloc[i:i+batch_size]
        for _, row in batch.iterrows():
            cursor = conn.cursor()
            # Convert numpy types to Python native types
            values = tuple(convert_numpy_types(v) for v in row)
            cursor.execute(f"""
                INSERT INTO dbo.production_runs
                (date, shift, plant_id, line_id, product_id, operator_id, planned_quantity, actual_quantity, good_quantity, rejected_quantity, cycle_time_minutes, runtime_hours, planned_production_time_hours, changeover_time_minutes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, values)
            cursor.close()

    print(f"✓ Inserted {len(records)} production records")
    return len(records)

def generate_downtime_events(conn, dimensions):
    """Generate downtime events with Story 1 patterns"""
    print("\n⚙️  Generating downtime event records...")

    cursor = conn.cursor()

    # Get Story 1 asset (first machine on first line)
    cursor.execute("SELECT TOP 1 asset_id FROM dbo.machines")
    story_asset = cursor.fetchone()[0]

    cursor.execute("SELECT line_id FROM dbo.machines WHERE asset_id = ?", (story_asset,))
    story_line = cursor.fetchone()[0]

    cursor.execute("SELECT plant_id FROM dbo.production_lines WHERE line_id = ?", (story_line,))
    story_plant = cursor.fetchone()[0]

    records = []

    # Story 1: Repeated unplanned downtime (Oct-Nov 2024)
    downtime_dates = [
        ('2024-10-05 08:30', 75, 'MECH-001', 'Belt Slippage', 'Belt needs replacement'),
        ('2024-10-12 14:15', 75, 'MECH-001', 'Belt Slippage', 'Recurring - temporary fix'),
        ('2024-10-20 10:00', 105, 'MECH-002', 'Misalignment', 'Bearing alignment drift'),
        ('2024-10-28 16:30', 90, 'MECH-001', 'Belt Slippage', 'Third occurrence - inadequate PM'),
        ('2024-11-05 09:15', 105, 'MECH-003', 'Motor Fault', 'Cascading failure'),
    ]

    for dt_str, duration, code, mode, comment in downtime_dates:
        dt_obj = datetime.strptime(dt_str, '%Y-%m-%d %H:%M')
        end_dt = dt_obj + timedelta(minutes=duration)

        records.append({
            'event_start_datetime': dt_obj,
            'event_end_datetime': end_dt,
            'duration_minutes': duration,
            'plant_id': story_plant,
            'line_id': story_line,
            'asset_id': story_asset,
            'planned_vs_unplanned': 'Unplanned',
            'reason_code': code,
            'failure_mode': mode,
            'category': 'Breakdown',
            'comments': comment
        })

    # Additional random downtime events
    start_date = datetime(2024, 9, 1)
    end_date = datetime(2026, 9, 30)
    current = start_date

    categories = ['Breakdown', 'Changeover', 'Material', 'Quality']
    failure_modes = ['Belt Slippage', 'Clog', 'Misalignment', 'Sensor Error', 'Pressure Issue']

    while current <= end_date:
        if np.random.random() < 0.05:  # 5% chance of downtime event
            if current.weekday() < 5:  # Weekdays only
                duration = int(np.random.randint(30, 180))
                category = np.random.choice(categories)

                records.append({
                    'event_start_datetime': current,
                    'event_end_datetime': current + timedelta(minutes=duration),
                    'duration_minutes': duration,
                    'plant_id': str(np.random.choice(dimensions['plants'])),
                    'line_id': str(np.random.choice(dimensions['lines'])),
                    'asset_id': str(np.random.choice(dimensions['machines'])),
                    'planned_vs_unplanned': str(np.random.choice(['Planned', 'Unplanned'])),
                    'reason_code': f"{np.random.choice(['MECH', 'MAT', 'QC'])}-{int(np.random.randint(1, 10)):03d}",
                    'failure_mode': str(np.random.choice(failure_modes)),
                    'category': str(category),
                    'comments': f'{str(category)} event on {current.date()}'
                })

        current += timedelta(days=1)

    # Bulk insert
    print(f"  Inserting {len(records)} downtime event records...")
    cursor = conn.cursor()

    for row in records:
        # Convert numpy types to Python native types
        values = (
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
            (event_start_datetime, event_end_datetime, duration_minutes, plant_id, line_id, asset_id, planned_vs_unplanned, reason_code, failure_mode, category, comments)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, values)

    cursor.close()
    print(f"✓ Inserted {len(records)} downtime records")
    return len(records)

def main():
    """Main execution"""
    print("=" * 60)
    print("Manufacturing Data Seed Generator")
    print("=" * 60)

    conn = connect_db()
    if not conn:
        return

    try:
        # Fetch dimension IDs
        print("\n📂 Fetching dimensions...")
        dimensions = get_dimension_ids(conn)

        # Generate fact data
        prod_count = generate_production_runs(conn, dimensions)
        downtime_count = generate_downtime_events(conn, dimensions)

        # Summary
        print("\n" + "=" * 60)
        print("✓ Seed Data Generation Complete!")
        print("=" * 60)
        print(f"Production Runs: {prod_count}")
        print(f"Downtime Events: {downtime_count}")
        print("\nNext steps:")
        print("1. Generate quality tests (via similar script)")
        print("2. Generate maintenance records")
        print("3. Generate inventory transactions")
        print("4. Generate cost records")
        print("5. Deploy API endpoints")
        print("=" * 60)

    except Exception as e:
        print(f"✗ Error: {e}")
    finally:
        conn.close()

if __name__ == '__main__':
    main()
