#!/usr/bin/env python3
"""
Seed data generator for sales-agent-db
Generates 3 years of realistic dummy data for doctors, calls, and sales
with seasonality, trends, and patterns using Faker + pandas
"""

import os
import sys
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime, timedelta
import random
from faker import Faker
import pandas as pd
import numpy as np
from uuid import uuid4

fake = Faker('en_US')
random.seed(42)
np.random.seed(42)

# Configuration
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '5433')
DB_NAME = os.getenv('DB_NAME', 'sales_agent_demo')
DB_USER = os.getenv('DB_USER', 'sales_agent')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'sales_agent_password')

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
    """Connect to PostgreSQL"""
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        )
        return conn
    except psycopg2.Error as e:
        print(f"Error connecting to database: {e}")
        sys.exit(1)

def generate_sales_reps(conn, num_reps=NUM_REPS):
    """Generate sales reps"""
    print("Generating sales reps...")
    reps = []
    rep_ids = []

    # First, create manager IDs from the first 5 reps
    manager_ids = [str(uuid4()) for _ in range(5)]

    # Insert managers first (without manager_id references)
    managers = []
    for manager_id in manager_ids:
        rep_ids.append(manager_id)
        managers.append((
            manager_id,
            fake.name(),
            random.choice(TERRITORIES[random.choice(REGIONS)]),
            random.choice(REGIONS),
            None  # Managers have no manager
        ))

    with conn.cursor() as cur:
        execute_values(
            cur,
            """
            INSERT INTO sales_reps (rep_id, name, territory, region, manager_id)
            VALUES %s
            """,
            managers
        )

    # Then create regular reps with valid manager references
    for i in range(num_reps - 5):
        rep_id = str(uuid4())
        rep_ids.append(rep_id)
        region = random.choice(REGIONS)
        territory = random.choice(TERRITORIES[region])
        manager_id = random.choice(manager_ids)

        reps.append((
            rep_id,
            fake.name(),
            territory,
            region,
            manager_id
        ))

    with conn.cursor() as cur:
        execute_values(
            cur,
            """
            INSERT INTO sales_reps (rep_id, name, territory, region, manager_id)
            VALUES %s
            """,
            reps
        )

    conn.commit()
    print(f"  ✓ Created {len(managers) + len(reps)} sales reps ({len(manager_ids)} managers + {len(reps)} reps)")
    return rep_ids

def generate_products(conn, num_products=NUM_PRODUCTS):
    """Generate products"""
    print("Generating products...")
    products = []
    product_ids = []

    for i in range(num_products):
        product_id = str(uuid4())
        product_ids.append(product_id)
        sku = f"SKU-{i+1:04d}"
        brand = random.choice(BRANDS)
        therapy_area = random.choice(THERAPY_AREAS)
        launch_date = DATE_START + timedelta(days=random.randint(0, 365))

        products.append((
            product_id,
            sku,
            brand,
            therapy_area,
            launch_date
        ))

    with conn.cursor() as cur:
        execute_values(
            cur,
            """
            INSERT INTO products (product_id, sku, brand, therapy_area, launch_date)
            VALUES %s
            """,
            products
        )

    conn.commit()
    print(f"  ✓ Created {len(products)} products")
    return product_ids

def generate_pharmacies(conn, num_pharmacies=NUM_PHARMACIES):
    """Generate pharmacies"""
    print("Generating pharmacies...")
    pharmacies = []
    pharmacy_ids = []

    for i in range(num_pharmacies):
        pharmacy_id = str(uuid4())
        pharmacy_ids.append(pharmacy_id)
        name = f"{fake.company()} Pharmacy"
        region = random.choice(REGIONS)
        channel = random.choice(CHANNELS)

        pharmacies.append((
            pharmacy_id,
            name,
            region,
            channel
        ))

    with conn.cursor() as cur:
        execute_values(
            cur,
            """
            INSERT INTO pharmacies (pharmacy_id, name, region, channel)
            VALUES %s
            """,
            pharmacies
        )

    conn.commit()
    print(f"  ✓ Created {len(pharmacies)} pharmacies")
    return pharmacy_ids

def generate_doctors(conn, num_doctors=NUM_DOCTORS):
    """Generate doctors"""
    print("Generating doctors...")
    doctors = []
    doctor_ids = []

    for i in range(num_doctors):
        doctor_id = str(uuid4())
        doctor_ids.append(doctor_id)
        region = random.choice(REGIONS)

        doctors.append((
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

    with conn.cursor() as cur:
        execute_values(
            cur,
            """
            INSERT INTO doctors (
                doctor_id, doctor_name, specialty, tier, hospital_clinic,
                region, territory, city, market, onboarded_date, status
            )
            VALUES %s
            """,
            doctors
        )

    conn.commit()
    print(f"  ✓ Created {len(doctors)} doctors")
    return doctor_ids

def generate_call_planning(conn, doctor_ids, rep_ids, product_ids):
    """Generate call planning data (3 years, weekly frequency per rep)"""
    print("Generating call planning data...")
    calls = []

    current_date = DATE_START
    while current_date <= DATE_END:
        for rep_id in rep_ids:
            # Each rep gets 3-5 calls per week
            num_calls_this_week = random.randint(3, 5)
            for _ in range(num_calls_this_week):
                call_id = str(uuid4())
                doctor_id = random.choice(doctor_ids)
                product_id = random.choice(product_ids)

                # 70-85% execution rate
                actual_call_date = None
                if random.random() < 0.78:  # Execution rate
                    actual_call_date = current_date + timedelta(days=random.randint(0, 6))

                # Feedback only if call was actually made
                feedback_score = None
                if actual_call_date:
                    feedback_score = random.randint(6, 10)  # Optimistic feedback

                calls.append((
                    call_id,
                    doctor_id,
                    rep_id,
                    product_id,
                    current_date,
                    actual_call_date,
                    random.choice(['Follow-up', 'New Product', 'Support']),
                    random.randint(1, 4),
                    'completed' if actual_call_date else 'planned',
                    feedback_score
                ))

        current_date += timedelta(weeks=1)

    # Batch insert
    with conn.cursor() as cur:
        execute_values(
            cur,
            """
            INSERT INTO call_planning (
                call_id, doctor_id, rep_id, product_id, planned_date,
                actual_call_date, call_type, frequency_target, call_status, feedback_score
            )
            VALUES %s
            """,
            calls,
            page_size=5000
        )

    conn.commit()
    print(f"  ✓ Created {len(calls)} call records")

def generate_secondary_sales(conn, rep_ids, product_ids, pharmacy_ids):
    """Generate secondary sales data (3 years, with seasonality and trends)"""
    print("Generating secondary sales data...")
    total_sales = 0
    batch_size = 5000

    current_date = DATE_START
    sales_batch = []

    while current_date <= DATE_END:
        # Seasonality: summer dip, year-end spike
        seasonality_factor = 1.0
        month = current_date.month
        if month in [7, 8]:  # Summer dip
            seasonality_factor = 0.7
        elif month in [11, 12]:  # Year-end spike
            seasonality_factor = 1.4

        # Each date: 3-7 sales per product per rep
        for rep_id in rep_ids:
            for product_id in product_ids:
                if random.random() < 0.4:  # Not every rep sells every product every day
                    num_sales = random.randint(0, 2)
                    for _ in range(num_sales):
                        sale_id = str(uuid4())
                        pharmacy_id = random.choice(pharmacy_ids)
                        quantity = random.randint(5, 50)
                        # Base price: 100-500, scaled by seasonality
                        base_price = random.uniform(100, 500)
                        value = quantity * base_price * seasonality_factor
                        region = random.choice(REGIONS)

                        # Trend: South declining over time
                        if region == 'South':
                            months_elapsed = (current_date - DATE_START).days / 30
                            value *= (1 - 0.02 * months_elapsed)  # 2% decline per month

                        sales_batch.append((
                            sale_id,
                            current_date,
                            product_id,
                            pharmacy_id,
                            rep_id,
                            region,
                            int(quantity),
                            round(value, 2)
                        ))

                        # Insert in batches to avoid memory overload
                        if len(sales_batch) >= batch_size:
                            with conn.cursor() as cur:
                                execute_values(
                                    cur,
                                    """
                                    INSERT INTO secondary_sales (
                                        sale_id, sale_date, product_id, pharmacy_id, rep_id,
                                        region, quantity_sold, value_sold
                                    )
                                    VALUES %s
                                    """,
                                    sales_batch
                                )
                            conn.commit()
                            total_sales += len(sales_batch)
                            sales_batch = []

        current_date += timedelta(days=1)

    # Insert remaining batch
    if sales_batch:
        with conn.cursor() as cur:
            execute_values(
                cur,
                """
                INSERT INTO secondary_sales (
                    sale_id, sale_date, product_id, pharmacy_id, rep_id,
                    region, quantity_sold, value_sold
                )
                VALUES %s
                """,
                sales_batch
            )
        conn.commit()
        total_sales += len(sales_batch)

    print(f"  ✓ Created {total_sales} sales records")

def main():
    """Main seed function"""
    print("=" * 60)
    print("Sales Agent Database Seeder")
    print("=" * 60)
    print(f"Connecting to {DB_NAME} on {DB_HOST}:{DB_PORT}...")

    conn = connect_db()
    print("✓ Connected successfully\n")

    try:
        # Generate dimension tables first
        rep_ids = generate_sales_reps(conn, NUM_REPS)
        product_ids = generate_products(conn, NUM_PRODUCTS)
        pharmacy_ids = generate_pharmacies(conn, NUM_PHARMACIES)
        doctor_ids = generate_doctors(conn, NUM_DOCTORS)

        print()

        # Generate fact tables
        generate_call_planning(conn, doctor_ids, rep_ids, product_ids)
        generate_secondary_sales(conn, rep_ids, product_ids, pharmacy_ids)

        print("\n" + "=" * 60)
        print("✓ Seed data generation complete!")
        print("=" * 60)

    except Exception as e:
        print(f"Error during seeding: {e}")
        conn.rollback()
        sys.exit(1)
    finally:
        conn.close()

if __name__ == '__main__':
    main()
