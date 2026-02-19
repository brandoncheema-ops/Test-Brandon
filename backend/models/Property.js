const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Property name is required'],
    trim: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  location: {
    address: String,
    city: String,
    state: String,
    country: { type: String, default: 'US' },
    zipCode: String
  },
  description: String,
  propertyType: {
    type: String,
    enum: ['villa', 'apartment', 'house', 'condo', 'townhouse', 'other'],
    default: 'villa'
  },
  bedrooms: { type: Number, default: 1 },
  bathrooms: { type: Number, default: 1 },
  maxGuests: { type: Number, default: 4 },
  amenities: [String],
  images: [String],
  fees: {
    platformFeePercentage: { type: Number, default: 20 },
    cleaningFeePerGuest: { type: Number, default: 250 },
    defaultNightlyRate: { type: Number, default: 500 }
  },
  currency: { type: String, default: 'USD' },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

propertySchema.virtual('bookings', {
  ref: 'Booking',
  localField: '_id',
  foreignField: 'property'
});

module.exports = mongoose.model('Property', propertySchema);
