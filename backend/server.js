require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const store = require('./store');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? false : undefined
}));
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [process.env.FRONTEND_URL, 'https://nf6-property-management.onrender.com'].filter(Boolean)
    : 'http://localhost:3000',
  credentials: true
}));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', limiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- AUTH MIDDLEWARE ---
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer')) {
      return res.status(401).json({ message: 'Not authorized - no token' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = store.verifyToken(token);
    req.user = store.findUserById(decoded.id);
    if (!req.user) return res.status(401).json({ message: 'User not found' });
    next();
  } catch {
    return res.status(401).json({ message: 'Not authorized - invalid token' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'Not authorized' });
  next();
};

// ============================================================
// AUTH ROUTES
// ============================================================
app.post('/api/auth/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'All fields are required' });
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });
    if (store.findUserByEmail(email)) return res.status(400).json({ message: 'Email already registered' });

    const user = await store.createUser({ name, email, password, role: 'owner' });
    const token = store.generateToken(user);
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) { next(err); }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = store.findUserByEmail(email);
    if (!user || !(await store.comparePassword(password, user.password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    const token = store.generateToken(user);
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) { next(err); }
});

app.get('/api/auth/me', protect, (req, res) => {
  const user = req.user;
  res.json({ user: { _id: user._id, name: user.name, email: user.email, role: user.role, properties: user.properties } });
});

// ============================================================
// PROPERTY ROUTES
// ============================================================
app.get('/api/properties', protect, (req, res) => {
  const props = store.getPropertiesByOwner(req.user._id);
  res.json(props);
});

app.get('/api/properties/:id', protect, (req, res) => {
  const prop = store.getPropertyById(req.params.id);
  if (!prop) return res.status(404).json({ message: 'Property not found' });
  res.json(prop);
});

app.post('/api/properties', protect, authorize('owner', 'manager'), (req, res) => {
  if (!req.body.name) return res.status(400).json({ message: 'Property name is required' });
  const prop = store.createProperty({ ...req.body, owner: req.user._id });
  req.user.properties.push(prop._id);
  res.status(201).json(prop);
});

app.put('/api/properties/:id', protect, authorize('owner', 'manager'), (req, res) => {
  const prop = store.updateProperty(req.params.id, req.body);
  if (!prop) return res.status(404).json({ message: 'Property not found' });
  res.json(prop);
});

app.delete('/api/properties/:id', protect, authorize('owner'), (req, res) => {
  const prop = store.deleteProperty(req.params.id);
  if (!prop) return res.status(404).json({ message: 'Property not found' });
  res.json({ message: 'Property deleted' });
});

// ============================================================
// BOOKING ROUTES
// ============================================================
app.get('/api/bookings/summary', protect, (req, res) => {
  const userProps = store.getPropertiesByOwner(req.user._id);
  const propIds = userProps.map(p => p._id);

  const filter = { propertyIds: propIds };
  if (req.query.property) filter.property = req.query.property;
  if (req.query.year) filter.year = req.query.year;

  const allBookings = store.getBookings(filter);

  const summary = {
    totalGuests: allBookings.length,
    totalNights: allBookings.reduce((s, b) => s + (b.nights || 0), 0),
    grossRevenue: allBookings.reduce((s, b) => s + (b.grossRevenue || 0), 0),
    platformFees: allBookings.reduce((s, b) => s + (b.platformFees || 0), 0),
    cleaningFees: allBookings.reduce((s, b) => s + (b.cleaningFee || 0), 0),
    netIncome: allBookings.reduce((s, b) => s + (b.netIncome || 0), 0)
  };
  summary.totalFees = summary.platformFees + summary.cleaningFees;

  const year = parseInt(req.query.year) || new Date().getFullYear();
  const now = new Date();
  const startOfYear = new Date(year, 0, 1);
  const daysSoFar = year === now.getFullYear()
    ? Math.ceil((now - startOfYear) / (1000 * 60 * 60 * 24))
    : 365;
  summary.occupancyRate = daysSoFar > 0 ? Math.round((summary.totalNights / daysSoFar) * 100) : 0;

  const monthly = {};
  for (let i = 0; i < 12; i++) {
    monthly[i] = { revenue: 0, expenses: 0, net: 0, guests: 0, nights: 0 };
  }
  for (const b of allBookings) {
    const m = new Date(b.checkIn).getMonth();
    monthly[m].revenue += b.grossRevenue || 0;
    monthly[m].expenses += (b.platformFees || 0) + (b.cleaningFee || 0);
    monthly[m].net += b.netIncome || 0;
    monthly[m].guests += 1;
    monthly[m].nights += b.nights || 0;
  }
  summary.monthly = monthly;

  res.json(summary);
});

app.get('/api/bookings', protect, (req, res) => {
  const userProps = store.getPropertiesByOwner(req.user._id);
  const propIds = userProps.map(p => p._id);

  const filter = {};
  if (req.query.property) {
    filter.property = req.query.property;
  } else {
    filter.propertyIds = propIds;
  }
  if (req.query.status) filter.status = req.query.status;
  if (req.query.month) filter.month = req.query.month;
  if (req.query.year) filter.year = req.query.year;

  const results = store.getBookings(filter).map(store.populateBooking);
  res.json(results);
});

app.get('/api/bookings/:id', protect, (req, res) => {
  const booking = store.getBookingById(req.params.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  res.json(store.populateBooking(booking));
});

app.post('/api/bookings', protect, authorize('owner', 'manager'), (req, res) => {
  const { property, guestName, checkIn, checkOut, ratePerNight } = req.body;
  if (!property || !guestName || !checkIn || !checkOut || !ratePerNight) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  const booking = store.createBooking(req.body);
  res.status(201).json(store.populateBooking(booking));
});

app.put('/api/bookings/:id', protect, authorize('owner', 'manager'), (req, res) => {
  const booking = store.updateBooking(req.params.id, req.body);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  res.json(store.populateBooking(booking));
});

app.delete('/api/bookings/:id', protect, authorize('owner'), (req, res) => {
  const booking = store.deleteBooking(req.params.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  res.json({ message: 'Booking deleted' });
});

// ============================================================
// INVOICE ROUTES
// ============================================================
app.get('/api/invoices', protect, (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.property) filter.property = req.query.property;
  const results = store.getInvoices(filter).map(store.populateInvoice);
  res.json(results);
});

app.post('/api/invoices', protect, authorize('owner', 'manager'), (req, res) => {
  const { bookingId } = req.body;
  const booking = store.getBookingById(bookingId);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });

  const invoice = store.createInvoice({
    booking: booking._id,
    property: booking.property,
    guestName: booking.guestName,
    guestEmail: booking.guestEmail,
    lineItems: [{ description: `${booking.nights} nights @ $${booking.ratePerNight}/night`, amount: booking.grossRevenue }],
    subtotal: booking.grossRevenue,
    fees: [{ description: 'Cleaning Fee', amount: booking.cleaningFee }],
    total: booking.grossRevenue + booking.cleaningFee,
    dueDate: booking.checkIn,
    notes: `Booking: ${booking.guestName}`
  });

  res.status(201).json(store.populateInvoice(invoice));
});

app.put('/api/invoices/:id', protect, authorize('owner', 'manager'), (req, res) => {
  const invoice = store.updateInvoice(req.params.id, req.body);
  if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
  res.json(store.populateInvoice(invoice));
});

// ============================================================
// WEEKEND SCHEDULE ROUTES
// ============================================================

const FORM_URL = process.env.WEEKEND_FORM_URL || '/weekend-coverage.html';

// GET all weekend schedule entries (with optional date range filter)
app.get('/api/weekend-schedule', protect, (req, res) => {
  const filter = {};
  if (req.query.startDate) filter.startDate = req.query.startDate;
  if (req.query.endDate) filter.endDate = req.query.endDate;
  res.json(store.getWeekendSchedules(filter));
});

// GET last weekend's summary with dates (Power Automate calls this)
app.get('/api/weekend-schedule/last-weekend', protect, (req, res) => {
  const summary = store.getLastWeekendSummary();
  res.json({ ...summary, formUrl: FORM_URL });
});

// GET formatted email body for last weekend (Power Automate HTTP connector)
// Includes dates and a link for Volsky to submit doctor names
app.get('/api/weekend-schedule/email-body', (req, res) => {
  const apiKey = req.query.apiKey || req.headers['x-api-key'];
  if (!apiKey || apiKey !== (process.env.SCHEDULE_API_KEY || 'nf6-schedule-key')) {
    return res.status(401).json({ message: 'Invalid API key' });
  }

  const summary = store.getLastWeekendSummary();
  const format = req.query.format || 'html';
  const baseUrl = process.env.FRONTEND_URL || req.protocol + '://' + req.get('host');
  const formLink = baseUrl + FORM_URL;

  if (format === 'text') {
    const filled = summary.entries.filter(e => e.doctorName);
    const pending = summary.entries.filter(e => !e.doctorName);
    let body = `Weekend Coverage Report\nWeekend of ${summary.saturday} to ${summary.sunday}\n\n`;
    if (filled.length > 0) {
      body += filled.map(e => {
        const d = new Date(e.date);
        return `${d.getMonth() + 1}/${d.getDate()} - ${e.doctorName}`;
      }).join('\n') + '\n\n';
    }
    if (pending.length > 0) {
      body += `${pending.length} date(s) still need doctor names.\n`;
    }
    body += `\nSubmit coverage here: ${formLink}`;
    return res.type('text/plain').send(body);
  }

  // HTML format for Outlook email body
  const satDate = new Date(summary.saturday);
  const sunDate = new Date(summary.sunday);
  const satStr = `${satDate.getMonth() + 1}/${satDate.getDate()}`;
  const sunStr = `${sunDate.getMonth() + 1}/${sunDate.getDate()}`;

  const html = `
    <div style="font-family: 'Segoe UI', Calibri, Arial, sans-serif;">
      <h3 style="color: #1a5f4a;">Weekend Coverage Report</h3>
      <p><strong>Weekend of ${satStr} - ${sunStr}</strong></p>
      <table style="border-collapse: collapse; width: 100%;">
        <tr style="background: #1a5f4a; color: white;">
          <th style="padding: 8px 12px; text-align: left;">Date</th>
          <th style="padding: 8px 12px; text-align: left;">Doctor</th>
        </tr>
        ${summary.entries.map((e, i) => {
          const d = new Date(e.date);
          const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
          const name = e.doctorName || '<em style="color:#999;">— pending —</em>';
          return `<tr style="background: ${i % 2 === 0 ? '#f9f9f9' : '#ffffff'};">
            <td style="padding: 8px 12px; border-bottom: 1px solid #ddd;">${dateStr}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #ddd;">${name}</td>
          </tr>`;
        }).join('')}
      </table>
      <p style="margin-top: 20px;">
        <a href="${formLink}" style="display: inline-block; background: #1a5f4a; color: white; padding: 10px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
          Submit Weekend Coverage
        </a>
      </p>
      <p style="font-size: 12px; color: #888;">Click the button above to fill in who worked each day.</p>
    </div>
  `;

  res.type('text/html').send(html);
});

// POST a new weekend schedule entry (date only, doctorName optional — Volsky fills in later)
app.post('/api/weekend-schedule', protect, authorize('owner', 'manager'), (req, res) => {
  const { date } = req.body;
  if (!date) {
    return res.status(400).json({ message: 'date is required' });
  }
  const entry = store.createWeekendSchedule(req.body);
  res.status(201).json(entry);
});

// POST bulk schedule entries (dates only for the upcoming weekend)
app.post('/api/weekend-schedule/bulk', protect, authorize('owner', 'manager'), (req, res) => {
  const { entries } = req.body;
  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ message: 'entries array is required' });
  }
  const created = entries.map(e => store.createWeekendSchedule(e));
  res.status(201).json(created);
});

// PUT update a schedule entry (Volsky uses this to fill in doctor name)
app.put('/api/weekend-schedule/:id', protect, (req, res) => {
  const entry = store.updateWeekendSchedule(req.params.id, req.body);
  if (!entry) return res.status(404).json({ message: 'Schedule entry not found' });
  res.json(entry);
});

// PUT submit coverage via API key (for the HTML form — no JWT needed)
app.put('/api/weekend-schedule/submit', (req, res) => {
  const apiKey = req.query.apiKey || req.headers['x-api-key'];
  if (!apiKey || apiKey !== (process.env.SCHEDULE_API_KEY || 'nf6-schedule-key')) {
    return res.status(401).json({ message: 'Invalid API key' });
  }
  const { entries } = req.body;
  if (!Array.isArray(entries)) {
    return res.status(400).json({ message: 'entries array is required' });
  }
  const updated = entries.map(e => store.updateWeekendSchedule(e.id, { doctorName: e.doctorName })).filter(Boolean);
  res.json(updated);
});

// DELETE a weekend schedule entry
app.delete('/api/weekend-schedule/:id', protect, authorize('owner'), (req, res) => {
  const entry = store.deleteWeekendSchedule(req.params.id);
  if (!entry) return res.status(404).json({ message: 'Schedule entry not found' });
  res.json({ message: 'Schedule entry deleted' });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mode: 'in-memory', timestamp: new Date().toISOString() });
});

// Serve React frontend in production
if (process.env.NODE_ENV === 'production') {
  const frontendBuild = path.join(__dirname, '..', 'frontend', 'build');
  app.use(express.static(frontendBuild));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendBuild, 'index.html'));
  });
}

// Error handler
app.use(errorHandler);

// ============================================================
// SEED DATA ON STARTUP
// ============================================================
(async () => {
  const user = await store.createUser({
    name: 'Michael Nguyen',
    email: 'michael@nf6familyoffice.com',
    password: 'NF6Admin2026!',
    role: 'owner'
  });

  const property = store.createProperty({
    name: 'Villa Lynn',
    owner: user._id,
    location: { address: 'Dorado Beach', city: 'Dorado', state: 'PR', country: 'US', zipCode: '00646' },
    description: 'Luxury villa at Dorado Beach, Puerto Rico',
    propertyType: 'villa',
    bedrooms: 4,
    bathrooms: 3,
    maxGuests: 8,
    amenities: ['Pool', 'Beach Access', 'Wi-Fi', 'A/C', 'Full Kitchen', 'Ocean View'],
    fees: { platformFeePercentage: 20, cleaningFeePerGuest: 250, defaultNightlyRate: 500 }
  });
  user.properties.push(property._id);

  const bookingsData = [
    { property: property._id, guestName: 'David Frayer', guestEmail: 'david.frayer@example.com', checkIn: '2026-01-02', checkOut: '2026-01-17', ratePerNight: 450, status: 'checked_out', paymentStatus: 'paid' },
    { property: property._id, guestName: 'Emily Levine', guestEmail: 'emily.levine@example.com', checkIn: '2026-01-25', checkOut: '2026-02-01', ratePerNight: 1500, status: 'checked_out', paymentStatus: 'paid' },
    { property: property._id, guestName: 'Jon Warwick', guestEmail: 'jon.warwick@example.com', checkIn: '2026-02-08', checkOut: '2026-03-10', ratePerNight: 566.67, status: 'confirmed', paymentStatus: 'paid' },
    { property: property._id, guestName: 'Billy Shroyer', guestEmail: 'billy.shroyer@example.com', checkIn: '2026-03-21', checkOut: '2026-03-27', ratePerNight: 1700, status: 'confirmed', paymentStatus: 'pending' }
  ];
  for (const b of bookingsData) {
    store.createBooking(b);
  }

  console.log('Seed data loaded: Villa Lynn + 4 bookings');
  console.log('Login: michael@nf6familyoffice.com / NF6Admin2026!');
})();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`NF6 API running on http://localhost:${PORT} (in-memory mode)`);
});

module.exports = app;
