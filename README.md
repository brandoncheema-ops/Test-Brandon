# NF6 Family Office - Property Management

A full-stack property management application for NF6 Family Office, built with React, Node.js/Express, and MongoDB.

## Features

- **Dashboard** - Revenue charts, KPIs, occupancy metrics, and recent bookings
- **Booking Management** - Full CRUD for guest bookings with filtering and status tracking
- **Multi-Property Support** - Manage multiple properties with individual fee structures
- **Calendar View** - Visual booking calendar with month navigation and booking details
- **Invoice Generation** - Auto-generated invoices with PDF export and email delivery
- **Payment Processing** - Stripe integration for collecting guest payments
- **Email Notifications** - Booking confirmations and invoice delivery via Nodemailer
- **Authentication** - JWT-based login/signup with role-based access (owner/manager/viewer)
- **Mobile Responsive** - Full mobile support with collapsible sidebar navigation

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router 6, Chart.js, React Toastify |
| Backend | Node.js, Express 4, Mongoose ODM |
| Database | MongoDB |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| Payments | Stripe |
| Email | Nodemailer |
| PDF | PDFKit |
| Deployment | Docker, Docker Compose |

## Project Structure

```
├── backend/
│   ├── config/
│   │   └── database.js          # MongoDB connection
│   ├── middleware/
│   │   ├── auth.js              # JWT auth & role authorization
│   │   └── errorHandler.js      # Global error handler
│   ├── models/
│   │   ├── User.js              # User model (auth, roles)
│   │   ├── Property.js          # Property model (fees, location)
│   │   ├── Booking.js           # Booking model (auto-calculates financials)
│   │   └── Invoice.js           # Invoice model (auto-numbering)
│   ├── routes/
│   │   ├── auth.js              # POST /register, /login, GET /me
│   │   ├── bookings.js          # CRUD + summary endpoint
│   │   ├── properties.js        # CRUD for properties
│   │   ├── invoices.js          # CRUD + PDF + email send
│   │   └── payments.js          # Stripe payment intents + webhooks
│   ├── utils/
│   │   ├── email.js             # Nodemailer transporter + templates
│   │   ├── pdfGenerator.js      # PDFKit invoice generation
│   │   └── seed.js              # Database seed script
│   ├── server.js                # Express app entry point
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   └── Layout/
│   │   │       └── AppLayout.jsx  # Sidebar + main layout
│   │   ├── context/
│   │   │   └── AuthContext.js     # Auth state management
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   ├── RegisterPage.jsx
│   │   │   ├── DashboardPage.jsx  # KPIs + charts
│   │   │   ├── BookingsPage.jsx   # CRUD table + modal
│   │   │   ├── PropertiesPage.jsx # Property cards + modal
│   │   │   ├── CalendarPage.jsx   # Calendar grid view
│   │   │   └── InvoicesPage.jsx   # Invoice management
│   │   ├── styles/
│   │   │   └── global.css         # Complete design system
│   │   ├── utils/
│   │   │   ├── api.js             # Axios instance with JWT
│   │   │   └── format.js          # Currency/date formatters
│   │   ├── App.jsx                # Router + auth guards
│   │   └── index.js
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── docker-compose.yml
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- npm or yarn

### 1. Clone and install

```bash
git clone <repo-url>
cd nf6-property-management

# Backend
cd backend
cp .env.example .env   # Edit with your values
npm install

# Frontend
cd ../frontend
cp .env.example .env
npm install
```

### 2. Configure environment variables

**backend/.env:**
```
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/nf6-property-management
JWT_SECRET=your-secret-key-here
JWT_EXPIRE=7d
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=NF6 Family Office <noreply@nf6familyoffice.com>
FRONTEND_URL=http://localhost:3000
```

**frontend/.env:**
```
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### 3. Seed the database

```bash
cd backend
npm run seed
```

This creates:
- Admin user: `michael@nf6familyoffice.com` / `NF6Admin2026!`
- Villa Lynn property with fees configured
- 4 sample bookings matching the original dashboard data

### 4. Run development servers

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm start
```

Frontend: http://localhost:3000
Backend API: http://localhost:5000/api

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Sign in (returns JWT) |
| GET | `/api/auth/me` | Get current user |

### Properties
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/properties` | List user's properties |
| GET | `/api/properties/:id` | Get property with bookings |
| POST | `/api/properties` | Create property |
| PUT | `/api/properties/:id` | Update property |
| DELETE | `/api/properties/:id` | Delete property |

### Bookings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bookings` | List bookings (filterable) |
| GET | `/api/bookings/summary` | Financial summary + monthly breakdown |
| GET | `/api/bookings/:id` | Get booking details |
| POST | `/api/bookings` | Create booking |
| PUT | `/api/bookings/:id` | Update booking |
| DELETE | `/api/bookings/:id` | Delete booking |

**Query parameters for GET /api/bookings:**
- `property` - Filter by property ID
- `status` - Filter by status
- `month` / `year` - Filter by month
- `startDate` / `endDate` - Date range

### Invoices
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/invoices` | List invoices |
| POST | `/api/invoices` | Generate from booking |
| GET | `/api/invoices/:id/pdf` | Download PDF |
| POST | `/api/invoices/:id/send` | Email to guest |
| PUT | `/api/invoices/:id` | Update status |

### Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payments/create-intent` | Create Stripe payment |
| POST | `/api/payments/webhook` | Stripe webhook handler |
| GET | `/api/payments/history` | Payment history |

## Deployment

### Docker (Recommended)

```bash
docker-compose up -d
```

This starts MongoDB, the backend API, and the frontend with nginx.

### Manual Deployment

**Backend (Heroku/Render/Railway):**
1. Set environment variables on platform
2. Deploy the `backend/` directory
3. Run `npm run seed` once for initial data

**Frontend (Vercel/Netlify):**
1. Set `REACT_APP_API_URL` to your backend URL
2. Build command: `npm run build`
3. Output directory: `build`

### MongoDB Atlas (Cloud Database)

1. Create a cluster at https://cloud.mongodb.com
2. Get connection string
3. Set `MONGODB_URI` in your backend environment

## Financial Model

The system automatically calculates:

- **Gross Revenue** = Nights x Rate per Night
- **Platform Fees** = Gross Revenue x Platform Fee % (default 20%)
- **Cleaning Fee** = Per-guest flat rate (default $250)
- **Net Income** = Gross Revenue - Platform Fees - Cleaning Fee

Each property has configurable fee structures, supporting multi-property portfolios with different rates.

## Current Data (Villa Lynn)

| Guest | Check-in | Check-out | Nights | Rate | Gross | Net |
|-------|----------|-----------|--------|------|-------|-----|
| David Frayer | Jan 2 | Jan 17 | 16 | $450 | $7,200 | $5,510 |
| Emily Levine | Jan 25 | Feb 1 | 7 | $1,500 | $10,500 | $8,150 |
| Jon Warwick | Feb 8 | Mar 10 | 30 | $567 | $17,000 | $13,350 |
| Billy Shroyer | Mar 21 | Mar 27 | 6 | $1,700 | $10,200 | $7,910 |

**YTD Summary:** $44,900 gross / $34,920 net / 66% occupancy

## License

Proprietary - NF6 Family Office. All rights reserved.
