/**
 * Localise the three demo databases for Pakistan: amounts in PKR, local names and places.
 *
 *   node init/localize_pkr.js snapshot --to localhost:1433 [apex|sales|mfg ...]
 *       Read the databases from the server in api/.env and write an exact copy, under the
 *       same names, to the SQL Server at --to (user sa, password MSSQL_PASSWORD). Only
 *       SELECTs run against the source. A rerun resumes, keeping tables already copied in full.
 *   node init/localize_pkr.js apply --on <host> [apex|sales|mfg ...]
 *       Localise the databases on the server in api/.env, in place. --on must name that
 *       server's host, so the target is never a surprise. Each database is one
 *       transaction: row counts and every money total are checked against RATE x their
 *       starting values before it commits, so a mismatch leaves the database untouched.
 *       A database that was already localised is refused, so amounts never multiply twice.
 *   node init/localize_pkr.js verify [apex|sales|mfg ...]
 *       Check a localised database: marker present, names unique, no USD, foreign place
 *       or placeholder name left in any text column, no column named in USD.
 *
 * Test locally first: snapshot to a local SQL Server, then run apply and verify with
 * DB_HOST, DB_PORT, DB_USER and DB_PASSWORD for it on the command line; variables already
 * set in the environment take precedence over api/.env.
 *
 * What apply changes:
 *   Apex   every money column x RATE, currency and units to PKR, *_usd columns renamed *_pkr,
 *          entities and offices moved to Pakistani cities,
 *          customer, vendor, offering and audit finding names replaced, "Synthetic" dropped
 *          from ledger descriptions and KPI definitions.
 *   Mfg    every cost column x RATE, plants, lines and machines moved to Pakistani cities,
 *          operator and supplier names replaced.
 *   Sales  amounts unchanged: value_sold is already a believable rupee figure (about 176 a pack).
 *          Doctor, hospital, city, pharmacy and rep names replaced.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../api/.env') });
const sql = require('../api/node_modules/mssql');
const names = require('./localize_pkr_names');

// PKR per USD, fixed so every figure converts the same way.
const RATE = 280;
const MARKER = 'localized_pkr';

const DATABASES = { apex: 'apex_agent_demo', sales: 'sales_agent_demo', mfg: 'manufacturing_agent_demo' };

// Money columns by table, under their names before localisation.
const MONEY = {
  apex: {
    action_catalog: ['estimated_cost_usd', 'expected_benefit_usd_m'],
    action_recommendation: ['gross_financial_benefit_usd', 'implementation_cost_usd', 'net_financial_benefit_usd', 'cash_benefit_usd'],
    dim_employee: ['base_salary'],
    dim_product_service: ['list_price'],
    fact_ap_invoice_payment: ['invoice_amount'],
    fact_ar_invoice_payment: ['invoice_amount', 'outstanding_amount'],
    fact_audit_finding: ['monetary_exposure'],
    fact_budget_forecast: ['budget_amount', 'forecast_amount', 'actual_amount'],
    fact_cash_position: ['opening_balance', 'cash_inflow', 'cash_outflow', 'closing_balance', 'restricted_cash'],
    fact_contract_pipeline: ['booking_value'],
    fact_control_exception: ['monetary_exposure'],
    fact_customer_monthly: ['revenue', 'gross_margin', 'credit_notes', 'outstanding_balance'],
    fact_customer_service: ['credit_note_amount'],
    fact_employee_monthly: ['base_pay_monthly', 'variable_pay_monthly'],
    fact_gl_transaction: ['debit', 'credit'],
    fact_manual_journal: ['amount'],
    fact_sales_transaction: ['list_price', 'net_revenue', 'direct_cost', 'gross_margin'],
    fact_vacancy_recruitment: ['recruitment_cost'],
    pred_control_risk: ['expected_monetary_exposure'],
    pred_customer_risk: ['revenue_at_risk', 'cash_at_risk'],
    pred_financial_forecast: ['revenue_forecast', 'gross_margin_forecast', 'ebitda_forecast', 'operating_cash_flow_forecast', 'revenue_low', 'revenue_high'],
    pred_workforce_risk: ['revenue_or_service_impact_usd'],
    scenario_simulation: ['investment_usd_m', 'six_month_net_cash_benefit_usd_m'],
    serving_control_risk_scorecard_quarterly: ['monetary_exposure'],
    serving_executive_scorecard_monthly: ['revenue', 'gross_margin', 'workforce_cost', 'outstanding_ar', 'disputed_ar', 'control_exposure', 'ebitda', 'operating_cash_flow'],
    serving_margin_bridge: ['estimated_ebitda_impact_usd'],
  },
  mfg: {
    cost_records: ['labor_cost', 'maintenance_cost', 'scrap_cost', 'energy_cost', 'standard_cost_per_unit', 'actual_cost_per_unit'],
    inventory_transactions: ['purchase_cost_per_unit', 'standard_cost'],
    maintenance_records: ['maintenance_cost'],
  },
  sales: {},
};

// Apex columns named after the dollar: _usd becomes _pkr, _usd_m becomes _pkr_m.
const renamed = (column) => column.replace(/_usd(_m)?$/, '_pkr$1');
const USD_COLUMNS = Object.entries(MONEY.apex).flatMap(([table, cols]) =>
  cols.filter((c) => renamed(c) !== c).map((c) => ({ table, column: c })));

// The investment ceilings are stored in USD millions with unit 'USDm'.
const CONSTRAINT_UNIT = { from: 'USDm', to: 'PKR m' };

// usd anywhere, so _usd column names and USDm units are caught too.
const FOREIGN_TEXT = /usd|\$|\bdollars?\b|\b(New York|London|Sao Paulo|São Paulo|Singapore|Canada|Europe|Latin|Asia|Berlin|Tokyo|Dubai|Toronto|Shanghai|Mexico|Los Angeles|Dallas|Chicago)\b|\bOffering \d+\b|Synthetic (composite|Customer|Vendor|audit finding|Payroll|Sales|Accrual|Allocation|AP expense|Cash receipt|Depreciation)/i;

function connect(database = 'master', server = {}) {
  return new sql.ConnectionPool({
    server: server.host || process.env.DB_HOST,
    port: parseInt(server.port || process.env.DB_PORT, 10),
    user: server.user || process.env.DB_USER,
    password: server.password || process.env.DB_PASSWORD,
    database,
    requestTimeout: 900000,
    connectionTimeout: 60000,
    pool: { max: 1 },
    options: { trustServerCertificate: true, encrypt: true },
  }).connect();
}

const quote = (s) => `N'${String(s).replace(/'/g, "''")}'`;

/** UPDATE target rows from (key, value...) pairs, 500 rows per statement. */
async function updateFrom(run, table, key, rows, columns) {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const values = chunk.map((r) => `(${[r[key], ...columns.map((c) => r[c])].map(quote).join(', ')})`).join(',\n');
    const sets = columns.map((c) => `t.[${c}] = v.[${c}]`).join(', ');
    await run(`UPDATE t SET ${sets}
      FROM [${table}] t JOIN (VALUES ${values}) v([${key}], ${columns.map((c) => `[${c}]`).join(', ')})
        ON CAST(t.[${key}] AS nvarchar(64)) = v.[${key}]`);
  }
}

/** Make room for longer names, keeping the column's nullability. */
async function widen(run, read, table, column, chars) {
  const [c] = await read(`SELECT is_nullable FROM sys.columns WHERE object_id = OBJECT_ID(${quote(table)}) AND name = ${quote(column)}`);
  await run(`ALTER TABLE [${table}] ALTER COLUMN [${column}] nvarchar(${chars}) ${c.is_nullable ? 'NULL' : 'NOT NULL'}`);
}

async function multiplyMoney(run, which) {
  for (const [table, cols] of Object.entries(MONEY[which])) {
    await run(`UPDATE [${table}] SET ${cols.map((c) => `[${c}] = [${c}] * ${RATE}`).join(', ')}`);
  }
}

async function localiseApex(run, read) {
  await multiplyMoney(run, 'apex');
  await run(`UPDATE decision_constraint SET constraint_value = constraint_value * ${RATE}, unit = ${quote(CONSTRAINT_UNIT.to)}
    WHERE unit = ${quote(CONSTRAINT_UNIT.from)}`);
  for (const { table, column } of USD_COLUMNS) await run(`EXEC sp_rename '${table}.${column}', '${renamed(column)}', 'COLUMN'`);

  for (const table of ['dim_organisation', 'dim_employee', 'fact_gl_transaction', 'fact_sales_transaction', 'fact_cash_position']) {
    await run(`UPDATE [${table}] SET currency = 'PKR'`);
  }
  await run(`UPDATE meta_kpi_definition SET unit = 'PKR' WHERE unit = 'USD'`);

  // "within the USD 2m ... constraints" names the ceiling, so it converts with it.
  for (const r of await read('SELECT scenario_result_id, rationale FROM scenario_simulation')) {
    const text = r.rationale.replace(/USD (\d+(?:\.\d+)?)m/g, (_, m) => `PKR ${+(m * RATE).toFixed(1)}m`);
    if (text !== r.rationale) await run(`UPDATE scenario_simulation SET rationale = ${quote(text)} WHERE scenario_result_id = ${quote(r.scenario_result_id)}`);
  }
  await run(`UPDATE action_recommendation SET rationale = REPLACE(rationale, ' for this synthetic scope', ' for this scope')`);
  await run(`UPDATE fact_gl_transaction SET description = journal_type WHERE description = 'Synthetic ' + journal_type`);
  await run(`UPDATE meta_kpi_definition SET definition = REPLACE(definition, 'Synthetic composite index', 'Composite index')`);

  for (const [id, e] of Object.entries(names.APEX_ENTITIES)) {
    await run(`UPDATE dim_organisation SET entity = ${quote(e.entity)}, location = ${quote(e.location)} WHERE entity_id = ${quote(id)}`);
    await run(`UPDATE pred_control_risk SET entity = ${quote(e.entity)} WHERE entity_id = ${quote(id)}`);
  }

  await widen(run, read, 'dim_customer', 'customer_name', 120);
  const customer = names.customerPicker();
  const customers = (await read('SELECT customer_id, industry, segment FROM dim_customer ORDER BY customer_id'))
    .map((r) => ({ customer_id: r.customer_id, customer_name: customer(r.industry, r.segment) }));
  await updateFrom(run, 'dim_customer', 'customer_id', customers, ['customer_name']);

  await widen(run, read, 'dim_vendor', 'vendor_name', 120);
  const vendor = names.vendorPicker();
  const vendors = (await read('SELECT vendor_id, category FROM dim_vendor ORDER BY vendor_id'))
    .map((r) => ({ vendor_id: r.vendor_id, vendor_name: vendor(r.category) }));
  await updateFrom(run, 'dim_vendor', 'vendor_id', vendors, ['vendor_name']);

  const offerings = await read('SELECT offering_id, business_unit FROM dim_product_service ORDER BY offering_id');
  const seen = {};
  await updateFrom(run, 'dim_product_service', 'offering_id', offerings.map((r) => {
    const list = names.OFFERINGS[r.business_unit];
    const i = (seen[r.business_unit] = (seen[r.business_unit] || 0) + 1) - 1;
    if (!list || i >= list.length) throw new Error(`no offering name for ${r.offering_id} (${r.business_unit})`);
    return { offering_id: r.offering_id, offering_name: list[i] };
  }), ['offering_name']);

  await widen(run, read, 'fact_audit_finding', 'finding_title', 200);
  const findings = (await read('SELECT finding_id, process FROM fact_audit_finding ORDER BY finding_id'))
    .map((r) => ({ finding_id: r.finding_id, finding_title: names.choose(names.FINDINGS[r.process], r.finding_id) }));
  await updateFrom(run, 'fact_audit_finding', 'finding_id', findings, ['finding_title']);

  for (const v of await read("SELECT name FROM sys.views WHERE is_ms_shipped = 0")) await run(`EXEC sp_refreshview '${v.name}'`);
}

async function localiseSales(run, read) {
  const person = names.personPicker('sales-people');
  const hospital = names.hospitalPicker();
  const doctors = (await read('SELECT doctor_id, region FROM doctors ORDER BY doctor_id')).map((r) => ({
    doctor_id: r.doctor_id,
    doctor_name: `Dr. ${person()}`,
    hospital_clinic: hospital(),
    city: names.choose(names.SALES_CITIES[r.region], r.doctor_id),
  }));
  await updateFrom(run, 'doctors', 'doctor_id', doctors, ['doctor_name', 'hospital_clinic', 'city']);

  const reps = (await read('SELECT rep_id FROM sales_reps ORDER BY rep_id')).map((r) => ({ rep_id: r.rep_id, name: person() }));
  await updateFrom(run, 'sales_reps', 'rep_id', reps, ['name']);

  const pharmacy = names.pharmacyPicker();
  const pharmacies = (await read('SELECT pharmacy_id, channel FROM pharmacies ORDER BY pharmacy_id'))
    .map((r) => ({ pharmacy_id: r.pharmacy_id, name: pharmacy(r.channel) }));
  await updateFrom(run, 'pharmacies', 'pharmacy_id', pharmacies, ['name']);
}

async function localiseMfg(run, read) {
  await multiplyMoney(run, 'mfg');

  const plants = await read('SELECT plant_id, plant_name FROM plants');
  const unknown = plants.filter((p) => !names.PLANTS[p.plant_name]);
  if (unknown.length) throw new Error(`no Pakistani location for plant ${unknown.map((p) => p.plant_name).join(', ')}`);
  for (const p of plants) {
    const to = names.PLANTS[p.plant_name];
    await run(`UPDATE plants SET plant_name = ${quote(to.name)}, location = ${quote(to.location)}, region = ${quote(to.region)}
      WHERE plant_id = ${quote(p.plant_id)}`);
    await run(`UPDATE downtime_events SET comments = REPLACE(comments, ${quote(p.plant_name)}, ${quote(to.name)})
      WHERE comments LIKE ${quote(`%${p.plant_name}%`)}`);
    if (to.from) {
      await run(`UPDATE production_lines SET line_name = REPLACE(line_name, ${quote(`-${to.from}-`)}, ${quote(`-${to.to}-`)})
        WHERE plant_id = ${quote(p.plant_id)}`);
      await run(`UPDATE machines SET machine_name = ${quote(to.to)} + SUBSTRING(machine_name, ${to.from.length + 1}, 200)
        WHERE plant_id = ${quote(p.plant_id)} AND machine_name LIKE ${quote(`${to.from}-%`)}`);
    }
  }

  const person = names.personPicker('mfg-operators');
  const operators = (await read('SELECT operator_id FROM operators ORDER BY operator_id')).map((r) => ({ operator_id: r.operator_id, name: person() }));
  await updateFrom(run, 'operators', 'operator_id', operators, ['name']);

  for (const [from, to] of Object.entries(names.SUPPLIERS)) {
    await run(`UPDATE suppliers SET supplier_name = ${quote(to)} WHERE supplier_name = ${quote(from)}`);
  }
}

const LOCALISE = { apex: localiseApex, sales: localiseSales, mfg: localiseMfg };

async function marker(pool) {
  const r = await pool.request().query(`SELECT CAST(value AS nvarchar(200)) v FROM sys.extended_properties WHERE class = 0 AND name = '${MARKER}'`);
  return r.recordset[0] ? r.recordset[0].v : null;
}

/** CREATE TABLE text for one source table, from its column metadata and primary key. */
async function tableDefinition(src, table) {
  const cols = (await src.request().query(`SELECT c.name, ty.name type, c.max_length, c.precision, c.scale, c.is_nullable
      FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
      WHERE c.object_id = OBJECT_ID(${quote(table)}) ORDER BY c.column_id`)).recordset;
  const type = (c) => {
    if (['nvarchar', 'nchar'].includes(c.type)) return `${c.type}(${c.max_length === -1 ? 'max' : c.max_length / 2})`;
    if (['varchar', 'char', 'varbinary'].includes(c.type)) return `${c.type}(${c.max_length === -1 ? 'max' : c.max_length})`;
    if (['decimal', 'numeric'].includes(c.type)) return `${c.type}(${c.precision}, ${c.scale})`;
    return c.type;
  };
  const pk = (await src.request().query(`SELECT col.name FROM sys.indexes i
      JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
      JOIN sys.columns col ON col.object_id = ic.object_id AND col.column_id = ic.column_id
      WHERE i.object_id = OBJECT_ID(${quote(table)}) AND i.is_primary_key = 1 ORDER BY ic.key_ordinal`)).recordset.map((r) => `[${r.name}]`);
  const body = cols.map((c) => `[${c.name}] ${type(c)} ${c.is_nullable ? 'NULL' : 'NOT NULL'}`);
  if (pk.length) body.push(`PRIMARY KEY (${pk.join(', ')})`);
  return { columns: cols, create: `CREATE TABLE [${table}] (${body.join(', ')})` };
}

/** Copy one database, tables, rows and views, from the api/.env server to a local one. */
async function snapshot(which, to) {
  const name = DATABASES[which];
  const [host, port = '1433'] = to.split(':');
  const local = { host, port, user: 'sa', password: process.env.MSSQL_PASSWORD };
  if (!local.password) throw new Error('set MSSQL_PASSWORD to the local SQL Server sa password');
  const master = await connect('master', local);
  const exists = await master.request().query(`SELECT 1 FROM sys.databases WHERE name = ${quote(name)}`);
  if (!exists.recordset.length) await master.request().query(`CREATE DATABASE [${name}]`);
  await master.close();

  // A rerun resumes: tables already copied in full are kept, the rest are copied again.
  const dst = await connect(name, local);
  try {
    if (await marker(dst)) throw new Error(`${name} at ${to} is already localised; drop it to take a fresh snapshot`);
    const tables = await retry(async () => {
      const src = await connect(name);
      try {
        return (await src.request().query('SELECT name FROM sys.tables WHERE is_ms_shipped = 0 ORDER BY name')).recordset.map((r) => r.name);
      } finally {
        await src.close();
      }
    }, `list tables of ${name}`);
    for (const table of tables) {
      const copied = await retry(() => copyTable(name, table, dst), `copy ${table}`);
      console.log(`  ${name}.${table}: ${copied} rows`);
    }
    await retry(async () => {
      const src = await connect(name);
      try {
        const views = (await src.request().query('SELECT v.name, m.definition FROM sys.sql_modules m JOIN sys.views v ON v.object_id = m.object_id')).recordset;
        for (const v of views) {
          await dst.request().query(`IF OBJECT_ID(${quote(v.name)}, 'V') IS NOT NULL DROP VIEW [${v.name}]`);
          await dst.request().batch(v.definition);
        }
      } finally {
        await src.close();
      }
    }, `copy views of ${name}`);
  } finally {
    await dst.close();
  }
}

/** Copy one table on a fresh source connection, unless the local copy is already complete. */
async function copyTable(database, table, dst) {
  const src = await connect(database);
  try {
    const [{ n }] = (await src.request().query(`SELECT COUNT(*) n FROM [${table}]`)).recordset;
    const have = (await dst.request().query(`SELECT CASE WHEN OBJECT_ID(${quote(table)}, 'U') IS NULL THEN -1 ELSE (SELECT SUM(rows) FROM sys.partitions WHERE object_id = OBJECT_ID(${quote(table)}) AND index_id IN (0, 1)) END n`)).recordset[0].n;
    if (Number(have) === n) return n;
    const def = await tableDefinition(src, table);
    await dst.request().query(`IF OBJECT_ID(${quote(table)}, 'U') IS NOT NULL DROP TABLE [${table}]; ${def.create}`);
    const copied = await copyRows(src, table, def.columns, dst);
    if (copied !== n) throw new Error(`copied ${copied} rows, source has ${n}`);
    return copied;
  } finally {
    await src.close();
  }
}

/** Stream one table from the source and bulk insert it in batches of 10,000 rows. */
async function copyRows(src, table, columns, dst) {
  const batch = () => {
    const t = new sql.Table(table);
    for (const c of columns) t.columns.add(c.name, columnType(c), { nullable: !!c.is_nullable });
    return t;
  };
  return new Promise((resolve, reject) => {
    const req = src.request();
    req.stream = true;
    let current = batch();
    let total = 0;
    let writing = Promise.resolve();
    const flush = () => {
      const full = current;
      current = batch();
      req.pause();
      writing = writing.then(() => dst.request().bulk(full)).then(() => req.resume(), reject);
    };
    req.on('row', (r) => {
      current.rows.add(...columns.map((c) => r[c.name]));
      total++;
      if (current.rows.length >= 10000) flush();
    });
    req.on('error', reject);
    req.on('done', () => {
      writing.then(() => (current.rows.length ? dst.request().bulk(current) : null)).then(() => resolve(total), reject);
    });
    req.query(`SELECT * FROM [${table}]`);
  });
}

async function retry(fn, what, attempts = 4) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= attempts) throw err;
      console.log(`  ${what} failed (${err.message}), retrying in ${i * 5}s`);
      await new Promise((r) => setTimeout(r, i * 5000));
    }
  }
}

function columnType(c) {
  const len = c.max_length === -1 ? sql.MAX : c.max_length;
  switch (c.type) {
    case 'nvarchar': return sql.NVarChar(c.max_length === -1 ? sql.MAX : len / 2);
    case 'nchar': return sql.NChar(len / 2);
    case 'varchar': return sql.VarChar(len);
    case 'char': return sql.Char(len);
    case 'decimal': case 'numeric': return sql.Decimal(c.precision, c.scale);
    case 'int': return sql.Int;
    case 'bigint': return sql.BigInt;
    case 'smallint': return sql.SmallInt;
    case 'tinyint': return sql.TinyInt;
    case 'bit': return sql.Bit;
    case 'float': return sql.Float;
    case 'real': return sql.Real;
    case 'date': return sql.Date;
    case 'datetime': return sql.DateTime;
    case 'datetime2': return sql.DateTime2(c.scale);
    case 'uniqueidentifier': return sql.UniqueIdentifier;
    default: throw new Error(`no copy rule for column type ${c.type} (${c.name})`);
  }
}

/** Row count of every table and the total of every money column, as exact strings. */
async function totals(read, which, after) {
  const out = {};
  for (const t of await read("SELECT t.name, SUM(p.rows) n FROM sys.tables t JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1) GROUP BY t.name")) {
    out[`rows ${t.name}`] = String(t.n);
  }
  for (const [table, cols] of Object.entries(MONEY[which])) {
    for (const col of cols) {
      const name = after ? renamed(col) : col;
      const [r] = await read(`SELECT CAST(SUM(CAST([${name}] AS decimal(38, 2)))${after ? '' : ` * ${RATE}`} AS decimal(38, 2)) v FROM [${table}]`);
      out[`${table}.${renamed(col)}`] = String(r.v);
    }
  }
  if (which === 'apex') {
    const unit = after ? CONSTRAINT_UNIT.to : CONSTRAINT_UNIT.from;
    const [r] = await read(`SELECT CAST(SUM(constraint_value)${after ? '' : ` * ${RATE}`} AS decimal(38, 2)) v FROM decision_constraint WHERE unit = ${quote(unit)}`);
    out['decision_constraint ceilings'] = String(r.v);
  }
  return out;
}

async function apply(which) {
  const target = DATABASES[which];
  const pool = await connect(target);
  try {
    const done = await marker(pool);
    if (done) throw new Error(`${target} was already localised (${done}). Running again would multiply amounts twice.`);
    const tx = new sql.Transaction(pool);
    await tx.begin();
    const run = (q) => new sql.Request(tx).query(q);
    const read = async (q) => (await new sql.Request(tx).query(q)).recordset;
    try {
      // Decimal sums travel as strings; the driver would round them to a JS number.
      const exact = async (q) => (await new sql.Request(tx).query(q.replace(/AS decimal\(38, 2\)\) v/g, 'AS decimal(38, 2)) AS nvarchar(60)) v').replace(/SELECT CAST\(/g, 'SELECT CAST(CAST('))).recordset;
      const expected = await totals(exact, which, false);
      await LOCALISE[which](run, read);
      const actual = await totals(exact, which, true);
      const wrong = Object.keys(expected).filter((k) => expected[k] !== actual[k]);
      if (wrong.length) throw new Error(`totals do not match, nothing was changed:\n    ${wrong.map((k) => `${k}: expected ${expected[k]}, got ${actual[k]}`).join('\n    ')}`);
      await run(`EXEC sys.sp_addextendedproperty @name = N'${MARKER}', @value = N'PKR at ${RATE} per USD, ${new Date().toISOString().slice(0, 10)}'`);
      await tx.commit();
    } catch (err) {
      await tx.rollback();
      throw err;
    }
    console.log(`  ${target}: localised; ${Object.keys(MONEY[which]).length} money tables at ${RATE}x and every row count checked`);
  } finally {
    await pool.close();
  }
}

/** Every check returns a list of problems; an empty list means the copy is right. */
async function verify(which) {
  const target = DATABASES[which];
  const pool = await connect(target);
  const problems = [];
  const read = async (q) => (await pool.request().query(q)).recordset;
  try {
    if (!(await marker(pool))) problems.push(`${target} has not been localised`);

    const unique = {
      apex: [['dim_customer', 'customer_name'], ['dim_vendor', 'vendor_name'], ['dim_product_service', 'offering_name']],
      sales: [['doctors', 'doctor_name'], ['pharmacies', 'name'], ['sales_reps', 'name']],
      mfg: [['operators', 'name'], ['plants', 'plant_name'], ['production_lines', 'line_name'], ['suppliers', 'supplier_name']],
    }[which];
    for (const [table, col] of unique) {
      const [u] = await read(`SELECT COUNT(*) n, COUNT(DISTINCT [${col}]) d FROM [${table}]`);
      if (u.n !== u.d) problems.push(`${table}.${col}: ${u.n - u.d} repeated names`);
    }

    // No dollar, foreign place or placeholder name may be left in any text column.
    const texts = await read(`SELECT t.name tbl, c.name col FROM sys.columns c JOIN sys.tables t ON t.object_id = c.object_id
      JOIN sys.types ty ON ty.user_type_id = c.user_type_id WHERE ty.name IN ('nvarchar', 'varchar', 'nchar', 'char') AND c.max_length <> -1`);
    for (const { tbl, col } of texts) {
      const values = await read(`SELECT DISTINCT TOP 5000 [${col}] v FROM [${tbl}] WHERE [${col}] IS NOT NULL`);
      const hit = values.find((r) => FOREIGN_TEXT.test(r.v));
      if (hit) problems.push(`${tbl}.${col} still has "${hit.v}"`);
    }
    const usd = await read(`SELECT t.name tbl, c.name col FROM sys.columns c JOIN sys.tables t ON t.object_id = c.object_id WHERE c.name LIKE '%usd%'`);
    for (const u of usd) problems.push(`${u.tbl}.${u.col} is still named in USD`);
  } finally {
    await pool.close();
  }
  console.log(problems.length ? `  ${target}: ${problems.length} problem(s)\n    ${problems.join('\n    ')}` : `  ${target}: localised, no USD or foreign names left`);
  return problems.length === 0;
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (name) => {
    const at = args.indexOf(name);
    return at >= 0 ? args.splice(at, 2)[1] : null;
  };
  const to = flag('--to');
  const on = flag('--on');
  const [command, ...rest] = args;
  const which = rest.length ? rest : Object.keys(DATABASES);
  const bad = which.filter((w) => !DATABASES[w]);
  const commands = { snapshot: (w) => snapshot(w, to), apply, verify };
  if (!commands[command] || bad.length || (command === 'snapshot' && !to)) {
    console.error('usage: node init/localize_pkr.js snapshot --to host[:port] | apply --on host | verify  [apex|sales|mfg ...]');
    process.exit(2);
  }
  if (command === 'apply' && on !== process.env.DB_HOST) {
    console.error(`apply would change the databases on ${process.env.DB_HOST}. Add --on ${process.env.DB_HOST} to confirm.`);
    process.exit(2);
  }
  let ok = true;
  for (const w of which) {
    console.log(`${command} ${w}`);
    if ((await commands[command](w)) === false) ok = false;
  }
  process.exit(ok ? 0 : 1);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { RATE, MONEY, USD_COLUMNS, renamed };
