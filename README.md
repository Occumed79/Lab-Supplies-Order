# OCCU-MED Lab Supply Portal

A connected clinic-ordering and Occu-Med administration system for laboratory supply fulfillment.

## Architecture

This repository deploys as **two separate Render Web Services** connected to the **same Neon database**.

### 1. Clinic Portal

Render service: `lab-supplies-order`

The clinic-facing service contains only:

- clinic credential login
- laboratory supply selection and quantities
- needed-by date and special instructions
- supply request submission
- clinic request history
- fulfillment status and shipment tracking

It does not expose admin navigation, clinic management, credential generation, or fulfillment controls.

### 2. Admin Portal

Render service: `lab-supplies-order-admin`

The Occu-Med administration service contains:

- command-center metrics
- clinic creation and activation/deactivation
- multiple users per clinic
- admin-generated temporary passwords
- copyable credential handoff
- clinic-user password reset
- clinic-user activation/deactivation and deletion
- incoming lab request review
- fulfillment status updates
- shipment tracking entry

There is no public registration and no emailed invitation workflow. Clinics and clinic users are created from the Admin Portal.

## Shared data model

Both Render services use the exact same `DATABASE_URL` so that:

- clinics created in Admin are immediately available for user assignment
- clinic users generated in Admin can sign in on the Clinic Portal
- clinic requests appear in Admin fulfillment
- admin status and tracking updates appear in clinic request history

Passwords are stored only as bcrypt hashes. The plain-text temporary password is shown only when an admin creates or resets a clinic user.

## Render settings

Both deployments are **Node Web Services**, not Static Sites.

Shared settings:

```txt
Build command: npm install && npm run build:render
Start command: npm start
Health check: /health
```

### Clinic Render environment

```txt
NODE_ENV=production
APP_MODE=clinic
VITE_APP_MODE=clinic
DATABASE_URL=<shared Lab Portal Neon pooled URL>
AUTH_SECRET=<clinic-service-specific random secret>
ORDER_NOTIFICATION_EMAIL=<Occu-Med fulfillment mailbox>
```

### Admin Render environment

```txt
NODE_ENV=production
APP_MODE=admin
VITE_APP_MODE=admin
VITE_CLINIC_APP_URL=https://lab-supplies-order.onrender.com
DATABASE_URL=<the exact same Lab Portal Neon pooled URL>
AUTH_SECRET=<different admin-service-specific random secret>
ADMIN_NAME=<admin display name>
ADMIN_EMAIL=<admin login email>
ADMIN_PASSWORD=<admin login password>
ORDER_NOTIFICATION_EMAIL=<Occu-Med fulfillment mailbox>
```

Optional SMTP variables for request confirmations and status notifications:

```txt
SMTP_HOST=<mail host>
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<mailbox username>
SMTP_PASS=<mailbox password or app password>
MAIL_FROM=Occu-Med Lab Supplies <supplies@yourdomain.com>
```

## Local commands

```bash
npm install
npm --prefix backend install
```

Clinic frontend:

```bash
VITE_APP_MODE=clinic npm run dev
```

Admin frontend:

```bash
VITE_APP_MODE=admin VITE_CLINIC_APP_URL=http://localhost:5173 npm run dev
```

Backend:

```bash
APP_MODE=clinic DATABASE_URL=<url> AUTH_SECRET=<secret> npm run dev:api
```

Production checks:

```bash
npm run typecheck
VITE_APP_MODE=clinic npm run build
VITE_APP_MODE=admin VITE_CLINIC_APP_URL=https://lab-supplies-order.onrender.com npm run build
node --check backend/server.js
```
