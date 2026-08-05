const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

/**
 * Streams a tabular PDF report to `res`.
 * @param {import('express').Response} res
 * @param {string} title
 * @param {string[]} columns - display headers
 * @param {Array<Array<string|number>>} rows
 * @param {object} [meta] - optional summary lines under the title
 */
function streamPdfTable(res, { title, columns, rows, meta = [], filename }) {
  const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename || 'report.pdf'}"`);
  doc.pipe(res);

  doc.fontSize(18).font('Helvetica-Bold').text(title, { align: 'left' });
  doc.moveDown(0.2);
  doc.fontSize(9).font('Helvetica').fillColor('#555').text(`Generated: ${new Date().toLocaleString()}`);
  meta.forEach((line) => doc.text(line));
  doc.fillColor('#000');
  doc.moveDown(0.8);

  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidth = pageWidth / columns.length;
  const rowHeight = 20;
  let y = doc.y;

  const drawHeader = () => {
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#fff');
    doc.rect(doc.page.margins.left, y, pageWidth, rowHeight).fill('#2c5290');
    doc.fillColor('#fff');
    columns.forEach((col, i) => {
      doc.text(String(col), doc.page.margins.left + i * colWidth + 4, y + 5, { width: colWidth - 8, ellipsis: true });
    });
    doc.fillColor('#000');
    y += rowHeight;
  };

  drawHeader();
  doc.font('Helvetica').fontSize(8.5);

  rows.forEach((row, idx) => {
    if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.page.margins.top;
      drawHeader();
      doc.font('Helvetica').fontSize(8.5);
    }
    if (idx % 2 === 0) {
      doc.rect(doc.page.margins.left, y, pageWidth, rowHeight).fill('#f3f4f6').fillColor('#000');
    }
    row.forEach((cell, i) => {
      doc.text(cell === null || cell === undefined ? '' : String(cell), doc.page.margins.left + i * colWidth + 4, y + 5, {
        width: colWidth - 8,
        ellipsis: true,
      });
    });
    y += rowHeight;
  });

  doc.end();
}

/**
 * Streams a tabular Excel report to `res`.
 */
async function streamExcelTable(res, { title, columns, rows, filename }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Asset Tracking System';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(title.slice(0, 31) || 'Report');
  sheet.columns = columns.map((c) => ({ header: c, key: c, width: Math.max(14, c.length + 2) }));
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C5290' } };

  rows.forEach((row) => sheet.addRow(row));
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename || 'report.xlsx'}"`);
  await workbook.xlsx.write(res);
  res.end();
}

module.exports = { streamPdfTable, streamExcelTable };
