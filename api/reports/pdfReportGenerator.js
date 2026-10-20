const PDFDocument = require('pdfkit');
const styleConfig = require('./styleConfig');
const { parseCell, sectionParagraphs, reportSummary } = require('./narrative');

/**
 * Document-style PDF reports for sales, manufacturing and Apex.
 *
 * Unlike the slide deck, the PDF reads as a written report: a title block,
 * contents, an executive summary, numbered sections with written analysis,
 * key figures, full detail tables and notes, then an appendix describing the
 * scope, filters and source tables.
 *
 * Expects data: { brand, title, subtitle?, summary?, kpis[], sections[{ title,
 * about?, narrative?, kpis?, table?{ headers, rows, weights?, metric? }, bullets?,
 * sources? }], top_issues[], recommended_actions[], notes?[], empty_hint? }.
 */

const INK = '#222222';
const MUTED = '#666666';
const RULE = '#C8CED6';
const HEAD_FILL = '#E9EEF4';
const ZEBRA = '#F7F9FB';

class PDFReportGenerator {
  constructor(reportType, data, filters = {}) {
    this.reportType = reportType;
    this.data = data || {};
    this.filters = filters;
    this.doc = null;
    this.margin = 50;
    this.brand = this.data.brand || 'Manufacturing';
    this.primary = `#${styleConfig.colors.primary}`;
  }

  createDocument() {
    // margin: 0, because gutters are managed here. PDFKit's own margin
    // auto-paginates drawing in the bottom margin, which broke footers.
    this.doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      bufferPages: true,
      info: {
        Title: this.data.title || `${this.brand} Report`,
        Author: `${this.brand} Agent`,
        Creator: 'sales-agent-db',
      },
    });
    this.contentBottom = this.doc.page.height - this.margin - 10;
    this.doc.y = this.margin;
  }

  width() {
    return this.doc.page.width - this.margin * 2;
  }

  /** New page with the same size as the first; PDFKit otherwise defaults to Letter. */
  addPage() {
    this.doc.addPage({ size: 'A4', margin: 0 });
    this.doc.y = this.margin + 16;
  }

  ensureSpace(needed) {
    if (this.doc.y + needed > this.contentBottom) this.addPage();
  }

  // ---- text blocks ----

  heading(text, level = 1) {
    const size = level === 1 ? 15 : 11.5;
    this.ensureSpace(level === 1 ? 70 : 50);
    this.doc.moveDown(level === 1 ? 0.8 : 0.5);
    this.doc.font('Helvetica-Bold').fontSize(size).fillColor(level === 1 ? this.primary : INK)
      .text(text, this.margin, this.doc.y, { width: this.width() });
    if (level === 1) {
      const y = this.doc.y + 2;
      this.doc.strokeColor(RULE).lineWidth(0.75).moveTo(this.margin, y).lineTo(this.margin + this.width(), y).stroke();
      this.doc.y = y + 6;
    } else {
      this.doc.moveDown(0.25);
    }
  }

  paragraph(text, opts = {}) {
    const font = opts.italic ? 'Helvetica-Oblique' : 'Helvetica';
    const size = opts.size || 10;
    this.doc.font(font).fontSize(size);
    this.ensureSpace(Math.min(this.doc.heightOfString(text, { width: this.width() }), 60) + 6);
    this.doc.fillColor(opts.color || INK)
      .text(text, this.margin, this.doc.y, { width: this.width(), align: opts.align || 'justify', lineGap: 1.5 });
    this.doc.moveDown(0.5);
  }

  list(items, numbered = false) {
    items.forEach((item, i) => {
      const marker = numbered ? `${i + 1}.` : '•';
      const indent = numbered ? 18 : 12;
      this.doc.font('Helvetica').fontSize(10);
      const h = this.doc.heightOfString(String(item), { width: this.width() - indent });
      this.ensureSpace(h + 4);
      const y = this.doc.y;
      this.doc.fillColor(this.primary).text(marker, this.margin, y, { width: indent, lineBreak: false });
      this.doc.fillColor(INK).text(String(item), this.margin + indent, y, { width: this.width() - indent, lineGap: 1.5 });
      this.doc.moveDown(0.25);
    });
    this.doc.moveDown(0.3);
  }

  /** Captions are kept on the same page as the header and first rows of their table. */
  caption(text) {
    this.ensureSpace(100);
    this.doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED)
      .text(text, this.margin, this.doc.y, { width: this.width() });
    this.doc.moveDown(0.25);
  }

  // ---- tables ----

  /**
   * Ruled table whose cells wrap. Numbers are right-aligned. The header row
   * repeats when the table continues on a new page.
   */
  table(headers, rows, weights) {
    if (!headers || !headers.length) return;
    const w = weights && weights.length === headers.length ? weights : headers.map(() => 1);
    const pad = 4;
    const size = headers.length > 7 ? 7.5 : 8.5;
    const colW = this.columnWidths(headers, rows, w, size, pad);
    const numericCol = headers.map((_, i) => rows.length > 0 && rows.every((r) => r[i] == null || r[i] === '' || r[i] === '-' || parseCell(r[i])));

    const rowHeight = (cells, font) => {
      this.doc.font(font).fontSize(size);
      return Math.max(...cells.map((c, i) => this.doc.heightOfString(String(c ?? ''), { width: colW[i] - pad * 2 }))) + pad * 2;
    };
    const drawRow = (cells, y, h, { header = false, fill = null } = {}) => {
      if (fill) this.doc.rect(this.margin, y, this.width(), h).fill(fill);
      this.doc.font(header ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(INK);
      let x = this.margin;
      cells.forEach((c, i) => {
        this.doc.text(String(c ?? ''), x + pad, y + pad, {
          width: colW[i] - pad * 2,
          align: numericCol[i] && i > 0 ? 'right' : 'left',
        });
        x += colW[i];
      });
      this.doc.strokeColor(RULE).lineWidth(header ? 0.9 : 0.4)
        .moveTo(this.margin, y + h).lineTo(this.margin + this.width(), y + h).stroke();
    };

    const headerH = rowHeight(headers, 'Helvetica-Bold');
    this.ensureSpace(headerH + Math.min(rows.length, 3) * 16);
    let y = this.doc.y;
    this.doc.strokeColor(RULE).lineWidth(0.9).moveTo(this.margin, y).lineTo(this.margin + this.width(), y).stroke();
    drawRow(headers, y, headerH, { header: true, fill: HEAD_FILL });
    y += headerH;

    rows.forEach((row, idx) => {
      const h = rowHeight(row, 'Helvetica');
      if (y + h > this.contentBottom) {
        this.addPage();
        y = this.doc.y;
        this.doc.strokeColor(RULE).lineWidth(0.9).moveTo(this.margin, y).lineTo(this.margin + this.width(), y).stroke();
        drawRow(headers, y, headerH, { header: true, fill: HEAD_FILL });
        y += headerH;
      }
      drawRow(row, y, h, { fill: idx % 2 ? ZEBRA : null });
      y += h;
    });
    this.doc.y = y + 10;
  }

  /**
   * Split the width by weight, but never make a column narrower than its
   * longest word, so headers and labels wrap between words, not inside them.
   */
  columnWidths(headers, rows, weights, size, pad) {
    const total = this.width();
    const longest = (text, font) => {
      this.doc.font(font).fontSize(size);
      return Math.max(0, ...String(text ?? '').split(/\s+/).map((word) => this.doc.widthOfString(word)));
    };
    const minW = headers.map((h, i) => Math.max(
      longest(h, 'Helvetica-Bold'),
      ...rows.slice(0, 60).map((r) => longest(r[i], 'Helvetica'))
    ) + pad * 2 + 1);
    const sum = weights.reduce((a, b) => a + b, 0);
    let widths = weights.map((x) => (total * x) / sum);
    if (minW.reduce((a, b) => a + b, 0) > total) return widths;
    for (let pass = 0; pass < 5; pass++) {
      const short = widths.map((wd, i) => wd < minW[i]);
      if (!short.some(Boolean)) break;
      const fixed = widths.reduce((a, wd, i) => a + (short[i] ? minW[i] : 0), 0);
      const flexSum = weights.reduce((a, x, i) => a + (short[i] ? 0 : x), 0);
      widths = widths.map((wd, i) => (short[i] ? minW[i] : ((total - fixed) * weights[i]) / flexSum));
    }
    return widths;
  }

  /** Key figures as a four-column Measure | Value | Measure | Value table. */
  keyFigures(kpis) {
    if (!Array.isArray(kpis) || !kpis.length) return;
    const rows = [];
    for (let i = 0; i < kpis.length; i += 2) {
      const cell = (k) => (k ? [`${k.label}${k.unit ? ` (${k.unit})` : ''}`, k.value] : ['', '']);
      rows.push([...cell(kpis[i]), ...cell(kpis[i + 1])]);
    }
    this.table(['Measure', 'Value', 'Measure', 'Value'], rows, [2, 1.2, 2, 1.2]);
  }

  // ---- page furniture ----

  scopeLine() {
    const f = this.filters;
    const bits = [];
    if (f.from || f.to) bits.push(`${f.from || 'the start of the data'} to ${f.to || 'the latest date'}`);
    else bits.push('the full history in the database');
    if (f.region) bits.push(`region ${f.region}`);
    if (f.business_unit) bits.push(`business unit ${f.business_unit}`);
    if (f.plant_id) bits.push(`plant ${f.plant_id}`);
    return bits.join(', ');
  }

  titleBlock() {
    const d = this.doc;
    d.rect(0, 0, d.page.width, 6).fill(this.primary);
    d.y = this.margin;
    d.font('Helvetica-Bold').fontSize(9).fillColor(this.primary)
      .text(`${this.brand.toUpperCase()} REPORT`, this.margin, d.y, { characterSpacing: 1.2 });
    d.moveDown(0.4);
    d.font('Helvetica-Bold').fontSize(22).fillColor(INK).text(this.data.title || `${this.brand} Report`, this.margin, d.y, { width: this.width() });
    const subtitle = this.filters.query ? `Prepared for the request: "${this.filters.query}"` : this.data.subtitle;
    if (subtitle) {
      d.moveDown(0.2);
      d.font('Helvetica').fontSize(12).fillColor(MUTED).text(subtitle, this.margin, d.y, { width: this.width() });
    }
    d.moveDown(0.8);
    this.table(['Field', 'Detail'], [
      ['Scope', this.scopeLine()],
      ['Generated', new Date().toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' })],
      ['Sections', String((this.data.sections || []).length)],
    ], [1, 4]);
  }

  finalizePages() {
    const range = this.doc.bufferedPageRange();
    const title = this.data.title || `${this.brand} Report`;
    for (let i = 0; i < range.count; i++) {
      this.doc.switchToPage(range.start + i);
      const { width, height } = this.doc.page;
      this.doc.save();
      if (i > 0) {
        this.doc.font('Helvetica').fontSize(8).fillColor(MUTED)
          .text(title, this.margin, 26, { width: this.width() * 0.7, lineBreak: false })
          .text(`${this.brand} Agent`, this.margin + this.width() * 0.7, 26, { width: this.width() * 0.3, align: 'right', lineBreak: false });
        this.doc.strokeColor(RULE).lineWidth(0.5).moveTo(this.margin, 40).lineTo(width - this.margin, 40).stroke();
      }
      const fy = height - 34;
      this.doc.strokeColor(RULE).lineWidth(0.5).moveTo(this.margin, fy - 8).lineTo(width - this.margin, fy - 8).stroke();
      this.doc.font('Helvetica').fontSize(8).fillColor(MUTED)
        .text(`${this.brand} Agent Report`, this.margin, fy, { width: this.width() * 0.6, lineBreak: false })
        .text(`Page ${i + 1} of ${range.count}`, this.margin + this.width() * 0.6, fy, { width: this.width() * 0.4, align: 'right', lineBreak: false });
      this.doc.restore();
    }
  }

  // ---- report ----

  async generateReport() {
    this.createDocument();
    const data = this.data;
    const sections = data.sections || [];

    this.titleBlock();

    if (sections.length > 1) {
      this.heading('Contents', 2);
      this.list([
        'Executive summary',
        ...sections.map((s) => s.title),
        ...(data.recommended_actions?.length ? ['Recommended actions'] : []),
        'About this report',
      ], true);
    }

    this.heading('1. Executive summary');
    const summary = reportSummary(data, this.scopeLine());
    summary.paragraphs.forEach((p) => this.paragraph(p));
    if (data.kpis?.length) {
      this.caption('Table 1.1  Key figures');
      this.keyFigures(data.kpis);
    }
    if (summary.brief.length) {
      this.heading('In brief', 2);
      this.list(summary.brief);
    }
    if (data.top_issues?.length) {
      this.heading('Priority issues', 2);
      this.list(data.top_issues.map((i) => `${i.title}. ${i.impact || ''}`.trim()), true);
    }

    sections.forEach((section, idx) => {
      const no = idx + 2;
      this.heading(`${no}. ${section.title || 'Section'}`);
      if (section.about) this.paragraph(section.about, { italic: true, color: MUTED, size: 9.5 });
      const tableRef = `Table ${no}.${section.kpis?.length ? 2 : 1}`;
      sectionParagraphs(section, tableRef).forEach((p) => this.paragraph(p));
      if (section.kpis?.length) {
        this.caption(`Table ${no}.1  Key figures`);
        this.keyFigures(section.kpis);
      }
      if (section.table?.headers && section.table.rows?.length) {
        this.caption(`${tableRef}  ${section.table.caption || section.title}`);
        this.table(section.table.headers, section.table.rows, section.table.weights);
      }
      if (section.bullets?.length) {
        this.heading('Notes', 2);
        this.list(section.bullets);
      }
    });

    if (!sections.length) {
      this.paragraph(data.empty_hint || 'No data matched this request.', { italic: true, color: MUTED });
    }

    const actions = data.recommended_actions || [];
    let next = sections.length + 2;
    if (actions.length) {
      this.heading(`${next}. Recommended actions`);
      this.list(actions.map((a) => a.action || String(a)), true);
      next += 1;
    }

    this.heading(`${next}. About this report`);
    this.paragraph(
      `Every figure in this report was queried from the ${this.brand} database when the report was generated; ` +
      'nothing is estimated or typed in. Written analysis is derived from the same figures shown in the tables.'
    );
    const sources = [...new Set(sections.flatMap((s) => s.sources || []))].sort();
    const notes = [`Scope: ${this.scopeLine()}.`, ...(data.notes || [])];
    if (sources.length) notes.push(`Source tables (${sources.length}): ${sources.join(', ')}.`);
    this.list(notes);

    this.finalizePages();
    return this.doc;
  }

  async save(stream) {
    return new Promise((resolve, reject) => {
      this.doc.pipe(stream);
      this.doc.end();
      stream.on('finish', () => resolve());
      stream.on('error', reject);
    });
  }
}

module.exports = PDFReportGenerator;
