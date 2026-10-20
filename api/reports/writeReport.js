const fs = require('fs');
const path = require('path');
const ReportGenerator = require('./reportGenerator');
const PDFReportGenerator = require('./pdfReportGenerator');
const CSVReportGenerator = require('./csvReportGenerator');

const FORMATS = ['pptx', 'pdf', 'csv'];
const reportsDir = path.join(__dirname, 'generated');
fs.mkdirSync(reportsDir, { recursive: true });

/**
 * Render report data to reports/generated in the requested format.
 * Returns the filename; the file is served by /reports/download/:filename.
 */
async function writeReport({ prefix, format, reportType, data, filters = {}, slug }) {
  const base = [prefix, slug || reportType].filter(Boolean).join('-');
  // Millisecond time plus a random tail, so two requests never share a file.
  const filename = `${base}_${Date.now()}${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}.${format}`;
  const filepath = path.join(reportsDir, filename);

  if (format === 'pdf') {
    const generator = new PDFReportGenerator(reportType, data, filters);
    await generator.generateReport();
    await generator.save(fs.createWriteStream(filepath));
  } else if (format === 'csv') {
    const generator = new CSVReportGenerator(reportType, data, filters);
    await generator.generateReport();
    await generator.save(filepath);
  } else {
    const generator = new ReportGenerator(reportType, data, filters);
    const prs = await generator.generateReport();
    await prs.writeFile({ fileName: filepath });
  }
  return filename;
}

function downloadUrl(req, filename) {
  return `${req.protocol}://${req.get('host')}/reports/download/${filename}`;
}

module.exports = { FORMATS, reportsDir, writeReport, downloadUrl };
