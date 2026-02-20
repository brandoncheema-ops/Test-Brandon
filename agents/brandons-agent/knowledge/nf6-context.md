# NF6 Family Office - Domain Knowledge

## Organization

NF6 Family Office is a property management organization handling short-term rental properties. The primary operation revolves around managing bookings, financials, and guest communications for vacation rental properties.

## Properties

### Villa Lynn
- **Type:** Vacation rental
- **Pricing:** Variable nightly rates based on season and guest
- **Platform Fee:** 20% of gross revenue
- **Cleaning Fee:** $250 per booking (flat rate)

## Financial Model

### Revenue Calculation
- **Gross Revenue** = Number of Nights x Nightly Rate
- **Platform Fees** = Gross Revenue x 20%
- **Cleaning Fee** = $250 (per booking)
- **Net Income** = Gross Revenue - Platform Fees - Cleaning Fee

### Key Metrics
- **Occupancy Rate** — Percentage of available nights that are booked
- **Average Nightly Rate** — Mean revenue per booked night
- **Revenue Per Available Night (RevPAN)** — Total revenue divided by total available nights

## Booking Statuses
- `confirmed` — Booking is confirmed and upcoming
- `checked-in` — Guest has arrived
- `checked-out` — Guest has departed
- `cancelled` — Booking was cancelled

## Roles
- **Owner** — Full access to all properties, bookings, and financials
- **Manager** — Can manage bookings and view financials
- **Viewer** — Read-only access to dashboards and reports

## Current Data (2025-2026)

| Guest | Check-in | Check-out | Nights | Rate | Gross | Net |
|-------|----------|-----------|--------|------|-------|-----|
| David Frayer | Jan 2, 2025 | Jan 17, 2025 | 16 | $450 | $7,200 | $5,510 |
| Emily Levine | Jan 25, 2025 | Feb 1, 2025 | 7 | $1,500 | $10,500 | $8,150 |
| Jon Warwick | Feb 8, 2025 | Mar 10, 2025 | 30 | $567 | $17,000 | $13,350 |
| Billy Shroyer | Mar 21, 2025 | Mar 27, 2025 | 6 | $1,700 | $10,200 | $7,910 |

**YTD Summary:** $44,900 gross / $34,920 net / 66% occupancy
