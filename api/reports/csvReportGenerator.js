const fs = require('fs');

/**
 * CSV reports. One file, one block per section, blocks separated by a blank
 * line so the file opens cleanly in Excel or Sheets.
 *
 * Sectioned data ({ title, kpis, sections[{ title, kpis, table, bullets }] })
 * is written block by block. Any other report data (the fixed manufacturing
 * and sales templates) is written field by field: scalars as Field,Value rows
 * and arrays of objects as tables.
 */

function csvCell(value) {
  if (value == null) return '';
  const s = value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvLine(cells) {
  return cells.map(csvCell).join(',') + '\r\n';
}

function humanize(key) {
  return String(key).replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

class CSVReportGenerator {
  constructor(reportType, data, filters = {}) {
    this.reportType = reportType;
    this.data = data || {};
    this.filters = filters;
    this.lines = [];
  }

  push(cells) {
    this.lines.push(csvLine(cells));
  }

  blank() {
    this.lines.push('\r\n');
  }

  addHeader(title) {
    this.push([title]);
    const filterBits = Object.entries(this.filters).filter(([, v]) => v != null && v !== '');
    for (const [k, v] of filterBits) this.push([humanize(k), v]);
    this.push(['Generated', new Date().toISOString()]);
    this.blank();
  }

  addKpis(kpis) {
    if (!Array.isArray(kpis) || !kpis.length) return;
    this.push(['Metric', 'Value', 'Unit']);
    for (const k of kpis) this.push([k.label, k.value, k.unit || '']);
  }

  addTable(headers, rows) {
    this.push(headers);
    for (const row of rows) this.push(row);
  }

  generateSectioned() {
    this.addHeader(this.data.title || humanize(this.reportType));

    if (Array.isArray(this.data.kpis) && this.data.kpis.length) {
      this.push(['Overview']);
      this.addKpis(this.data.kpis);
      this.blank();
    }

    for (const section of this.data.sections || []) {
      this.push([section.title || 'Section']);
      if (section.kpis?.length) {
        this.addKpis(section.kpis);
        if (section.table?.rows?.length || section.bullets?.length) this.blank();
      }
      if (section.table?.headers && section.table.rows?.length) {
        this.addTable(section.table.headers, section.table.rows);
      }
      if (section.bullets?.length) {
        if (section.table?.rows?.length) this.blank();
        this.push(['Notes']);
        for (const b of section.bullets) this.push([b]);
      }
      this.blank();
    }

    const issues = this.data.top_issues || [];
    if (issues.length) {
      this.push(['Top Issues']);
      this.addTable(['Issue', 'Impact'], issues.map((i) => [i.title, i.impact]));
      this.blank();
    }

    const actions = this.data.recommended_actions || [];
    if (actions.length) {
      this.push(['Recommended Actions']);
      for (const a of actions) this.push([a.action || String(a)]);
    }
  }

  writeValue(label, value) {
    if (Array.isArray(value)) {
      if (!value.length) return;
      this.push([label]);
      if (value.every((v) => v && typeof v === 'object' && !(v instanceof Date))) {
        const headers = [...new Set(value.flatMap((v) => Object.keys(v)))];
        this.addTable(headers, value.map((v) => headers.map((h) => v[h])));
      } else {
        for (const v of value) this.push([v]);
      }
      this.blank();
    } else if (value && typeof value === 'object' && !(value instanceof Date)) {
      const scalars = Object.entries(value).filter(([, v]) => v == null || typeof v !== 'object' || v instanceof Date);
      if (scalars.length) {
        this.push([label]);
        this.push(['Field', 'Value']);
        for (const [k, v] of scalars) this.push([humanize(k), v]);
        this.blank();
      }
      for (const [k, v] of Object.entries(value)) {
        if (v && typeof v === 'object' && !(v instanceof Date)) this.writeValue(`${label} - ${humanize(k)}`, v);
      }
    }
  }

  generateRaw() {
    this.addHeader(humanize(this.reportType));
    const scalars = Object.entries(this.data).filter(([, v]) => v == null || typeof v !== 'object' || v instanceof Date);
    if (scalars.length) {
      this.push(['Field', 'Value']);
      for (const [k, v] of scalars) this.push([humanize(k), v]);
      this.blank();
    }
    for (const [k, v] of Object.entries(this.data)) {
      if (v && typeof v === 'object' && !(v instanceof Date)) this.writeValue(humanize(k), v);
    }
  }

  async generateReport() {
    if (Array.isArray(this.data.sections)) this.generateSectioned();
    else this.generateRaw();
    return this;
  }

  async save(filepath) {
    // BOM so Excel reads UTF-8 (en dashes, accented names) correctly.
    await fs.promises.writeFile(filepath, '﻿' + this.lines.join(''), 'utf8');
  }
}

module.exports = CSVReportGenerator;
module.exports.csvLine = csvLine;
