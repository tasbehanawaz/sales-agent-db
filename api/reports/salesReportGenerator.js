const PptxGenJS = require('pptxgenjs');
const styleConfig = require('./styleConfig');

class SalesReportGenerator {
  constructor(reportType, data = {}) {
    this.reportType = reportType;
    this.data = data;
    this.prs = new PptxGenJS();
    this.setupPresentation();
  }

  setupPresentation() {
    this.prs.defineLayout({ name: 'TITLE_SLIDE', master: 'BLANK' });
    this.prs.defineLayout({ name: 'CONTENT_SLIDE', master: 'BLANK' });
  }

  addTitleSlide(title, subtitle) {
    const slide = this.prs.addSlide();
    slide.background = { color: 'FFFFFF' };

    slide.addShape(this.prs.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: 1.2,
      fill: { color: styleConfig.colors.primary },
    });

    slide.addText(title, {
      x: 0.5, y: 0.2, w: 8, h: 0.8,
      ...styleConfig.fonts.title,
      color: 'FFFFFF',
    });

    slide.addText(subtitle, {
      x: 0.5, y: 1.5, w: 8, h: 1,
      ...styleConfig.fonts.subtitle,
    });

    const dateStr = new Date().toLocaleDateString();
    slide.addText(`Generated: ${dateStr}`, {
      x: 0.5, y: 6.8, w: 8, h: 0.3,
      ...styleConfig.fonts.small,
      color: styleConfig.colors.light,
    });
  }

  addContentSlide(title, content) {
    const slide = this.prs.addSlide();
    slide.background = { color: 'FFFFFF' };

    slide.addShape(this.prs.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: 0.6,
      fill: { color: styleConfig.colors.primary },
    });

    slide.addText(title, {
      x: 0.5, y: 0.1, w: 8, h: 0.4,
      ...styleConfig.fonts.heading,
      color: 'FFFFFF',
    });

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
      align: 'center', fontSize: 28, bold: true, color: 'FFFFFF',
    });

    slide.addText(`${label} ${unit}`, {
      x, y: y + 0.7, w: 1.8, h: 0.4,
      align: 'center', fontSize: 10, color: 'FFFFFF',
    });
  }

  addTable(slide, x, y, w, h, data) {
    slide.addTable(data, {
      x, y, w, h,
      colW: data[0]?.map(() => (w / data[0].length)),
      border: { pt: 1, color: 'CCCCCC' },
      fill: { color: styleConfig.colors.light },
      fontSize: 10,
      align: 'center',
      valign: 'middle',
    });
  }

  async generateReport() {
    switch (this.reportType) {
      case 'sales-overview':
        return await this.generateSalesOverview();
      case 'doctor-distribution':
        return await this.generateDoctorDistribution();
      case 'pharmacy-network':
        return await this.generatePharmacyNetwork();
      default:
        throw new Error(`Unknown report type: ${this.reportType}`);
    }
  }

  async generateSalesOverview() {
    this.addTitleSlide(
      'Sales Agent Network Report',
      'Overview of Sales Representatives & Territory Performance'
    );

    this.addContentSlide('Sales Network Summary', (slide) => {
      const stats = this.data.stats || {};

      this.addKPIBox(slide, 0.5, 0.9, 'Sales Reps', `${stats.rep_count || 0}`, '', 'primary');
      this.addKPIBox(slide, 2.6, 0.9, 'Doctors', `${stats.doctor_count || 0}`, '', 'success');
      this.addKPIBox(slide, 4.7, 0.9, 'Pharmacies', `${stats.pharmacy_count || 0}`, '', 'warning');
      this.addKPIBox(slide, 6.8, 0.9, 'Regions', `${stats.region_count || 0}`, '', 'neutral');
    });

    this.addContentSlide('Key Metrics', (slide) => {
      const metrics = [
        '✓ Territory coverage across multiple regions',
        '✓ Integrated healthcare provider network',
        '✓ Multi-channel pharmacy distribution',
        '✓ Scalable sales team structure',
      ];

      metrics.forEach((metric, i) => {
        slide.addText(metric, {
          x: 0.8, y: 1.0 + (i * 0.6), w: 8, h: 0.5,
          ...styleConfig.fonts.body,
        });
      });
    });

    return this.prs;
  }

  async generateDoctorDistribution() {
    this.addTitleSlide(
      'Doctor Network Analysis',
      'Healthcare Provider Distribution & Demographics'
    );

    this.addContentSlide('Doctor Network Overview', (slide) => {
      const data = this.data.doctor_data || {};

      this.addKPIBox(slide, 0.5, 0.9, 'Total Doctors', `${data.total || 0}`, '', 'primary');
      this.addKPIBox(slide, 2.6, 0.9, 'Active', `${data.active || 0}`, '', 'success');
      this.addKPIBox(slide, 4.7, 0.9, 'Regions Covered', `${data.regions || 0}`, '', 'warning');
      this.addKPIBox(slide, 6.8, 0.9, 'Avg Calls/Month', `${data.avg_calls || 0}`, '', 'neutral');
    });

    this.addContentSlide('Doctor Insights', (slide) => {
      const insights = [
        '• Strong presence across major metropolitan areas',
        '• Diverse specialties represented (cardiology, orthopedics, etc.)',
        '• Multiple call planning strategies by region',
        '• Data-driven territory management',
      ];

      insights.forEach((insight, i) => {
        slide.addText(insight, {
          x: 0.8, y: 1.0 + (i * 0.6), w: 8, h: 0.5,
          ...styleConfig.fonts.body,
        });
      });
    });

    return this.prs;
  }

  async generatePharmacyNetwork() {
    this.addTitleSlide(
      'Pharmacy Network Report',
      'Distribution Channel Analysis & Reach'
    );

    this.addContentSlide('Pharmacy Network Overview', (slide) => {
      const data = this.data.pharmacy_data || {};

      this.addKPIBox(slide, 0.5, 0.9, 'Total Pharmacies', `${data.total || 0}`, '', 'primary');
      this.addKPIBox(slide, 2.6, 0.9, 'Chain Stores', `${data.chains || 0}`, '', 'success');
      this.addKPIBox(slide, 4.7, 0.9, 'Independent', `${data.independent || 0}`, '', 'warning');
      this.addKPIBox(slide, 6.8, 0.9, 'Avg Products', `${data.avg_products || 0}`, '', 'neutral');
    });

    this.addContentSlide('Distribution Strategy', (slide) => {
      const strategies = [
        '✓ Multi-channel distribution network',
        '✓ Chain & independent pharmacy mix',
        '✓ Optimized inventory management',
        '✓ Consistent product availability',
      ];

      strategies.forEach((strategy, i) => {
        slide.addText(strategy, {
          x: 0.8, y: 1.0 + (i * 0.6), w: 8, h: 0.5,
          ...styleConfig.fonts.body,
        });
      });
    });

    return this.prs;
  }

  async save(filename) {
    return await this.prs.writeFile({ fileName: filename });
  }
}

module.exports = SalesReportGenerator;
