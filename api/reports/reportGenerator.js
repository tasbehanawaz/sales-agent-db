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
      x: 0.5, y: 6.8, w: 8, h: 0.3,
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
      fontSize: 28,
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
    try {
      switch (this.reportType) {
        case 'oee-dashboard':
          return await this.generateOEEReport();
        case 'downtime-analysis':
          return await this.generateDowntimeReport();
        case 'quality-trends':
          return await this.generateQualityReport();
        case 'cost-analysis':
          return await this.generateCostReport();
        case 'executive-summary':
          return await this.generateExecutiveReport();
        case 'query-driven':
          return await this.generateQueryDrivenReport();
        default:
          throw new Error(`Unknown report type: ${this.reportType}`);
      }
    } catch (error) {
      console.error(`Error generating ${this.reportType} report:`, error);
      throw error;
    }
  }

  async generateOEEReport() {
    this.addTitleSlide(
      'OEE Dashboard Report',
      'Operational Equipment Effectiveness Analysis'
    );

    this.addContentSlide('OEE Summary', (slide) => {
      const oeeData = this.data.oee_summary || {};

      this.addKPIBox(slide, 0.5, 0.9, 'Overall OEE', `${(oeeData.overall || 0).toFixed(1)}%`, '%', 'primary');
      this.addKPIBox(slide, 2.6, 0.9, 'Availability', `${(oeeData.availability || 0).toFixed(1)}%`, '%', 'success');
      this.addKPIBox(slide, 4.7, 0.9, 'Performance', `${(oeeData.performance || 0).toFixed(1)}%`, '%', 'warning');
      this.addKPIBox(slide, 6.8, 0.9, 'Quality', `${(oeeData.quality || 0).toFixed(1)}%`, '%', 'danger');

      if (this.data.oee_by_line) {
        const tableData = [
          ['Line', 'OEE %', 'Status'],
          ...this.data.oee_by_line.slice(0, 8).map(line => [
            line.line_name,
            `${(line.oee_pct || 0).toFixed(1)}%`,
            line.oee_pct >= 80 ? '✓ Good' : '⚠ Needs Attention'
          ])
        ];

        this.addTable(slide, 0.5, 2.3, 8, 3.5, tableData);
      }
    });

    this.addContentSlide('Key Insights', (slide) => {
      const insights = [
        '• Top performing line: ' + (this.data.top_line || 'N/A'),
        '• Lines below 80% OEE: ' + (this.data.poor_performers || 0),
        '• Most impactful factor: ' + (this.data.limiting_factor || 'Availability'),
        '• Recommended action: Focus on ' + (this.data.recommendation || 'preventive maintenance'),
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

  async generateDowntimeReport() {
    this.addTitleSlide(
      'Downtime Analysis Report',
      'Root Cause Investigation & Pareto Analysis'
    );

    this.addContentSlide('Downtime Overview', (slide) => {
      const downtimeData = this.data.summary || {};

      this.addKPIBox(slide, 0.5, 0.9, 'Total Downtime', `${(downtimeData.total_hours || 0).toFixed(1)}`, 'hrs', 'danger');
      this.addKPIBox(slide, 2.6, 0.9, 'Incidents', `${downtimeData.incident_count || 0}`, '', 'warning');
      this.addKPIBox(slide, 4.7, 0.9, 'Avg Duration', `${(downtimeData.avg_duration || 0).toFixed(1)}`, 'min', 'neutral');
      this.addKPIBox(slide, 6.8, 0.9, 'Lost Output', `${(downtimeData.impact_units || 0).toLocaleString()}`, 'units', 'danger');

      if (this.data.top_reasons) {
        const tableData = [
          ['Reason', 'Count', 'Total Hours', '% of Total'],
          ...this.data.top_reasons.slice(0, 8).map(reason => [
            reason.reason_code,
            reason.count,
            `${(reason.total_hours || 0).toFixed(1)}`,
            `${((reason.pct || 0) * 100).toFixed(1)}%`
          ])
        ];

        this.addTable(slide, 0.5, 2.3, 8, 3.5, tableData);
      }
    });

    this.addContentSlide('Recommendations', (slide) => {
      const recommendations = [
        '• Focus on top 3 downtime drivers (80/20 rule)',
        '• Implement preventive maintenance for recurring failures',
        '• Prioritize equipment with highest impact',
        '• Monitor and track improvement metrics weekly',
      ];

      recommendations.forEach((rec, i) => {
        slide.addText(rec, {
          x: 0.8, y: 1.0 + (i * 0.6), w: 8, h: 0.5,
          ...styleConfig.fonts.body,
        });
      });
    });

    return this.prs;
  }

  async generateQualityReport() {
    this.addTitleSlide(
      'Quality Trends Report',
      'Yield & Rejection Rate Analysis'
    );

    this.addContentSlide('Quality Metrics', (slide) => {
      const qualityData = this.data.summary || {};

      this.addKPIBox(slide, 0.5, 0.9, 'Average Yield', `${(qualityData.avg_yield || 0).toFixed(1)}%`, '%', 'success');
      this.addKPIBox(slide, 2.6, 0.9, 'Rejection Rate', `${(qualityData.avg_rejection || 0).toFixed(1)}%`, '%', 'danger');
      this.addKPIBox(slide, 4.7, 0.9, 'Good Units', `${(qualityData.total_good || 0).toLocaleString()}`, '', 'success');
      this.addKPIBox(slide, 6.8, 0.9, 'Rejected Units', `${(qualityData.total_rejected || 0).toLocaleString()}`, '', 'danger');
    });

    this.addContentSlide('Quality by Product', (slide) => {
      if (this.data.by_product) {
        const tableData = [
          ['Product', 'Yield %', 'Rejection %', 'Status'],
          ...this.data.by_product.slice(0, 8).map(prod => [
            prod.product_name,
            `${(prod.yield_pct || 0).toFixed(1)}%`,
            `${(prod.rejection_pct || 0).toFixed(1)}%`,
            prod.yield_pct >= 95 ? '✓ Good' : '⚠ Review'
          ])
        ];

        this.addTable(slide, 0.5, 0.9, 8, 4.9, tableData);
      }
    });

    return this.prs;
  }

  async generateCostReport() {
    this.addTitleSlide(
      'Cost Analysis Report',
      'Unit Cost & Energy Efficiency Analysis'
    );

    this.addContentSlide('Cost Summary', (slide) => {
      const costData = this.data.summary || {};

      this.addKPIBox(slide, 0.5, 0.9, 'Avg Unit Cost', `$${(costData.avg_cost || 0).toFixed(2)}`, '', 'primary');
      this.addKPIBox(slide, 2.6, 0.9, 'Energy Cost', `$${(costData.energy_cost || 0).toFixed(0)}`, '', 'warning');
      this.addKPIBox(slide, 4.7, 0.9, 'Scrap Cost', `$${(costData.scrap_cost || 0).toFixed(0)}`, '', 'danger');
      this.addKPIBox(slide, 6.8, 0.9, 'Total Cost', `$${(costData.total_cost || 0).toFixed(0)}`, '', 'neutral');
    });

    this.addContentSlide('Cost by Line', (slide) => {
      if (this.data.by_line) {
        const tableData = [
          ['Line', 'Unit Cost', 'Energy/Unit', 'Total Cost'],
          ...this.data.by_line.slice(0, 8).map(line => [
            line.line_name,
            `$${(line.unit_cost || 0).toFixed(2)}`,
            `${(line.energy_per_unit || 0).toFixed(2)} kWh`,
            `$${(line.total_cost || 0).toFixed(0)}`
          ])
        ];

        this.addTable(slide, 0.5, 0.9, 8, 4.9, tableData);
      }
    });

    return this.prs;
  }

  async generateExecutiveReport() {
    this.addTitleSlide(
      'Manufacturing Executive Summary',
      'Key Metrics, Issues & Opportunities'
    );

    this.addContentSlide('Key Performance Indicators', (slide) => {
      const kpis = this.data.kpis || {};

      this.addKPIBox(slide, 0.5, 0.9, 'OEE', `${(kpis.oee || 0).toFixed(1)}%`, '%', 'primary');
      this.addKPIBox(slide, 2.6, 0.9, 'Yield', `${(kpis.yield || 0).toFixed(1)}%`, '%', 'success');
      this.addKPIBox(slide, 4.7, 0.9, 'Unit Cost', `$${(kpis.cost || 0).toFixed(2)}`, '', 'warning');
      this.addKPIBox(slide, 6.8, 0.9, 'Downtime', `${(kpis.downtime || 0).toFixed(0)}`, 'hrs', 'danger');
    });

    this.addContentSlide('Top Issues (Priority)', (slide) => {
      const issues = this.data.top_issues || [];
      issues.slice(0, 5).forEach((issue, i) => {
        slide.addText(`${i + 1}. ${issue.title}`, {
          x: 0.8, y: 1.0 + (i * 0.8), w: 8, h: 0.7,
          ...styleConfig.fonts.body,
          bold: true,
        });
        slide.addText(`   Impact: ${issue.impact}`, {
          x: 1.0, y: 1.45 + (i * 0.8), w: 7.5, h: 0.3,
          ...styleConfig.fonts.small,
        });
      });
    });

    this.addContentSlide('Recommended Actions (30-Day)', (slide) => {
      const actions = this.data.recommended_actions || [];
      actions.slice(0, 4).forEach((action, i) => {
        slide.addText(`✓ ${action.action}`, {
          x: 0.8, y: 1.0 + (i * 1.0), w: 8, h: 0.9,
          ...styleConfig.fonts.body,
        });
      });
    });

    return this.prs;
  }

  async generateQueryDrivenReport() {
    const title = this.data.title || 'Manufacturing Report';
    const topics = (this.data.topics || []).join(', ') || 'custom';
    const queryHint = this.filters?.query ? String(this.filters.query) : '';
    const subtitle = queryHint
      ? (queryHint.length > 90 ? `${queryHint.slice(0, 87)}…` : queryHint)
      : `Topics: ${topics}`;

    this.addTitleSlide(title, subtitle);

    if (Array.isArray(this.data.kpis) && this.data.kpis.length) {
      this.addContentSlide('Overview', (slide) => {
        this.data.kpis.slice(0, 4).forEach((kpi, i) => {
          this.addKPIBox(
            slide,
            0.5 + i * 2.1,
            0.9,
            kpi.label || '',
            String(kpi.value ?? ''),
            kpi.unit || '',
            kpi.color || 'primary'
          );
        });
      });
    }

    for (const section of this.data.sections || []) {
      this.addContentSlide(section.title || 'Section', (slide) => {
        let y = 0.9;
        if (Array.isArray(section.kpis) && section.kpis.length) {
          section.kpis.slice(0, 4).forEach((kpi, i) => {
            this.addKPIBox(
              slide,
              0.5 + i * 2.1,
              y,
              kpi.label || '',
              String(kpi.value ?? ''),
              kpi.unit || '',
              kpi.color || 'primary'
            );
          });
          y = 2.3;
        }
        if (section.table && section.table.headers && section.table.rows?.length) {
          const tableData = [
            section.table.headers,
            ...section.table.rows.slice(0, 8).map((row) => row.map((c) => String(c ?? ''))),
          ];
          this.addTable(slide, 0.5, y, 8, Math.min(4.5, 0.4 + tableData.length * 0.4), tableData);
        } else if (Array.isArray(section.bullets) && section.bullets.length) {
          section.bullets.slice(0, 6).forEach((b, i) => {
            slide.addText(`• ${b}`, {
              x: 0.8, y: y + i * 0.55, w: 8, h: 0.5,
              ...styleConfig.fonts.body,
            });
          });
        }
      });
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

  async save(filename) {
    return await this.prs.writeFile({ fileName: filename });
  }
}

module.exports = ReportGenerator;
