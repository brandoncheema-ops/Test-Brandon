const PDFDocument = require('pdfkit');

const generateInvoicePDF = (invoice) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Header
    doc.fillColor('#1a5f4a')
      .fontSize(24)
      .text('NF6 FAMILY OFFICE', 50, 50)
      .fontSize(10)
      .fillColor('#666')
      .text('Property Management', 50, 80);

    // Invoice details
    doc.fillColor('#333')
      .fontSize(20)
      .text('INVOICE', 400, 50, { align: 'right' })
      .fontSize(10)
      .text(`Invoice #: ${invoice.invoiceNumber}`, 400, 80, { align: 'right' })
      .text(`Date: ${new Date(invoice.createdAt).toLocaleDateString()}`, 400, 95, { align: 'right' })
      .text(`Due: ${new Date(invoice.dueDate).toLocaleDateString()}`, 400, 110, { align: 'right' });

    // Divider
    doc.moveTo(50, 140).lineTo(550, 140).stroke('#1a5f4a');

    // Bill to
    doc.fontSize(12)
      .fillColor('#1a5f4a')
      .text('Bill To:', 50, 160)
      .fillColor('#333')
      .fontSize(10)
      .text(invoice.guestName, 50, 180)
      .text(invoice.guestEmail || '', 50, 195);

    // Property info
    doc.fontSize(12)
      .fillColor('#1a5f4a')
      .text('Property:', 300, 160)
      .fillColor('#333')
      .fontSize(10)
      .text(invoice.property?.name || 'N/A', 300, 180);

    // Line items table
    let y = 240;

    // Table header
    doc.fillColor('#1a5f4a')
      .rect(50, y, 500, 25)
      .fill();

    doc.fillColor('white')
      .fontSize(10)
      .text('Description', 60, y + 7)
      .text('Amount', 450, y + 7, { align: 'right' });

    y += 35;

    // Line items
    doc.fillColor('#333');
    for (const item of invoice.lineItems) {
      doc.text(item.description, 60, y)
        .text(`$${item.amount.toLocaleString()}`, 450, y, { align: 'right' });
      y += 25;
    }

    // Fees
    if (invoice.fees && invoice.fees.length > 0) {
      doc.moveTo(50, y).lineTo(550, y).stroke('#ddd');
      y += 10;

      for (const fee of invoice.fees) {
        doc.text(fee.description, 60, y)
          .text(`$${fee.amount.toLocaleString()}`, 450, y, { align: 'right' });
        y += 25;
      }
    }

    // Total
    doc.moveTo(300, y).lineTo(550, y).stroke('#1a5f4a');
    y += 15;

    doc.fontSize(14)
      .fillColor('#1a5f4a')
      .text('TOTAL', 300, y)
      .text(`$${invoice.total.toLocaleString()}`, 450, y, { align: 'right' });

    // Status
    y += 40;
    const statusColor = invoice.status === 'paid' ? '#2d7a5e' : '#d84040';
    doc.fontSize(12)
      .fillColor(statusColor)
      .text(`Status: ${invoice.status.toUpperCase()}`, 50, y);

    // Notes
    if (invoice.notes) {
      y += 30;
      doc.fontSize(9)
        .fillColor('#666')
        .text('Notes:', 50, y)
        .text(invoice.notes, 50, y + 15);
    }

    // Footer
    doc.fontSize(8)
      .fillColor('#999')
      .text('NF6 Family Office | Property Management', 50, 720, { align: 'center' })
      .text('Thank you for your business', 50, 735, { align: 'center' });

    doc.end();
  });
};

module.exports = { generateInvoicePDF };
