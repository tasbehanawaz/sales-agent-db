const PptxGenJS = require('pptxgenjs');
const styleConfig = require('./styleConfig');

class ReportGenerator {
  constructor(reportType, data, filters = {}) {
    this.reportType = reportType;
    this.data = data;
    this.filters = filters;
    this.prs = new PptxGenJS();
    this.setupPresentation();
  }

  setupPresentation() {
    this.prs.defineLayout({
      name: 'TITLE_SLIDE',
      master: 'BLANK',
    });
    this.prs.defineLayout({
      name: 'CONTENT_SLIDE',
      master: 'BLANK',
    });
  }

  addTitleSlide(title, subtitle) {
    const slide = this.prs.addSlide();
    slide.background = { color: 'FFFFFF' };

    // Top banner
    slide.addShape(this.prs.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: 1.2,
      fill: { color: styleConfig.colors.primary },
    });

    // Title
    slide.addText(title, {
      x: 0.5, y: 0.2, w: 8, h: 0.8,
      ...styleConfig.fonts.title,
      color: 'FFFFFF',
    });

    // Subtitle
    slide.addText(subtitle, {
      x: 0.5, y: 1.5, w: 8, h: 1,
      ...styleConfig.fonts.subtitle,
    });

    // Date footer
    const dateStr = new Date().toLocaleDateString();
    slide.addText(`Generated: ${dateStr}`, {
      x: 0.5, y: 5.1, w: 8, h: 0.3,
      ...styleConfig.fonts.small,
      color: styleConfig.colors.light,
    });
  }

  addContentSlide(title, content) {
    const slide = this.prs.addSlide();
    slide.background = { color: 'FFFFFF' };

    // Header
    slide.addShape(this.prs.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: 0.6,
      fill: { color: styleConfig.colors.primary },
    });

    // Title
    slide.addText(title, {
      x: 0.5, y: 0.1, w: 8, h: 0.4,
      ...styleConfig.fonts.heading,
      color: 'FFFFFF',
    });

    // Content callback
    if (typeof content === 'function') {
      content(slide, this.prs);
    }
  }

  addKPIBox(slide, x, y, label, value, unit = '', color = 'primary') {
    const bgColor = styleConfig.colors[color] || styleConfig.colors.primary;

    slide.addShape(this.prs.ShapeType.rect, {
      x, y, w: 1.8, h: 1.2,
      fill: { color: bgColor },
      line: { type: 'none' },
    });

    slide.addText(value, {
      x, y: y + 0.2, w: 1.8, h: 0.5,
      align: 'center',
      fontSize: String(value).length > 6 ? 20 : 28,
      bold: true,
      color: 'FFFFFF',
    });

    slide.addText(`${label} ${unit}`, {
      x, y: y + 0.7, w: 1.8, h: 0.4,
      align: 'center',
      fontSize: 10,
      color: 'FFFFFF',
    });
  }

  addTable(slide, x, y, w, h, data, weights) {
    const sum = weights ? weights.reduce((a, b) => a + b, 0) : 0;
    slide.addTable(data, {
      x, y, w, h,
      colW: weights && weights.length === data[0]?.length
        ? weights.map((wt) => (w * wt) / sum)
        : data[0]?.map(() => (w / data[0].length)),
      border: { pt: 1, color: 'CCCCCC' },
      fill: { color: styleConfig.colors.light },
      fontSize: 10,
      align: 'center',
      valign: 'middle',
    });
  }

  async generateReport() {
    return this.renderSections();
  }

  /** KPI boxes, four per row. Returns the y below the last row. */
  addKPIRows(slide, kpis, y) {
    kpis.forEach((kpi, i) => {
      this.addKPIBox(
        slide,
        0.5 + (i % 4) * 2.1,
        y + Math.floor(i / 4) * 1.4,
        kpi.label || '',
        String(kpi.value ?? ''),
        kpi.unit || '',
        kpi.color || 'primary'
      );
    });
    return y + (Math.ceil(kpis.length / 4) - 1) * 1.4 + 1.2;
  }

  /**
   * Sales, manufacturing and Apex reports all render as sections.
   * A table longer than one slide continues on "(cont.)" slides; notes go
   * under the table when they fit, else on their own slide, so no row or
   * bullet is dropped.
   */
  async renderSections() {
    const title = this.data.title || 'Report';
    const topics = (this.data.topics || []).join(', ') || 'custom';
    const queryHint = this.filters?.query ? String(this.filters.query) : '';
    const subtitle = queryHint
      ? (queryHint.length > 90 ? `${queryHint.slice(0, 87)}…` : queryHint)
      : (this.data.subtitle || `Topics: ${topics}`);

    this.addTitleSlide(title, subtitle);

    if (Array.isArray(this.data.kpis) && this.data.kpis.length) {
      this.addContentSlide('Overview', (slide) => {
        this.addKPIRows(slide, this.data.kpis.slice(0, 8), 0.9);
      });
    }

    const slideBottom = 5.45;
    const rowH = 0.28;
    const bulletH = 0.4;
    const width = 9;

    for (const section of this.data.sections || []) {
      const sectionTitle = section.title || 'Section';
      const kpis = Array.isArray(section.kpis) ? section.kpis : [];
      const table = section.table && section.table.headers && section.table.rows?.length ? section.table : null;
      const bullets = Array.isArray(section.bullets) ? section.bullets : [];

      const weights = table && table.weights && table.weights.length === table.headers.length
        ? table.weights
        : table ? table.headers.map(() => 1) : [];
      const weightSum = weights.reduce((a, b) => a + b, 0);
      const maxChars = weights.map((wt) => Math.max(6, Math.floor(((width * wt) / weightSum) * 13)));
      const clip = (cell, i) => {
        const str = String(cell ?? '');
        return str.length > maxChars[i] ? `${str.slice(0, maxChars[i] - 1)}…` : str;
      };

      let rows = table ? table.rows.map((row) => row.map(clip)) : [];
      let first = true;
      let notesPlaced = !bullets.length;
      do {
        this.addContentSlide(first ? sectionTitle : `${sectionTitle} (cont.)`, (slide) => {
          let y = 0.9;
          if (first && kpis.length) y = this.addKPIRows(slide, kpis, y) + 0.15;
          if (table) {
            const fit = Math.max(1, Math.floor((slideBottom - y) / rowH) - 1);
            const chunk = rows.slice(0, fit);
            rows = rows.slice(fit);
            const tableData = [table.headers.map(clip), ...chunk];
            this.addTable(slide, 0.5, y, width, rowH * tableData.length, tableData, weights);
            y += rowH * tableData.length + 0.15;
          }
          if (!rows.length && !notesPlaced && y + bullets.length * bulletH <= slideBottom) {
            this.addBullets(slide, bullets, y, bulletH);
            notesPlaced = true;
          }
        });
        first = false;
      } while (rows.length);

      if (!notesPlaced) {
        this.addContentSlide(`${sectionTitle}: Notes`, (slide) => {
          this.addBullets(slide, bullets.slice(0, 11), 0.9, bulletH);
        });
      }
    }

    if (this.data.is_executive && (this.data.top_issues || []).length) {
      this.addContentSlide('Top Issues (Priority)', (slide) => {
        (this.data.top_issues || []).slice(0, 5).forEach((issue, i) => {
          slide.addText(`${i + 1}. ${issue.title || 'Issue'}`, {
            x: 0.8, y: 1.0 + (i * 0.8), w: 8, h: 0.7,
            ...styleConfig.fonts.body,
            bold: true,
          });
          slide.addText(`   Impact: ${issue.impact || 'N/A'}`, {
            x: 1.0, y: 1.45 + (i * 0.8), w: 7.5, h: 0.3,
            ...styleConfig.fonts.small,
          });
        });
      });
    }

    const actions = this.data.recommended_actions || [];
    if (actions.length) {
      this.addContentSlide('Recommended Actions', (slide) => {
        actions.slice(0, 4).forEach((action, i) => {
          slide.addText(`✓ ${action.action || String(action)}`, {
            x: 0.8, y: 1.0 + (i * 1.0), w: 8, h: 0.9,
            ...styleConfig.fonts.body,
          });
        });
      });
    }

    return this.prs;
  }

  addBullets(slide, bullets, y, step) {
    bullets.forEach((b, i) => {
      slide.addText(`• ${b}`, {
        x: 0.8, y: y + i * step, w: 8.5, h: step,
        ...styleConfig.fonts.body,
      });
    });
  }

  async save(filename) {
    return await this.prs.writeFile({ fileName: filename });
  }
}

module.exports = ReportGenerator;
