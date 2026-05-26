CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  provider text NOT NULL DEFAULT 'email',
  role text NOT NULL DEFAULT 'clinic',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clinics (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  clinic_name text NOT NULL,
  phone text,
  address text,
  city text,
  state text,
  zip_code text,
  account_status text NOT NULL DEFAULT 'Active',
  last_order_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_name text NOT NULL,
  product_code text NOT NULL UNIQUE,
  description text,
  category text NOT NULL DEFAULT 'General',
  price numeric(10,2) NOT NULL DEFAULT 0,
  stock_quantity integer NOT NULL DEFAULT 0,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clinic_id uuid REFERENCES clinics(id) ON DELETE SET NULL,
  order_number text NOT NULL UNIQUE,
  order_status text NOT NULL DEFAULT 'Pending',
  delivery_address text,
  delivery_city text,
  delivery_state text,
  delivery_zip text,
  delivery_method text,
  special_instructions text,
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  shipping_cost numeric(10,2) NOT NULL DEFAULT 0,
  total_cost numeric(10,2) NOT NULL DEFAULT 0,
  estimated_delivery_date date,
  order_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  clinic_email text NOT NULL,
  clinic_name text NOT NULL,
  invitation_message text,
  invitation_status text NOT NULL DEFAULT 'Sent',
  token text UNIQUE NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);
