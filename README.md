# Scourr — Trade Show Orders

An order-taking app for Scourr reusable cleaning cloths, built for use at in-person trade shows. Staff add items to a cart, capture optional customer details, and record the order — all backed by `localStorage` so it keeps working without a network connection at the venue.

## Features

- **Product catalog** — quantity steppers with per-product minimum and step amounts (`lib/trade-show.ts`)
- **Cart & checkout** — customer details, shipping/billing addresses, payment method, discounts
- **Offline-first** — orders persist to `localStorage`, with an order history table and CSV export for post-show follow-up
- **Stripe Checkout** — optional card payment via `/api/stripe/checkout`
- **Order sync** — orders can sync to a Google Sheet (`/api/orders`) and trigger confirmation emails (`/api/email/order-confirmation`)

## Tech Stack

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS v4**

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — it redirects straight to `/trade-show`.

### Environment variables

| Variable | Used for |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Google Sheets order sync |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_B64` (preferred) or `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Google Sheets order sync |
| `GOOGLE_SHEET_ID` | Google Sheets order sync — the ID segment from the sheet's URL |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Order confirmation emails |
| `MERCHANT_EMAIL` (optional) | Where merchant order notifications are sent (defaults to `GMAIL_USER`) |
| `GMAIL_FROM_EMAIL` (optional) | Custom "From" address, must be a verified alias on `GMAIL_USER` |
| `STRIPE_SECRET_KEY` | Stripe Checkout |

## Deployment

Deploy to [Vercel](https://vercel.com) with the environment variables above set in project settings.
