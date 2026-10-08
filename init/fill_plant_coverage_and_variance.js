/**
 * Fill plants that have no lines, and separate plant / line / shift performance.
 *
 * Safe to run again:
 * - regions, production quantities, and quality rates are rewritten from a fixed formula
 * - lines, costs, inventory, downtime, and maintenance are inserted only when missing
 *
 * Does not add another copy of Plant Alpha / Beta / Gamma history.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../api/.env') });
const crypto = require('crypto');
const sql = require('../api/node_modules/mssql');

const PROFILES = {
  'Tokyo Manufacturing': { region: 'Asia-Pacific', vol: 1.35, att: 0.95, rej: 0.010, short: 0.01, cost: 0.85, down: 0.04 },
  'Singapore Manufacturing': { region: 'Asia-Pacific', vol: 1.08, att: 0.92, rej: 0.016, short: 0.02, cost: 0.95, down: 0.06 },
  'Plant Gamma': { region: 'West', vol: 1.18, att: 0.93, rej: 0.012, short: 0.02, cost: 1.05, down: 0.08 },
  'Berlin Manufacturing': { region: 'Europe', vol: 1.00, att: 0.88, rej: 0.024, short: 0.04, cost: 1.15, down: 0.10 },
  'Plant Alpha': { region: 'North', vol: 0.96, att: 0.84, rej: 0.028, short: 0.05, cost: 1.00, down: 0.12 },
  'Toronto Manufacturing': { region: 'North America', vol: 0.90, att: 0.85, rej: 0.033, short: 0.06, cost: 1.08, down: 0.11 },
  'Shanghai Manufacturing': { region: 'Asia-Pacific', vol: 1.22, att: 0.78, rej: 0.052, short: 0.10, cost: 0.78, down: 0.16 },
  'São Paulo Manufacturing': { region: 'Latin America', vol: 0.74, att: 0.75, rej: 0.061, short: 0.12, cost: 0.72, down: 0.18 },
  'Plant Beta': { region: 'South', vol: 0.70, att: 0.73, rej: 0.068, short: 0.14, cost: 0.90, down: 0.20 },
  'Mexico City Manufacturing': { region: 'Latin America', vol: 0.58, att: 0.69, rej: 0.082, short: 0.18, cost: 0.68, down: 0.24 },
  'Dubai Manufacturing': { region: 'Middle East', vol: 0.46, att: 0.64, rej: 0.105, short: 0.28, cost: 1.35, down: 0.32 }
};

const SEASON = { 1: 1.16, 2: 1.10, 3: 1.06, 4: 0.94, 5: 0.90, 6: 0.86, 7: 0.82, 8: 0.86, 9: 0.96, 10: 1.12, 11: 1.20, 12: 1.14 };
const SHIFT_VOL = { Morning: 1.14, Evening: 1.00, Night: 0.84 };
const SHIFT_ATT = { Morning: 1.02, Evening: 1.00, Night: 0.95 };
const CODES = {
  'Berlin Manufacturing': 'BER',
  'Dubai Manufacturing': 'DXB',
  'Mexico City Manufacturing': 'MEX',
  'São Paulo Manufacturing': 'SAO',
  'Shanghai Manufacturing': 'SHA',
  'Singapore Manufacturing': 'SIN',
  'Tokyo Manufacturing': 'TYO',
  'Toronto Manufacturing': 'YYZ'
};

function uuid() {
  return crypto.randomUUID();
}

function iso(d) {
  return d.toISOString().slice(0, 10);
}

function eachWeekday() {
  const out = [];
  const d = new Date(Date.UTC(2022, 8, 1));
  const last = new Date(Date.UTC(2026, 8, 30));
  for (; d <= last; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) out.push(new Date(d.getTime()));
  }
  return out;
}

function eachWeek() {
  const days = eachWeekday();
  return days.filter((d) => d.getUTCDay() === 1);
}

async function bulk(pool, tableName, columns, rows) {
  const size = 4000;
  for (let i = 0; i < rows.length; i += size) {
    const table = new sql.Table(tableName);
    table.create = false;
    for (const col of columns) table.columns.add(col.name, col.type, col.opts || { nullable: true });
    for (const row of rows.slice(i, i + size)) table.rows.add(...row);
    await pool.request().bulk(table);
    process.stdout.write(`  ${tableName} ${Math.min(i + size, rows.length)}/${rows.length}\n`);
  }
}

async function main() {
  const pool = await sql.connect({
    server: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    database: process.env.DB_NAME_MFG,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionTimeout: 30000,
    requestTimeout: 600000,
    options: { trustServerCertificate: true, encrypt: true }
  });

  console.log('Fixing region labels');
  for (const [name, profile] of Object.entries(PROFILES)) {
    await pool.request()
      .input('name', sql.NVarChar, name)
      .input('region', sql.NVarChar, profile.region)
      .query('UPDATE dbo.plants SET region = @region, updated_at = GETUTCDATE() WHERE plant_name = @name');
  }

  const plants = (await pool.request().query(`
    SELECT p.plant_id, p.plant_name,
      (SELECT COUNT(*) FROM dbo.production_lines l WHERE l.plant_id = p.plant_id) AS lines,
      (SELECT COUNT(*) FROM dbo.production_runs r WHERE r.plant_id = p.plant_id) AS runs,
      (SELECT COUNT(*) FROM dbo.quality_tests q WHERE q.plant_id = p.plant_id) AS quality,
      (SELECT COUNT(*) FROM dbo.cost_records c WHERE c.plant_id = p.plant_id) AS costs,
      (SELECT COUNT(*) FROM dbo.inventory_transactions i WHERE i.plant_id = p.plant_id) AS inventory
    FROM dbo.plants p
  `)).recordset;

  const products = (await pool.request().query('SELECT product_id FROM dbo.products ORDER BY product_name')).recordset.map((r) => r.product_id);
  const materials = (await pool.request().query('SELECT material_id, supplier_id FROM dbo.materials')).recordset;
  const operators = (await pool.request().query('SELECT operator_id, plant_id FROM dbo.operators')).recordset;

  const empty = plants.filter((p) => p.lines === 0 && PROFILES[p.plant_name]);
  console.log('Plants with no lines:', empty.map((p) => p.plant_name).join(', ') || '(none)');

  for (const plant of empty) {
    const code = CODES[plant.plant_name] || 'X';
    for (let n = 1; n <= 2; n++) {
      const lineId = uuid();
      await pool.request()
        .input('id', sql.UniqueIdentifier, lineId)
        .input('plant', sql.UniqueIdentifier, plant.plant_id)
        .input('name', sql.NVarChar, `Line-${code}-${n}`)
        .input('area', sql.NVarChar, n === 1 ? 'Primary' : 'Secondary')
        .query(`INSERT INTO dbo.production_lines (line_id, plant_id, line_name, line_area)
                VALUES (@id, @plant, @name, @area)`);
      for (let m = 1; m <= 2; m++) {
        await pool.request()
          .input('id', sql.UniqueIdentifier, uuid())
          .input('line', sql.UniqueIdentifier, lineId)
          .input('plant', sql.UniqueIdentifier, plant.plant_id)
          .input('name', sql.NVarChar, `${code}-${n}-Machine-${m}`)
          .input('type', sql.NVarChar, m === 1 ? 'Tablet Press' : 'Packaging')
          .input('cap', sql.Int, n === 1 ? 1400 : 800)
          .input('crit', sql.NVarChar, n === 1 ? 'Critical' : 'Medium')
          .query(`INSERT INTO dbo.machines
                    (asset_id, line_id, plant_id, machine_name, machine_type, rated_capacity_units_per_hour, commissioning_date, criticality)
                  VALUES (@id, @line, @plant, @name, @type, @cap, '2020-01-15', @crit)`);
      }
    }
    console.log('  lines created for', plant.plant_name);
  }

  const lines = (await pool.request().query(`
    SELECT l.line_id, l.plant_id, l.line_name, p.plant_name,
           ROW_NUMBER() OVER (PARTITION BY l.plant_id ORDER BY l.line_name) AS rn,
           COUNT(*) OVER (PARTITION BY l.plant_id) AS cnt
    FROM dbo.production_lines l
    JOIN dbo.plants p ON p.plant_id = l.plant_id
  `)).recordset;

  const machines = (await pool.request().query(`
    SELECT asset_id, line_id, plant_id, machine_name FROM dbo.machines
  `)).recordset;

  console.log('Reassigning downtime events whose line belongs to another plant');
  const mismatched = (await pool.request().query(`
    SELECT d.downtime_id, d.plant_id
    FROM dbo.downtime_events d
    JOIN dbo.production_lines l ON l.line_id = d.line_id
    WHERE l.plant_id <> d.plant_id
  `)).recordset;
  for (const row of mismatched) {
    const line = lines.find((l) => l.plant_id === row.plant_id);
    const machine = line && machines.find((m) => m.line_id === line.line_id);
    if (!line || !machine) continue;
    await pool.request()
      .input('id', sql.UniqueIdentifier, row.downtime_id)
      .input('line', sql.UniqueIdentifier, line.line_id)
      .input('asset', sql.UniqueIdentifier, machine.asset_id)
      .query('UPDATE dbo.downtime_events SET line_id = @line, asset_id = @asset WHERE downtime_id = @id');
  }
  console.log('  reassigned', mismatched.length);

  const needRuns = plants.filter((p) => p.runs === 0 && PROFILES[p.plant_name]);
  const days = eachWeekday();
  const runRows = [];
  for (const plant of needRuns) {
    const profile = PROFILES[plant.plant_name];
    const plantLines = lines.filter((l) => l.plant_id === plant.plant_id);
    const ops = operators.filter((o) => o.plant_id === plant.plant_id);
    const chosen = [0, 1, 2, 3].map((k) => products[(plants.indexOf(plant) + k) % products.length]);
    for (const day of days) {
      for (const line of plantLines) {
        for (const shift of ['Morning', 'Evening', 'Night']) {
          const op = ops.length ? ops[day.getUTCDate() % ops.length].operator_id : null;
          runRows.push([
            uuid(),
            iso(day),
            shift,
            plant.plant_id,
            line.line_id,
            chosen[day.getUTCMonth() % chosen.length],
            op,
            1, 1, 1, 0,
            7, 8, 9, 40
          ]);
        }
      }
    }
  }
  console.log('Inserting production runs for empty plants:', runRows.length);
  if (runRows.length) {
    await bulk(pool, 'dbo.production_runs', [
      { name: 'production_id', type: sql.UniqueIdentifier, opts: { nullable: false } },
      { name: 'date', type: sql.Date, opts: { nullable: false } },
      { name: 'shift', type: sql.NVarChar(50), opts: { nullable: false } },
      { name: 'plant_id', type: sql.UniqueIdentifier, opts: { nullable: false } },
      { name: 'line_id', type: sql.UniqueIdentifier, opts: { nullable: false } },
      { name: 'product_id', type: sql.UniqueIdentifier, opts: { nullable: false } },
      { name: 'operator_id', type: sql.UniqueIdentifier },
      { name: 'planned_quantity', type: sql.Int, opts: { nullable: false } },
      { name: 'actual_quantity', type: sql.Int, opts: { nullable: false } },
      { name: 'good_quantity', type: sql.Int, opts: { nullable: false } },
      { name: 'rejected_quantity', type: sql.Int },
      { name: 'cycle_time_minutes', type: sql.Decimal(10, 2) },
      { name: 'runtime_hours', type: sql.Decimal(10, 2) },
      { name: 'planned_production_time_hours', type: sql.Decimal(10, 2) },
      { name: 'changeover_time_minutes', type: sql.Int }
    ], runRows);
  }

  console.log('Applying plant, line, shift, season, and year factors to every production run');
  await pool.request().query(`
    WITH line_pos AS (
      SELECT line_id,
        ROW_NUMBER() OVER (PARTITION BY plant_id ORDER BY line_name) AS rn,
        COUNT(*) OVER (PARTITION BY plant_id) AS cnt
      FROM dbo.production_lines
    )
    UPDATE pr
    SET
      planned_quantity = calc.planned,
      actual_quantity = calc.actual,
      good_quantity = calc.good,
      rejected_quantity = calc.rejected,
      cycle_time_minutes = calc.cycle_time,
      runtime_hours = calc.runtime,
      changeover_time_minutes = calc.changeover,
      updated_at = GETUTCDATE()
    FROM dbo.production_runs pr
    JOIN dbo.plants p ON p.plant_id = pr.plant_id
    JOIN line_pos lp ON lp.line_id = pr.line_id
    CROSS APPLY (
      SELECT
        CASE p.plant_name
          WHEN 'Tokyo Manufacturing' THEN 1.35 WHEN 'Shanghai Manufacturing' THEN 1.22
          WHEN 'Plant Gamma' THEN 1.18 WHEN 'Singapore Manufacturing' THEN 1.08
          WHEN 'Berlin Manufacturing' THEN 1.00 WHEN 'Plant Alpha' THEN 0.96
          WHEN 'Toronto Manufacturing' THEN 0.90 WHEN N'São Paulo Manufacturing' THEN 0.74
          WHEN 'Plant Beta' THEN 0.70 WHEN 'Mexico City Manufacturing' THEN 0.58
          WHEN 'Dubai Manufacturing' THEN 0.46 ELSE 1.00
        END AS vol,
        CASE p.plant_name
          WHEN 'Tokyo Manufacturing' THEN 0.95 WHEN 'Plant Gamma' THEN 0.93
          WHEN 'Singapore Manufacturing' THEN 0.92 WHEN 'Berlin Manufacturing' THEN 0.88
          WHEN 'Toronto Manufacturing' THEN 0.85 WHEN 'Plant Alpha' THEN 0.84
          WHEN 'Shanghai Manufacturing' THEN 0.78 WHEN N'São Paulo Manufacturing' THEN 0.75
          WHEN 'Plant Beta' THEN 0.73 WHEN 'Mexico City Manufacturing' THEN 0.69
          WHEN 'Dubai Manufacturing' THEN 0.64 ELSE 0.85
        END AS att,
        CASE p.plant_name
          WHEN 'Tokyo Manufacturing' THEN 0.010 WHEN 'Plant Gamma' THEN 0.012
          WHEN 'Singapore Manufacturing' THEN 0.016 WHEN 'Berlin Manufacturing' THEN 0.024
          WHEN 'Plant Alpha' THEN 0.028 WHEN 'Toronto Manufacturing' THEN 0.033
          WHEN 'Shanghai Manufacturing' THEN 0.052 WHEN N'São Paulo Manufacturing' THEN 0.061
          WHEN 'Plant Beta' THEN 0.068 WHEN 'Mexico City Manufacturing' THEN 0.082
          WHEN 'Dubai Manufacturing' THEN 0.105 ELSE 0.030
        END AS rej,
        CASE WHEN lp.cnt <= 1 THEN 1.0
             ELSE 0.62 + (lp.rn - 1) * (0.76 / (lp.cnt - 1)) END AS line_factor,
        CASE pr.shift WHEN 'Morning' THEN 1.14 WHEN 'Night' THEN 0.84 ELSE 1.00 END AS shift_vol,
        CASE pr.shift WHEN 'Morning' THEN 1.02 WHEN 'Night' THEN 0.95 ELSE 1.00 END AS shift_att,
        CASE MONTH(pr.date)
          WHEN 1 THEN 1.16 WHEN 2 THEN 1.10 WHEN 3 THEN 1.06 WHEN 4 THEN 0.94
          WHEN 5 THEN 0.90 WHEN 6 THEN 0.86 WHEN 7 THEN 0.82 WHEN 8 THEN 0.86
          WHEN 9 THEN 0.96 WHEN 10 THEN 1.12 WHEN 11 THEN 1.20 ELSE 1.14
        END AS season,
        (1.0 + (YEAR(pr.date) - 2022) * 0.03) AS year_factor,
        (0.94 + (ABS(CHECKSUM(pr.production_id)) % 12) / 100.0) AS noise
    ) f
    CROSS APPLY (
      SELECT
        CASE WHEN CAST(ROUND(11000 * f.season * f.year_factor * f.vol * f.line_factor * f.shift_vol * f.noise, 0) AS int) < 1
             THEN 1
             ELSE CAST(ROUND(11000 * f.season * f.year_factor * f.vol * f.line_factor * f.shift_vol * f.noise, 0) AS int)
        END AS planned
    ) p1
    CROSS APPLY (
      SELECT
        CASE WHEN CAST(ROUND(p1.planned * f.att * f.shift_att, 0) AS int) < 1 THEN 1
             ELSE CAST(ROUND(p1.planned * f.att * f.shift_att, 0) AS int) END AS good
    ) g
    CROSS APPLY (
      SELECT
        CASE WHEN CAST(ROUND(g.good / NULLIF(1.0 - f.rej, 0), 0) AS int) < g.good THEN g.good
             ELSE CAST(ROUND(g.good / NULLIF(1.0 - f.rej, 0), 0) AS int) END AS actual
    ) a
    CROSS APPLY (
      SELECT
        p1.planned AS planned,
        a.actual AS actual,
        g.good AS good,
        a.actual - g.good AS rejected,
        CAST(ROUND(8.5 / NULLIF(f.att * f.line_factor, 0), 2) AS decimal(10,2)) AS cycle_time,
        CAST(ROUND(7.2 + f.shift_vol, 2) AS decimal(10,2)) AS runtime,
        CAST(ROUND(25 + (1.0 - f.att) * 80, 0) AS int) AS changeover
    ) calc
  `);

  const needQuality = (await pool.request().query(`
    SELECT p.plant_id, p.plant_name
    FROM dbo.plants p
    WHERE NOT EXISTS (SELECT 1 FROM dbo.quality_tests q WHERE q.plant_id = p.plant_id)
  `)).recordset.filter((p) => PROFILES[p.plant_name]);

  const qualityRows = [];
  for (const plant of needQuality) {
    const plantLines = lines.filter((l) => l.plant_id === plant.plant_id);
    const profile = PROFILES[plant.plant_name];
    const chosen = [0, 1, 2, 3].map((k) => products[k % products.length]);
    for (const day of days) {
      for (const line of plantLines) {
        const produced = Math.max(1, Math.round(8000 * profile.vol * (line.rn === 1 ? 1.2 : 0.75) * SEASON[day.getUTCMonth() + 1]));
        const rejected = Math.round(produced * profile.rej);
        qualityRows.push([
          uuid(),
          `BATCH-${uuid().slice(0, 8).toUpperCase()}`,
          iso(day),
          plant.plant_id,
          line.line_id,
          chosen[day.getUTCMonth() % chosen.length],
          produced,
          rejected,
          Math.round(rejected * 0.45),
          rejected > 0 ? 'Dimension' : null,
          rejected === 0 ? 'Pass' : (profile.rej > 0.05 ? 'Fail' : 'Rework'),
          rejected === 0 ? null : (profile.rej > 0.07 ? 'Major' : 'Minor'),
          rejected > 0 ? 'Out of Spec' : null
        ]);
      }
    }
  }
  console.log('Inserting quality tests:', qualityRows.length);
  if (qualityRows.length) {
    await bulk(pool, 'dbo.quality_tests', [
      { name: 'quality_id', type: sql.UniqueIdentifier, opts: { nullable: false } },
      { name: 'batch_id', type: sql.NVarChar(100) },
      { name: 'date', type: sql.Date, opts: { nullable: false } },
      { name: 'plant_id', type: sql.UniqueIdentifier, opts: { nullable: false } },
      { name: 'line_id', type: sql.UniqueIdentifier, opts: { nullable: false } },
      { name: 'product_id', type: sql.UniqueIdentifier, opts: { nullable: false } },
      { name: 'produced_quantity', type: sql.Int, opts: { nullable: false } },
      { name: 'rejected_quantity', type: sql.Int, opts: { nullable: false } },
      { name: 'rework_quantity', type: sql.Int },
      { name: 'defect_type', type: sql.NVarChar(255) },
      { name: 'inspection_result', type: sql.NVarChar(50) },
      { name: 'defect_severity', type: sql.NVarChar(50) },
      { name: 'scrap_reason', type: sql.NVarChar(255) }
    ], qualityRows);
  }

  console.log('Rescaling quality rejection on plants that already had tests');
  await pool.request().query(`
    UPDATE q
    SET
      rejected_quantity = CAST(ROUND(q.produced_quantity * f.rej, 0) AS int),
      rework_quantity = CAST(ROUND(q.produced_quantity * f.rej * 0.45, 0) AS int),
      inspection_result = CASE WHEN q.produced_quantity * f.rej < 1 THEN 'Pass' WHEN f.rej > 0.05 THEN 'Fail' ELSE 'Rework' END,
      defect_type = CASE WHEN q.produced_quantity * f.rej < 1 THEN NULL ELSE 'Dimension' END,
      defect_severity = CASE WHEN q.produced_quantity * f.rej < 1 THEN NULL WHEN f.rej > 0.07 THEN 'Major' ELSE 'Minor' END,
      scrap_reason = CASE WHEN q.produced_quantity * f.rej < 1 THEN NULL ELSE 'Out of Spec' END,
      updated_at = GETUTCDATE()
    FROM dbo.quality_tests q
    JOIN dbo.plants p ON p.plant_id = q.plant_id
    CROSS APPLY (
      SELECT CASE p.plant_name
        WHEN 'Tokyo Manufacturing' THEN 0.010 WHEN 'Plant Gamma' THEN 0.012
        WHEN 'Singapore Manufacturing' THEN 0.016 WHEN 'Berlin Manufacturing' THEN 0.024
        WHEN 'Plant Alpha' THEN 0.028 WHEN 'Toronto Manufacturing' THEN 0.033
        WHEN 'Shanghai Manufacturing' THEN 0.052 WHEN N'São Paulo Manufacturing' THEN 0.061
        WHEN 'Plant Beta' THEN 0.068 WHEN 'Mexico City Manufacturing' THEN 0.082
        WHEN 'Dubai Manufacturing' THEN 0.105 ELSE 0.030
      END AS rej
    ) f
    WHERE p.plant_name IN ('Plant Alpha', 'Plant Beta', 'Plant Gamma')
  `);

  const needCosts = (await pool.request().query(`
    SELECT p.plant_id, p.plant_name
    FROM dbo.plants p
    WHERE NOT EXISTS (SELECT 1 FROM dbo.cost_records c WHERE c.plant_id = p.plant_id)
  `)).recordset.filter((p) => PROFILES[p.plant_name]);
  const weeks = eachWeek();
  const costRows = [];
  for (const plant of needCosts) {
    const profile = PROFILES[plant.plant_name];
    const plantLines = lines.filter((l) => l.plant_id === plant.plant_id);
    for (const week of weeks) {
      for (const line of plantLines) {
        const units = Math.round(14000 * profile.vol * (line.rn === 1 ? 1.2 : 0.75) * SEASON[week.getUTCMonth() + 1]);
        const labor = Math.round(units * 0.42 * profile.cost);
        const energy = Math.round(units * 0.11 * profile.cost);
        const scrap = Math.round(units * profile.rej * 2.4 * profile.cost);
        const maint = Math.round(units * profile.down * 0.8 * profile.cost);
        const actual = (labor + energy + scrap + maint) / Math.max(units, 1);
        costRows.push([
          uuid(),
          `PO-${uuid().slice(0, 8).toUpperCase()}`,
          iso(week),
          plant.plant_id,
          line.line_id,
          products[0],
          labor,
          maint,
          scrap,
          Math.round(units * 0.08),
          energy,
          Math.round(actual * 0.9 * 100) / 100,
          Math.round(actual * 100) / 100,
          units
        ]);
      }
    }
  }
  console.log('Inserting cost records:', costRows.length);
  if (costRows.length) {
    await bulk(pool, 'dbo.cost_records', [
      { name: 'cost_id', type: sql.UniqueIdentifier, opts: { nullable: false } },
      { name: 'production_order_id', type: sql.NVarChar(100) },
      { name: 'date', type: sql.Date, opts: { nullable: false } },
      { name: 'plant_id', type: sql.UniqueIdentifier, opts: { nullable: false } },
      { name: 'line_id', type: sql.UniqueIdentifier, opts: { nullable: false } },
      { name: 'product_id', type: sql.UniqueIdentifier, opts: { nullable: false } },
      { name: 'labor_cost', type: sql.Decimal(15, 2) },
      { name: 'maintenance_cost', type: sql.Decimal(15, 2) },
      { name: 'scrap_cost', type: sql.Decimal(15, 2) },
      { name: 'energy_kwh', type: sql.Decimal(15, 2) },
      { name: 'energy_cost', type: sql.Decimal(15, 2) },
      { name: 'standard_cost_per_unit', type: sql.Decimal(15, 2) },
      { name: 'actual_cost_per_unit', type: sql.Decimal(15, 2) },
      { name: 'units_produced', type: sql.Int }
    ], costRows);
  }

  const needInv = (await pool.request().query(`
    SELECT p.plant_id, p.plant_name
    FROM dbo.plants p
    WHERE NOT EXISTS (SELECT 1 FROM dbo.inventory_transactions i WHERE i.plant_id = p.plant_id)
  `)).recordset.filter((p) => PROFILES[p.plant_name]);
  const invRows = [];
  for (const plant of needInv) {
    const profile = PROFILES[plant.plant_name];
    const mats = materials.slice(0, 4);
    for (const week of weeks) {
      mats.forEach((mat, idx) => {
        const issued = Math.round((4000 + idx * 500) * profile.vol);
        const shortage = Math.round(issued * profile.short);
        invRows.push([
          uuid(),
          iso(week),
          plant.plant_id,
          mat.material_id,
          mat.supplier_id,
          issued + 2000,
          issued + 2000 - issued - shortage,
          issued,
          shortage,
          `LOT-${week.getUTCFullYear()}${String(week.getUTCMonth() + 1).padStart(2, '0')}`,
          issued,
          issued + shortage,
          2.5,
          2.2
        ]);
      });
    }
  }
  console.log('Inserting inventory rows:', invRows.length);
  if (invRows.length) {
    await bulk(pool, 'dbo.inventory_transactions', [
      { name: 'inventory_id', type: sql.UniqueIdentifier, opts: { nullable: false } },
      { name: 'date', type: sql.Date, opts: { nullable: false } },
      { name: 'plant_id', type: sql.UniqueIdentifier, opts: { nullable: false } },
      { name: 'material_id', type: sql.UniqueIdentifier, opts: { nullable: false } },
      { name: 'supplier_id', type: sql.UniqueIdentifier },
      { name: 'opening_stock_units', type: sql.Int },
      { name: 'closing_stock_units', type: sql.Int },
      { name: 'stock_issued_to_production', type: sql.Int },
      { name: 'shortages_quantity', type: sql.Int },
      { name: 'batch_lot_number', type: sql.NVarChar(100) },
      { name: 'standard_usage_quantity', type: sql.Decimal(10, 2) },
      { name: 'actual_usage_quantity', type: sql.Int },
      { name: 'purchase_cost_per_unit', type: sql.Decimal(15, 2) },
      { name: 'standard_cost', type: sql.Decimal(15, 2) }
    ], invRows);
  }

  const already = new Set(
    (await pool.request().query(`
      SELECT DISTINCT p.plant_name
      FROM dbo.downtime_events d
      JOIN dbo.plants p ON p.plant_id = d.plant_id
      WHERE d.comments LIKE 'gap-fill:%'
    `)).recordset.map((r) => r.plant_name)
  );
  let downAdded = 0;
  for (const plant of plants.filter((p) => PROFILES[p.plant_name] && !already.has(p.plant_name) && CODES[p.plant_name])) {
    const profile = PROFILES[plant.plant_name];
    const plantLines = lines.filter((l) => l.plant_id === plant.plant_id);
    const plantMachines = machines.filter((m) => m.plant_id === plant.plant_id);
    if (!plantLines.length || !plantMachines.length) continue;
    const events = Math.round(40 + profile.down * 400);
    for (let i = 0; i < events; i++) {
      const day = days[Math.floor((i * 17) % days.length)];
      const line = plantLines[i % plantLines.length];
      const machine = plantMachines.find((m) => m.line_id === line.line_id) || plantMachines[0];
      const minutes = Math.round(20 + profile.down * 400 + (i % 5) * 15);
      const start = new Date(day.getTime());
      start.setUTCHours(8, 0, 0, 0);
      const end = new Date(start.getTime() + minutes * 60000);
      const category = profile.rej > 0.06 ? 'Breakdown' : (i % 3 === 0 ? 'Changeover' : 'Material');
      await pool.request()
        .input('id', sql.UniqueIdentifier, uuid())
        .input('start', sql.DateTime, start)
        .input('end', sql.DateTime, end)
        .input('mins', sql.Int, minutes)
        .input('plant', sql.UniqueIdentifier, plant.plant_id)
        .input('line', sql.UniqueIdentifier, line.line_id)
        .input('asset', sql.UniqueIdentifier, machine.asset_id)
        .input('cat', sql.NVarChar, category)
        .input('comment', sql.NVarChar, `gap-fill:${plant.plant_name}`)
        .query(`INSERT INTO dbo.downtime_events
                  (downtime_id, event_start_datetime, event_end_datetime, duration_minutes, plant_id, line_id, asset_id,
                   planned_vs_unplanned, reason_code, failure_mode, category, comments)
                VALUES (@id, @start, @end, @mins, @plant, @line, @asset, 'Unplanned', 'MECH-001', 'Pressure Issue', @cat, @comment)`);
      downAdded += 1;
    }
  }
  console.log('Added downtime events:', downAdded);

  const summary = await pool.request().query(`
    SELECT p.plant_name,
      (SELECT COUNT(*) FROM dbo.production_runs r WHERE r.plant_id = p.plant_id) AS runs,
      (SELECT CAST(AVG(CAST(good_quantity AS float)) AS decimal(12,0)) FROM dbo.production_runs r WHERE r.plant_id = p.plant_id) AS avg_good,
      (SELECT CAST(SUM(good_quantity) * 100.0 / NULLIF(SUM(planned_quantity),0) AS decimal(6,1)) FROM dbo.production_runs r WHERE r.plant_id = p.plant_id) AS attainment
    FROM dbo.plants p
    ORDER BY avg_good DESC
  `);
  console.table(summary.recordset);
  await pool.close();
  console.log('Done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
