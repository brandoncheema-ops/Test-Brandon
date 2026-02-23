/**
 * In-memory data store - replaces MongoDB for local development without a database.
 * All data resets on server restart. Replace with MongoDB models for production.
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'nf6-dev-secret-key';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

let nextId = 100;
const genId = () => String(++nextId);

// --- USERS ---
const users = [];

const createUser = async ({ name, email, password, role = 'owner' }) => {
  const hashed = await bcrypt.hash(password, 12);
  const user = { _id: genId(), name, email: email.toLowerCase(), password: hashed, role, properties: [], createdAt: new Date() };
  users.push(user);
  return user;
};

const findUserByEmail = (email) => users.find(u => u.email === email.toLowerCase());
const findUserById = (id) => users.find(u => u._id === id);

const comparePassword = async (plain, hashed) => bcrypt.compare(plain, hashed);

const generateToken = (user) => jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRE });

const verifyToken = (token) => jwt.verify(token, JWT_SECRET);

// --- PROPERTIES ---
const properties = [];

const createProperty = (data) => {
  const prop = {
    _id: genId(),
    name: data.name,
    owner: data.owner,
    location: data.location || {},
    description: data.description || '',
    propertyType: data.propertyType || 'villa',
    bedrooms: data.bedrooms || 1,
    bathrooms: data.bathrooms || 1,
    maxGuests: data.maxGuests || 4,
    amenities: data.amenities || [],
    fees: {
      platformFeePercentage: data.fees?.platformFeePercentage ?? 20,
      cleaningFeePerGuest: data.fees?.cleaningFeePerGuest ?? 250,
      defaultNightlyRate: data.fees?.defaultNightlyRate ?? 500
    },
    currency: data.currency || 'USD',
    isActive: true,
    createdAt: new Date()
  };
  properties.push(prop);
  return prop;
};

const getPropertiesByOwner = (ownerId) => properties.filter(p => p.owner === ownerId && p.isActive);
const getPropertyById = (id) => properties.find(p => p._id === id);
const updateProperty = (id, data) => {
  const prop = getPropertyById(id);
  if (!prop) return null;
  Object.assign(prop, data, { _id: prop._id, owner: prop.owner });
  return prop;
};
const deleteProperty = (id) => {
  const idx = properties.findIndex(p => p._id === id);
  if (idx === -1) return null;
  return properties.splice(idx, 1)[0];
};

// --- BOOKINGS ---
const bookings = [];

const createBooking = (data) => {
  const prop = getPropertyById(data.property);
  const checkIn = new Date(data.checkIn);
  const checkOut = new Date(data.checkOut);
  const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
  const rate = parseFloat(data.ratePerNight);
  const grossRevenue = nights * rate;
  const platformFees = prop ? grossRevenue * (prop.fees.platformFeePercentage / 100) : 0;
  const cleaningFee = prop ? prop.fees.cleaningFeePerGuest : 250;
  const netIncome = grossRevenue - platformFees - cleaningFee;

  const booking = {
    _id: genId(),
    property: data.property,
    guestName: data.guestName,
    guestEmail: data.guestEmail || '',
    guestPhone: data.guestPhone || '',
    checkIn: checkIn.toISOString(),
    checkOut: checkOut.toISOString(),
    nights,
    ratePerNight: rate,
    grossRevenue: Math.round(grossRevenue * 100) / 100,
    platformFees: Math.round(platformFees * 100) / 100,
    cleaningFee,
    netIncome: Math.round(netIncome * 100) / 100,
    status: data.status || 'confirmed',
    paymentStatus: data.paymentStatus || 'pending',
    notes: data.notes || '',
    createdAt: new Date()
  };
  bookings.push(booking);
  return booking;
};

const getBookings = (filter = {}) => {
  let result = [...bookings];

  if (filter.property) {
    result = result.filter(b => b.property === filter.property);
  }
  if (filter.propertyIds) {
    result = result.filter(b => filter.propertyIds.includes(b.property));
  }
  if (filter.status) {
    result = result.filter(b => b.status === filter.status);
  }
  if (filter.month && filter.year) {
    const month = parseInt(filter.month) - 1;
    const year = parseInt(filter.year);
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59);
    result = result.filter(b => {
      const ci = new Date(b.checkIn);
      const co = new Date(b.checkOut);
      return (ci >= startOfMonth && ci <= endOfMonth) ||
             (co >= startOfMonth && co <= endOfMonth) ||
             (ci <= startOfMonth && co >= endOfMonth);
    });
  }
  if (filter.year && !filter.month) {
    const year = parseInt(filter.year);
    result = result.filter(b => new Date(b.checkIn).getFullYear() === year);
  }

  return result.sort((a, b) => new Date(b.checkIn) - new Date(a.checkIn));
};

const getBookingById = (id) => bookings.find(b => b._id === id);

const updateBooking = (id, data) => {
  const booking = getBookingById(id);
  if (!booking) return null;

  const needsRecalc = data.checkIn || data.checkOut || data.ratePerNight;
  Object.assign(booking, data, { _id: booking._id });

  if (needsRecalc) {
    const prop = getPropertyById(booking.property);
    const checkIn = new Date(booking.checkIn);
    const checkOut = new Date(booking.checkOut);
    booking.nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    booking.grossRevenue = booking.nights * parseFloat(booking.ratePerNight);
    booking.platformFees = prop ? booking.grossRevenue * (prop.fees.platformFeePercentage / 100) : 0;
    booking.cleaningFee = prop ? prop.fees.cleaningFeePerGuest : 250;
    booking.netIncome = booking.grossRevenue - booking.platformFees - booking.cleaningFee;
  }

  return booking;
};

const deleteBooking = (id) => {
  const idx = bookings.findIndex(b => b._id === id);
  if (idx === -1) return null;
  return bookings.splice(idx, 1)[0];
};

// --- INVOICES ---
const invoices = [];
let invoiceCounter = 0;

const createInvoice = (data) => {
  invoiceCounter++;
  const invoice = {
    _id: genId(),
    invoiceNumber: `NF6-${new Date().getFullYear()}-${String(invoiceCounter).padStart(4, '0')}`,
    booking: data.booking,
    property: data.property,
    guestName: data.guestName,
    guestEmail: data.guestEmail || '',
    lineItems: data.lineItems || [],
    subtotal: data.subtotal || 0,
    fees: data.fees || [],
    total: data.total || 0,
    status: data.status || 'draft',
    dueDate: data.dueDate,
    notes: data.notes || '',
    createdAt: new Date()
  };
  invoices.push(invoice);
  return invoice;
};

const getInvoices = (filter = {}) => {
  let result = [...invoices];
  if (filter.status) result = result.filter(i => i.status === filter.status);
  if (filter.property) result = result.filter(i => i.property === filter.property);
  return result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

const getInvoiceById = (id) => invoices.find(i => i._id === id);

const updateInvoice = (id, data) => {
  const inv = getInvoiceById(id);
  if (!inv) return null;
  Object.assign(inv, data, { _id: inv._id, invoiceNumber: inv.invoiceNumber });
  return inv;
};

// --- WEEKEND SCHEDULE ---
const weekendSchedules = [];

const createWeekendSchedule = (data) => {
  const entry = {
    _id: genId(),
    doctorName: data.doctorName,
    date: new Date(data.date).toISOString(),
    location: data.location || '',
    notes: data.notes || '',
    createdAt: new Date()
  };
  weekendSchedules.push(entry);
  return entry;
};

const getWeekendSchedules = (filter = {}) => {
  let result = [...weekendSchedules];

  if (filter.startDate && filter.endDate) {
    const start = new Date(filter.startDate);
    const end = new Date(filter.endDate);
    result = result.filter(s => {
      const d = new Date(s.date);
      return d >= start && d <= end;
    });
  }
  if (filter.doctorName) {
    result = result.filter(s => s.doctorName.toLowerCase().includes(filter.doctorName.toLowerCase()));
  }

  return result.sort((a, b) => new Date(a.date) - new Date(b.date));
};

const deleteWeekendSchedule = (id) => {
  const idx = weekendSchedules.findIndex(s => s._id === id);
  if (idx === -1) return null;
  return weekendSchedules.splice(idx, 1)[0];
};

/**
 * Returns last week's weekend schedule formatted with dates.
 * Output format: "2/21 - Dr. Yurka\n2/22 - Dr. Yurka"
 */
const getLastWeekendSummary = () => {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 6=Sat

  // Find last Saturday and Sunday
  const lastSunday = new Date(now);
  lastSunday.setDate(now.getDate() - dayOfWeek);
  lastSunday.setHours(23, 59, 59, 999);

  const lastSaturday = new Date(lastSunday);
  lastSaturday.setDate(lastSunday.getDate() - 1);
  lastSaturday.setHours(0, 0, 0, 0);

  const entries = getWeekendSchedules({
    startDate: lastSaturday.toISOString(),
    endDate: lastSunday.toISOString()
  });

  const lines = entries.map(e => {
    const d = new Date(e.date);
    return `${d.getMonth() + 1}/${d.getDate()} - ${e.doctorName}`;
  });

  return {
    saturday: lastSaturday.toISOString().slice(0, 10),
    sunday: lastSunday.toISOString().slice(0, 10),
    entries,
    formatted: lines.join('\n'),
    htmlFormatted: lines.join('<br>')
  };
};

// --- POPULATE helper (mimic Mongoose populate) ---
const populateBooking = (booking) => {
  if (!booking) return booking;
  const prop = getPropertyById(booking.property);
  return { ...booking, property: prop ? { _id: prop._id, name: prop.name, location: prop.location } : null };
};

const populateInvoice = (invoice) => {
  if (!invoice) return invoice;
  const booking = getBookingById(invoice.booking);
  const prop = getPropertyById(invoice.property);
  return {
    ...invoice,
    booking: booking || null,
    property: prop ? { _id: prop._id, name: prop.name } : null
  };
};

module.exports = {
  // Users
  createUser, findUserByEmail, findUserById, comparePassword, generateToken, verifyToken,
  // Properties
  createProperty, getPropertiesByOwner, getPropertyById, updateProperty, deleteProperty,
  // Bookings
  createBooking, getBookings, getBookingById, updateBooking, deleteBooking,
  // Invoices
  createInvoice, getInvoices, getInvoiceById, updateInvoice,
  // Weekend Schedule
  createWeekendSchedule, getWeekendSchedules, deleteWeekendSchedule, getLastWeekendSummary,
  // Helpers
  populateBooking, populateInvoice
};
