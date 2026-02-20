# MN Family Office Dashboard

A comprehensive family office net worth dashboard that consolidates financial data across 20+ entities, 9+ financial institutions, and 3 currencies (USD, EUR, COP).

## Features

- **Executive Dashboard** - High-level net worth overview with KPI cards, charts, and currency breakdowns
- **Entity Management** - 20 family office entities (LLCs, Trusts, LPs, personal accounts, international companies)
- **Institution Tracking** - 9 financial institutions (FirstBank PR, BoFA, Chase, J.P. Morgan, Charles Schwab, Santander, Bancolombia, Occidente, QBO)
- **Multi-Currency Support** - USD, EUR, and COP with real-time conversion rates
- **42 Real Accounts** - All account data from actual bank/brokerage screenshots
- **Day Change Tracking** - Investment gain/loss tracking from Schwab brokerage accounts
- **Liability Tracking** - Mortgage and loan tracking with net worth calculations
- **Interactive Charts** - Donut chart for assets by institution, bar chart for entity types
- **Search & Filter** - Full-text search and filtering across all pages
- **Drill-Down Views** - Click any entity or institution to see all associated accounts
- **Authentication** - JWT-based login with protected routes

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router 6, Chart.js, react-chartjs-2, React Icons |
| Backend | Node.js, Express 4, In-Memory Store |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| Deployment | Docker, Docker Compose |

## Quick Start

```bash
# Backend
cd backend
npm install
npm run dev    # http://localhost:5000

# Frontend (separate terminal)
cd frontend
npm install
npm start      # http://localhost:3000
```

**Login:** `michael@nf6familyoffice.com` / `NF6Admin2026!`

## Pages

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/` | Executive overview with net worth, KPIs, charts, currency cards, top accounts |
| Entities | `/entities` | All 20 family office entities with search and type filters |
| Entity Detail | `/entities/:id` | Single entity with all accounts, assets, liabilities |
| Institutions | `/institutions` | All 9 financial institutions with net value and account counts |
| Institution Detail | `/institutions/:id` | Single institution with all accounts |
| Accounts | `/accounts` | Full list of 42 accounts with sorting, search, and filters |

## Data Summary

- **Total Entities:** 20 (LLCs, Trusts, LPs, Personal, Inc, SL, Company)
- **Total Institutions:** 9 (US banks, brokerages, Spanish bank, Colombian banks, QBO)
- **Total Accounts:** 42
- **Currencies:** USD, EUR, COP
- **Exchange Rates:** 1 EUR = 1.08 USD, 1 USD = 3,688 COP
