const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Booking = require('../models/Booking');
const Property = require('../models/Property');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/bookings - List bookings with optional filters
router.get('/', protect, async (req, res, next) => {
  try {
    const filter = {};

    if (req.query.property) {
      filter.property = req.query.property;
    } else {
      // Only show bookings for user's properties
      const userProperties = await Property.find({ owner: req.user._id }).select('_id');
      filter.property = { $in: userProperties.map(p => p._id) };
    }

    if (req.query.status) filter.status = req.query.status;

    if (req.query.startDate || req.query.endDate) {
      filter.checkIn = {};
      if (req.query.startDate) filter.checkIn.$gte = new Date(req.query.startDate);
      if (req.query.endDate) filter.checkIn.$lte = new Date(req.query.endDate);
    }

    if (req.query.month && req.query.year) {
      const month = parseInt(req.query.month) - 1;
      const year = parseInt(req.query.year);
      const startOfMonth = new Date(year, month, 1);
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);
      filter.$or = [
        { checkIn: { $gte: startOfMonth, $lte: endOfMonth } },
        { checkOut: { $gte: startOfMonth, $lte: endOfMonth } },
        { checkIn: { $lte: startOfMonth }, checkOut: { $gte: endOfMonth } }
      ];
    }

    const bookings = await Booking.find(filter)
      .populate('property', 'name location')
      .sort('-checkIn');

    res.json(bookings);
  } catch (error) {
    next(error);
  }
});

// GET /api/bookings/summary - Financial summary
router.get('/summary', protect, async (req, res, next) => {
  try {
    const filter = {};
    const userProperties = await Property.find({ owner: req.user._id }).select('_id');
    filter.property = { $in: userProperties.map(p => p._id) };

    if (req.query.property) {
      filter.property = req.query.property;
    }

    const year = parseInt(req.query.year) || new Date().getFullYear();
    filter.checkIn = {
      $gte: new Date(year, 0, 1),
      $lte: new Date(year, 11, 31, 23, 59, 59)
    };

    const bookings = await Booking.find(filter);

    const summary = {
      totalGuests: bookings.length,
      totalNights: bookings.reduce((sum, b) => sum + (b.nights || 0), 0),
      grossRevenue: bookings.reduce((sum, b) => sum + (b.grossRevenue || 0), 0),
      platformFees: bookings.reduce((sum, b) => sum + (b.platformFees || 0), 0),
      cleaningFees: bookings.reduce((sum, b) => sum + (b.cleaningFee || 0), 0),
      netIncome: bookings.reduce((sum, b) => sum + (b.netIncome || 0), 0)
    };

    summary.totalFees = summary.platformFees + summary.cleaningFees;

    // Days in year so far
    const now = new Date();
    const startOfYear = new Date(year, 0, 1);
    const daysSoFar = year === now.getFullYear()
      ? Math.ceil((now - startOfYear) / (1000 * 60 * 60 * 24))
      : 365;
    summary.occupancyRate = daysSoFar > 0
      ? Math.round((summary.totalNights / daysSoFar) * 100)
      : 0;

    // Monthly breakdown
    const monthlyData = {};
    for (let i = 0; i < 12; i++) {
      monthlyData[i] = { revenue: 0, expenses: 0, net: 0, guests: 0, nights: 0 };
    }
    for (const booking of bookings) {
      const month = new Date(booking.checkIn).getMonth();
      monthlyData[month].revenue += booking.grossRevenue || 0;
      monthlyData[month].expenses += (booking.platformFees || 0) + (booking.cleaningFee || 0);
      monthlyData[month].net += booking.netIncome || 0;
      monthlyData[month].guests += 1;
      monthlyData[month].nights += booking.nights || 0;
    }
    summary.monthly = monthlyData;

    res.json(summary);
  } catch (error) {
    next(error);
  }
});

// GET /api/bookings/:id
router.get('/:id', protect, async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('property');
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    res.json(booking);
  } catch (error) {
    next(error);
  }
});

// POST /api/bookings
router.post('/', protect, authorize('owner', 'manager'), [
  body('property').notEmpty().withMessage('Property is required'),
  body('guestName').trim().notEmpty().withMessage('Guest name is required'),
  body('checkIn').isISO8601().withMessage('Valid check-in date is required'),
  body('checkOut').isISO8601().withMessage('Valid check-out date is required'),
  body('ratePerNight').isFloat({ min: 0 }).withMessage('Valid rate is required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const booking = await Booking.create(req.body);
    await booking.populate('property', 'name location');

    res.status(201).json(booking);
  } catch (error) {
    next(error);
  }
});

// PUT /api/bookings/:id
router.put('/:id', protect, authorize('owner', 'manager'), async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    Object.assign(booking, req.body);
    await booking.save();
    await booking.populate('property', 'name location');

    res.json(booking);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/bookings/:id
router.delete('/:id', protect, authorize('owner'), async (req, res, next) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }
    res.json({ message: 'Booking deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
