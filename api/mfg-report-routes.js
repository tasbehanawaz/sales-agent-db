/**
 * Manufacturing report generation (PPTX, PDF, CSV).
 *
 * Every report is a list of sections built from manufacturing_agent_demo.
 * The five fixed templates and the free-text query endpoint pick sections by
 * topic. PDF and CSV carry more rows than slides (see limit() in format.js).
 * from/to and plant_id filter every fact table.
 */

require('dotenv').config();
const { query } = require('./db');
const { strParam, dateParam, uuidParams } = require('./queryParams');
const { FORMATS, writeReport, downloadUrl } = require('./reports/writeReport');
const { n, money, count, dec, pct, share, limit } = require('./reports/format');

const MFG_DB = process.env.DB_NAME_MFG || 'manufacturing_agent_demo';

function t(name) {
  return `[${MFG_DB}].dbo.[${name}]`;
}

/** WHERE clause on a date column and plant_id column (either may be omitted). */
function where(f, { date, plant, extra = [] } = {}) {
  const c = [...extra];
  if (date && f.from) c.push(`CAST(${date} AS date) >= @from_date`);
  if (date && f.to) c.push(`CAST(${date} AS date) <= @to_date`);
  if (plant && f.plant_id) c.push(`${plant} = @plant_id`);
  return c.length ? `WHERE ${c.join(' AND ')}` : '';
}

function q(f, text) {
  return query(text, f.params);
}

const PLANT = (alias) => `JOIN ${t('plants')} p ON p.plant_id = ${alias}.plant_id`;

// ---- sections ----

const SECTIONS = {
  async 'plants'(f) {
    const rows = await q(f, `SELECT p.plant_name, p.region, p.location,
        (SELECT COUNT(*) FROM ${t('production_lines')} l WHERE l.plant_id = p.plant_id) lines,
        (SELECT COUNT(*) FROM ${t('machines')} m WHERE m.plant_id = p.plant_id) machines,
        (SELECT COUNT(*) FROM ${t('machines')} m WHERE m.plant_id = p.plant_id AND m.criticality = 'Critical') critical,
        (SELECT COUNT(*) FROM ${t('operators')} o WHERE o.plant_id = p.plant_id) operators
      FROM ${t('plants')} p ${where(f, { plant: 'p.plant_id' })} ORDER BY p.plant_name`);
    const sum = (k) => rows.reduce((s, r) => s + n(r[k]), 0);
    return {
      id: 'plants',
      title: 'Plant Footprint',
      about: 'Plants, production lines, machines and operators in scope.',
      sources: ['plants', 'production_lines', 'machines', 'operators'],
      kpis: [
        { label: 'Plants', value: count(rows.length), color: 'primary' },
        { label: 'Lines', value: count(sum('lines')), color: 'success' },
        { label: 'Machines', value: count(sum('machines')), color: 'warning' },
        { label: 'Operators', value: count(sum('operators')), color: 'neutral' },
      ],
      table: {
        headers: ['Plant', 'Region', 'Location', 'Lines', 'Machines', 'Critical Machines', 'Operators'],
        rows: rows.map((r) => [r.plant_name, r.region, r.location, count(r.lines), count(r.machines), count(r.critical), count(r.operators)]),
        weights: [2, 1, 1.4, 0.8, 0.9, 1.1, 1],
        metric: 'Machines',
      },
    };
  },

  async 'oee'(f) {
    const w = where(f, { date: 'r.date', plant: 'r.plant_id' });
    const [s] = await q(f, `SELECT
        SUM(CAST(r.actual_quantity AS float)) / NULLIF(SUM(r.planned_quantity), 0) * 100 availability,
        SUM(CAST(r.good_quantity AS float)) / NULLIF(SUM(r.actual_quantity), 0) * 100 quality,
        SUM(CAST(r.good_quantity AS float)) / NULLIF(SUM(r.planned_quantity), 0) * 100 oee,
        SUM(r.runtime_hours) / NULLIF(SUM(r.planned_production_time_hours), 0) * 100 runtime
      FROM ${t('production_runs')} r ${w}`);
    const rows = await q(f, `SELECT TOP ${limit(f, 10)} l.line_name, p.plant_name, COUNT(*) runs,
        SUM(CAST(r.actual_quantity AS float)) / NULLIF(SUM(r.planned_quantity), 0) * 100 availability,
        SUM(CAST(r.good_quantity AS float)) / NULLIF(SUM(r.actual_quantity), 0) * 100 quality,
        SUM(CAST(r.good_quantity AS float)) / NULLIF(SUM(r.planned_quantity), 0) * 100 oee
      FROM ${t('production_runs')} r JOIN ${t('production_lines')} l ON l.line_id = r.line_id ${PLANT('r')}
      ${w} GROUP BY l.line_name, p.plant_name ORDER BY oee DESC`);
    const below = rows.filter((r) => n(r.oee) < 80);
    return {
      id: 'oee',
      title: 'OEE by Production Line',
      about: 'Overall equipment effectiveness, computed from production runs as good output over planned output. ' +
        'Availability is actual over planned quantity; quality is good over actual quantity.',
      sources: ['production_runs', 'production_lines', 'plants'],
      narrative: [
        `Overall OEE is ${pct(s.oee)}, made up of ${pct(s.availability)} availability and ${pct(s.quality)} quality. ` +
        `Lines ran ${pct(s.runtime)} of their planned production time. ` +
        (below.length
          ? `${below.length} of ${rows.length} lines are below the 80% OEE benchmark, led by ${below[below.length - 1].line_name} at ${pct(below[below.length - 1].oee)}.`
          : `All ${rows.length} lines meet the 80% OEE benchmark.`),
      ],
      kpis: [
        { label: 'Overall OEE', value: pct(s.oee), color: 'primary' },
        { label: 'Availability', value: pct(s.availability), color: 'success' },
        { label: 'Quality', value: pct(s.quality), color: 'warning' },
        { label: 'Runtime vs Plan', value: pct(s.runtime), color: 'neutral' },
      ],
      table: {
        headers: ['Line', 'Plant', 'Runs', 'Availability', 'Quality', 'OEE', 'Status'],
        rows: rows.map((r) => [r.line_name, r.plant_name, count(r.runs), pct(r.availability), pct(r.quality), pct(r.oee),
          n(r.oee) >= 80 ? 'Good' : 'Needs Attention']),
        weights: [1.6, 1.6, 0.8, 1, 0.9, 0.8, 1.3],
        metric: 'OEE',
      },
    };
  },

  async 'production'(f) {
    const w = where(f, { date: 'r.date', plant: 'r.plant_id' });
    const [s] = await q(f, `SELECT COUNT(*) runs, SUM(r.planned_quantity) planned, SUM(r.actual_quantity) actual,
        SUM(r.good_quantity) good, SUM(r.rejected_quantity) rejected FROM ${t('production_runs')} r ${w}`);
    const rows = await q(f, `SELECT TOP ${limit(f, 10)} l.line_name, p.plant_name, COUNT(*) runs, SUM(r.planned_quantity) planned,
        SUM(r.actual_quantity) actual, SUM(r.good_quantity) good, SUM(r.rejected_quantity) rejected
      FROM ${t('production_runs')} r JOIN ${t('production_lines')} l ON l.line_id = r.line_id ${PLANT('r')}
      ${w} GROUP BY l.line_name, p.plant_name ORDER BY good DESC`);
    return {
      id: 'production',
      title: 'Production Output by Line',
      about: 'Planned, actual, good and rejected quantities from production runs.',
      sources: ['production_runs', 'production_lines', 'plants'],
      narrative: [
        `${count(s.runs)} production runs delivered ${count(s.actual)} units against a plan of ${count(s.planned)} ` +
        `(${share(s.actual, s.planned)} attainment). ${count(s.good)} units were good and ${count(s.rejected)} were rejected ` +
        `(${share(s.rejected, s.actual)} of output).`,
      ],
      kpis: [
        { label: 'Good Qty', value: count(s.good), color: 'success' },
        { label: 'Actual Qty', value: count(s.actual), color: 'primary' },
        { label: 'Rejected', value: count(s.rejected), color: 'danger' },
        { label: 'Runs', value: count(s.runs), color: 'neutral' },
      ],
      table: {
        headers: ['Line', 'Plant', 'Runs', 'Planned', 'Actual', 'Good', 'Rejected', 'Attainment', 'Yield'],
        rows: rows.map((r) => [r.line_name, r.plant_name, count(r.runs), count(r.planned), count(r.actual), count(r.good),
          count(r.rejected), share(r.actual, r.planned), share(r.good, r.actual)]),
        weights: [1.5, 1.5, 0.8, 1.2, 1.2, 1.2, 1, 1, 0.8],
        metric: 'Good',
      },
    };
  },

  async 'production-trend'(f) {
    const rows = await q(f, `SELECT FORMAT(r.date, 'yyyy-MM') month, COUNT(*) runs, SUM(r.planned_quantity) planned,
        SUM(r.actual_quantity) actual, SUM(r.good_quantity) good, SUM(r.rejected_quantity) rejected
      FROM ${t('production_runs')} r ${where(f, { date: 'r.date', plant: 'r.plant_id' })}
      GROUP BY FORMAT(r.date, 'yyyy-MM') ORDER BY month`);
    const shown = f.detail ? rows : rows.slice(-12);
    return {
      id: 'production-trend',
      title: 'Monthly Production Trend',
      about: f.detail ? 'Output by calendar month across the selected period.' : 'Output by calendar month, last 12 months of the period.',
      sources: ['production_runs'],
      table: {
        headers: ['Month', 'Runs', 'Planned', 'Actual', 'Good', 'Rejected', 'Attainment', 'Yield'],
        rows: shown.map((r) => [r.month, count(r.runs), count(r.planned), count(r.actual), count(r.good), count(r.rejected),
          share(r.actual, r.planned), share(r.good, r.actual)]),
        weights: [1, 0.8, 1.2, 1.2, 1.2, 1, 1, 0.8],
        metric: 'Good',
      },
    };
  },

  async 'production-by-shift'(f) {
    const rows = await q(f, `SELECT r.shift, COUNT(*) runs, SUM(r.good_quantity) good, SUM(r.rejected_quantity) rejected,
        AVG(r.cycle_time_minutes) cycle, AVG(CAST(r.changeover_time_minutes AS float)) changeover, SUM(r.runtime_hours) runtime
      FROM ${t('production_runs')} r ${where(f, { date: 'r.date', plant: 'r.plant_id' })}
      GROUP BY r.shift ORDER BY good DESC`);
    return {
      id: 'production-by-shift',
      title: 'Production by Shift',
      about: 'Output, rejects, cycle time and changeover time for each shift.',
      sources: ['production_runs'],
      table: {
        headers: ['Shift', 'Runs', 'Good', 'Rejected', 'Reject Rate', 'Avg Cycle (min)', 'Avg Changeover (min)', 'Runtime (h)'],
        rows: rows.map((r) => [r.shift, count(r.runs), count(r.good), count(r.rejected), share(r.rejected, n(r.good) + n(r.rejected)),
          dec(r.cycle, 2), dec(r.changeover), count(r.runtime)]),
        weights: [1, 0.9, 1.2, 1, 1, 1.1, 1.3, 1],
        metric: 'Good',
      },
    };
  },

  async 'production-by-product'(f) {
    const rows = await q(f, `SELECT TOP ${limit(f, 12)} pr.product_name, pr.category, pr.dosage, COUNT(*) runs, SUM(r.good_quantity) good,
        SUM(r.rejected_quantity) rejected
      FROM ${t('production_runs')} r JOIN ${t('products')} pr ON pr.product_id = r.product_id
      ${where(f, { date: 'r.date', plant: 'r.plant_id' })}
      GROUP BY pr.product_name, pr.category, pr.dosage ORDER BY good DESC`);
    return {
      id: 'production-by-product',
      title: 'Production by Product',
      about: 'Good and rejected output for each product.',
      sources: ['production_runs', 'products'],
      table: {
        headers: ['Product', 'Category', 'Dosage', 'Runs', 'Good', 'Rejected', 'Yield'],
        rows: rows.map((r) => [r.product_name, r.category, r.dosage, count(r.runs), count(r.good), count(r.rejected),
          share(r.good, n(r.good) + n(r.rejected))]),
        weights: [2, 1, 1, 0.8, 1.2, 1, 0.8],
        metric: 'Good',
      },
    };
  },

  async 'downtime'(f) {
    const w = where(f, { date: 'event_start_datetime', plant: 'plant_id' });
    const [s] = await q(f, `SELECT COUNT(*) events, SUM(duration_minutes) / 60.0 hours, AVG(CAST(duration_minutes AS float)) avg_min,
        SUM(CASE WHEN planned_vs_unplanned = 'Unplanned' THEN duration_minutes ELSE 0 END) / 60.0 unplanned
      FROM ${t('downtime_events')} ${w}`);
    const rows = await q(f, `SELECT TOP ${limit(f, 10)} ISNULL(failure_mode, ISNULL(reason_code, category)) reason,
        COUNT(*) events, SUM(duration_minutes) / 60.0 hours, AVG(CAST(duration_minutes AS float)) avg_min,
        SUM(CASE WHEN planned_vs_unplanned = 'Unplanned' THEN 1 ELSE 0 END) unplanned
      FROM ${t('downtime_events')} ${w}
      GROUP BY ISNULL(failure_mode, ISNULL(reason_code, category)) ORDER BY hours DESC`);
    const cats = await q(f, `SELECT category, COUNT(*) events, SUM(duration_minutes) / 60.0 hours FROM ${t('downtime_events')} ${w}
      GROUP BY category ORDER BY hours DESC`);
    const top3 = rows.slice(0, 3).reduce((x, r) => x + n(r.hours), 0);
    return {
      id: 'downtime',
      title: 'Downtime by Cause (Pareto)',
      about: 'Downtime events grouped by failure mode, ordered by hours lost. The notes split the hours by category.',
      sources: ['downtime_events'],
      narrative: [
        `${count(s.events)} downtime events cost ${dec(s.hours)} hours, an average of ${dec(s.avg_min, 0)} minutes each. ` +
        `${share(s.unplanned, s.hours)} of the lost time was unplanned. ` +
        (rows.length >= 3 ? `The three largest causes (${rows.slice(0, 3).map((r) => r.reason).join(', ')}) account for ${share(top3, s.hours)} of all hours.` : ''),
      ],
      kpis: [
        { label: 'Downtime', value: dec(s.hours), unit: 'hrs', color: 'danger' },
        { label: 'Events', value: count(s.events), color: 'warning' },
        { label: 'Avg Duration', value: dec(s.avg_min), unit: 'min', color: 'primary' },
        { label: 'Unplanned Share', value: share(s.unplanned, s.hours), color: 'danger' },
      ],
      table: {
        headers: ['Cause', 'Events', 'Hours', '% of Hours', 'Avg (min)', 'Unplanned Events'],
        rows: rows.map((r) => [r.reason, count(r.events), dec(r.hours), share(r.hours, s.hours), dec(r.avg_min), count(r.unplanned)]),
        weights: [1.8, 0.8, 0.9, 1, 0.9, 1.2],
        metric: 'Hours',
      },
      bullets: cats.map((c) => `${c.category}: ${count(c.events)} events, ${dec(c.hours)} hours (${share(c.hours, s.hours)})`),
    };
  },

  async 'downtime-by-line'(f) {
    const rows = await q(f, `SELECT TOP ${limit(f, 10)} l.line_name, p.plant_name, COUNT(*) events, SUM(d.duration_minutes) / 60.0 hours,
        SUM(CASE WHEN d.planned_vs_unplanned = 'Unplanned' THEN d.duration_minutes ELSE 0 END) / 60.0 unplanned
      FROM ${t('downtime_events')} d JOIN ${t('production_lines')} l ON l.line_id = d.line_id ${PLANT('d')}
      ${where(f, { date: 'd.event_start_datetime', plant: 'd.plant_id' })}
      GROUP BY l.line_name, p.plant_name ORDER BY hours DESC`);
    return {
      id: 'downtime-by-line',
      title: 'Downtime by Production Line',
      about: 'Hours lost on each line, split into planned and unplanned time.',
      sources: ['downtime_events', 'production_lines', 'plants'],
      table: {
        headers: ['Line', 'Plant', 'Events', 'Hours', 'Unplanned Hours', 'Unplanned Share'],
        rows: rows.map((r) => [r.line_name, r.plant_name, count(r.events), dec(r.hours), dec(r.unplanned), share(r.unplanned, r.hours)]),
        weights: [1.6, 1.6, 0.8, 0.9, 1.2, 1.2],
        metric: 'Hours',
      },
    };
  },

  async 'quality'(f) {
    const w = where(f, { date: 'qt.date', plant: 'qt.plant_id' });
    const [s] = await q(f, `SELECT COUNT(*) batches, SUM(qt.produced_quantity) produced, SUM(qt.rejected_quantity) rejected,
        SUM(qt.rework_quantity) rework FROM ${t('quality_tests')} qt ${w}`);
    const rows = await q(f, `SELECT TOP ${limit(f, 12)} pr.product_name, pr.category, COUNT(*) batches, SUM(qt.produced_quantity) produced,
        SUM(qt.rejected_quantity) rejected, SUM(qt.rework_quantity) rework
      FROM ${t('quality_tests')} qt JOIN ${t('products')} pr ON pr.product_id = qt.product_id
      ${w} GROUP BY pr.product_name, pr.category ORDER BY SUM(qt.rejected_quantity) * 1.0 / NULLIF(SUM(qt.produced_quantity), 0) DESC`);
    const yieldOf = (r) => (n(r.produced) ? (1 - n(r.rejected) / n(r.produced)) * 100 : 0);
    return {
      id: 'quality',
      title: 'Quality by Product',
      about: 'Yield, rejection and rework from batch quality tests. Yield is produced minus rejected, over produced.',
      sources: ['quality_tests', 'products'],
      narrative: [
        `${count(s.batches)} batches were tested, covering ${count(s.produced)} units. ${count(s.rejected)} units were rejected ` +
        `(${share(s.rejected, s.produced)}) and ${count(s.rework)} sent to rework, for an overall yield of ${pct(yieldOf(s))}.`,
      ],
      kpis: [
        { label: 'Yield', value: pct(yieldOf(s)), color: 'success' },
        { label: 'Rejection Rate', value: share(s.rejected, s.produced), color: 'danger' },
        { label: 'Rework Units', value: count(s.rework), color: 'warning' },
        { label: 'Batches Tested', value: count(s.batches), color: 'neutral' },
      ],
      table: {
        headers: ['Product', 'Category', 'Batches', 'Produced', 'Rejected', 'Rework', 'Rejection Rate', 'Yield'],
        rows: rows.map((r) => [r.product_name, r.category, count(r.batches), count(r.produced), count(r.rejected), count(r.rework),
          share(r.rejected, r.produced), pct(yieldOf(r))]),
        weights: [2, 1, 0.8, 1.2, 1, 1, 1.1, 0.8],
        metric: 'Rejected',
      },
    };
  },

  async 'quality-defects'(f) {
    const w = where(f, { date: 'date', plant: 'plant_id' });
    const rows = await q(f, `SELECT inspection_result, defect_severity, COUNT(*) batches, SUM(rejected_quantity) rejected,
        SUM(rework_quantity) rework FROM ${t('quality_tests')} ${w}
      GROUP BY inspection_result, defect_severity ORDER BY rejected DESC`);
    const reasons = await q(f, `SELECT TOP ${limit(f, 8)} scrap_reason, COUNT(*) batches, SUM(rejected_quantity) rejected
      FROM ${t('quality_tests')} ${w} GROUP BY scrap_reason ORDER BY rejected DESC`);
    return [{
      id: 'quality-defects',
      title: 'Inspection Results and Defect Severity',
      about: 'Batches by inspection outcome and defect severity.',
      sources: ['quality_tests'],
      table: {
        headers: ['Inspection Result', 'Severity', 'Batches', 'Rejected Units', 'Rework Units'],
        rows: rows.map((r) => [r.inspection_result, r.defect_severity, count(r.batches), count(r.rejected), count(r.rework)]),
        weights: [1.4, 1, 1, 1.2, 1.2],
        metric: 'Rejected Units',
      },
    }, {
      id: 'scrap-reasons',
      title: 'Scrap Reasons',
      about: 'Rejected units by the scrap reason recorded at inspection.',
      sources: ['quality_tests'],
      table: {
        headers: ['Scrap Reason', 'Batches', 'Rejected Units'],
        rows: reasons.map((r) => [r.scrap_reason || 'Not recorded', count(r.batches), count(r.rejected)]),
        weights: [2.5, 1, 1.2],
      },
    }];
  },

  async 'costs'(f) {
    const w = where(f, { date: 'c.date', plant: 'c.plant_id' });
    const [s] = await q(f, `SELECT SUM(c.actual_cost_per_unit * c.units_produced) actual, SUM(c.standard_cost_per_unit * c.units_produced) standard,
        SUM(c.units_produced) units, SUM(c.energy_cost) energy, SUM(c.scrap_cost) scrap FROM ${t('cost_records')} c ${w}`);
    const rows = await q(f, `SELECT TOP ${limit(f, 10)} l.line_name, p.plant_name, SUM(c.units_produced) units,
        SUM(c.actual_cost_per_unit * c.units_produced) actual, SUM(c.standard_cost_per_unit * c.units_produced) standard,
        SUM(c.energy_kwh) kwh
      FROM ${t('cost_records')} c JOIN ${t('production_lines')} l ON l.line_id = c.line_id ${PLANT('c')}
      ${w} GROUP BY l.line_name, p.plant_name ORDER BY actual DESC`);
    const variance = n(s.actual) - n(s.standard);
    return {
      id: 'costs',
      title: 'Cost by Production Line',
      about: 'Actual against standard cost, weighted by units produced, with energy use per unit.',
      sources: ['cost_records', 'production_lines', 'plants'],
      narrative: [
        `Production cost ${money(s.actual)} for ${count(s.units)} units, an average of ${money(n(s.actual) / (n(s.units) || 1))} per unit. ` +
        `That is ${money(Math.abs(variance))} ${variance >= 0 ? 'above' : 'below'} standard cost (${share(variance, s.standard)}). ` +
        `Energy cost ${money(s.energy)} and scrap ${money(s.scrap)}.`,
      ],
      kpis: [
        { label: 'Total Cost', value: money(s.actual), color: 'neutral' },
        { label: 'Avg Unit Cost', value: money(n(s.actual) / (n(s.units) || 1)), color: 'primary' },
        { label: 'Vs Standard', value: share(variance, s.standard), color: variance > 0 ? 'danger' : 'success' },
        { label: 'Energy Cost', value: money(s.energy), color: 'warning' },
      ],
      table: {
        headers: ['Line', 'Plant', 'Units', 'Actual Cost', 'Standard Cost', 'Variance', 'Unit Cost', 'kWh/Unit'],
        rows: rows.map((r) => [r.line_name, r.plant_name, count(r.units), money(r.actual), money(r.standard),
          share(n(r.actual) - n(r.standard), r.standard), money(n(r.actual) / (n(r.units) || 1)), dec(n(r.kwh) / (n(r.units) || 1), 3)]),
        weights: [1.5, 1.5, 1, 1, 1.1, 0.9, 0.9, 0.9],
        metric: 'Actual Cost',
      },
    };
  },

  async 'cost-components'(f) {
    const rows = await q(f, `SELECT p.plant_name, SUM(c.labor_cost) labor, SUM(c.maintenance_cost) maintenance, SUM(c.scrap_cost) scrap,
        SUM(c.energy_cost) energy, SUM(c.units_produced) units
      FROM ${t('cost_records')} c ${PLANT('c')} ${where(f, { date: 'c.date', plant: 'c.plant_id' })}
      GROUP BY p.plant_name ORDER BY SUM(c.labor_cost + c.maintenance_cost + c.scrap_cost + c.energy_cost) DESC`);
    const total = (r) => n(r.labor) + n(r.maintenance) + n(r.scrap) + n(r.energy);
    return {
      id: 'cost-components',
      title: 'Cost Components by Plant',
      about: 'Labour, maintenance, scrap and energy cost recorded against production orders.',
      sources: ['cost_records', 'plants'],
      table: {
        headers: ['Plant', 'Labour', 'Maintenance', 'Scrap', 'Energy', 'Total', 'Units', 'Cost/Unit'],
        rows: rows.map((r) => [r.plant_name, money(r.labor), money(r.maintenance), money(r.scrap), money(r.energy), money(total(r)),
          count(r.units), money(total(r) / (n(r.units) || 1))]),
        weights: [1.8, 1, 1.1, 1, 1, 1, 1, 0.9],
        metric: 'Total',
      },
    };
  },

  async 'maintenance'(f) {
    const w = where(f, { date: 'mr.failure_date', plant: 'm.plant_id' });
    const join = `FROM ${t('maintenance_records')} mr JOIN ${t('machines')} m ON m.asset_id = mr.asset_id`;
    const rows = await q(f, `SELECT mr.maintenance_type, COUNT(*) orders, SUM(mr.labor_hours) labor, SUM(mr.maintenance_cost) cost,
        AVG(DATEDIFF(minute, mr.repair_start_datetime, mr.repair_end_datetime) / 60.0) repair_h,
        SUM(CASE WHEN mr.planned_maintenance_completed_date > mr.planned_maintenance_due_date THEN 1 ELSE 0 END) late
      ${join} ${w} GROUP BY mr.maintenance_type ORDER BY cost DESC`);
    const sum = (k) => rows.reduce((s, r) => s + n(r[k]), 0);
    const emergency = rows.find((r) => r.maintenance_type === 'Emergency');
    return {
      id: 'maintenance',
      title: 'Maintenance by Type',
      about: 'Work orders, labour hours, cost and repair time by maintenance type. Late means planned maintenance completed after its due date.',
      sources: ['maintenance_records', 'machines'],
      narrative: [
        `${count(sum('orders'))} work orders used ${count(sum('labor'))} labour hours and cost ${money(sum('cost'))}. ` +
        (emergency ? `Emergency work made up ${share(emergency.orders, sum('orders'))} of orders and ${share(emergency.cost, sum('cost'))} of cost.` : ''),
      ],
      kpis: [
        { label: 'Work Orders', value: count(sum('orders')), color: 'primary' },
        { label: 'Labour Hours', value: count(sum('labor')), color: 'warning' },
        { label: 'Cost', value: money(sum('cost')), color: 'danger' },
        { label: 'Completed Late', value: count(sum('late')), color: 'neutral' },
      ],
      table: {
        headers: ['Type', 'Work Orders', 'Labour Hours', 'Cost', 'Avg Repair (h)', 'Completed Late'],
        rows: rows.map((r) => [r.maintenance_type, count(r.orders), count(r.labor), money(r.cost), dec(r.repair_h), count(r.late)]),
        weights: [1.4, 1, 1.1, 1, 1.1, 1.1],
        metric: 'Cost',
      },
    };
  },

  async 'maintenance-assets'(f) {
    const rows = await q(f, `SELECT TOP ${limit(f, 10)} m.machine_name, m.machine_type, m.criticality, COUNT(*) orders,
        SUM(mr.maintenance_cost) cost, SUM(mr.labor_hours) labor,
        SUM(CASE WHEN mr.maintenance_type = 'Emergency' THEN 1 ELSE 0 END) emergency
      FROM ${t('maintenance_records')} mr JOIN ${t('machines')} m ON m.asset_id = mr.asset_id
      ${where(f, { date: 'mr.failure_date', plant: 'm.plant_id' })}
      GROUP BY m.machine_name, m.machine_type, m.criticality ORDER BY cost DESC`);
    return {
      id: 'maintenance-assets',
      title: 'Machines with the Highest Maintenance Cost',
      about: 'Maintenance cost and emergency work orders per machine.',
      sources: ['maintenance_records', 'machines'],
      table: {
        headers: ['Machine', 'Type', 'Criticality', 'Work Orders', 'Emergency', 'Labour Hours', 'Cost'],
        rows: rows.map((r) => [r.machine_name, r.machine_type, r.criticality, count(r.orders), count(r.emergency), count(r.labor), money(r.cost)]),
        weights: [1.8, 1.3, 1, 1, 1, 1.1, 1],
        metric: 'Cost',
      },
    };
  },

  async 'inventory'(f) {
    const w = where(f, { date: 'i.date', plant: 'i.plant_id' });
    const [s] = await q(f, `SELECT SUM(i.stock_issued_to_production) issued, SUM(i.shortages_quantity) shortages,
        SUM(i.actual_usage_quantity) actual, SUM(i.standard_usage_quantity) standard,
        SUM(i.actual_usage_quantity * i.purchase_cost_per_unit) spend FROM ${t('inventory_transactions')} i ${w}`);
    const rows = await q(f, `SELECT TOP ${limit(f, 10)} mt.material_name, su.supplier_name, SUM(i.stock_issued_to_production) issued,
        SUM(i.shortages_quantity) shortages, SUM(i.actual_usage_quantity) actual, SUM(i.standard_usage_quantity) standard,
        SUM(i.actual_usage_quantity * i.purchase_cost_per_unit) spend
      FROM ${t('inventory_transactions')} i JOIN ${t('materials')} mt ON mt.material_id = i.material_id
      LEFT JOIN ${t('suppliers')} su ON su.supplier_id = i.supplier_id
      ${w} GROUP BY mt.material_name, su.supplier_name ORDER BY shortages DESC`);
    return {
      id: 'inventory',
      title: 'Materials: Shortages and Usage Variance',
      about: 'Stock issued to production, shortages, and actual against standard material usage.',
      sources: ['inventory_transactions', 'materials', 'suppliers'],
      narrative: [
        `${count(s.issued)} units of material were issued to production with ${count(s.shortages)} units short. ` +
        `Actual usage was ${share(n(s.actual) - n(s.standard), s.standard)} against standard, and material spend was ${money(s.spend)}.`,
      ],
      kpis: [
        { label: 'Issued', value: count(s.issued), color: 'primary' },
        { label: 'Shortages', value: count(s.shortages), color: 'danger' },
        { label: 'Usage vs Std', value: share(n(s.actual) - n(s.standard), s.standard), color: 'warning' },
        { label: 'Material Spend', value: money(s.spend), color: 'neutral' },
      ],
      table: {
        headers: ['Material', 'Supplier', 'Issued', 'Shortages', 'Actual Usage', 'Standard Usage', 'Usage Variance', 'Spend'],
        rows: rows.map((r) => [r.material_name, r.supplier_name || '-', count(r.issued), count(r.shortages), count(r.actual), count(r.standard),
          share(n(r.actual) - n(r.standard), r.standard), money(r.spend)]),
        weights: [1.6, 1.4, 1, 1, 1, 1.1, 1, 1],
        metric: 'Shortages',
      },
    };
  },
};

// ---- report types and query topics ----

const ALL = Object.keys(SECTIONS);

const REPORT_TYPES = {
  'oee-dashboard': {
    title: 'OEE Dashboard Report',
    subtitle: 'Equipment effectiveness, output and shift performance',
    sections: ['oee', 'production', 'production-trend', 'production-by-shift'],
  },
  'downtime-analysis': {
    title: 'Downtime Analysis Report',
    subtitle: 'Root causes, lines affected and maintenance',
    sections: ['downtime', 'downtime-by-line', 'maintenance', 'maintenance-assets'],
  },
  'quality-trends': {
    title: 'Quality Trends Report',
    subtitle: 'Yield, rejection, defects and scrap by product',
    sections: ['quality', 'quality-defects', 'production-by-product'],
  },
  'cost-analysis': {
    title: 'Cost Analysis Report',
    subtitle: 'Unit cost against standard, cost components and materials',
    sections: ['costs', 'cost-components', 'inventory'],
  },
  'executive-summary': {
    title: 'Manufacturing Executive Summary',
    subtitle: 'Key metrics, issues and opportunities',
    sections: ['plants', 'oee', 'production', 'downtime', 'quality', 'costs', 'maintenance', 'inventory'],
    executive: true,
  },
  'full-report': {
    title: 'Manufacturing Full Report',
    subtitle: 'Every manufacturing section',
    sections: ALL,
    executive: true,
  },
};

const QUERY_TOPICS = [
  { topic: 'oee', re: /\boee\b|\bavailability\b|\bequipment effectiveness\b/, sections: ['oee'] },
  { topic: 'downtime', re: /\bdowntime\b|\bfailures?\b|\bbreakdowns?\b|\bpareto\b|\bunplanned\b/, sections: ['downtime', 'downtime-by-line'] },
  { topic: 'quality', re: /\bquality\b|\brejection\b|\byield\b|\bdefects?\b|\bscrap\b|\binspection\b/, sections: ['quality', 'quality-defects'] },
  { topic: 'products', re: /\bproducts?\b|\bskus?\b/, sections: ['production-by-product', 'quality'] },
  { topic: 'costs', re: /\bcosts?\b|\benergy\b|\blabou?r\b|\bunit cost\b|\bexpenses?\b/, sections: ['costs', 'cost-components'] },
  { topic: 'production', re: /\bproduction runs?\b|\boutput\b|\bthroughput\b|\bgood quantity\b|\bruntime\b|\btrend\b/, sections: ['production', 'production-trend'] },
  { topic: 'lines', re: /\bproduction lines?\b|\blines?\b/, sections: ['oee', 'production'] },
  { topic: 'shifts', re: /\bshifts?\b|\bchangeovers?\b|\bcycle time\b/, sections: ['production-by-shift'] },
  { topic: 'maintenance', re: /\bmaintenance\b|\brepairs?\b|\bwork orders?\b|\bmachines?\b|\bassets?\b/, sections: ['maintenance', 'maintenance-assets'] },
  { topic: 'inventory', re: /\binventory\b|\bmaterials?\b|\bshortages?\b|\bstock\b|\bsuppliers?\b/, sections: ['inventory'] },
  { topic: 'plants', re: /\bplants?\b|\bfactor(y|ies)\b|\bsites?\b|\boperators?\b/, sections: ['plants'] },
];

function analyzeQuery(text) {
  const s = String(text || '').toLowerCase().replace(/\bonline\b|\bdeadline\b/g, '');
  if (/\b(full|complete|entire|whole|everything|all (the )?data)\b/.test(s)) {
    return { topics: ['all'], sections: ALL, executive: true, primaryTemplate: 'executive-summary' };
  }
  const matched = QUERY_TOPICS.filter((x) => x.re.test(s));
  if (!matched.length) {
    return { topics: ['executive'], sections: REPORT_TYPES['executive-summary'].sections, executive: true, primaryTemplate: inferReportType(text) };
  }
  return {
    topics: matched.map((x) => x.topic),
    sections: [...new Set(matched.flatMap((x) => x.sections))],
    executive: /\bexecutive\b|\boverview\b|\bkpis?\b/.test(s),
    primaryTemplate: inferReportType(text),
  };
}

/** Closest fixed template, reported back as matched_template. */
function inferReportType(text) {
  const s = String(text || '').toLowerCase();
  const scores = { 'oee-dashboard': 0, 'downtime-analysis': 0, 'quality-trends': 0, 'cost-analysis': 0, 'executive-summary': 0 };
  if (/\boee\b/.test(s)) scores['oee-dashboard'] += 5;
  if (/\bavailability\b|\bequipment effectiveness\b/.test(s)) scores['oee-dashboard'] += 3;
  if (/\bproduction lines?\b|\blines?\b/.test(s) && !/\bonline\b/.test(s)) scores['oee-dashboard'] += 4;
  if (/\bproduction runs?\b|\boutput\b|\bthroughput\b|\bruntime\b|\bshifts?\b/.test(s)) scores['oee-dashboard'] += 4;
  if (/\bdowntime\b/.test(s)) scores['downtime-analysis'] += 5;
  if (/\bfailures?\b|\bbreakdowns?\b|\bpareto\b|\bunplanned\b|\broot cause\b|\bmaintenance\b/.test(s)) scores['downtime-analysis'] += 3;
  if (/\bquality\b|\brejection\b|\byield\b|\bdefects?\b|\bscrap\b/.test(s)) scores['quality-trends'] += 5;
  if (/\bproducts?\b|\bskus?\b|\bbrand\b/.test(s)) scores['quality-trends'] += 4;
  if (/\bcosts?\b|\benergy\b|\blabou?r\b|\bunit cost\b|\bexpenses?\b|\binventory\b|\bmaterials?\b/.test(s)) scores['cost-analysis'] += 5;
  if (/\bexecutive\b|\boverview\b|\bkpis?\b|\bdashboard summary\b/.test(s)) scores['executive-summary'] += 4;
  const [best, score] = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return score > 0 ? best : 'executive-summary';
}

function reportTitleFromQuery(text, topics) {
  const cleaned = String(text || '')
    .replace(/^(create|generate|make|give me|show me|build|prepare)\s+(an?\s+)?/i, '')
    .replace(/\b(as\s+(an?\s+)?)?(pdf|pptx|csv|powerpoint|excel|spreadsheet|report)\b/gi, '')
    .replace(/^\s*(on|for|about|of)\s+/i, '')
    .replace(/^\s*the\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length >= 3 && cleaned.length <= 80) {
    const titled = cleaned.replace(/^\w/, (c) => c.toUpperCase());
    return /report$/i.test(titled) ? titled : `${titled} Report`;
  }
  return `${topics.map((x) => x.replace(/^\w/, (c) => c.toUpperCase())).join(' & ')} Report`;
}

function fileSlug(title) {
  return String(title || '').toLowerCase().replace(/\breport\b/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'custom';
}

// ---- report data ----

async function overviewKpis(f) {
  const [r] = await q(f, `SELECT SUM(CAST(good_quantity AS float)) / NULLIF(SUM(planned_quantity), 0) * 100 oee,
      SUM(good_quantity) good FROM ${t('production_runs')} ${where(f, { date: 'date', plant: 'plant_id' })}`);
  const [qt] = await q(f, `SELECT SUM(rejected_quantity) rejected, SUM(produced_quantity) produced
    FROM ${t('quality_tests')} ${where(f, { date: 'date', plant: 'plant_id' })}`);
  const [d] = await q(f, `SELECT SUM(duration_minutes) / 60.0 hours FROM ${t('downtime_events')}
    ${where(f, { date: 'event_start_datetime', plant: 'plant_id' })}`);
  const [c] = await q(f, `SELECT SUM(actual_cost_per_unit * units_produced) / NULLIF(SUM(units_produced), 0) unit_cost
    FROM ${t('cost_records')} ${where(f, { date: 'date', plant: 'plant_id' })}`);
  return [
    { label: 'OEE', value: pct(r.oee), color: 'primary' },
    { label: 'Yield', value: pct(n(qt.produced) ? (1 - n(qt.rejected) / n(qt.produced)) * 100 : 0), color: 'success' },
    { label: 'Unit Cost', value: money(c.unit_cost), color: 'warning' },
    { label: 'Downtime', value: dec(d.hours, 0), unit: 'hrs', color: 'danger' },
    { label: 'Good Units', value: count(r.good), color: 'neutral' },
  ];
}

/** The weakest point in each area, with an action for each. */
async function issuesAndActions(f) {
  const [line] = await q(f, `SELECT TOP 1 l.line_name, SUM(CAST(r.good_quantity AS float)) / NULLIF(SUM(r.planned_quantity), 0) * 100 oee
    FROM ${t('production_runs')} r JOIN ${t('production_lines')} l ON l.line_id = r.line_id
    ${where(f, { date: 'r.date', plant: 'r.plant_id' })} GROUP BY l.line_name ORDER BY oee`);
  const [cause] = await q(f, `SELECT TOP 1 ISNULL(failure_mode, ISNULL(reason_code, category)) reason, COUNT(*) events,
      SUM(duration_minutes) / 60.0 hours FROM ${t('downtime_events')} ${where(f, { date: 'event_start_datetime', plant: 'plant_id' })}
    GROUP BY ISNULL(failure_mode, ISNULL(reason_code, category)) ORDER BY hours DESC`);
  const [prod] = await q(f, `SELECT TOP 1 pr.product_name, SUM(qt.rejected_quantity) * 100.0 / NULLIF(SUM(qt.produced_quantity), 0) rej
    FROM ${t('quality_tests')} qt JOIN ${t('products')} pr ON pr.product_id = qt.product_id
    ${where(f, { date: 'qt.date', plant: 'qt.plant_id' })} GROUP BY pr.product_name ORDER BY rej DESC`);
  const [cost] = await q(f, `SELECT TOP 1 l.line_name,
      (SUM(c.actual_cost_per_unit * c.units_produced) - SUM(c.standard_cost_per_unit * c.units_produced)) over_std
    FROM ${t('cost_records')} c JOIN ${t('production_lines')} l ON l.line_id = c.line_id
    ${where(f, { date: 'c.date', plant: 'c.plant_id' })} GROUP BY l.line_name ORDER BY over_std DESC`);
  const [mat] = await q(f, `SELECT TOP 1 mt.material_name, SUM(i.shortages_quantity) shortages
    FROM ${t('inventory_transactions')} i JOIN ${t('materials')} mt ON mt.material_id = i.material_id
    ${where(f, { date: 'i.date', plant: 'i.plant_id' })} GROUP BY mt.material_name ORDER BY shortages DESC`);

  const issues = [];
  const actions = [];
  if (cause) {
    issues.push({ title: `Largest downtime cause: ${cause.reason}`, impact: `${dec(cause.hours)} hours lost over ${count(cause.events)} events` });
    actions.push({ action: `Run a root-cause review and preventive maintenance plan for ${cause.reason}, the largest source of downtime (${dec(cause.hours)} hours).` });
  }
  if (line) {
    issues.push({ title: `Lowest OEE line: ${line.line_name}`, impact: `${pct(line.oee)} OEE` });
    actions.push({ action: `Review planning, changeovers and stoppages on ${line.line_name} to lift OEE from ${pct(line.oee)}.` });
  }
  if (prod) {
    issues.push({ title: `Highest rejection rate: ${prod.product_name}`, impact: `${pct(prod.rej)} of units rejected` });
    actions.push({ action: `Tighten process controls for ${prod.product_name}, which has the highest rejection rate (${pct(prod.rej)}).` });
  }
  if (cost && n(cost.over_std) > 0) {
    issues.push({ title: `Largest cost overrun: ${cost.line_name}`, impact: `${money(cost.over_std)} above standard cost` });
    actions.push({ action: `Investigate why ${cost.line_name} runs ${money(cost.over_std)} above standard cost.` });
  }
  if (mat && n(mat.shortages) > 0) {
    issues.push({ title: `Most material shortages: ${mat.material_name}`, impact: `${count(mat.shortages)} units short` });
    actions.push({ action: `Raise safety stock or supplier lead-time cover for ${mat.material_name} (${count(mat.shortages)} units short).` });
  }
  return { issues, actions };
}

async function buildReportData({ title, subtitle, sections, topics, executive }, f) {
  const [built, kpis, ia] = await Promise.all([
    Promise.all(sections.map((id) => SECTIONS[id](f))),
    overviewKpis(f),
    issuesAndActions(f),
  ]);
  return {
    brand: 'Manufacturing',
    title,
    subtitle,
    topics,
    kpis,
    sections: built.flat(),
    top_issues: executive ? ia.issues : [],
    recommended_actions: ia.actions.slice(0, executive ? 5 : 3),
    is_executive: Boolean(executive),
    empty_hint: 'No manufacturing data matched. Try a topic such as OEE, downtime, quality, products, costs, maintenance or inventory.',
  };
}

// ---- handlers ----

function reportFormat(value) {
  const format = (strParam(value) || 'pptx').toLowerCase();
  return FORMATS.includes(format) ? format : null;
}

function requestFilters(src, format) {
  const ids = uuidParams(src, ['plant_id']);
  if (ids.error) return { error: ids.error };
  const f = { from: dateParam(src.from), to: dateParam(src.to), plant_id: ids.values.plant_id, detail: format !== 'pptx' };
  f.params = {};
  if (f.from) f.params.from_date = f.from;
  if (f.to) f.params.to_date = f.to;
  if (f.plant_id) f.params.plant_id = f.plant_id;
  return f;
}

async function generateReport(req, res) {
  try {
    const reportType = strParam(req.query.report_type);
    const format = reportFormat(req.query.format);
    if (!reportType) return res.status(400).json({ success: false, error: 'report_type parameter required' });
    if (!format) return res.status(400).json({ success: false, error: `format must be one of ${FORMATS.join(', ')}` });
    const spec = REPORT_TYPES[reportType];
    if (!spec) return res.status(400).json({ success: false, error: `Unknown report type: ${reportType}` });
    const f = requestFilters(req.query, format);
    if (f.error) return res.status(400).json({ success: false, error: f.error });

    const data = await buildReportData({ ...spec, topics: [reportType] }, f);
    const filename = await writeReport({
      prefix: 'mfg',
      format,
      reportType,
      data,
      filters: { from: f.from, to: f.to, plant_id: f.plant_id },
    });

    res.json({
      success: true,
      report_type: reportType,
      title: data.title,
      sections: data.sections.map((s) => s.title),
      format,
      filename,
      download_url: downloadUrl(req, filename),
      message: 'Manufacturing report generated successfully. Use download_url to download.',
    });
  } catch (err) {
    console.error('Report generation error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function generateReportQuery(req, res) {
  try {
    const src = { ...req.query, ...req.body };
    const userQuery = strParam(src.query);
    const format = reportFormat(src.format);
    if (!userQuery) return res.status(400).json({ success: false, error: 'query parameter required' });
    if (!format) return res.status(400).json({ success: false, error: `format must be one of ${FORMATS.join(', ')}` });
    const f = requestFilters(src, format);
    if (f.error) return res.status(400).json({ success: false, error: f.error });

    const plan = analyzeQuery(userQuery);
    const title = reportTitleFromQuery(userQuery, plan.topics);
    const data = await buildReportData({ title, sections: plan.sections, topics: plan.topics, executive: plan.executive }, f);
    const filename = await writeReport({
      prefix: 'mfg',
      format,
      reportType: 'query-driven',
      data,
      filters: { from: f.from, to: f.to, plant_id: f.plant_id, query: userQuery },
      slug: fileSlug(title),
    });

    res.json({
      success: true,
      query: userQuery,
      title: data.title,
      report_type: 'query-driven',
      inferred_report_type: 'query-driven',
      topics: plan.topics,
      matched_template: plan.primaryTemplate,
      sections: data.sections.map((s) => s.title),
      format,
      filename,
      download_url: downloadUrl(req, filename),
      message: `Report built from DB data for topics: ${plan.topics.join(', ')}. Use download_url to download.`,
    });
  } catch (err) {
    console.error('Query-based report generation error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { REPORT_TYPES, SECTIONS, generateReport, generateReportQuery };
