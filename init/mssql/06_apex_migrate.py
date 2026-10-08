#!/usr/bin/env python3
"""
Apex Group: one-shot SQLite -> MSSQL migration.

This is an IMPORT, not a generator. The other scripts in this folder invent
synthetic rows from formulas (03_seed_data.py, ../fill_plant_coverage_and_variance.js);
this one copies real data out of the apex_group_synthetic .db file and into a new
database on the SQL Server instance that is already running. Nothing new is
invented and nothing is dropped from the source.

It creates its own database (default apex_agent_demo) on the SAME instance that
already hosts sales_agent_demo and manufacturing_agent_demo. No second SQL
Server, no compose change, no new port.

SQLite is loosely typed, so every column is profiled against its actual values
before the table is created:
  INTEGER -> INT, or BIGINT when the real values need it
  REAL    -> DECIMAL(19,s). NOT float: these are revenue/EBITDA/margin figures
             and float rounding would surface as visibly wrong numbers in the
             agent's answers.
  TEXT    -> DATE / DATETIME2 when every value parses as one, else NVARCHAR(n)
             sized to the longest value actually present. Defaulting all 367
             text columns to NVARCHAR(MAX) would make every one of them
             unindexable.

Safe to re-run: each table is dropped and rebuilt, so a half-finished run is
fixed by running it again. It only ever touches the Apex database.

Usage:
    python3 init/mssql/06_apex_migrate.py  /path/to/apex_group_synthetic.db

Environment (same names the rest of the repo uses; read from api/.env):
    DB_HOST  DB_PORT  DB_USER  DB_PASSWORD      connection to the instance
    DB_NAME_APEX                                target database, default apex_agent_demo
"""

import os
import re
import sys
import sqlite3
from decimal import Decimal, ROUND_HALF_UP, getcontext

try:
    import pyodbc
except ImportError:
    sys.exit("pyodbc is not installed.  pip install -r requirements.txt")

# Load api/.env the same way the Node scripts do, so one set of credentials
# serves both. Optional: plain environment variables work just as well.
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", "api", ".env"))
except ImportError:
    pass

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "1433")
DB_USER = os.getenv("DB_USER", "sa")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
APEX_DB = os.getenv("DB_NAME_APEX", "apex_agent_demo")

# Rows per executemany batch. 2000 keeps the parameter count well under SQL
# Server's 2100-parameter ceiling even for the widest table here (32 columns).
BATCH = 2000

# Values are quantised against DECIMAL(38,s); give the context room for it.
getcontext().prec = 50

# DECIMAL(38,s) is the widest SQL Server offers. Precision 38 with a scale
# capped at 6 leaves 32 integer digits -- the largest figure in this dataset
# needs 8, so there is room for the demo to grow without an arithmetic
# overflow at insert time.
DECIMAL_PRECISION = 38
MAX_SCALE = 6

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
DATETIME_RE = re.compile(r"^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?")

VIEW_PREFIX_RE = r'''^\s*CREATE\s+VIEW\s+["\[`]?\w+["\]`]?\s+AS\s+'''

INDEX_RE = re.compile(
    r'CREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?[\["`]?(\w+)[\]"`]?\s+'
    r'ON\s+[\["`]?(\w+)[\]"`]?\s*\((.+?)\)\s*$',
    re.IGNORECASE | re.DOTALL,
)


def connect(database):
    """Connect to one database on the instance. TrustServerCertificate matches
    the API's own mssql options (the container uses a self-signed cert)."""
    for driver in ("ODBC Driver 18 for SQL Server", "ODBC Driver 17 for SQL Server"):
        try:
            return pyodbc.connect(
                f"DRIVER={{{driver}}};SERVER={DB_HOST},{DB_PORT};DATABASE={database};"
                f"UID={DB_USER};PWD={DB_PASSWORD};TrustServerCertificate=yes;",
                autocommit=True,
            )
        except pyodbc.InterfaceError:
            continue  # driver not installed, try the next one
    sys.exit(
        "No usable ODBC driver found. Install msodbcsql18:\n"
        "  curl https://packages.microsoft.com/keys/microsoft.asc | sudo apt-key add -\n"
        "  sudo apt-get install -y msodbcsql18 unixodbc-dev"
    )


def ensure_database():
    """CREATE DATABASE cannot run inside a transaction, hence autocommit above."""
    con = connect("master")
    cur = con.cursor()
    cur.execute("SELECT 1 FROM sys.databases WHERE name = ?", APEX_DB)
    if cur.fetchone():
        print(f"  database [{APEX_DB}] already exists")
    else:
        cur.execute(f"CREATE DATABASE [{APEX_DB}]")
        print(f"  created database [{APEX_DB}]")
    con.close()


def profile(sqlite_cur, table, column, declared):
    """Pick a T-SQL type by looking at the values actually stored."""
    q = lambda expr: sqlite_cur.execute(
        f'SELECT {expr} FROM "{table}" WHERE "{column}" IS NOT NULL'
    ).fetchone()
    declared = (declared or "").upper()

    if "INT" in declared:
        row = q(f'MAX(ABS("{column}"))')
        biggest = row[0] if row and row[0] is not None else 0
        return "INT" if biggest < 2_147_483_647 else "BIGINT"

    if declared in ("REAL", "FLOA", "DOUB") or "REAL" in declared or "DOUB" in declared:
        # Measure the scale actually used so money keeps its cents and ratios
        # keep their precision, without blanket-widening every column.
        # Measure the scale the values genuinely carry. repr() is no good here:
        # binary floats print as 0.30000000000000004, which would claim 17
        # decimal places for a number that really has one. Round-tripping with
        # a tolerance finds the real scale and leaves the integer side room.
        scale = 2
        for (v,) in sqlite_cur.execute(
            f'SELECT "{column}" FROM "{table}" WHERE "{column}" IS NOT NULL LIMIT 500'
        ):
            f = float(v)
            for candidate in range(0, MAX_SCALE + 1):
                if abs(round(f, candidate) - f) < 1e-9:
                    scale = max(scale, candidate)
                    break
            else:
                scale = MAX_SCALE
        return f"DECIMAL({DECIMAL_PRECISION},{scale})"

    if "BLOB" in declared:
        return "VARBINARY(MAX)"

    # TEXT, or no declared type at all.
    row = q(f'MAX(LENGTH("{column}"))')
    longest = row[0] if row and row[0] is not None else 0

    sample = sqlite_cur.execute(
        f'SELECT "{column}" FROM "{table}" WHERE "{column}" IS NOT NULL LIMIT 200'
    ).fetchall()
    values = [str(v[0]) for v in sample]
    if values:
        if all(DATE_RE.match(v) for v in values):
            return "DATE"
        if all(DATETIME_RE.match(v) for v in values):
            return "DATETIME2"

    if longest == 0:
        return "NVARCHAR(255)"           # column is entirely NULL
    if longest > 4000:
        return "NVARCHAR(MAX)"
    # Headroom so a slightly longer value later doesn't truncate, rounded up.
    return f"NVARCHAR({min(max(int(longest * 1.5), 32), 4000)})"


def migrate_table(slite_cur, mssql_cur, table):
    cols = slite_cur.execute(f'PRAGMA table_info("{table}")').fetchall()
    names = [c[1] for c in cols]
    types = [profile(slite_cur, table, c[1], c[2]) for c in cols]

    ddl = ",\n    ".join(f"[{n}] {t} NULL" for n, t in zip(names, types))
    mssql_cur.execute(f"IF OBJECT_ID('dbo.{table}','U') IS NOT NULL DROP TABLE [dbo].[{table}]")
    mssql_cur.execute(f"CREATE TABLE [dbo].[{table}] (\n    {ddl}\n)")

    placeholders = ",".join("?" * len(names))
    collist = ",".join("[" + n + "]" for n in names)
    sqlite_cols = ",".join('"' + n + '"' for n in names)
    insert = "INSERT INTO [dbo].[" + table + "] (" + collist + ") VALUES (" + placeholders + ")"

    # fast_executemany turns per-row round trips into a single bulk call.
    mssql_cur.fast_executemany = True

    # Column index -> quantiser for that column's exact scale. Binding a
    # Decimal with more digits than the target column can make pyodbc's
    # fast_executemany path reject the batch outright, so each value is
    # snapped to the column's own scale first.
    quant = {}
    for i, t in enumerate(types):
        if t.startswith("DECIMAL"):
            quant[i] = Decimal(1).scaleb(-int(t.split(",")[1].rstrip(")")))
    decimal_at = set(quant)
    read = slite_cur.execute('SELECT ' + sqlite_cols + ' FROM "' + table + '"')

    moved = 0
    while True:
        rows = read.fetchmany(BATCH)
        if not rows:
            break
        if decimal_at:
            # Hand ODBC an exact Decimal rather than a binary float, so the
            # stored value is the one that was in the source file.
            rows = [
                [
                    Decimal(repr(v)).quantize(quant[i])
                    if (i in decimal_at and v is not None) else v
                    for i, v in enumerate(row)
                ]
                for row in rows
            ]
        else:
            rows = [list(r) for r in rows]
        mssql_cur.executemany(insert, rows)
        moved += len(rows)
    return moved, len(names)


def main():
    if len(sys.argv) < 2:
        sys.exit(f"usage: {sys.argv[0]} /path/to/apex_group_synthetic.db")
    path = sys.argv[1]
    if not os.path.isfile(path):
        sys.exit(f"SQLite file not found: {path}")

    print(f"source : {path}")
    print(f"target : {DB_HOST},{DB_PORT} -> [{APEX_DB}]\n")

    print("database")
    ensure_database()

    slite = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    sq = slite.cursor()
    meta = slite.cursor()
    mssql = connect(APEX_DB)
    mc = mssql.cursor()

    tables = [
        r[0] for r in meta.execute(
            "SELECT name FROM sqlite_master WHERE type='table' "
            "AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )
    ]

    print(f"\ntables ({len(tables)})")
    expected = {}
    for t in tables:
        moved, ncols = migrate_table(sq, mc, t)
        expected[t] = moved
        print(f"  {t:<44} {moved:>9,} rows  {ncols:>3} cols")

    # --- indexes -------------------------------------------------------------
    print("\nindexes")
    made = skipped = 0
    for name, sql in meta.execute(
        "SELECT name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL"
    ).fetchall():
        m = INDEX_RE.search(sql.strip().rstrip(";"))
        if not m:
            print(f"  SKIP {name}: could not parse")
            skipped += 1
            continue
        unique, idx, tbl, collist = m.groups()
        strip_chars = '"[]` '
        cleaned = ", ".join(
            "[" + c.strip().strip(strip_chars) + "]" for c in collist.split(",")
        )
        try:
            mc.execute(
                f"CREATE {'UNIQUE ' if unique else ''}INDEX [{idx}] "
                f"ON [dbo].[{tbl}] ({cleaned})"
            )
            made += 1
        except pyodbc.Error as e:
            # Most likely an index on a column that profiled to NVARCHAR(MAX).
            print(f"  SKIP {idx} on {tbl}: {str(e).splitlines()[0][:110]}")
            skipped += 1
    print(f"  {made} created, {skipped} skipped")

    # --- views ---------------------------------------------------------------
    print("\nviews")
    for name, sql in meta.execute(
        "SELECT name, sql FROM sqlite_master WHERE type='view' AND sql IS NOT NULL"
    ).fetchall():
        body = re.sub(
            VIEW_PREFIX_RE, "", sql.strip().rstrip(";"), flags=re.IGNORECASE
        )
        try:
            mc.execute(f"IF OBJECT_ID('dbo.{name}','V') IS NOT NULL DROP VIEW [dbo].[{name}]")
            mc.execute(f"CREATE VIEW [dbo].[{name}] AS {body}")
            print(f"  {name}")
        except pyodbc.Error as e:
            print(f"  FAILED {name}: {str(e).splitlines()[0][:110]}")
            print(f"         source SQL: {body[:160]}")

    # --- verify --------------------------------------------------------------
    print("\nverify (source rows vs landed rows)")
    bad = 0
    for t in tables:
        src = meta.execute(f'SELECT COUNT(*) FROM "{t}"').fetchone()[0]
        mc.execute(f"SELECT COUNT(*) FROM [dbo].[{t}]")
        dst = mc.fetchone()[0]
        if src != dst:
            print(f"  MISMATCH {t}: sqlite {src:,} -> mssql {dst:,}")
            bad += 1
    total = sum(expected.values())
    if bad:
        print(f"\n  {bad} table(s) DO NOT match. Re-run the script.")
        sys.exit(1)
    print(f"  all {len(tables)} tables match — {total:,} rows total")

    print(f"\nDone. Add this to api/.env, then add apex-routes.js:")
    print(f"  DB_NAME_APEX={APEX_DB}")

    slite.close()
    mssql.close()


if __name__ == "__main__":
    main()
