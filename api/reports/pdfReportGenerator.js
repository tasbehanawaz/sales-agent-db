const PDFDocument = require('pdfkit');
const styleConfig = require('./styleConfig');

/**
 * Manufacturing PDF reports — styled to mirror the PPTX layout:
 * banner header, KPI cards, zebra tables, insights, page footers.
 */
class PDFReportGenerator {
  constructor(reportType, data, filters = {}) {
    this.reportType = reportType;
    this.data = data;
    this.filters = filters;
    this.doc = null;
    this.pageNumber = 0;
    this.margin = 40;
    this.contentBottom = 0;
  }

  // ---- color helpers (styleConfig stores hex WITHOUT '#') ----
  color(nameOrHex, fallback = 'primary') {
    const raw = styleConfig.colors[nameOrHex] || nameOrHex || styleConfig.colors[fallback];
    const hex = String(raw).replace(/^#/, '');
    return `#${hex}`;
  }

  createDocument() {
    // margin: 0 — we manage gutters ourselves. PDFKit's built-in margin
    // auto-paginates any drawing in the bottom margin (which broke footers
    // into blank extra pages).
    this.doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      bufferPages: true,
      autoFirstPage: true,
      info: {
        Title: `Manufacturing ${this.reportType} Report`,
        Author: 'Manufacturing Agent',
        Creator: 'sales-agent-db',
      },
    });
    this.footerHeight = 36;
    this.contentBottom = this.doc.page.height - this.footerHeight - 8;
    this.pageNumber = 1;
  }

  contentWidth() {
    return this.doc.page.width - this.margin * 2;
  }

  ensureSpace(needed) {
    if (this.doc.y + needed > this.contentBottom) {
      this.doc.addPage({ margin: 0 });
      this.doc.y = this.margin;
      this.pageNumber += 1;
    }
  }

  /** Draw footer on every existing page without creating new ones */
  finalizeFooters() {
    const range = this.doc.bufferedPageRange();
    const total = range.count;
    const footerY = this.doc.page.height - 28;

    for (let i = 0; i < total; i++) {
      this.doc.switchToPage(range.start + i);

      // Use vector ops + absolute text only — never let text auto-flow
      this.doc.save();
      this.doc
        .strokeColor(this.color('light'))
        .lineWidth(0.75)
        .moveTo(this.margin, footerY - 10)
        .lineTo(this.doc.page.width - this.margin, footerY - 10)
        .stroke();

      this.doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#888888')
        .text('Manufacturing Agent Report', this.margin, footerY, {
          width: this.contentWidth() * 0.55,
          align: 'left',
          lineBreak: false,
          continued: false,
        });

      this.doc.text(`Page ${i + 1} of ${total}`, this.margin + this.contentWidth() * 0.55, footerY, {
        width: this.contentWidth() * 0.45,
        align: 'right',
        lineBreak: false,
        continued: false,
      });
      this.doc.restore();
    }
  }

  /** Top banner + title + subtitle + date (content continues on same page) */
  addHeader(title, subtitle) {
    const w = this.doc.page.width;
    const bannerH = 72;

    this.doc.rect(0, 0, w, bannerH).fill(this.color('primary'));

    this.doc
      .fillColor('#FFFFFF')
      .font('Helvetica-Bold')
      .fontSize(22)
      .text(title, this.margin, 18, { width: w - this.margin * 2, align: 'left' });

    this.doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor('#D6E6F5')
      .text(subtitle || '', this.margin, 46, { width: w - this.margin * 2, align: 'left' });

    this.doc.y = bannerH + 16;

    const filterBits = [];
    if (this.filters.from || this.filters.to) {
      filterBits.push(`Period: ${this.filters.from || '…'} to ${this.filters.to || '…'}`);
    }
    if (this.filters.plant_id) filterBits.push(`Plant: ${this.filters.plant_id}`);
    filterBits.push(`Generated: ${new Date().toLocaleString()}`);

    this.doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#666666')
      .text(filterBits.join('  |  '), this.margin, this.doc.y, {
        width: this.contentWidth(),
        align: 'left',
      });

    this.doc.moveDown(0.8);
    this._drawRule();
    this.doc.moveDown(0.6);
  }

  _drawRule() {
    const y = this.doc.y;
    this.doc
      .strokeColor(this.color('light'))
      .lineWidth(1)
      .moveTo(this.margin, y)
      .lineTo(this.doc.page.width - this.margin, y)
      .stroke();
    this.doc.y = y + 6;
  }

  addSectionTitle(title) {
    this.ensureSpace(36);
    this.doc
      .font('Helvetica-Bold')
      .fontSize(13)
      .fillColor(this.color('primary'))
      .text(title, this.margin, this.doc.y, { width: this.contentWidth() });
    this.doc.moveDown(0.35);

    // Accent underline
    const y = this.doc.y;
    this.doc
      .strokeColor(this.color('primary'))
      .lineWidth(2)
      .moveTo(this.margin, y)
      .lineTo(this.margin + 48, y)
      .stroke();
    this.doc.y = y + 10;
  }

  /**
   * KPI cards in a responsive grid (fits 4 across A4).
   * @param {Array<{label, value, color?, unit?}>} kpis
   */
  addKPIGrid(kpis) {
    if (!kpis || !kpis.length) return;

    const gap = 10;
    const cols = Math.min(4, kpis.length);
    const cardW = (this.contentWidth() - gap * (cols - 1)) / cols;
    const cardH = 68;
    const rows = Math.ceil(kpis.length / cols);

    this.ensureSpace(rows * (cardH + gap) + 8);

    const startY = this.doc.y;
    let maxY = startY;

    kpis.forEach((kpi, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = this.margin + col * (cardW + gap);
      const y = startY + row * (cardH + gap);
      this._drawKPICard(x, y, cardW, cardH, kpi);
      maxY = Math.max(maxY, y + cardH);
    });

    this.doc.y = maxY + 14;
  }

  _drawKPICard(x, y, w, h, kpi) {
    const bg = this.color(kpi.color || 'primary');

    this.doc.roundedRect(x, y, w, h, 4).fill(bg);

    const value = String(kpi.value ?? '');
    const label = `${kpi.label || ''}${kpi.unit ? ` (${kpi.unit})` : ''}`;

    this.doc
      .fillColor('#FFFFFF')
      .font('Helvetica-Bold')
      .fontSize(value.length > 10 ? 16 : 20)
      .text(value, x + 8, y + 14, { width: w - 16, align: 'center' });

    this.doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#FFFFFF')
      .text(label, x + 8, y + 44, { width: w - 16, align: 'center' });
  }

  /**
   * Professional table with header + zebra rows.
   * @param {string[]} headers
   * @param {Array<Array<string|number>>} rows
   * @param {number[]} [colWeights] optional relative column weights
   */
  addTable(headers, rows, colWeights) {
    if (!headers || !headers.length) return;

    const tableW = this.contentWidth();
    const weights = colWeights && colWeights.length === headers.length
      ? colWeights
      : headers.map(() => 1);
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const colWidths = weights.map((w) => (tableW * w) / weightSum);

    const headerH = 24;
    const rowH = 20;
    const padX = 6;

    this.ensureSpace(headerH + Math.min(rows.length, 3) * rowH + 10);

    let x0 = this.margin;
    let y = this.doc.y;
    const tableStartY = y;

    // Header
    this.doc.rect(x0, y, tableW, headerH).fill(this.color('primary'));
    this.doc.font('Helvetica-Bold').fontSize(9).fillColor('#FFFFFF');
    let cx = x0;
    headers.forEach((h, i) => {
      this.doc.text(String(h), cx + padX, y + 7, {
        width: colWidths[i] - padX * 2,
        align: i === 0 ? 'left' : 'center',
        lineBreak: false,
      });
      cx += colWidths[i];
    });
    y += headerH;

    // Rows
    let segmentStartY = tableStartY;
    rows.forEach((row, idx) => {
      if (y + rowH > this.contentBottom) {
        this.doc
          .strokeColor('#CCCCCC')
          .lineWidth(0.75)
          .rect(x0, segmentStartY, tableW, y - segmentStartY)
          .stroke();

        this.doc.addPage({ margin: 0 });
        y = this.margin;
        segmentStartY = y;

        this.doc.rect(x0, y, tableW, headerH).fill(this.color('primary'));
        this.doc.font('Helvetica-Bold').fontSize(9).fillColor('#FFFFFF');
        cx = x0;
        headers.forEach((h, i) => {
          this.doc.text(String(h), cx + padX, y + 7, {
            width: colWidths[i] - padX * 2,
            align: i === 0 ? 'left' : 'center',
            lineBreak: false,
          });
          cx += colWidths[i];
        });
        y += headerH;
      }

      const bg = idx % 2 === 0 ? '#FFFFFF' : this.color('light');
      this.doc.rect(x0, y, tableW, rowH).fill(bg);

      this.doc
        .strokeColor('#E0E0E0')
        .lineWidth(0.5)
        .moveTo(x0, y + rowH)
        .lineTo(x0 + tableW, y + rowH)
        .stroke();

      this.doc.font('Helvetica').fontSize(9).fillColor('#333333');
      cx = x0;
      row.forEach((cell, i) => {
        const cellStr = String(cell ?? '');
        const isStatus = headers[i] && /status/i.test(headers[i]);
        if (isStatus) {
          const good = /good|ok/i.test(cellStr);
          this.doc.fillColor(good ? this.color('success') : this.color('warning'));
          this.doc.font('Helvetica-Bold');
        } else {
          this.doc.fillColor('#333333');
          this.doc.font('Helvetica');
        }
        this.doc.text(cellStr, cx + padX, y + 5, {
          width: colWidths[i] - padX * 2,
          align: i === 0 ? 'left' : 'center',
          lineBreak: false,
          height: rowH - 2,
        });
        cx += colWidths[i];
      });
      y += rowH;
    });

    this.doc
      .strokeColor('#CCCCCC')
      .lineWidth(0.75)
      .rect(x0, segmentStartY, tableW, y - segmentStartY)
      .stroke();

    this.doc.y = y + 12;
  }

  addTextBlock(text, size = 10, bold = false, color = '#404040') {
    this.ensureSpace(24);
    this.doc
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(size)
      .fillColor(color)
      .text(text, this.margin, this.doc.y, { width: this.contentWidth() });
    this.doc.moveDown(0.25);
  }

  addBulletList(items) {
    if (!items || !items.length) return;
    this.ensureSpace(items.length * 16 + 8);
    items.forEach((item) => {
      this.ensureSpace(18);
      const bulletX = this.margin + 4;
      const textX = this.margin + 16;
      const y = this.doc.y;

      this.doc
        .circle(bulletX + 2, y + 5, 2)
        .fill(this.color('primary'));

      this.doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#404040')
        .text(String(item), textX, y, {
          width: this.contentWidth() - 16,
        });
      this.doc.moveDown(0.2);
    });
    this.doc.moveDown(0.3);
  }

  addCallout(title, body, colorName = 'primary') {
    this.ensureSpace(48);
    const x = this.margin;
    const w = this.contentWidth();
    const y = this.doc.y;
    const pad = 8;

    this.doc.font('Helvetica-Bold').fontSize(10);
    const titleH = this.doc.heightOfString(title, { width: w - pad * 2 - 8 });
    this.doc.font('Helvetica').fontSize(9);
    const bodyH = this.doc.heightOfString(body, { width: w - pad * 2 - 8 });
    const h = pad * 2 + titleH + bodyH + 2;

    this.doc.roundedRect(x, y, w, h, 3).fill('#F5F8FB');
    this.doc.rect(x, y, 4, h).fill(this.color(colorName));

    this.doc
      .fillColor(this.color(colorName))
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(title, x + pad + 8, y + pad, { width: w - pad * 2 - 8 });

    this.doc
      .fillColor('#505050')
      .font('Helvetica')
      .fontSize(9)
      .text(body, x + pad + 8, y + pad + titleH + 1, { width: w - pad * 2 - 8 });

    this.doc.y = y + h + 8;
  }

  async generateReport() {
    this.createDocument();

    switch (this.reportType) {
      case 'oee-dashboard':
        await this.generateOEEReport();
        break;
      case 'downtime-analysis':
        await this.generateDowntimeReport();
        break;
      case 'quality-trends':
        await this.generateQualityReport();
        break;
      case 'cost-analysis':
        await this.generateCostReport();
        break;
      case 'executive-summary':
        await this.generateExecutiveReport();
        break;
      case 'query-driven':
        await this.generateQueryDrivenReport();
        break;
      default:
        throw new Error(`Unknown report type: ${this.reportType}`);
    }

    this.finalizeFooters();
    return this.doc;
  }

  // ---- report builders ----

  async generateOEEReport() {
    const oeeData = this.data.oee_summary || {};
    this.addHeader('OEE Dashboard Report', 'Operational Equipment Effectiveness Analysis');

    this.addSectionTitle('OEE Summary');
    this.addKPIGrid([
      { label: 'Overall OEE', value: `${Number(oeeData.overall || 0).toFixed(1)}%`, color: 'primary' },
      { label: 'Availability', value: `${Number(oeeData.overall_availability || oeeData.availability || 0).toFixed(1)}%`, color: 'success' },
      { label: 'Performance', value: `${Number(oeeData.overall_performance || oeeData.performance || 0).toFixed(1)}%`, color: 'warning' },
      { label: 'Quality', value: `${Number(oeeData.overall_quality || oeeData.quality || 0).toFixed(1)}%`, color: 'danger' },
    ]);

    if (this.data.oee_by_line && this.data.oee_by_line.length > 0) {
      this.addSectionTitle('Performance by Line');
      this.addTable(
        ['Line', 'OEE %', 'Status'],
        this.data.oee_by_line.slice(0, 12).map((line) => {
          const pct = Number(line.oee_pct || 0);
          return [line.line_name || 'N/A', `${pct.toFixed(1)}%`, pct >= 80 ? 'Good' : 'Needs Attention'];
        }),
        [3, 1.2, 1.8]
      );
    }

    this.addSectionTitle('Key Insights');
    this.addBulletList([
      `Top performing line: ${this.data.top_line || 'N/A'}`,
      `Lines below 80% OEE: ${this.data.poor_performers || 0}`,
      `Recommendation: Focus on ${this.data.recommendation || 'preventive maintenance'}`,
    ]);
  }

  async generateDowntimeReport() {
    const downtimeData = this.data.summary || {};
    this.addHeader('Downtime Analysis Report', 'Root Cause Investigation & Pareto Analysis');

    this.addSectionTitle('Downtime Overview');
    this.addKPIGrid([
      { label: 'Total Downtime', value: `${Number(downtimeData.total_hours || 0).toFixed(1)}`, unit: 'hrs', color: 'danger' },
      { label: 'Incidents', value: `${downtimeData.incident_count || 0}`, color: 'warning' },
      { label: 'Avg Duration', value: `${Number(downtimeData.avg_duration || 0).toFixed(1)}`, unit: 'min', color: 'primary' },
      { label: 'Lost Output', value: `${Number(downtimeData.impact_units || 0).toLocaleString()}`, unit: 'units', color: 'danger' },
    ]);

    if (this.data.top_reasons && this.data.top_reasons.length > 0) {
      this.addSectionTitle('Top Downtime Reasons');
      this.addTable(
        ['Reason', 'Count', 'Hours', '% of Total'],
        this.data.top_reasons.slice(0, 12).map((reason) => [
          reason.reason_code || 'Unknown',
          String(reason.count || 0),
          Number(reason.total_hours || 0).toFixed(1),
          `${(Number(reason.pct || 0) * 100).toFixed(1)}%`,
        ]),
        [3, 1, 1, 1.2]
      );
    }

    this.addSectionTitle('Recommendations');
    this.addBulletList([
      'Focus on top 3 downtime drivers (80/20 rule)',
      'Implement preventive maintenance for recurring failures',
      'Prioritize equipment with highest impact',
      'Monitor and track improvement metrics weekly',
    ]);
  }

  async generateQualityReport() {
    const qualityData = this.data.summary || {};
    this.addHeader('Quality Trends Report', 'Yield & Rejection Rate Analysis');

    this.addSectionTitle('Quality Metrics');
    this.addKPIGrid([
      { label: 'Avg Yield', value: `${Number(qualityData.avg_yield || 0).toFixed(1)}%`, color: 'success' },
      { label: 'Rejection Rate', value: `${Number(qualityData.avg_rejection || 0).toFixed(1)}%`, color: 'danger' },
      { label: 'Good Units', value: `${Number(qualityData.total_good || 0).toLocaleString()}`, color: 'success' },
      { label: 'Rejected', value: `${Number(qualityData.total_rejected || 0).toLocaleString()}`, color: 'danger' },
    ]);

    if (this.data.by_product && this.data.by_product.length > 0) {
      this.addSectionTitle('Quality by Product');
      this.addTable(
        ['Product', 'Yield %', 'Rejection %', 'Status'],
        this.data.by_product.slice(0, 12).map((prod) => {
          const yieldPct = Number(prod.yield_pct || 0);
          return [
            prod.product_name || 'Unknown',
            `${yieldPct.toFixed(1)}%`,
            `${Number(prod.rejection_pct || 0).toFixed(1)}%`,
            yieldPct >= 95 ? 'Good' : 'Review',
          ];
        }),
        [3.2, 1.2, 1.4, 1.2]
      );
    } else {
      this.addCallout(
        'No product breakdown',
        'Quality summary KPIs are shown above. Product-level rows were not available for this filter range.',
        'warning'
      );
    }
  }

  async generateCostReport() {
    const costData = this.data.summary || {};
    this.addHeader('Cost Analysis Report', 'Unit Cost & Energy Efficiency Analysis');

    this.addSectionTitle('Cost Summary');
    this.addKPIGrid([
      { label: 'Unit Cost', value: `$${Number(costData.avg_cost || 0).toFixed(2)}`, color: 'primary' },
      { label: 'Energy Cost', value: `$${Math.round(Number(costData.energy_cost || 0)).toLocaleString()}`, color: 'warning' },
      { label: 'Scrap Cost', value: `$${Math.round(Number(costData.scrap_cost || 0)).toLocaleString()}`, color: 'danger' },
      { label: 'Total Cost', value: `$${Math.round(Number(costData.total_cost || 0)).toLocaleString()}`, color: 'neutral' },
    ]);

    if (this.data.by_line && this.data.by_line.length > 0) {
      this.addSectionTitle('Cost by Line');
      this.addTable(
        ['Line', 'Unit Cost', 'Energy/Unit', 'Total'],
        this.data.by_line.slice(0, 12).map((line) => [
          line.line_name || 'Unknown',
          `$${Number(line.unit_cost || 0).toFixed(2)}`,
          `${Number(line.energy_per_unit || 0).toFixed(2)} kWh`,
          `$${Number(line.total_cost || 0).toFixed(0)}`,
        ]),
        [2.5, 1.3, 1.5, 1.3]
      );
    }
  }

  async generateExecutiveReport() {
    const kpis = this.data.kpis || {};
    this.addHeader('Manufacturing Executive Summary', 'Key Metrics, Issues & Opportunities');

    this.addSectionTitle('Key Performance Indicators');
    this.addKPIGrid([
      { label: 'OEE', value: `${Number(kpis.oee || 0).toFixed(1)}%`, color: 'primary' },
      { label: 'Yield', value: `${Number(kpis.yield || 0).toFixed(1)}%`, color: 'success' },
      { label: 'Unit Cost', value: `$${Number(kpis.cost || 0).toFixed(2)}`, color: 'warning' },
      { label: 'Downtime', value: `${Number(kpis.downtime || 0).toFixed(0)}`, unit: 'hrs', color: 'danger' },
    ]);

    const issues = this.data.top_issues || [];
    if (issues.length) {
      this.addSectionTitle('Top Issues (Priority)');
      issues.slice(0, 5).forEach((issue, i) => {
        this.addCallout(
          `${i + 1}. ${issue.title || 'Issue'}`,
          `Impact: ${issue.impact || 'N/A'}`,
          i === 0 ? 'danger' : 'primary'
        );
      });
    }

    const actions = this.data.recommended_actions || [];
    if (actions.length) {
      this.addSectionTitle('Recommended Actions (30-Day)');
      this.addBulletList(actions.slice(0, 5).map((a) => a.action || String(a)));
    }
  }

  /**
   * Custom report built from free-text query topics + live DB sections.
   * Expects data: { title, topics, kpis[], sections[{title,kpis,table,bullets}], ... }
   */
  async generateQueryDrivenReport() {
    const title = this.data.title || 'Manufacturing Report';
    const topics = (this.data.topics || []).join(', ') || 'custom';
    const queryHint = this.filters?.query ? String(this.filters.query) : '';
    const subtitle = queryHint
      ? (queryHint.length > 90 ? `${queryHint.slice(0, 87)}…` : queryHint)
      : `Topics: ${topics}`;

    this.addHeader(title, subtitle);

    if (Array.isArray(this.data.kpis) && this.data.kpis.length) {
      this.addSectionTitle('Overview');
      this.addKPIGrid(this.data.kpis.slice(0, 4));
    }

    const sections = this.data.sections || [];
    for (const section of sections) {
      this.addSectionTitle(section.title || 'Section');
      if (Array.isArray(section.kpis) && section.kpis.length) {
        this.addKPIGrid(section.kpis.slice(0, 4));
      }
      if (section.table && section.table.headers && section.table.rows?.length) {
        this.addTable(
          section.table.headers,
          section.table.rows.slice(0, 12),
          section.table.weights
        );
      }
      if (Array.isArray(section.bullets) && section.bullets.length) {
        this.addBulletList(section.bullets.slice(0, 6));
      }
    }

    if (this.data.is_executive) {
      const issues = this.data.top_issues || [];
      if (issues.length) {
        this.addSectionTitle('Top Issues (Priority)');
        issues.slice(0, 5).forEach((issue, i) => {
          this.addCallout(
            `${i + 1}. ${issue.title || 'Issue'}`,
            `Impact: ${issue.impact || 'N/A'}`,
            i === 0 ? 'danger' : 'primary'
          );
        });
      }
    }

    const actions = this.data.recommended_actions || [];
    if (actions.length) {
      this.addSectionTitle('Recommended Actions');
      this.addBulletList(actions.slice(0, 5).map((a) => a.action || String(a)));
    }

    if (!sections.length && !(Array.isArray(this.data.kpis) && this.data.kpis.length)) {
      this.addCallout(
        'No matching data',
        'Could not build sections for this query. Try naming a topic: OEE, downtime, quality, products, costs, production runs, or lines.',
        'warning'
      );
    }
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
