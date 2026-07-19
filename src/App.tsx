import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import './portal-refinement.css';

type Role = 'admin' | 'clinic_user';
type Mode = 'admin' | 'clinic';

type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  clinic_id: string | null;
  clinic_name?: string | null;
  last_login_at?: string | null;
  created_at: string;
};

type Clinic = {
  id: string;
  clinic_name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  account_status: string;
  last_order_date?: string | null;
  user_count?: number;
  order_count?: number;
  assigned_product_count?: number;
};

type Product = {
  id: string;
  product_name: string;
  product_code: string;
  description?: string | null;
  category: string;
  unit_label: string;
  is_available?: boolean;
};

const PRODUCT_IMAGE_RULES: Array<{ image: string; codes?: string[]; aliases: string[] }> = [
  { image: 'lc-clinical-collection-kit.png', codes: ['LC-KIT', 'LABCORP-KIT'], aliases: ['lc clinical collection kit', 'labcorp clinical collection kit'] },
  { image: 'crl-clinical-collection-kit.png', codes: ['CRL-KIT'], aliases: ['crl clinical collection kit', 'clinical reference laboratory collection kit'] },
  { image: 'fedex-shipping-envelope.png', codes: ['SHIP-PAK', 'FEDEX-ENVELOPE'], aliases: ['fedex shipping envelope', 'clinical shipping pak'] },
  { image: 'lithium-heparin-green-top.png', codes: ['TUBE-GREEN', 'TUBE-HEPARIN'], aliases: ['lithium heparin green top', 'green-top tube', 'lithium heparin tube'] },
  { image: 'edta-lavender-top.png', codes: ['TUBE-EDTA'], aliases: ['edta lavender-top', 'lavender-top tube', 'edta tube'] },
  { image: 'plain-serum-red-top.png', codes: ['TUBE-RED'], aliases: ['plain serum red top', 'red-top tube', 'plain serum tube'] },
  { image: 'sodium-citrate-light-blue-top.png', codes: ['TUBE-CITRATE', 'TUBE-LIGHT-BLUE'], aliases: ['sodium citrate light blue top', 'light-blue-top tube', 'sodium citrate tube'] },
  { image: 'tiger-top-sst.png', codes: ['TUBE-TIGER'], aliases: ['tiger top sst', 'tiger-top tube'] },
  { image: 'gold-sst.png', codes: ['TUBE-SST', 'TUBE-GOLD'], aliases: ['sst gold-top', 'gold sst', 'gold-top tube'] },
  { image: 'royal-blue-trace-element.png', codes: ['TUBE-ROYAL-BLUE', 'TUBE-TRACE'], aliases: ['royal blue trace element', 'royal-blue-top tube', 'trace element tube'] },
  { image: 'exempt-specimen-box.png', codes: ['EXEMPT-BOX', 'SPECIMEN-BOX'], aliases: ['exempt specimen box', 'exempt human specimen box', 'specimen shipping box'] },
  { image: 'fedex-shipping-label.png', codes: ['FEDEX-LABEL', 'SHIP-LABEL'], aliases: ['fedex shipping label'] },
  { image: 'biohazard-bag.png', codes: ['BIO-BAG'], aliases: ['biohazard specimen bag', 'biohazard bag'] },
  { image: 'lc-split-urine-cup.png', codes: ['LC-CUP', 'LABCORP-CUP'], aliases: ['lc split urine cup', 'labcorp split urine cup', 'labcorp drug screen collection cup'] },
  { image: 'crl-split-urine-cup.png', codes: ['CRL-CUP'], aliases: ['crl split urine cup', 'crl drug screen collection cup'] },
  { image: 'lc-chain-of-custody.png', codes: ['LC-CCF', 'LABCORP-CCF'], aliases: ['lc chain of custody', 'labcorp chain of custody'] },
  { image: 'crl-chain-of-custody.png', codes: ['CRL-CCF'], aliases: ['crl chain of custody'] },
  { image: 'lc-lab-requisition.png', codes: ['LC-REQ', 'LABCORP-REQ'], aliases: ['lc lab requisition', 'labcorp requisition'] },
  { image: 'crl-lab-requisition.png', codes: ['CRL-REQ'], aliases: ['crl lab requisition'] },
];

function getProductImage(product: Product): string | null {
  const code = product.product_code.trim().toUpperCase();
  const name = product.product_name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const rule = PRODUCT_IMAGE_RULES.find((candidate) =>
    candidate.codes?.includes(code) ||
    candidate.aliases.some((alias) => name.includes(alias))
  );
  return rule ? `/${rule.image}` : null;
}

type OrderItem = {
  product_id: string;
  product_name: string;
  product_code: string;
  category?: string;
  unit_label?: string;
  quantity: number;
};

type Order = {
  id: string;
  clinic_id: string;
  clinic_name?: string | null;
  clinic_email?: string | null;
  submitted_by_name?: string | null;
  order_number: string;
  order_status: string;
  requested_by?: string | null;
  needed_by?: string | null;
  tracking_number?: string | null;
  special_instructions?: string | null;
  order_items: OrderItem[];
  created_at: string;
};

type Session = { token: string; user: User; clinic: Clinic | null; mode: Mode };
type IconName = 'dashboard' | 'orders' | 'clinics' | 'users' | 'logout' | 'plus' | 'key' | 'copy' | 'box' | 'truck' | 'settings';

type ClinicProductAssignment = {
  clinic_id: string;
  product_ids: string[];
};

const MODE: Mode = import.meta.env.VITE_APP_MODE === 'admin' ? 'admin' : 'clinic';
const CLINIC_APP_URL = String(import.meta.env.VITE_CLINIC_APP_URL || 'https://lab-supplies-order.onrender.com').replace(/\/$/, '');
const API_BASE = import.meta.env.DEV ? '/api' : '';
const STORAGE_KEY = `occu_med_lab_${MODE}_session`;
const LOGO_URL = 'https://raw.githubusercontent.com/Occumed79/Service-Map-Atlas/main/artifacts/occu-med/public/occu-med-logo.png';

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'The request could not be completed.');
  return payload as T;
}

function loadSession(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as Session | null;
  } catch {
    return null;
  }
}

function saveSession(session: Session | null) {
  if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else localStorage.removeItem(STORAGE_KEY);
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value.includes('T') ? value : `${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Never' : date.toLocaleString();
}

function generatePassword() {
  const groups = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%&*'];
  const all = groups.join('');
  const values = new Uint32Array(16);
  crypto.getRandomValues(values);
  const characters = groups.map((group, index) => group[values[index] % group.length]);
  for (let index = groups.length; index < values.length; index += 1) characters.push(all[values[index] % all.length]);
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = values[index] % (index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }
  return characters.join('');
}

function Icon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  const paths: Record<IconName, ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    orders: <><path d="M7 4h10l2 3v13H5V7l2-3Z"/><path d="M8 4v4h8V4M8 12h8M8 16h6"/></>,
    clinics: <><path d="M4 21V7l8-4 8 4v14"/><path d="M9 21v-5h6v5M9 9h1M14 9h1M9 12h1M14 12h1"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    key: <><circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M15 8l2 2M17 6l2 2"/></>,
    copy: <><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>,
    box: <><path d="m21 8-9 5-9-5 9-5 9 5Z"/><path d="m3 8 9 5 9-5M12 13v9M3 8v9l9 5 9-5V8"/></>,
    truck: <><path d="M10 17h4V5H2v12h3M14 9h4l4 4v4h-3"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V20.3h-3v-.08a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 7.02 15a1.7 1.7 0 0 0-1.56-1.03H5.4v-3h.06A1.7 1.7 0 0 0 7.02 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.12-2.12.06.06A1.7 1.7 0 0 0 10.68 5a1.7 1.7 0 0 0 1.03-1.56V3.3h3v.14A1.7 1.7 0 0 0 15.74 5a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.12 2.12-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.56 1.03h.14v3h-.14A1.7 1.7 0 0 0 19.4 15Z"/></>,
  };
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Logo({ compact = false }: { compact?: boolean }) {
  return <img src={LOGO_URL} alt="Occu-Med" className={`logo-img mx-auto ${compact ? 'max-w-[180px]' : 'max-w-[280px]'}`} />;
}

function Alert({ type, children }: { type: 'error' | 'success'; children?: ReactNode }) {
  if (!children) return null;
  return <div className={type === 'error' ? 'alert-error' : 'alert-success'}>{children}</div>;
}

function Modal({ title, description, children, onClose, wide = false }: { title: string; description?: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <div className={`glass-card ring-card modal-panel ${wide ? 'modal-panel-wide' : ''}`}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div><h2 className="text-xl font-bold">{title}</h2>{description && <p className="mt-1 text-sm text-slate-500">{description}</p>}</div>
        <button className="secondary-button !min-h-0 !px-3 !py-1.5" onClick={onClose} type="button">Close</button>
      </div>
      {children}
    </div>
  </div>;
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${status.toLowerCase()}`}>{status}</span>;
}

function Login({ onLogin }: { onLogin: (session: Session) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await request<Session>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      onLogin(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return <div className="portal-bg flex min-h-screen items-center justify-center p-4">
    <div className="glass-card ring-card w-full max-w-[430px] rounded-[28px] p-7 md:p-9">
      <Logo />
      <div className="mt-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{MODE === 'admin' ? 'Lab Supply Administration' : 'Lab Supply Portal'}</h1>
        <p className="mt-2 text-sm leading-5 text-slate-500">{MODE === 'admin' ? 'Authorized access to clinic accounts, credentials, and fulfillment.' : 'Sign in to request laboratory supplies and track fulfillment.'}</p>
      </div>
      <form onSubmit={submit} className="mt-7 space-y-4">
        <Alert type="error">{error}</Alert>
        <label className="block"><span className="mb-1.5 block text-sm font-semibold">Email</span><input className="field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
        <label className="block"><span className="mb-1.5 block text-sm font-semibold">Password</span><input className="field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" /></label>
        <button className="primary-button mt-2 w-full" disabled={loading}>{loading ? 'Opening portal…' : MODE === 'admin' ? 'Open Admin Panel' : 'Open Clinic Portal'}</button>
      </form>
    </div>
  </div>;
}

function MetricCard({ icon, label, value }: { icon: IconName; label: string; value: number | string }) {
  return <div className="glass-card ring-card rounded-2xl p-5"><div className="flex items-center gap-4"><span className="icon-box"><Icon name={icon} /></span><div><p className="text-sm text-slate-500">{label}</p><p className="text-2xl font-bold">{value}</p></div></div></div>;
}

function AdminShell({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [page, setPage] = useState<'dashboard' | 'requests' | 'clinics' | 'users'>('dashboard');
  const [orders, setOrders] = useState<Order[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [orderData, clinicData, userData, productData] = await Promise.all([
        request<Order[]>('/orders', {}, session.token),
        request<Clinic[]>('/admin/clinics', {}, session.token),
        request<User[]>('/admin/users', {}, session.token),
        request<Product[]>('/admin/products', {}, session.token),
      ]);
      setOrders(orderData);
      setClinics(clinicData);
      setUsers(userData);
      setProducts(productData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin data could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const nav: Array<{ id: typeof page; label: string; icon: IconName }> = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'requests', label: 'Lab Requests', icon: 'orders' },
    { id: 'clinics', label: 'Clinics', icon: 'clinics' },
    { id: 'users', label: 'Clinic Users', icon: 'users' },
  ];

  return <div className="portal-bg min-h-screen md:flex">
    <aside className="sidebar-shell flex w-full shrink-0 flex-col p-4 md:min-h-screen md:w-64">
      <div className="px-3 pb-3 pt-1 text-center"><Logo compact /><p className="mt-3 text-[11px] font-bold uppercase tracking-[.2em] text-slate-500">Lab Administration</p></div>
      <nav className="mt-2 flex gap-1 overflow-x-auto md:flex-1 md:flex-col md:overflow-visible">
        {nav.map((item) => <button key={item.id} className={`nav-button min-w-max md:min-w-0 ${page === item.id ? 'active' : ''}`} onClick={() => setPage(item.id)}><Icon name={item.icon} /><span className="text-sm font-semibold">{item.label}</span></button>)}
      </nav>
      <div className="mt-4 border-t border-slate-200/70 pt-4">
        <div className="px-3 pb-3"><p className="text-sm font-bold">{session.user.name}</p><p className="break-all text-xs text-slate-500">{session.user.email}</p></div>
        <button className="nav-button !text-red-500" onClick={onLogout}><Icon name="logout" /><span className="text-sm font-semibold">Sign Out</span></button>
      </div>
    </aside>
    <main className="min-w-0 flex-1 p-4 md:p-8"><div className="mx-auto max-w-7xl"><Alert type="error">{error}</Alert>
      {page === 'dashboard' && <AdminDashboard orders={orders} clinics={clinics} users={users} loading={loading} />}
      {page === 'requests' && <AdminRequests orders={orders} loading={loading} token={session.token} onRefresh={load} />}
      {page === 'clinics' && <AdminClinics clinics={clinics} products={products} loading={loading} token={session.token} onRefresh={load} />}
      {page === 'users' && <AdminUsers users={users} clinics={clinics} loading={loading} token={session.token} onRefresh={load} />}
    </div></main>
  </div>;
}

function AdminDashboard({ orders, clinics, users, loading }: { orders: Order[]; clinics: Clinic[]; users: User[]; loading: boolean }) {
  const open = orders.filter((order) => !['Delivered', 'Cancelled'].includes(order.order_status)).length;
  const pending = orders.filter((order) => order.order_status === 'Pending').length;
  return <div>
    <h1 className="text-3xl font-bold tracking-tight">Lab Supply Command Center</h1>
    <p className="mt-1 text-sm text-slate-500">Monitor clinic access, incoming requests, and fulfillment status.</p>
    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard icon="clinics" label="Total Clinics" value={loading ? '—' : clinics.length} />
      <MetricCard icon="users" label="Clinic Users" value={loading ? '—' : users.length} />
      <MetricCard icon="orders" label="Open Requests" value={loading ? '—' : open} />
      <MetricCard icon="box" label="Awaiting Review" value={loading ? '—' : pending} />
    </div>
    <div className="glass-card ring-card mt-6 rounded-2xl p-6"><h2 className="text-lg font-bold">Recent lab requests</h2><div className="mt-4"><RequestSummary orders={orders.slice(0, 6)} loading={loading} /></div></div>
  </div>;
}

function RequestSummary({ orders, loading }: { orders: Order[]; loading: boolean }) {
  if (loading) return <p className="py-8 text-center text-sm text-slate-500">Loading requests…</p>;
  if (!orders.length) return <p className="py-8 text-center text-sm text-slate-500">No lab supply requests yet.</p>;
  return <div className="divide-y divide-slate-200/20">{orders.map((order) => <div key={order.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-mono text-sm font-bold text-sky-300">{order.order_number}</p><p className="text-sm font-semibold">{order.clinic_name}</p><p className="text-xs text-slate-500">{formatDateTime(order.created_at)} · {order.order_items.length} item types</p></div><StatusBadge status={order.order_status} /></div>)}</div>;
}

function AdminRequests({ orders, loading, token, onRefresh }: { orders: Order[]; loading: boolean; token: string; onRefresh: () => Promise<void> }) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const filtered = orders.filter((order) => (statusFilter === 'All' || order.order_status === statusFilter) && `${order.order_number} ${order.clinic_name || ''}`.toLowerCase().includes(query.toLowerCase()));
  return <div>
    <h1 className="text-3xl font-bold tracking-tight">Lab Supply Requests</h1><p className="mt-1 text-sm text-slate-500">Review clinic orders, update fulfillment, and add shipment tracking.</p>
    <div className="glass-card ring-card mt-6 rounded-2xl overflow-hidden"><div className="grid gap-3 border-b border-slate-200/20 p-4 md:grid-cols-[1fr_220px]"><input className="field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search request or clinic"/><select className="field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>{['All', 'Pending', 'Approved', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map((status) => <option key={status}>{status}</option>)}</select></div>
      {loading ? <p className="p-10 text-center text-sm text-slate-500">Loading requests…</p> : !filtered.length ? <p className="p-10 text-center text-sm text-slate-500">No matching requests.</p> : <div className="space-y-3 p-3">{filtered.map((order) => <AdminRequestRow key={order.id} order={order} token={token} onRefresh={onRefresh} />)}</div>}
    </div>
  </div>;
}

function AdminRequestRow({ order, token, onRefresh }: { order: Order; token: string; onRefresh: () => Promise<void> }) {
  const [status, setStatus] = useState(order.order_status);
  const [tracking, setTracking] = useState(order.tracking_number || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true); setError('');
    try {
      await request(`/admin/orders/${order.id}`, { method: 'PATCH', body: JSON.stringify({ order_status: status, tracking_number: tracking }) }, token);
      await onRefresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Request update failed.'); }
    finally { setSaving(false); }
  };
  return <article className="ring-card inner-card rounded-2xl p-5"><Alert type="error">{error}</Alert><div className="grid gap-5 xl:grid-cols-[1fr_340px]"><div><div className="flex flex-wrap items-center gap-3"><span className="font-mono text-sm font-bold text-sky-300">{order.order_number}</span><StatusBadge status={order.order_status}/></div><h3 className="mt-2 text-lg font-bold">{order.clinic_name}</h3><p className="text-sm text-slate-500">Submitted {formatDateTime(order.created_at)}{order.submitted_by_name ? ` by ${order.submitted_by_name}` : ''}{order.needed_by ? ` · Needed by ${formatDate(order.needed_by)}` : ''}</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{order.order_items.map((item) => <div key={item.product_id} className="sub-card rounded-xl px-3 py-2 text-sm"><strong>{item.quantity} {item.unit_label || 'unit(s)'}</strong> · {item.product_name}</div>)}</div>{order.special_instructions && <p className="sub-card mt-4 rounded-xl p-3 text-sm"><strong>Instructions:</strong> {order.special_instructions}</p>}</div><div className="sub-card rounded-2xl p-4"><label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Status</span><select className="field" value={status} onChange={(event) => setStatus(event.target.value)}>{['Pending', 'Approved', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map((value) => <option key={value}>{value}</option>)}</select></label><label className="mt-4 block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Tracking number</span><input className="field" value={tracking} onChange={(event) => setTracking(event.target.value)} placeholder="Add when shipped" /></label><button className="primary-button mt-4 w-full" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Update Request'}</button></div></div></article>;
}

function AdminClinics({ clinics, products, loading, token, onRefresh }: { clinics: Clinic[]; products: Product[]; loading: boolean; token: string; onRefresh: () => Promise<void> }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [manageClinic, setManageClinic] = useState<Clinic | null>(null);
  const filtered = clinics.filter((clinic) => `${clinic.clinic_name} ${clinic.city || ''} ${clinic.state || ''} ${clinic.email || ''}`.toLowerCase().includes(query.toLowerCase()));
  return <div><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-3xl font-bold tracking-tight">Clinic Management</h1><p className="mt-1 text-sm text-slate-500">Create clinics and control which lab items each clinic can request.</p></div><button className="primary-button flex items-center gap-2" onClick={() => setModalOpen(true)}><Icon name="plus" className="h-4 w-4"/> Add Clinic</button></div>
    <div className="glass-card ring-card mt-6 rounded-2xl overflow-hidden"><div className="border-b border-slate-200/20 p-4"><input className="field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search clinics"/></div>{loading ? <p className="p-10 text-center text-sm text-slate-500">Loading clinics…</p> : <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">{filtered.map((clinic) => <ClinicCard key={clinic.id} clinic={clinic} token={token} onRefresh={onRefresh} onManageProducts={() => setManageClinic(clinic)} />)}</div>}</div>
    {modalOpen && <CreateClinicModal token={token} onClose={() => setModalOpen(false)} onCreated={async () => { setModalOpen(false); await onRefresh(); }} />}
    {manageClinic && <ManageClinicProductsModal clinic={manageClinic} products={products} token={token} onClose={() => setManageClinic(null)} onSaved={onRefresh} />}
  </div>;
}

function ClinicCard({ clinic, token, onRefresh, onManageProducts }: { clinic: Clinic; token: string; onRefresh: () => Promise<void>; onManageProducts: () => void }) {
  const [saving, setSaving] = useState(false);
  const toggle = async () => { setSaving(true); try { await request(`/admin/clinics/${clinic.id}`, { method: 'PATCH', body: JSON.stringify({ ...clinic, account_status: clinic.account_status === 'Active' ? 'Inactive' : 'Active' }) }, token); await onRefresh(); } finally { setSaving(false); } };
  return <div className="ring-card inner-card rounded-2xl p-5"><div className="flex items-start justify-between gap-3"><h3 className="font-bold">{clinic.clinic_name}</h3><StatusBadge status={clinic.account_status}/></div><div className="mt-3 space-y-1 text-sm text-slate-500"><p>{clinic.contact_name || 'No contact listed'}</p><p>{clinic.email || 'No email listed'}</p><p>{clinic.phone || 'No phone listed'}</p><p>{clinic.address || 'No address listed'}<br/>{clinic.city}, {clinic.state} {clinic.zip_code}</p></div><div className="mt-4 border-t border-slate-200/20 pt-3 text-xs text-slate-500"><span>{clinic.user_count || 0} users · {clinic.order_count || 0} requests · {clinic.assigned_product_count || 0} lab items</span><div className="mt-3 flex flex-wrap gap-2"><button className="secondary-button flex items-center gap-2 !min-h-0 !px-3 !py-1.5" onClick={onManageProducts}><Icon name="settings" className="h-4 w-4"/> Manage Lab Items</button><button className="secondary-button !min-h-0 !px-3 !py-1.5" onClick={toggle} disabled={saving}>{clinic.account_status === 'Active' ? 'Deactivate' : 'Activate'}</button></div></div></div>;
}

function ManageClinicProductsModal({ clinic, products, token, onClose, onSaved }: { clinic: Clinic; products: Product[]; token: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let active = true;
    request<ClinicProductAssignment>(`/admin/clinics/${clinic.id}/products`, {}, token)
      .then((result) => { if (active) setSelected(new Set(result.product_ids)); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'Could not load assigned lab items.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [clinic.id, token]);

  const available = products.filter((product) => product.is_available !== false);
  const visible = products.filter((product) => `${product.product_name} ${product.product_code} ${product.category}`.toLowerCase().includes(query.toLowerCase()));
  const toggle = (productId: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(productId)) next.delete(productId); else next.add(productId);
    return next;
  });
  const save = async () => {
    setSaving(true); setError('');
    try {
      await request<ClinicProductAssignment>(`/admin/clinics/${clinic.id}/products`, { method: 'PUT', body: JSON.stringify({ product_ids: Array.from(selected) }) }, token);
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save clinic lab items.');
    } finally {
      setSaving(false);
    }
  };

  return <Modal title={`Manage lab items — ${clinic.clinic_name}`} description="Only selected items will appear in this clinic’s ordering portal." onClose={onClose} wide>
    <Alert type="error">{error}</Alert>
    <div className="mb-4 flex flex-col gap-3 sm:flex-row"><input className="field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search product, code, or category"/><div className="flex shrink-0 gap-2"><button type="button" className="secondary-button" onClick={() => setSelected(new Set(available.map((product) => product.id)))}>Select All</button><button type="button" className="secondary-button" onClick={() => setSelected(new Set<string>())}>Clear All</button></div></div>
    {loading ? <p className="py-10 text-center text-sm text-slate-500">Loading clinic assignments…</p> : <div className="product-assignment-list grid max-h-[52vh] gap-3 overflow-y-auto pr-1 md:grid-cols-2">{visible.map((product) => {
      const disabled = product.is_available === false;
      const checked = selected.has(product.id);
      return <label key={product.id} className={`ring-card assignment-card rounded-xl p-4 ${checked ? 'ring-selected' : ''} ${disabled ? 'opacity-50' : ''}`}>
        <div className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-4 w-4" checked={checked} disabled={disabled} onChange={() => toggle(product.id)} /><div><div className="flex flex-wrap items-center gap-2"><strong>{product.product_name}</strong>{disabled && <span className="badge inactive">Globally disabled</span>}</div><p className="mt-1 font-mono text-xs text-sky-300">{product.product_code}</p><p className="mt-1 text-xs text-slate-500">{product.category} · {product.unit_label}</p></div></div>
      </label>;
    })}</div>}
    <div className="mt-5 flex items-center justify-between gap-4 border-t border-slate-200/20 pt-4"><p className="text-sm text-slate-500"><strong className="text-white">{selected.size}</strong> items assigned</p><div className="flex gap-2"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="button" className="primary-button" onClick={save} disabled={saving || loading}>{saving ? 'Saving…' : 'Save Changes'}</button></div></div>
  </Modal>;
}

function CreateClinicModal({ token, onClose, onCreated }: { token: string; onClose: () => void; onCreated: () => Promise<void> }) {
  const [form, setForm] = useState({ clinic_name: '', contact_name: '', email: '', phone: '', address: '', city: '', state: '', zip_code: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); setError(''); try { await request('/admin/clinics', { method: 'POST', body: JSON.stringify(form) }, token); await onCreated(); } catch (err) { setError(err instanceof Error ? err.message : 'Clinic creation failed.'); } finally { setSaving(false); } };
  return <Modal title="Add clinic" description="Create the clinic record, then use Manage Lab Items to choose its catalog." onClose={onClose}><form onSubmit={submit} className="grid gap-4 md:grid-cols-2"><div className="md:col-span-2"><Alert type="error">{error}</Alert></div>{Object.entries(form).map(([key, value]) => <label key={key} className={key === 'address' ? 'md:col-span-2' : ''}><span className="mb-1.5 block text-sm font-semibold">{key.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())}</span><input className="field" value={value} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} required={key === 'clinic_name'} /></label>)}<button className="primary-button md:col-span-2" disabled={saving}>{saving ? 'Creating…' : 'Create Clinic'}</button></form></Modal>;
}

function AdminUsers({ users, clinics, loading, token, onRefresh }: { users: User[]; clinics: Clinic[]; loading: boolean; token: string; onRefresh: () => Promise<void> }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [resetUser, setResetUser] = useState<User | null>(null);
  return <div><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-3xl font-bold tracking-tight">Clinic User Management</h1><p className="mt-1 text-sm text-slate-500">Generate credentials and attach multiple users to each clinic.</p></div><button className="primary-button flex items-center gap-2" onClick={() => setCreateOpen(true)} disabled={!clinics.length}><Icon name="plus" className="h-4 w-4"/> Create Clinic Login</button></div>
    <div className="glass-card ring-card mt-6 rounded-2xl overflow-hidden">{loading ? <p className="p-10 text-center text-sm text-slate-500">Loading users…</p> : !users.length ? <p className="p-10 text-center text-sm text-slate-500">No clinic users found.</p> : <div className="overflow-x-auto"><table className="table-shell min-w-[820px]"><thead><tr><th>User</th><th>Clinic</th><th>Status</th><th>Last login</th><th className="text-right">Actions</th></tr></thead><tbody>{users.map((user) => <UserRow key={user.id} user={user} token={token} onReset={() => setResetUser(user)} onRefresh={onRefresh} />)}</tbody></table></div>}</div>
    {createOpen && <CreateUserModal clinics={clinics} token={token} onClose={() => setCreateOpen(false)} onCreated={onRefresh} />}
    {resetUser && <ResetPasswordModal user={resetUser} token={token} onClose={() => setResetUser(null)} onSaved={onRefresh} />}
  </div>;
}

function UserRow({ user, token, onReset, onRefresh }: { user: User; token: string; onReset: () => void; onRefresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const toggle = async () => { setBusy(true); try { await request(`/admin/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ active: !user.active }) }, token); await onRefresh(); } finally { setBusy(false); } };
  const remove = async () => { if (!window.confirm(`Delete ${user.name}?`)) return; setBusy(true); try { await request(`/admin/users/${user.id}`, { method: 'DELETE' }, token); await onRefresh(); } finally { setBusy(false); } };
  return <tr><td><div className="font-semibold">{user.name}</div><div className="text-xs text-slate-500">{user.email}</div></td><td>{user.clinic_name || '—'}</td><td><button className={`toggle ${user.active ? 'on' : ''}`} onClick={toggle} disabled={busy} aria-label={user.active ? 'Deactivate user' : 'Activate user'}><span /></button></td><td className="text-sm text-slate-500">{formatDateTime(user.last_login_at)}</td><td><div className="flex justify-end gap-2"><button className="secondary-button !min-h-0 !px-3 !py-2" title="Reset password" onClick={onReset}><Icon name="key" className="h-4 w-4"/></button><button className="danger-button !min-h-0 !px-3 !py-2" onClick={remove} disabled={busy}>Delete</button></div></td></tr>;
}

type CredentialHandoff = { name: string; email: string; password: string; clinicName: string };
function CreateUserModal({ clinics, token, onClose, onCreated }: { clinics: Clinic[]; token: string; onClose: () => void; onCreated: () => Promise<void> }) {
  const [form, setForm] = useState({ name: '', email: '', password: generatePassword(), clinic_id: clinics[0]?.id || '' });
  const [handoff, setHandoff] = useState<CredentialHandoff | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const create = async (event: FormEvent) => { event.preventDefault(); setSaving(true); setError(''); try { const created = await request<User>('/admin/users', { method: 'POST', body: JSON.stringify(form) }, token); const clinicName = clinics.find((clinic) => clinic.id === created.clinic_id)?.clinic_name || created.clinic_name || ''; setHandoff({ name: created.name, email: created.email, password: form.password, clinicName }); await onCreated(); } catch (err) { setError(err instanceof Error ? err.message : 'User creation failed.'); } finally { setSaving(false); } };
  const copy = async () => { if (!handoff) return; await navigator.clipboard.writeText(`Occu-Med Lab Supply Portal\nPortal: ${CLINIC_APP_URL}\nClinic: ${handoff.clinicName}\nUsername: ${handoff.email}\nTemporary password: ${handoff.password}`); };
  return <Modal title="Create clinic login" description="Generate credentials and attach the account to a clinic." onClose={onClose}>{handoff ? <div className="space-y-4"><div className="ring-card credential-card rounded-2xl p-4 text-sm space-y-2"><p><span className="text-slate-500">Portal:</span> <strong>{CLINIC_APP_URL}</strong></p><p><span className="text-slate-500">Clinic:</span> <strong>{handoff.clinicName}</strong></p><p><span className="text-slate-500">Username:</span> <strong>{handoff.email}</strong></p><p><span className="text-slate-500">Password:</span> <strong className="font-mono">{handoff.password}</strong></p></div><p className="text-xs text-slate-500">This is the only point where the plain-text password is available. Copy it now.</p><button className="secondary-button flex w-full items-center justify-center gap-2" onClick={() => void copy()}><Icon name="copy" className="h-4 w-4"/> Copy Credentials</button><button className="primary-button w-full" onClick={onClose}>Done</button></div> : <form onSubmit={create} className="grid gap-4 md:grid-cols-2"><div className="md:col-span-2"><Alert type="error">{error}</Alert></div><label><span className="mb-1.5 block text-sm font-semibold">Full name</span><input className="field" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required /></label><label><span className="mb-1.5 block text-sm font-semibold">Email / username</span><input className="field" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required /></label><label className="md:col-span-2"><span className="mb-1.5 block text-sm font-semibold">Clinic</span><select className="field" value={form.clinic_id} onChange={(event) => setForm((current) => ({ ...current, clinic_id: event.target.value }))} required>{clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.clinic_name}</option>)}</select></label><label className="md:col-span-2"><span className="mb-1.5 block text-sm font-semibold">Temporary password</span><div className="flex gap-2"><input className="field font-mono" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required /><button type="button" className="secondary-button shrink-0" onClick={() => setForm((current) => ({ ...current, password: generatePassword() }))}>Generate</button></div></label><button className="primary-button md:col-span-2" disabled={saving}>{saving ? 'Creating…' : 'Create Account and Show Credentials'}</button></form>}</Modal>;
}

function ResetPasswordModal({ user, token, onClose, onSaved }: { user: User; token: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [password, setPassword] = useState(generatePassword());
  const [savedPassword, setSavedPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); setError(''); try { await request(`/admin/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ password }) }, token); setSavedPassword(password); await onSaved(); } catch (err) { setError(err instanceof Error ? err.message : 'Password reset failed.'); } finally { setSaving(false); } };
  const copy = async () => navigator.clipboard.writeText(`Occu-Med Lab Supply Portal\nPortal: ${CLINIC_APP_URL}\nUsername: ${user.email}\nTemporary password: ${savedPassword}`);
  return <Modal title={`Reset password for ${user.name}`} description="The previous password cannot be viewed. The new password immediately replaces it." onClose={onClose}><Alert type="error">{error}</Alert>{savedPassword ? <div className="space-y-4"><div className="ring-card credential-card rounded-2xl p-4 text-sm"><p>Username: <strong>{user.email}</strong></p><p className="mt-2">New password: <strong className="font-mono">{savedPassword}</strong></p></div><button className="secondary-button flex w-full items-center justify-center gap-2" onClick={() => void copy()}><Icon name="copy" className="h-4 w-4"/> Copy Credentials</button><button className="primary-button w-full" onClick={onClose}>Done</button></div> : <div className="space-y-4"><label className="block"><span className="mb-1.5 block text-sm font-semibold">New password</span><div className="flex gap-2"><input className="field font-mono" value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" className="secondary-button" onClick={() => setPassword(generatePassword())}>Generate</button></div></label><button className="primary-button w-full" onClick={save} disabled={saving || password.length < 8}>{saving ? 'Saving…' : 'Save New Password'}</button></div>}</Modal>;
}

function ClinicShell({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clinic, setClinic] = useState<Clinic | null>(session.clinic);
  const [view, setView] = useState<'request' | 'history'>('request');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => { setLoading(true); setError(''); try { const [orderData, productData, clinicData] = await Promise.all([request<Order[]>('/orders', {}, session.token), request<Product[]>('/products', {}, session.token), request<Clinic>('/clinic/profile', {}, session.token)]); setOrders(orderData); setProducts(productData); setClinic(clinicData); } catch (err) { setError(err instanceof Error ? err.message : 'Clinic portal could not be loaded.'); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);

  return <div className="portal-bg min-h-screen"><header className="border-b border-slate-200/20 bg-white/5 backdrop-blur-2xl"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8"><div className="flex items-center gap-4"><Logo compact /><div className="hidden border-l border-slate-200/20 pl-4 sm:block"><p className="font-bold">Lab Supply Portal</p><p className="text-xs text-slate-500">{clinic?.clinic_name}</p></div></div><div className="flex items-center gap-3"><div className="hidden text-right sm:block"><p className="text-sm font-bold">{session.user.name}</p><p className="text-xs text-slate-500">{session.user.email}</p></div><button className="secondary-button flex items-center gap-2" onClick={onLogout}><Icon name="logout" className="h-4 w-4"/> Sign Out</button></div></div></header>
    <main className="mx-auto max-w-7xl px-4 py-6 md:px-8"><Alert type="error">{error}</Alert><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-3xl font-bold tracking-tight">{clinic?.clinic_name || 'Clinic Portal'}</h1><p className="mt-1 text-sm text-slate-500">Request laboratory supplies and track Occu-Med fulfillment.</p></div><div className="glass-card ring-card flex rounded-xl p-1"><button className={`rounded-lg px-4 py-2 text-sm font-bold ${view === 'request' ? 'bg-sky-700 text-white' : 'text-slate-400'}`} onClick={() => setView('request')}>New Request</button><button className={`rounded-lg px-4 py-2 text-sm font-bold ${view === 'history' ? 'bg-sky-700 text-white' : 'text-slate-400'}`} onClick={() => setView('history')}>Request History</button></div></div>
      {view === 'request' ? <ClinicOrderForm products={products} clinic={clinic} token={session.token} loading={loading} onCreated={async () => { await load(); setView('history'); }} /> : <ClinicHistory orders={orders} loading={loading} />}
    </main>
  </div>;
}

function ClinicOrderForm({ products, clinic, token, loading, onCreated }: { products: Product[]; clinic: Clinic | null; token: string; loading: boolean; onCreated: () => Promise<void> }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [neededBy, setNeededBy] = useState('');
  const [instructions, setInstructions] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const categories = useMemo(() => ['All', ...Array.from(new Set(products.map((product) => product.category)))], [products]);
  const visible = products.filter((product) => (category === 'All' || product.category === category) && `${product.product_name} ${product.product_code}`.toLowerCase().includes(search.toLowerCase()));
  const selected = (Object.entries(quantities) as Array<[string, number]>).filter(([, quantity]) => quantity > 0);
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(''); setSuccess(''); if (!selected.length) return setError('Select at least one supply item.'); setSubmitting(true); try { const order = await request<Order>('/orders', { method: 'POST', body: JSON.stringify({ items: selected.map(([product_id, quantity]) => ({ product_id, quantity })), needed_by: neededBy || null, special_instructions: instructions }) }, token); setSuccess(`Request ${order.order_number} was submitted.`); setQuantities({}); setNeededBy(''); setInstructions(''); await onCreated(); } catch (err) { setError(err instanceof Error ? err.message : 'Request could not be submitted.'); } finally { setSubmitting(false); } };
  return <form onSubmit={submit} className="mt-6 grid gap-6 xl:grid-cols-[1fr_330px]"><div className="glass-card ring-card rounded-2xl overflow-hidden"><div className="grid gap-3 border-b border-slate-200/20 p-4 md:grid-cols-[1fr_220px]"><input className="field" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search supplies or item code"/><select className="field" value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((value) => <option key={value}>{value}</option>)}</select></div>{loading ? <p className="p-10 text-center text-sm text-slate-500">Loading supplies…</p> : !products.length ? <div className="p-10 text-center"><p className="font-semibold">No lab items are assigned to this clinic.</p><p className="mt-2 text-sm text-slate-500">Please contact Occu-Med to update the clinic catalog.</p></div> : <div className="grid gap-4 p-5 md:grid-cols-2">{visible.map((product) => { const isSelected = (quantities[product.id] || 0) > 0; const productImage = getProductImage(product); return <div key={product.id} className={`ring-card supply-card rounded-2xl p-4 ${isSelected ? 'ring-selected' : ''}`}>{productImage && <div className="mb-4 flex h-44 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5 p-3"><img src={productImage} alt={product.product_name} className="h-full w-full object-contain drop-shadow-lg" loading="lazy" /></div>}<div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-sky-300">{product.category}</p><h3 className="mt-1 font-bold">{product.product_name}</h3><p className="mt-1 font-mono text-xs text-slate-400">{product.product_code}</p></div><span className="badge processing">{product.unit_label}</span></div><p className="mt-3 min-h-10 text-sm leading-5 text-slate-500">{product.description}</p><div className="mt-4 flex items-center gap-2"><button type="button" className="secondary-button !h-10 !min-h-0 !w-10 !p-0" onClick={() => setQuantities((current) => ({ ...current, [product.id]: Math.max(0, (current[product.id] || 0) - 1) }))}>−</button><input className="field !w-20 text-center font-bold" type="number" min="0" value={quantities[product.id] || 0} onChange={(event) => setQuantities((current) => ({ ...current, [product.id]: Math.max(0, Number(event.target.value) || 0) }))}/><button type="button" className="secondary-button !h-10 !min-h-0 !w-10 !p-0" onClick={() => setQuantities((current) => ({ ...current, [product.id]: (current[product.id] || 0) + 1 }))}>+</button></div></div>; })}</div>}</div><div className="glass-card ring-card h-fit rounded-2xl p-5 xl:sticky xl:top-6"><h2 className="text-xl font-bold">Request details</h2><div className="mt-4 space-y-4"><Alert type="error">{error}</Alert><Alert type="success">{success}</Alert><div className="sub-card rounded-xl p-4 text-sm"><p className="text-slate-500">Shipping to</p><p className="mt-1 font-bold">{clinic?.clinic_name}</p><p className="mt-1 text-slate-500">{clinic?.address}<br/>{clinic?.city}, {clinic?.state} {clinic?.zip_code}</p></div><label className="block"><span className="mb-1.5 block text-sm font-semibold">Needed by</span><input className="field" type="date" value={neededBy} onChange={(event) => setNeededBy(event.target.value)} /></label><label className="block"><span className="mb-1.5 block text-sm font-semibold">Special instructions</span><textarea className="field" value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Urgency, kit preference, collection type, or delivery notes" /></label><div className="sub-card rounded-xl px-4 py-3 text-sm"><strong>{selected.length}</strong> supply item{selected.length === 1 ? '' : 's'} selected</div><button className="primary-button w-full" disabled={submitting || !selected.length}>{submitting ? 'Submitting…' : 'Submit to Occu-Med'}</button></div></div></form>;
}

function ClinicHistory({ orders, loading }: { orders: Order[]; loading: boolean }) {
  return <div className="glass-card ring-card mt-6 rounded-2xl overflow-hidden"><div className="border-b border-slate-200/20 p-5"><h2 className="text-xl font-bold">Request history</h2><p className="mt-1 text-sm text-slate-500">Live fulfillment status and shipment tracking.</p></div>{loading ? <p className="p-10 text-center text-sm text-slate-500">Loading requests…</p> : !orders.length ? <p className="p-10 text-center text-sm text-slate-500">No supply requests have been submitted.</p> : <div className="space-y-3 p-3">{orders.map((order) => <article key={order.id} className="ring-card inner-card rounded-2xl p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-3"><span className="font-mono text-sm font-bold text-sky-300">{order.order_number}</span><StatusBadge status={order.order_status}/></div><p className="mt-2 text-sm text-slate-500">Submitted {formatDateTime(order.created_at)}{order.needed_by ? ` · Needed by ${formatDate(order.needed_by)}` : ''}</p></div>{order.tracking_number && <div className="sub-card rounded-xl px-4 py-3 text-sm"><span className="text-slate-500">Tracking</span><p className="mt-1 font-mono font-bold text-sky-300">{order.tracking_number}</p></div>}</div><div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{order.order_items.map((item) => <div key={item.product_id} className="sub-card rounded-xl px-3 py-2 text-sm"><strong>{item.quantity} {item.unit_label || 'unit(s)'}</strong> · {item.product_name}</div>)}</div></article>)}</div>}</div>;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const login = (value: Session) => { saveSession(value); setSession(value); };
  const logout = () => { saveSession(null); setSession(null); };

  if (!session || session.mode !== MODE || (MODE === 'admin' && session.user.role !== 'admin') || (MODE === 'clinic' && session.user.role !== 'clinic_user')) return <Login onLogin={login} />;
  return MODE === 'admin' ? <AdminShell session={session} onLogout={logout} /> : <ClinicShell session={session} onLogout={logout} />;
}
