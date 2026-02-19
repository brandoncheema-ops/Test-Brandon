const express = require('express');
const Booking = require('../models/Booking');
const Invoice = require('../models/Invoice');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Helper to get Stripe instance (lazy-loaded to avoid startup errors if key missing)
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY in your environment.');
  }
  return require('stripe')(process.env.STRIPE_SECRET_KEY);
}

// POST /api/payments/create-intent - Create Stripe payment intent
router.post('/create-intent', protect, async (req, res, next) => {
  try {
    const stripe = getStripe();
    const { bookingId, amount } = req.body;

    const booking = await Booking.findById(bookingId).populate('property');
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const paymentAmount = amount || booking.grossRevenue + booking.cleaningFee;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(paymentAmount * 100), // Stripe uses cents
      currency: 'usd',
      metadata: {
        bookingId: booking._id.toString(),
        guestName: booking.guestName,
        propertyName: booking.property.name
      }
    });

    booking.stripePaymentIntentId = paymentIntent.id;
    booking.paymentStatus = 'pending';
    await booking.save();

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    next(error);
  }
});

// POST /api/payments/webhook - Stripe webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const stripe = getStripe();
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ message: `Webhook Error: ${err.message}` });
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const booking = await Booking.findOne({ stripePaymentIntentId: paymentIntent.id });
    if (booking) {
      booking.paymentStatus = 'paid';
      await booking.save();

      // Update related invoice if exists
      const invoice = await Invoice.findOne({ booking: booking._id });
      if (invoice) {
        invoice.status = 'paid';
        invoice.paidDate = new Date();
        await invoice.save();
      }
    }
  }

  res.json({ received: true });
});

// GET /api/payments/history
router.get('/history', protect, async (req, res, next) => {
  try {
    const bookings = await Booking.find({
      paymentStatus: { $in: ['paid', 'partial', 'refunded'] },
      stripePaymentIntentId: { $exists: true }
    }).populate('property', 'name').sort('-updatedAt');

    res.json(bookings);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
