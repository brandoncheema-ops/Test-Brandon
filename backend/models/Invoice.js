const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    unique: true,
    required: true
  },
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true
  },
  guestName: String,
  guestEmail: String,
  lineItems: [{
    description: String,
    amount: Number
  }],
  subtotal: Number,
  fees: [{
    description: String,
    amount: Number
  }],
  total: Number,
  status: {
    type: String,
    enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
    default: 'draft'
  },
  dueDate: Date,
  paidDate: Date,
  notes: String
}, {
  timestamps: true
});

// Auto-generate invoice number
invoiceSchema.pre('save', async function (next) {
  if (this.isNew) {
    const count = await mongoose.model('Invoice').countDocuments();
    const year = new Date().getFullYear();
    this.invoiceNumber = `NF6-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Invoice', invoiceSchema);
