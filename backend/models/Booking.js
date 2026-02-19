const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true
  },
  guestName: {
    type: String,
    required: [true, 'Guest name is required'],
    trim: true
  },
  guestEmail: {
    type: String,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  guestPhone: String,
  checkIn: {
    type: Date,
    required: [true, 'Check-in date is required']
  },
  checkOut: {
    type: Date,
    required: [true, 'Check-out date is required']
  },
  nights: { type: Number, min: 1 },
  ratePerNight: {
    type: Number,
    required: [true, 'Rate per night is required'],
    min: 0
  },
  grossRevenue: { type: Number, default: 0 },
  platformFees: { type: Number, default: 0 },
  cleaningFee: { type: Number, default: 0 },
  netIncome: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['confirmed', 'pending', 'checked_in', 'checked_out', 'cancelled'],
    default: 'confirmed'
  },
  notes: String,
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'paid', 'refunded'],
    default: 'pending'
  },
  stripePaymentIntentId: String
}, {
  timestamps: true
});

// Calculate financials before saving
bookingSchema.pre('save', async function (next) {
  if (this.isModified('checkIn') || this.isModified('checkOut') || this.isModified('ratePerNight')) {
    const checkIn = new Date(this.checkIn);
    const checkOut = new Date(this.checkOut);
    this.nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

    if (this.nights < 1) {
      return next(new Error('Check-out must be after check-in'));
    }

    this.grossRevenue = this.nights * this.ratePerNight;

    // Fetch property for fee rates
    const Property = mongoose.model('Property');
    const property = await Property.findById(this.property);
    if (property) {
      this.platformFees = this.grossRevenue * (property.fees.platformFeePercentage / 100);
      this.cleaningFee = property.fees.cleaningFeePerGuest;
    }

    this.netIncome = this.grossRevenue - this.platformFees - this.cleaningFee;
  }
  next();
});

module.exports = mongoose.model('Booking', bookingSchema);
