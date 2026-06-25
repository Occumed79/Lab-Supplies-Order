# OCCU-MED Lab Supply Portal

React + Vite + TypeScript app for clinic registration, clinic login, admin login, lab supply ordering, checkout, confirmation, profile management, admin clinic dashboard, clinic invitations, and clinic order history.

## Current architecture

This repository now contains two deployable pieces:

1. **Frontend static site** at the repository root.
2. **Neon-backed API** in `backend/`.

The Render blueprint defines both services:

- `lab-supplies-order` — static Vite frontend
- `lab-supplies-order-api` — Node/Express API

The frontend build uses `VITE_API_BASE_URL` and defaults to:

```txt
https://lab-supplies-order-api.onrender.com
```

## Commands

Frontend:

```bash
npm install
npm run build
npm run dev
```

Backend:

```bash
cd backend
npm install
npm start
```

## Required Render environment variables

### API service: `lab-supplies-order-api`

Required:

```txt
DATABASE_URL=<Neon pooled or direct connection string>
FRONTEND_ORIGIN=https://lab-supplies-order.onrender.com
PUBLIC_FRONTEND_URL=https://lab-supplies-order.onrender.com
ADMIN_EMAIL=<admin login email>
ADMIN_PASSWORD=<admin login password>
```

Optional, only needed if clinic invitation emails should send through Resend:

```txt
RESEND_API_KEY=<Resend API key>
MAIL_FROM=<verified Resend sender, e.g. Occu-Med Lab Supplies <no-reply@yourdomain.com>>
```

### Static frontend service: `lab-supplies-order`

```txt
VITE_API_BASE_URL=https://lab-supplies-order-api.onrender.com
```

## Validation previously completed

```bash
npx tsc --noEmit
npm run build
```

Both commands previously passed successfully before the Render/API wiring updates.

## Notes

- The frontend startup script patches the production API base URL before `npm run dev` and `npm run build`.
- The same startup script also patches the login flow so the frontend respects the role returned by the API instead of trusting the selected login tab.
- If `RESEND_API_KEY` and `MAIL_FROM` are not configured, invitation records can still be created, but invitation email delivery is not active.
