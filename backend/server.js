import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { neon } from '@neondatabase/serverless';
import { randomBytes } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { sendPlainEmail } from './mailer.js';

const app = express();
const port = Number(process.env.PORT || 10000);
const databaseUrl = process.env.DATABASE_URL;
const frontendOrigins = String(process.env.FRONTEND_ORIGIN || '*')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const publicFrontendUrl = String(process.env.PUBLIC_FRONTEND_URL || 'https://lab-supplies-order.onrender.com').replace(/\/$/, '');
const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const adminPassword = String(process.env.ADMIN_PASSWORD || '');
const notificationEmail = String(process.env.ORDER_NOTIFICATION_EMAIL || adminEmail).trim();

if (!databaseUrl) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const authSecret = process.env.AUTH_SECRET || `${databaseUrl}:${adminEmail}:lab-supply-portal`;
if (!process.env.AUTH_SECRET) console.warn('AUTH_SECRET is not configured; using a stable deployment fallback.');

const sql = neon(databaseUrl);
const allowedStatuses = ['Pending', 'Approved', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || frontendOrigins.includes('*') || frontendOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS'));
  },
}));

const text = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const email = (value) => text(value, 254).toLowerCase();
const positiveInt = (value, fallback = 0) => {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

function signUser(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    authSecret,
    { expiresIn: '12h', issuer: 'occu-med-lab-supply-portal' },
  );
}

function authRequired(req, res, next) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Authentication required.' });
  try {
    req.auth = jwt.verify(token, authSecret, { issuer: 'occu-med-lab-supply-portal' });
    return next();
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }
}

const roleRequired = (...roles) => (req, res, next) => {
  if (!roles.includes(req.auth?.role)) return res.status(403).json({ error: 'You do not have access to this action.' });
  return next();
};

async function clinicForUser(userId) {
  const rows = await sql`SELECT * FROM clinics WHERE user_id = ${userId} LIMIT 1`;
  return rows[0] || null;
}

function normalizeOrder(row) {
  return {
    ...row,
    order_items: Array.isArray(row.order_items) ? row.order_items : JSON.parse(row.order_items || '[]'),
  };
}

async function initDb() {
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
  await sql`CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    email text UNIQUE NOT NULL,
    password_hash text NOT NULL,
    provider text NOT NULL DEFAULT 'email',
    role text NOT NULL DEFAULT 'clinic',
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS clinics (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    clinic_name text NOT NULL,
    contact_name text,
    email text,
    phone text,
    address text,
    city text,
    state text,
    zip_code text,
    account_status text NOT NULL DEFAULT 'Active',
    last_order_date date,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`ALTER TABLE clinics ADD COLUMN IF NOT EXISTS contact_name text`;
  await sql`ALTER TABLE clinics ADD COLUMN IF NOT EXISTS email text`;
  await sql`CREATE TABLE IF NOT EXISTS products (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_name text NOT NULL,
    product_code text NOT NULL UNIQUE,
    description text,
    category text NOT NULL DEFAULT 'General',
    unit_label text NOT NULL DEFAULT 'Each',
    display_order integer NOT NULL DEFAULT 0,
    price numeric(10,2) NOT NULL DEFAULT 0,
    stock_quantity integer NOT NULL DEFAULT 0,
    is_available boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_label text NOT NULL DEFAULT 'Each'`;
  await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0`;
  await sql`CREATE TABLE IF NOT EXISTS orders (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id uuid REFERENCES clinics(id) ON DELETE SET NULL,
    order_number text NOT NULL UNIQUE,
    order_status text NOT NULL DEFAULT 'Pending',
    requested_by text,
    needed_by date,
    delivery_address text,
    delivery_city text,
    delivery_state text,
    delivery_zip text,
    delivery_method text,
    special_instructions text,
    tracking_number text,
    shipped_at timestamptz,
    subtotal numeric(10,2) NOT NULL DEFAULT 0,
    shipping_cost numeric(10,2) NOT NULL DEFAULT 0,
    total_cost numeric(10,2) NOT NULL DEFAULT 0,
    estimated_delivery_date date,
    order_items jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS requested_by text`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS needed_by date`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number text`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipped_at timestamptz`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()`;
  await sql`CREATE TABLE IF NOT EXISTS invitations (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    clinic_email text NOT NULL,
    clinic_name text NOT NULL,
    invitation_message text,
    invitation_status text NOT NULL DEFAULT 'Sent',
    token text UNIQUE NOT NULL,
    sent_at timestamptz NOT NULL DEFAULT now(),
    accepted_at timestamptz
  )`;

  await sql`UPDATE clinics c SET email = u.email FROM users u WHERE c.user_id = u.id AND (c.email IS NULL OR c.email = '')`;

  const supplies = [
    ['CRL-CCF', 'CRL Chain of Custody Forms', 'Laboratory chain-of-custody forms for CRL collections.', 'CRL', 'Pack', 10],
    ['CRL-CUP', 'CRL Drug Screen Collection Cups', 'Sealed collection cups for CRL drug-screen specimens.', 'CRL', 'Case', 20],
    ['LABCORP-REQ', 'Labcorp Requisition Forms', 'Blank Labcorp laboratory requisition forms.', 'Labcorp', 'Pack', 30],
    ['LABCORP-CCF', 'Labcorp Chain of Custody Forms', 'Chain-of-custody forms for Labcorp drug-screen collections.', 'Labcorp', 'Pack', 40],
    ['URINE-CUP', 'Urine Specimen Collection Cups', 'Sterile urine specimen cups with secure lids.', 'Collection Supplies', 'Case', 50],
    ['TUBE-SST', 'SST Gold-Top Tubes', 'Serum separator tubes for chemistry and serology testing.', 'Collection Tubes', 'Box', 60],
    ['TUBE-EDTA', 'EDTA Lavender-Top Tubes', 'EDTA tubes for hematology collections.', 'Collection Tubes', 'Box', 70],
    ['TUBE-GRAY', 'Gray-Top Tubes', 'Fluoride/oxalate tubes for glucose-related testing.', 'Collection Tubes', 'Box', 80],
    ['BIO-BAG', 'Biohazard Specimen Bags', 'Leak-resistant specimen transport bags with document pouch.', 'Shipping', 'Pack', 90],
    ['SHIP-PAK', 'Clinical Shipping Paks', 'Compliant outer packaging for specimen or supply shipment.', 'Shipping', 'Pack', 100],
    ['ABSORBENT', 'Absorbent Sheets', 'Absorbent material for compliant specimen packaging.', 'Shipping', 'Pack', 110],
    ['LABELS', 'Specimen Labels', 'Blank specimen identification labels.', 'Collection Supplies', 'Roll', 120],
  ];

  for (const [code, name, description, category, unit, displayOrder] of supplies) {
    await sql`INSERT INTO products (product_code, product_name, description, category, unit_label, display_order, price, stock_quantity, is_available)
      VALUES (${code}, ${name}, ${description}, ${category}, ${unit}, ${displayOrder}, 0, 9999, true)
      ON CONFLICT (product_code) DO UPDATE SET
        product_name = EXCLUDED.product_name,
        description = EXCLUDED.description,
        category = EXCLUDED.category,
        unit_label = EXCLUDED.unit_label,
        display_order = EXCLUDED.display_order`;
  }

  if (adminEmail && adminPassword) {
    const existing = await sql`SELECT id FROM users WHERE lower(email) = ${adminEmail} LIMIT 1`;
    const hash = await bcrypt.hash(adminPassword, 12);
    if (existing.length === 0) {
      await sql`INSERT INTO users (email, password_hash, provider, role) VALUES (${adminEmail}, ${hash}, 'email', 'admin')`;
    } else {
      await sql`UPDATE users SET role = 'admin', password_hash = ${hash} WHERE id = ${existing[0].id}`;
    }
  }
}

app.get('/health', (_req, res) => res.json({ ok: true, service: 'lab-supplies-order-api' }));
app.get('/', (_req, res) => res.json({ service: 'lab-supplies-order-api', status: 'running' }));

app.post('/auth/login', async (req, res) => {
  try {
    const loginEmail = email(req.body?.email);
    const password = String(req.body?.password || '');
    const rows = await sql`SELECT id, email, password_hash, role FROM users WHERE lower(email) = ${loginEmail} LIMIT 1`;
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'Invalid email or password.' });
    const clinic = user.role === 'clinic' ? await clinicForUser(user.id) : null;
    return res.json({ token: signUser(user), user: { id: user.id, email: user.email, role: user.role }, clinic });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Login failed.' });
  }
});

app.get('/invitations/:token', async (req, res) => {
  try {
    const rows = await sql`SELECT clinic_email, clinic_name, invitation_message, invitation_status FROM invitations WHERE token = ${text(req.params.token, 100)} LIMIT 1`;
    const invitation = rows[0];
    if (!invitation || invitation.invitation_status === 'Accepted') return res.status(404).json({ error: 'This invitation is invalid or has already been used.' });
    return res.json(invitation);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not validate invitation.' });
  }
});

app.post('/auth/register', async (req, res) => {
  try {
    const payload = req.body || {};
    const clinicEmail = email(payload.email);
    const password = String(payload.password || '');
    const clinicName = text(payload.clinic_name, 200);
    if (!clinicEmail || !clinicName || password.length < 8) return res.status(400).json({ error: 'Clinic name, valid email, and an 8-character password are required.' });
    const duplicate = await sql`SELECT id FROM users WHERE lower(email) = ${clinicEmail} LIMIT 1`;
    if (duplicate.length) return res.status(409).json({ error: 'An account already exists for this email.' });

    let invitation = null;
    const invitationToken = text(payload.invitation_token, 100);
    if (invitationToken) {
      const rows = await sql`SELECT * FROM invitations WHERE token = ${invitationToken} AND invitation_status <> 'Accepted' LIMIT 1`;
      invitation = rows[0] || null;
      if (!invitation) return res.status(400).json({ error: 'The invitation is invalid or has already been used.' });
      if (email(invitation.clinic_email) !== clinicEmail) return res.status(400).json({ error: 'Use the email address that received the invitation.' });
    }

    const hash = await bcrypt.hash(password, 12);
    const users = await sql`INSERT INTO users (email, password_hash, provider, role) VALUES (${clinicEmail}, ${hash}, 'email', 'clinic') RETURNING id, email, role`;
    const user = users[0];
    const clinics = await sql`INSERT INTO clinics (user_id, clinic_name, contact_name, email, phone, address, city, state, zip_code, account_status)
      VALUES (${user.id}, ${clinicName}, ${text(payload.contact_name, 160)}, ${clinicEmail}, ${text(payload.phone, 50)}, ${text(payload.address, 250)}, ${text(payload.city, 120)}, ${text(payload.state, 80)}, ${text(payload.zip_code, 30)}, 'Active') RETURNING *`;
    if (invitation) await sql`UPDATE invitations SET invitation_status = 'Accepted', accepted_at = now() WHERE id = ${invitation.id}`;
    return res.status(201).json({ token: signUser(user), user, clinic: clinics[0] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Registration failed.' });
  }
});

app.get('/me', authRequired, async (req, res) => {
  const clinic = req.auth.role === 'clinic' ? await clinicForUser(req.auth.sub) : null;
  return res.json({ user: { id: req.auth.sub, email: req.auth.email, role: req.auth.role }, clinic });
});

app.get('/products', authRequired, async (_req, res) => {
  const rows = await sql`SELECT id, product_name, product_code, description, category, unit_label, is_available FROM products WHERE is_available = true ORDER BY display_order, category, product_name`;
  return res.json(rows);
});

app.get('/clinic/profile', authRequired, roleRequired('clinic'), async (req, res) => {
  const clinic = await clinicForUser(req.auth.sub);
  if (!clinic) return res.status(404).json({ error: 'Clinic profile not found.' });
  return res.json(clinic);
});

app.put('/clinic/profile', authRequired, roleRequired('clinic'), async (req, res) => {
  try {
    const clinic = await clinicForUser(req.auth.sub);
    if (!clinic) return res.status(404).json({ error: 'Clinic profile not found.' });
    const data = req.body || {};
    const rows = await sql`UPDATE clinics SET
      clinic_name = ${text(data.clinic_name || clinic.clinic_name, 200)},
      contact_name = ${text(data.contact_name, 160)},
      phone = ${text(data.phone, 50)},
      address = ${text(data.address, 250)},
      city = ${text(data.city, 120)},
      state = ${text(data.state, 80)},
      zip_code = ${text(data.zip_code, 30)}
      WHERE id = ${clinic.id} RETURNING *`;
    return res.json(rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Profile update failed.' });
  }
});

app.get('/orders', authRequired, async (req, res) => {
  try {
    let rows;
    if (req.auth.role === 'admin') {
      rows = await sql`SELECT o.*, c.clinic_name, c.email AS clinic_email FROM orders o LEFT JOIN clinics c ON c.id = o.clinic_id ORDER BY o.created_at DESC`;
    } else {
      const clinic = await clinicForUser(req.auth.sub);
      rows = clinic ? await sql`SELECT o.*, c.clinic_name, c.email AS clinic_email FROM orders o LEFT JOIN clinics c ON c.id = o.clinic_id WHERE o.clinic_id = ${clinic.id} ORDER BY o.created_at DESC` : [];
    }
    return res.json(rows.map(normalizeOrder));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not load orders.' });
  }
});

app.post('/orders', authRequired, roleRequired('clinic'), async (req, res) => {
  try {
    const clinic = await clinicForUser(req.auth.sub);
    if (!clinic) return res.status(404).json({ error: 'Clinic profile not found.' });
    const requestedItems = Array.isArray(req.body?.items) ? req.body.items : [];
    const quantities = new Map(requestedItems.map((item) => [String(item.product_id), positiveInt(item.quantity)]).filter(([, quantity]) => quantity > 0));
    if (!quantities.size) return res.status(400).json({ error: 'Select at least one supply item.' });

    const productIds = [...quantities.keys()];
    const products = await sql`SELECT id, product_name, product_code, category, unit_label FROM products WHERE id = ANY(${productIds}::uuid[]) AND is_available = true`;
    const orderItems = products.map((product) => ({
      product_id: product.id,
      product_name: product.product_name,
      product_code: product.product_code,
      category: product.category,
      unit_label: product.unit_label,
      quantity: quantities.get(product.id),
    }));
    if (!orderItems.length) return res.status(400).json({ error: 'No valid supply items were selected.' });

    const orderNumber = `LS-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomBytes(2).toString('hex').toUpperCase()}`;
    const neededBy = text(req.body?.needed_by, 10) || null;
    const rows = await sql`INSERT INTO orders (
      clinic_id, order_number, order_status, requested_by, needed_by,
      delivery_address, delivery_city, delivery_state, delivery_zip,
      delivery_method, special_instructions, subtotal, shipping_cost, total_cost,
      estimated_delivery_date, order_items
    ) VALUES (
      ${clinic.id}, ${orderNumber}, 'Pending', ${text(req.body?.requested_by, 160)}, ${neededBy},
      ${clinic.address}, ${clinic.city}, ${clinic.state}, ${clinic.zip_code},
      'Occu-Med Fulfillment', ${text(req.body?.special_instructions, 2000)}, 0, 0, 0,
      ${neededBy}, ${JSON.stringify(orderItems)}::jsonb
    ) RETURNING *`;
    await sql`UPDATE clinics SET last_order_date = CURRENT_DATE WHERE id = ${clinic.id}`;

    const summary = orderItems.map((item) => `- ${item.product_name}: ${item.quantity} ${item.unit_label}`).join('\n');
    const subject = `New lab supply request ${orderNumber} — ${clinic.clinic_name}`;
    await Promise.allSettled([
      notificationEmail ? sendPlainEmail({
        to: notificationEmail,
        subject,
        text: `${clinic.clinic_name} submitted a lab supply request.\n\n${summary}\n\nNeeded by: ${neededBy || 'Not specified'}\nRequested by: ${text(req.body?.requested_by, 160) || 'Not specified'}\nInstructions: ${text(req.body?.special_instructions, 2000) || 'None'}`,
      }) : Promise.resolve(),
      clinic.email ? sendPlainEmail({
        to: clinic.email,
        subject: `Occu-Med lab supply request received — ${orderNumber}`,
        text: `Your lab supply request has been received and is pending review.\n\n${summary}\n\nYou can track the request in the Occu-Med Lab Supply Portal.`,
      }) : Promise.resolve(),
    ]);

    return res.status(201).json(normalizeOrder(rows[0]));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not submit the supply request.' });
  }
});

app.get('/admin/clinics', authRequired, roleRequired('admin'), async (_req, res) => {
  const rows = await sql`SELECT c.*, u.email AS login_email, count(o.id)::int AS order_count
    FROM clinics c LEFT JOIN users u ON u.id = c.user_id LEFT JOIN orders o ON o.clinic_id = c.id
    GROUP BY c.id, u.email ORDER BY c.clinic_name`;
  return res.json(rows);
});

app.get('/admin/invitations', authRequired, roleRequired('admin'), async (_req, res) => {
  return res.json(await sql`SELECT * FROM invitations ORDER BY sent_at DESC`);
});

app.post('/admin/invitations', authRequired, roleRequired('admin'), async (req, res) => {
  try {
    const clinicEmail = email(req.body?.clinic_email);
    const clinicName = text(req.body?.clinic_name, 200);
    const message = text(req.body?.invitation_message, 2000) || 'You are invited to join the Occu-Med Lab Supply Portal.';
    if (!clinicEmail || !clinicName) return res.status(400).json({ error: 'Clinic name and email are required.' });
    const token = uuidv4();
    const rows = await sql`INSERT INTO invitations (admin_user_id, clinic_email, clinic_name, invitation_message, invitation_status, token)
      VALUES (${req.auth.sub}, ${clinicEmail}, ${clinicName}, ${message}, 'Sent', ${token}) RETURNING *`;
    const inviteUrl = `${publicFrontendUrl}/register?token=${encodeURIComponent(token)}`;
    const mailResult = await sendPlainEmail({
      to: clinicEmail,
      subject: 'Invitation to the Occu-Med Lab Supply Portal',
      text: `${message}\n\nCreate your clinic account here:\n${inviteUrl}\n\nThis invitation is intended for ${clinicName}.`,
    });
    return res.status(201).json({ ...rows[0], email_status: mailResult?.skipped ? 'not_configured' : 'sent', invite_url: inviteUrl });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not create the invitation.' });
  }
});

app.patch('/admin/orders/:id', authRequired, roleRequired('admin'), async (req, res) => {
  try {
    const status = text(req.body?.order_status, 30);
    if (!allowedStatuses.includes(status)) return res.status(400).json({ error: 'Invalid order status.' });
    const trackingNumber = text(req.body?.tracking_number, 150);
    const rows = await sql`UPDATE orders SET
      order_status = ${status},
      tracking_number = ${trackingNumber},
      shipped_at = CASE WHEN ${status} = 'Shipped' AND shipped_at IS NULL THEN now() ELSE shipped_at END,
      updated_at = now()
      WHERE id = ${text(req.params.id, 50)} RETURNING *`;
    if (!rows[0]) return res.status(404).json({ error: 'Order not found.' });

    const clinicRows = await sql`SELECT c.email, c.clinic_name FROM clinics c JOIN orders o ON o.clinic_id = c.id WHERE o.id = ${rows[0].id} LIMIT 1`;
    const clinic = clinicRows[0];
    if (clinic?.email) {
      await sendPlainEmail({
        to: clinic.email,
        subject: `Lab supply request ${rows[0].order_number}: ${status}`,
        text: `Your Occu-Med lab supply request is now ${status}.${trackingNumber ? `\n\nTracking number: ${trackingNumber}` : ''}`,
      });
    }
    return res.json(normalizeOrder(rows[0]));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not update the order.' });
  }
});

initDb()
  .then(() => app.listen(port, '0.0.0.0', () => console.log(`Lab Supplies API listening on ${port}`)))
  .catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });
