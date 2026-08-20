#!/usr/bin/env python3
"""
Seed data generator for sales-agent-db (MSSQL)
Generates 3 years of realistic dummy data without requiring pandas/numpy
"""

import os
import sys
import pyodbc
from datetime import datetime, timedelta
import random
from faker import Faker
from uuid import uuid4

fake = Faker('en_US')
random.seed(42)

# Configuration
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '1433')
DB_NAME = os.getenv('DB_NAME', 'sales_agent_demo')
DB_USER = os.getenv('DB_USER', 'sa')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'Sales@Agent123')

REGIONS = ['North', 'South', 'East', 'West', 'Central']
TERRITORIES = {
    'North': ['North-A', 'North-B', 'North-C'],
    'South': ['South-A', 'South-B', 'South-C'],
    'East': ['East-A', 'East-B', 'East-C'],
    'West': ['West-A', 'West-B'],
    'Central': ['Central-A', 'Central-B'],
}

SPECIALTIES = ['Cardiology', 'Oncology', 'Neurology', 'Endocrinology', 'Psychiatry', 'General Practice']
THERAPY_AREAS = ['Cardiovascular', 'Oncology', 'Diabetes', 'Mental Health', 'Respiratory']
BRANDS = ['MedBrand-A', 'MedBrand-B', 'MedBrand-C', 'MedBrand-D']
CHANNELS = ['Retail', 'Hospital', 'Clinic']

NUM_REPS = 50
NUM_DOCTORS = 300
NUM_PRODUCTS = 15
NUM_PHARMACIES = 150

DATE_START = datetime(2023, 1, 1)
DATE_END = datetime(2025, 12, 31)

def connect_db():
    """Connect to MSSQL"""
    try:
        conn_str = f'Driver={{ODBC Driver 17 for SQL Server}};Server={DB_HOST},{DB_PORT};Database={DB_NAME};UID={DB_USER};PWD={DB_PASSWORD};Encrypt=yes;TrustServerCertificate=yes;Connection Timeout=30;'
        conn = pyodbc.connect(conn_str)
        return conn
    except pyodbc.Error as e:
        print(f"Error connecting to database: {e}")
        sys.exit(1)

def generate_sales_reps(conn, num_reps=NUM_REPS):
    """Generate sales reps"""
    print("Generating sales reps...")
    rep_ids = []

    manager_ids = [str(uuid4()) for _ in range(5)]

    cursor = conn.cursor()

    # Insert managers first
    for manager_id in manager_ids:
        rep_ids.append(manager_id)
        cursor.execute("""
            INSERT INTO dbo.sales_reps (rep_id, name, territory, region, manager_id)
            VALUES (?, ?, ?, ?, ?)
        """, (
            manager_id,
            fake.name(),
            random.choice(TERRITORIES[random.choice(REGIONS)]),
            random.choice(REGIONS),
            None
        ))

    # Insert regular reps
    for i in range(num_reps - 5):
        rep_id = str(uuid4())
        rep_ids.append(rep_id)
        region = random.choice(REGIONS)
        cursor.execute("""
            INSERT INTO dbo.sales_reps (rep_id, name, territory, region, manager_id)
            VALUES (?, ?, ?, ?, ?)
        """, (
            rep_id,
            fake.name(),
            random.choice(TERRITORIES[region]),
            region,
            random.choice(manager_ids)
        ))

    cursor.close()
    conn.commit()
    print(f"  ✓ Created {num_reps} sales reps")
    return rep_ids

def generate_products(conn, num_products=NUM_PRODUCTS):
    """Generate products"""
    print("Generating products...")
    product_ids = []
    cursor = conn.cursor()

    for i in range(num_products):
        product_id = str(uuid4())
        product_ids.append(product_id)
        cursor.execute("""
            INSERT INTO dbo.products (product_id, sku, brand, therapy_area, launch_date)
            VALUES (?, ?, ?, ?, ?)
        """, (
            product_id,
            f"SKU-{i+1:04d}",
            random.choice(BRANDS),
            random.choice(THERAPY_AREAS),
            DATE_START + timedelta(days=random.randint(0, 365))
        ))

    cursor.close()
    conn.commit()
    print(f"  ✓ Created {num_products} products")
    return product_ids

def generate_pharmacies(conn, num_pharmacies=NUM_PHARMACIES):
    """Generate pharmacies"""
    print("Generating pharmacies...")
    pharmacy_ids = []
    cursor = conn.cursor()

    for i in range(num_pharmacies):
        pharmacy_id = str(uuid4())
        pharmacy_ids.append(pharmacy_id)
        cursor.execute("""
            INSERT INTO dbo.pharmacies (pharmacy_id, name, region, channel)
            VALUES (?, ?, ?, ?)
        """, (
            pharmacy_id,
            f"{fake.company()} Pharmacy",
            random.choice(REGIONS),
            random.choice(CHANNELS)
        ))

    cursor.close()
    conn.commit()
    print(f"  ✓ Created {num_pharmacies} pharmacies")
    return pharmacy_ids

def generate_doctors(conn, num_doctors=NUM_DOCTORS):
    """Generate doctors"""
    print("Generating doctors...")
    doctor_ids = []
    cursor = conn.cursor()

    for i in range(num_doctors):
        doctor_id = str(uuid4())
        doctor_ids.append(doctor_id)
        region = random.choice(REGIONS)
        cursor.execute("""
            INSERT INTO dbo.doctors (
                doctor_id, doctor_name, specialty, tier, hospital_clinic,
                region, territory, city, market, onboarded_date, status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            doctor_id,
            fake.name(),
            random.choice(SPECIALTIES),
            random.choice(['A', 'B', 'C']),
            fake.company(),
            region,
            random.choice(TERRITORIES[region]),
            fake.city(),
            f"Market-{random.randint(1, 10):02d}",
            DATE_START + timedelta(days=random.randint(0, 730)),
            'active' if random.random() > 0.1 else 'inactive'
        ))

    cursor.close()
    conn.commit()
    print(f"  ✓ Created {num_doctors} doctors")
    return doctor_ids

def generate_call_planning(conn, doctor_ids, rep_ids, product_ids):
    """Generate call planning data"""
    print("Generating call planning data...")
    cursor = conn.cursor()
    batch_size = 500
    batch = []

    current_date = DATE_START
    while current_date <= DATE_END:
        for rep_id in rep_ids:
            num_calls = random.randint(3, 5)
            for _ in range(num_calls):
                actual_call_date = None
                if random.random() < 0.78:
                    actual_call_date = current_date + timedelta(days=random.randint(0, 6))

                feedback_score = None
                if actual_call_date:
                    feedback_score = random.randint(6, 10)

                batch.append((
                    str(uuid4()),
                    random.choice(doctor_ids),
                    rep_id,
                    random.choice(product_ids),
                    current_date,
                    actual_call_date,
                    random.choice(['Follow-up', 'New Product', 'Support']),
                    random.randint(1, 4),
                    'completed' if actual_call_date else 'planned',
                    feedback_score
                ))

                if len(batch) >= batch_size:
                    for call in batch:
                        cursor.execute("""
                            INSERT INTO dbo.call_planning (
                                call_id, doctor_id, rep_id, product_id, planned_date,
                                actual_call_date, call_type, frequency_target, call_status, feedback_score
                            )
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, call)
                    conn.commit()
                    batch = []

        current_date += timedelta(weeks=1)

    # Insert remaining
    if batch:
        for call in batch:
            cursor.execute("""
                INSERT INTO dbo.call_planning (
                    call_id, doctor_id, rep_id, product_id, planned_date,
                    actual_call_date, call_type, frequency_target, call_status, feedback_score
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, call)
        conn.commit()

    cursor.close()
    print(f"  ✓ Created call planning records")

def generate_secondary_sales(conn, rep_ids, product_ids, pharmacy_ids):
    """Generate secondary sales data"""
    print("Generating secondary sales data...")
    cursor = conn.cursor()
    batch_size = 1000
    batch = []

    current_date = DATE_START
    while current_date <= DATE_END:
        seasonality_factor = 1.0
        month = current_date.month
        if month in [7, 8]:
            seasonality_factor = 0.7
        elif month in [11, 12]:
            seasonality_factor = 1.4

        for rep_id in rep_ids:
            for product_id in product_ids:
                if random.random() < 0.4:
                    num_sales = random.randint(0, 2)
                    for _ in range(num_sales):
                        quantity = random.randint(5, 50)
                        base_price = random.uniform(100, 500)
                        value = quantity * base_price * seasonality_factor
                        region = random.choice(REGIONS)

                        if region == 'South':
                            months_elapsed = (current_date - DATE_START).days / 30
                            value *= (1 - 0.02 * months_elapsed)

                        batch.append((
                            str(uuid4()),
                            current_date,
                            product_id,
                            random.choice(pharmacy_ids),
                            rep_id,
                            region,
                            int(quantity),
                            round(value, 2)
                        ))

                        if len(batch) >= batch_size:
                            for sale in batch:
                                cursor.execute("""
                                    INSERT INTO dbo.secondary_sales (
                                        sale_id, sale_date, product_id, pharmacy_id, rep_id,
                                        region, quantity_sold, value_sold
                                    )
                                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                                """, sale)
                            conn.commit()
                            batch = []

        current_date += timedelta(days=1)

    # Insert remaining
    if batch:
        for sale in batch:
            cursor.execute("""
                INSERT INTO dbo.secondary_sales (
                    sale_id, sale_date, product_id, pharmacy_id, rep_id,
                    region, quantity_sold, value_sold
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, sale)
        conn.commit()

    cursor.close()
    print(f"  ✓ Created secondary sales records")

def main():
    """Main seed function"""
    print("=" * 60)
    print("Sales Agent Database Seeder (MSSQL)")
    print("=" * 60)
    print(f"Connecting to {DB_NAME} on {DB_HOST}:{DB_PORT}...")

    conn = connect_db()
    print("✓ Connected successfully\n")

    try:
        rep_ids = generate_sales_reps(conn, NUM_REPS)
        product_ids = generate_products(conn, NUM_PRODUCTS)
        pharmacy_ids = generate_pharmacies(conn, NUM_PHARMACIES)
        doctor_ids = generate_doctors(conn, NUM_DOCTORS)

        print()

        generate_call_planning(conn, doctor_ids, rep_ids, product_ids)
        generate_secondary_sales(conn, rep_ids, product_ids, pharmacy_ids)

        print("\n" + "=" * 60)
        print("✓ Seed data generation complete!")
        print("=" * 60)

    except Exception as e:
        print(f"Error during seeding: {e}")
        sys.exit(1)
    finally:
        conn.close()

if __name__ == '__main__':
    main()
