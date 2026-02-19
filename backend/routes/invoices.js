const express = require('express');
const Invoice = require('../models/Invoice');
const Booking = require('../models/Booking');
const { protect, authorize } = require('../middleware/auth');
const { generateInvoicePDF } = require('../utils/pdfGenerator');
const { sendEmail } = require('../utils/email');

const router = express.Router();

// GET /api/invoices
router.get('/', protect, async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.property) filter.property = req.query.property;
    if (req.query.status) filter.status = req.query.status;

    const invoices = await Invoice.find(filter)
      .populate('booking')
      .populate('property', 'name')
      .sort('-createdAt');

    res.json(invoices);
  } catch (error) {
    next(error);
  }
});

// POST /api/invoices - Generate invoice from booking
router.post('/', protect, authorize('owner', 'manager'), async (req, res, next) => {
  try {
    const { bookingId } = req.body;
    const booking = await Booking.findById(bookingId).populate('property');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const invoice = await Invoice.create({
      booking: booking._id,
      property: booking.property._id,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      lineItems: [{
        description: `${booking.nights} nights @ $${booking.ratePerNight}/night`,
        amount: booking.grossRevenue
      }],
      subtotal: booking.grossRevenue,
      fees: [
        { description: 'Cleaning Fee', amount: booking.cleaningFee }
      ],
      total: booking.grossRevenue + booking.cleaningFee,
      dueDate: new Date(booking.checkIn),
      notes: `Booking: ${booking.guestName} | ${new Date(booking.checkIn).toLocaleDateString()} - ${new Date(booking.checkOut).toLocaleDateString()}`
    });

    await invoice.populate('booking property');
    res.status(201).json(invoice);
  } catch (error) {
    next(error);
  }
});

// GET /api/invoices/:id/pdf - Download PDF
router.get('/:id/pdf', protect, async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('booking')
      .populate('property');

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const pdfBuffer = await generateInvoicePDF(invoice);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

// POST /api/invoices/:id/send - Send invoice via email
router.post('/:id/send', protect, authorize('owner', 'manager'), async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('booking')
      .populate('property');

    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    if (!invoice.guestEmail) {
      return res.status(400).json({ message: 'Guest email is required to send invoice' });
    }

    const pdfBuffer = await generateInvoicePDF(invoice);

    await sendEmail({
      to: invoice.guestEmail,
      subject: `Invoice ${invoice.invoiceNumber} - ${invoice.property.name}`,
      html: `
        <h2>Invoice from NF6 Family Office</h2>
        <p>Dear ${invoice.guestName},</p>
        <p>Please find your invoice attached for your stay at ${invoice.property.name}.</p>
        <p><strong>Invoice #:</strong> ${invoice.invoiceNumber}</p>
        <p><strong>Total:</strong> $${invoice.total.toLocaleString()}</p>
        <p><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</p>
        <br>
        <p>Thank you for choosing NF6 Family Office.</p>
      `,
      attachments: [{
        filename: `invoice-${invoice.invoiceNumber}.pdf`,
        content: pdfBuffer
      }]
    });

    invoice.status = 'sent';
    await invoice.save();

    res.json({ message: 'Invoice sent successfully' });
  } catch (error) {
    next(error);
  }
});

// PUT /api/invoices/:id
router.put('/:id', protect, authorize('owner', 'manager'), async (req, res, next) => {
  try {
    const invoice = await Invoice.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    res.json(invoice);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
