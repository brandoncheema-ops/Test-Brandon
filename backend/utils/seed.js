/**
 * Seed script to populate the database with NF6 sample data.
 * Run with: node utils/seed.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Property = require('../models/Property');
const Booking = require('../models/Booking');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Property.deleteMany({});
    await Booking.deleteMany({});
    console.log('Cleared existing data');

    // Create admin user
    const user = await User.create({
      name: 'Michael Nguyen',
      email: 'michael@nf6familyoffice.com',
      password: 'NF6Admin2026!',
      role: 'owner'
    });
    console.log('Created admin user: michael@nf6familyoffice.com / NF6Admin2026!');

    // Create Villa Lynn property
    const property = await Property.create({
      name: 'Villa Lynn',
      owner: user._id,
      location: {
        address: 'Dorado Beach',
        city: 'Dorado',
        state: 'PR',
        country: 'US',
        zipCode: '00646'
      },
      description: 'Luxury villa at Dorado Beach, Puerto Rico',
      propertyType: 'villa',
      bedrooms: 4,
      bathrooms: 3,
      maxGuests: 8,
      amenities: ['Pool', 'Beach Access', 'Wi-Fi', 'A/C', 'Full Kitchen', 'Ocean View'],
      fees: {
        platformFeePercentage: 20,
        cleaningFeePerGuest: 250,
        defaultNightlyRate: 500
      },
      currency: 'USD'
    });

    user.properties.push(property._id);
    await user.save();
    console.log('Created property: Villa Lynn');

    // Create bookings
    const bookingsData = [
      {
        property: property._id,
        guestName: 'David Frayer',
        guestEmail: 'david.frayer@example.com',
        checkIn: new Date('2026-01-02'),
        checkOut: new Date('2026-01-17'),
        ratePerNight: 450,
        status: 'checked_out',
        paymentStatus: 'paid'
      },
      {
        property: property._id,
        guestName: 'Emily Levine',
        guestEmail: 'emily.levine@example.com',
        checkIn: new Date('2026-01-25'),
        checkOut: new Date('2026-02-01'),
        ratePerNight: 1500,
        status: 'checked_out',
        paymentStatus: 'paid'
      },
      {
        property: property._id,
        guestName: 'Jon Warwick',
        guestEmail: 'jon.warwick@example.com',
        checkIn: new Date('2026-02-08'),
        checkOut: new Date('2026-03-10'),
        ratePerNight: 566.67,
        status: 'confirmed',
        paymentStatus: 'paid'
      },
      {
        property: property._id,
        guestName: 'Billy Shroyer',
        guestEmail: 'billy.shroyer@example.com',
        checkIn: new Date('2026-03-21'),
        checkOut: new Date('2026-03-27'),
        ratePerNight: 1700,
        status: 'confirmed',
        paymentStatus: 'pending'
      }
    ];

    for (const data of bookingsData) {
      const booking = await Booking.create(data);
      console.log(`Created booking: ${booking.guestName} (${booking.nights} nights, $${booking.grossRevenue} gross)`);
    }

    console.log('\nSeed completed successfully!');
    console.log('Login: michael@nf6familyoffice.com / NF6Admin2026!');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seed();
