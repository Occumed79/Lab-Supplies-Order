import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';

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
};
type Product = {
  id: string;
  product_name: string;
  product_code: string;
  description?: string | null;
  category: string;
  unit_label: string;
};
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
type IconName = 'dashboard' | 'orders' | 'clinics' | 'users' | 'logout' | 'plus' | 'key' | 'copy' | 'box' | 'truck';

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

function Modal({ title, description, children, onClose }: { title: string; description?: string; children: ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <div className="glass-card modal-panel">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div><h2 className="text-xl font-bold text-[#183047]">{title}</h2>{description && <p className="mt-1 text-sm text-slate-500">{description}</p>}</div>
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
    <div className="glass-card w-full max-w-[430px] rounded-[28px] p-7 md:p-9">
      <Logo />
      <div className="mt-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-[#182d43]">{MODE === 'admin' ? 'Lab Supply Administration' : 'Lab Supply Portal'}</h1>
        <p className="mt-2 text-sm leading-5 text-slate-500">{MODE === 'admin' ? 'Authorized access to clinic accounts, credentials, and fulfillment.' : 'Sign in to request laboratory supplies and track fulfillment.'}</p>
      </div>
      <form onSubmit={submit} className="mt-7 space-y-4">
        <Alert type="error">{error}</Alert>
        <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-600">Email</span><input className="field" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
        <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-600">Password</span><input className="field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" /></label>
        <button className="primary-button mt-2 w-full" disabled={loading}>{loading ? 'Opening portal…' : MODE === 'admin' ? 'Open Admin Panel' : 'Open Clinic Portal'}</button>
      </form>
    </div>
  </div>;
}

function MetricCard({ icon, label, value }: { icon: IconName; label: string; value: number | string }) {
  return <div className="glass-card rounded-2xl p-5"><div className="flex items-center gap-4"><span className="icon-box"><Icon name={icon} /></span><div><p className="text-sm text-slate-500">{label}</p><p className="text-2xl font-bold text-[#183047]">{value}</p></div></div></div>;
}

function AdminShell({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [page, setPage] = useState<'dashboard' | 'requests' | 'clinics' | 'users'>('dashboard');
  const [orders, setOrders] = useState<Order[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [orderData, clinicData, userData] = await Promise.all([
        request<Order[]>('/orders', {}, session.token),
        request<Clinic[]>('/admin/clinics', {}, session.token),
        request<User[]>('/admin/users', {}, session.token),
      ]);
      setOrders(orderData);
      setClinics(clinicData);
      setUsers(userData);
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
        <div className="px-3 pb-3"><p className="text-sm font-bold text-[#183047]">{session.user.name}</p><p className="break-all text-xs text-slate-500">{session.user.email}</p></div>
        <button className="nav-button !text-red-500" onClick={onLogout}><Icon name="logout" /><span className="text-sm font-semibold">Sign Out</span></button>
      </div>
    </aside>
    <main className="min-w-0 flex-1 p-4 md:p-8"><div className="mx-auto max-w-7xl"><Alert type="error">{error}</Alert>
      {page === 'dashboard' && <AdminDashboard orders={orders} clinics={clinics} users={users} loading={loading} />}
      {page === 'requests' && <AdminRequests orders={orders} loading={loading} token={session.token} onRefresh={load} />}
      {page === 'clinics' && <AdminClinics clinics={clinics} loading={loading} token={session.token} onRefresh={load} />}
      {page === 'users' && <AdminUsers users={users} clinics={clinics} loading={loading} token={session.token} onRefresh={load} />}
    </div></main>
  </div>;
}

function AdminDashboard({ orders, clinics, users, loading }: { orders: Order[]; clinics: Clinic[]; users: User[]; loading: boolean }) {
  const open = orders.filter((order) => !['Delivered', 'Cancelled'].includes(order.order_status)).length;
  const pending = orders.filter((order) => order.order_status === 'Pending').length;
  return <div>
    <h1 className="text-3xl font-bold tracking-tight text-[#182d43]">Lab Supply Command Center</h1>
    <p className="mt-1 text-sm text-slate-500">Monitor clinic access, incoming requests, and fulfillment status.</p>
    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard icon="clinics" label="Total Clinics" value={loading ? '—' : clinics.length} />
      <MetricCard icon="users" label="Clinic Users" value={loading ? '—' : users.length} />
      <MetricCard icon="orders" label="Open Requests" value={loading ? '—' : open} />
      <MetricCard icon="box" label="Awaiting Review" value={loading ? '—' : pending} />
    </div>
    <div className="glass-card mt-6 rounded-2xl p-6"><h2 className="text-lg font-bold">Recent lab requests</h2><div className="mt-4"><RequestSummary orders={orders.slice(0, 6)} loading={loading} /></div></div>
  </div>;
}

function RequestSummary({ orders, loading }: { orders: Order[]; loading: boolean }) {
  if (loading) return <p className="py-8 text-center text-sm text-slate-500">Loading requests…</p>;
  if (!orders.length) return <p className="py-8 text-center text-sm text-slate-500">No lab supply requests yet.</p>;
  return <div className="divide-y divide-slate-200/70">{orders.map((order) => <div key={order.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-mono text-sm font-bold text-[#1c5f85]">{order.order_number}</p><p className="text-sm font-semibold">{order.clinic_name}</p><p className="text-xs text-slate-500">{formatDateTime(order.created_at)} · {order.order_items.length} item types</p></div><StatusBadge status={order.order_status} /></div>)}</div>;
}

function AdminRequests({ orders, loading, token, onRefresh }: { orders: Order[]; loading: boolean; token: string; onRefresh: () => Promise<void> }) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const filtered = orders.filter((order) => (statusFilter === 'All' || order.order_status === statusFilter) && `${order.order_number} ${order.clinic_name || ''}`.toLowerCase().includes(query.toLowerCase()));
  return <div>
    <h1 className="text-3xl font-bold tracking-tight">Lab Supply Requests</h1><p className="mt-1 text-sm text-slate-500">Review clinic orders, update fulfillment, and add shipment tracking.</p>
    <div className="glass-card mt-6 rounded-2xl overflow-hidden"><div className="grid gap-3 border-b border-slate-200/70 p-4 md:grid-cols-[1fr_220px]"><input className="field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search request or clinic"/><select className="field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>{['All', 'Pending', 'Approved', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map((status) => <option key={status}>{status}</option>)}</select></div>
      {loading ? <p className="p-10 text-center text-sm text-slate-500">Loading requests…</p> : !filtered.length ? <p className="p-10 text-center text-sm text-slate-500">No matching requests.</p> : <div className="divide-y divide-slate-200/70">{filtered.map((order) => <AdminRequestRow key={order.id} order={order} token={token} onRefresh={onRefresh} />)}</div>}
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
  return <article className="p-5"><Alert type="error">{error}</Alert><div className="grid gap-5 xl:grid-cols-[1fr_340px]"><div><div className="flex flex-wrap items-center gap-3"><span className="font-mono text-sm font-bold text-[#1c5f85]">{order.order_number}</span><StatusBadge status={order.order_status}/></div><h3 className="mt-2 text-lg font-bold">{order.clinic_name}</h3><p className="text-sm text-slate-500">Submitted {formatDateTime(order.created_at)}{order.submitted_by_name ? ` by ${order.submitted_by_name}` : ''}{order.needed_by ? ` · Needed by ${formatDate(order.needed_by)}` : ''}</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{order.order_items.map((item) => <div key={item.product_id} className="rounded-xl border border-slate-200/70 bg-white/55 px-3 py-2 text-sm"><strong>{item.quantity} {item.unit_label || 'unit(s)'}</strong> · {item.product_name}</div>)}</div>{order.special_instructions && <p className="mt-4 rounded-xl bg-slate-50/70 p-3 text-sm text-slate-600"><strong>Instructions:</strong> {order.special_instructions}</p>}</div><div className="rounded-2xl border border-slate-200/70 bg-white/48 p-4"><label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Status</span><select className="field" value={status} onChange={(event) => setStatus(event.target.value)}>{['Pending', 'Approved', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map((value) => <option key={value}>{value}</option>)}</select></label><label className="mt-4 block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">Tracking number</span><input className="field" value={tracking} onChange={(event) => setTracking(event.target.value)} placeholder="Add when shipped" /></label><button className="primary-button mt-4 w-full" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Update Request'}</button></div></div></article>;
}

function AdminClinics({ clinics, loading, token, onRefresh }: { clinics: Clinic[]; loading: boolean; token: string; onRefresh: () => Promise<void> }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = clinics.filter((clinic) => `${clinic.clinic_name} ${clinic.city || ''} ${clinic.state || ''} ${clinic.email || ''}`.toLowerCase().includes(query.toLowerCase()));
  return <div><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-3xl font-bold tracking-tight">Clinic Management</h1><p className="mt-1 text-sm text-slate-500">Create clinic accounts before generating user credentials.</p></div><button className="primary-button flex items-center gap-2" onClick={() => setModalOpen(true)}><Icon name="plus" className="h-4 w-4"/> Add Clinic</button></div>
    <div className="glass-card mt-6 rounded-2xl overflow-hidden"><div className="border-b border-slate-200/70 p-4"><input className="field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search clinics"/></div>{loading ? <p className="p-10 text-center text-sm text-slate-500">Loading clinics…</p> : <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">{filtered.map((clinic) => <ClinicCard key={clinic.id} clinic={clinic} token={token} onRefresh={onRefresh} />)}</div>}</div>
    {modalOpen && <CreateClinicModal token={token} onClose={() => setModalOpen(false)} onCreated={async () => { setModalOpen(false); await onRefresh(); }} />}
  </div>;
}

function ClinicCard({ clinic, token, onRefresh }: { clinic: Clinic; token: string; onRefresh: () => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const toggle = async () => { setSaving(true); try { await request(`/admin/clinics/${clinic.id}`, { method: 'PATCH', body: JSON.stringify({ ...clinic, account_status: clinic.account_status === 'Active' ? 'Inactive' : 'Active' }) }, token); await onRefresh(); } finally { setSaving(false); } };
  return <div className="rounded-2xl border border-slate-200/70 bg-white/55 p-5"><div className="flex items-start justify-between gap-3"><h3 className="font-bold">{clinic.clinic_name}</h3><StatusBadge status={clinic.account_status}/></div><div className="mt-3 space-y-1 text-sm text-slate-500"><p>{clinic.contact_name || 'No contact listed'}</p><p>{clinic.email || 'No email listed'}</p><p>{clinic.phone || 'No phone listed'}</p><p>{clinic.address || 'No address listed'}<br/>{clinic.city}, {clinic.state} {clinic.zip_code}</p></div><div className="mt-4 flex items-center justify-between border-t border-slate-200/70 pt-3 text-xs text-slate-500"><span>{clinic.user_count || 0} users · {clinic.order_count || 0} requests</span><button className="secondary-button !min-h-0 !px-3 !py-1.5" onClick={toggle} disabled={saving}>{clinic.account_status === 'Active' ? 'Deactivate' : 'Activate'}</button></div></div>;
}

function CreateClinicModal({ token, onClose, onCreated }: { token: string; onClose: () => void; onCreated: () => Promise<void> }) {
  const [form, setForm] = useState({ clinic_name: '', contact_name: '', email: '', phone: '', address: '', city: '', state: '', zip_code: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); setError(''); try { await request('/admin/clinics', { method: 'POST', body: JSON.stringify(form) }, token); await onCreated(); } catch (err) { setError(err instanceof Error ? err.message : 'Clinic creation failed.'); } finally { setSaving(false); } };
  return <Modal title="Add clinic" description="Create the clinic record first, then create one or more clinic users." onClose={onClose}><form onSubmit={submit} className="grid gap-4 md:grid-cols-2"><div className="md:col-span-2"><Alert type="error">{error}</Alert></div>{Object.entries(form).map(([key, value]) => <label key={key} className={key === 'address' ? 'md:col-span-2' : ''}><span className="mb-1.5 block text-sm font-semibold text-slate-600">{key.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())}</span><input className="field" value={value} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} required={key === 'clinic_name'} /></label>)}<button className="primary-button md:col-span-2" disabled={saving}>{saving ? 'Creating…' : 'Create Clinic'}</button></form></Modal>;
}

function AdminUsers({ users, clinics, loading, token, onRefresh }: { users: User[]; clinics: Clinic[]; loading: boolean; token: string; onRefresh: () => Promise<void> }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [resetUser, setResetUser] = useState<User | null>(null);
  return <div><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-3xl font-bold tracking-tight">Clinic User Management</h1><p className="mt-1 text-sm text-slate-500">Generate credentials and attach multiple users to each clinic.</p></div><button className="primary-button flex items-center gap-2" onClick={() => setCreateOpen(true)} disabled={!clinics.length}><Icon name="plus" className="h-4 w-4"/> Create Clinic Login</button></div>
    <div className="glass-card mt-6 rounded-2xl overflow-hidden">{loading ? <p className="p-10 text-center text-sm text-slate-500">Loading users…</p> : !users.length ? <p className="p-10 text-center text-sm text-slate-500">No clinic users found.</p> : <div className="overflow-x-auto"><table className="table-shell min-w-[820px]"><thead><tr><th>User</th><th>Clinic</th><th>Status</th><th>Last login</th><th className="text-right">Actions</th></tr></thead><tbody>{users.map((user) => <UserRow key={user.id} user={user} token={token} onReset={() => setResetUser(user)} onRefresh={onRefresh} />)}</tbody></table></div>}</div>
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
  return <Modal title="Create clinic login" description="Generate credentials for a user and attach the account to a clinic." onClose={onClose}>{handoff ? <div className="space-y-4"><div className="rounded-2xl border border-slate-200 bg-white/70 p-4 text-sm space-y-2"><p><span className="text-slate-500">Portal:</span> <strong>{CLINIC_APP_URL}</strong></p><p><span className="text-slate-500">Clinic:</span> <strong>{handoff.clinicName}</strong></p><p><span className="text-slate-500">Username:</span> <strong>{handoff.email}</strong></p><p><span className="text-slate-500">Password:</span> <strong className="font-mono">{handoff.password}</strong></p></div><p className="text-xs text-slate-500">This is the only point where the plain-text password is available. Copy it now.</p><button className="secondary-button flex w-full items-center justify-center gap-2" onClick={() => void copy()}><Icon name="copy" className="h-4 w-4"/> Copy Credentials</button><button className="primary-button w-full" onClick={onClose}>Done</button></div> : <form onSubmit={create} className="grid gap-4 md:grid-cols-2"><div className="md:col-span-2"><Alert type="error">{error}</Alert></div><label><span className="mb-1.5 block text-sm font-semibold text-slate-600">Full name</span><input className="field" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required /></label><label><span className="mb-1.5 block text-sm font-semibold text-slate-600">Email / username</span><input className="field" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required /></label><label className="md:col-span-2"><span className="mb-1.5 block text-sm font-semibold text-slate-600">Clinic</span><select className="field" value={form.clinic_id} onChange={(event) => setForm((current) => ({ ...current, clinic_id: event.target.value }))} required>{clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.clinic_name}</option>)}</select></label><label className="md:col-span-2"><span className="mb-1.5 block text-sm font-semibold text-slate-600">Temporary password</span><div className="flex gap-2"><input className="field font-mono" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required /><button type="button" className="secondary-button shrink-0" onClick={() => setForm((current) => ({ ...current, password: generatePassword() }))}>Generate</button></div></label><button className="primary-button md:col-span-2" disabled={saving}>{saving ? 'Creating…' : 'Create Account and Show Credentials'}</button></form>}</Modal>;
}

function ResetPasswordModal({ user, token, onClose, onSaved }: { user: User; token: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [password, setPassword] = useState(generatePassword());
  const [savedPassword, setSavedPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); setError(''); try { await request(`/admin/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ password }) }, token); setSavedPassword(password); await onSaved(); } catch (err) { setError(err instanceof Error ? err.message : 'Password reset failed.'); } finally { setSaving(false); } };
  const copy = async () => navigator.clipboard.writeText(`Occu-Med Lab Supply Portal\nPortal: ${CLINIC_APP_URL}\nUsername: ${user.email}\nTemporary password: ${savedPassword}`);
  return <Modal title={`Reset password for ${user.name}`} description="The previous password cannot be viewed. The new password immediately replaces it." onClose={onClose}><Alert type="error">{error}</Alert>{savedPassword ? <div className="space-y-4"><div className="rounded-2xl border border-slate-200 bg-white/70 p-4 text-sm"><p>Username: <strong>{user.email}</strong></p><p className="mt-2">New password: <strong className="font-mono">{savedPassword}</strong></p></div><button className="secondary-button flex w-full items-center justify-center gap-2" onClick={() => void copy()}><Icon name="copy" className="h-4 w-4"/> Copy Credentials</button><button className="primary-button w-full" onClick={onClose}>Done</button></div> : <div className="space-y-4"><label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-600">New password</span><div className="flex gap-2"><input className="field font-mono" value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" className="secondary-button" onClick={() => setPassword(generatePassword())}>Generate</button></div></label><button className="primary-button w-full" onClick={save} disabled={saving || password.length < 8}>{saving ? 'Saving…' : 'Save New Password'}</button></div>}</Modal>;
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

  return <div className="portal-bg min-h-screen"><header className="border-b border-slate-200/70 bg-white/55 backdrop-blur-2xl"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8"><div className="flex items-center gap-4"><Logo compact /><div className="hidden border-l border-slate-200 pl-4 sm:block"><p className="font-bold">Lab Supply Portal</p><p className="text-xs text-slate-500">{clinic?.clinic_name}</p></div></div><div className="flex items-center gap-3"><div className="hidden text-right sm:block"><p className="text-sm font-bold">{session.user.name}</p><p className="text-xs text-slate-500">{session.user.email}</p></div><button className="secondary-button flex items-center gap-2" onClick={onLogout}><Icon name="logout" className="h-4 w-4"/> Sign Out</button></div></div></header>
    <main className="mx-auto max-w-7xl px-4 py-6 md:px-8"><Alert type="error">{error}</Alert><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-3xl font-bold tracking-tight">{clinic?.clinic_name || 'Clinic Portal'}</h1><p className="mt-1 text-sm text-slate-500">Request laboratory supplies and track Occu-Med fulfillment.</p></div><div className="glass-card flex rounded-xl p-1"><button className={`rounded-lg px-4 py-2 text-sm font-bold ${view === 'request' ? 'bg-[#1c5f85] text-white' : 'text-slate-500'}`} onClick={() => setView('request')}>New Request</button><button className={`rounded-lg px-4 py-2 text-sm font-bold ${view === 'history' ? 'bg-[#1c5f85] text-white' : 'text-slate-500'}`} onClick={() => setView('history')}>Request History</button></div></div>
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
  const selected = Object.entries(quantities).filter(([, quantity]) => quantity > 0);
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(''); setSuccess(''); if (!selected.length) return setError('Select at least one supply item.'); setSubmitting(true); try { const order = await request<Order>('/orders', { method: 'POST', body: JSON.stringify({ items: selected.map(([product_id, quantity]) => ({ product_id, quantity })), needed_by: neededBy || null, special_instructions: instructions }) }, token); setSuccess(`Request ${order.order_number} was submitted.`); setQuantities({}); setNeededBy(''); setInstructions(''); await onCreated(); } catch (err) { setError(err instanceof Error ? err.message : 'Request could not be submitted.'); } finally { setSubmitting(false); } };
  return <form onSubmit={submit} className="mt-6 grid gap-6 xl:grid-cols-[1fr_330px]"><div className="glass-card rounded-2xl overflow-hidden"><div className="grid gap-3 border-b border-slate-200/70 p-4 md:grid-cols-[1fr_220px]"><input className="field" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search supplies or item code"/><select className="field" value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((value) => <option key={value}>{value}</option>)}</select></div>{loading ? <p className="p-10 text-center text-sm text-slate-500">Loading supplies…</p> : <div className="grid gap-4 p-5 md:grid-cols-2">{visible.map((product) => <div key={product.id} className={`rounded-2xl border p-4 ${quantities[product.id] > 0 ? 'border-[#75a9c9] bg-[#edf7fc]' : 'border-slate-200/70 bg-white/55'}`}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-[#38779d]">{product.category}</p><h3 className="mt-1 font-bold">{product.product_name}</h3><p className="mt-1 font-mono text-xs text-slate-400">{product.product_code}</p></div><span className="badge processing">{product.unit_label}</span></div><p className="mt-3 min-h-10 text-sm leading-5 text-slate-500">{product.description}</p><div className="mt-4 flex items-center gap-2"><button type="button" className="secondary-button !h-10 !min-h-0 !w-10 !p-0" onClick={() => setQuantities((current) => ({ ...current, [product.id]: Math.max(0, (current[product.id] || 0) - 1) }))}>−</button><input className="field !w-20 text-center font-bold" type="number" min="0" value={quantities[product.id] || 0} onChange={(event) => setQuantities((current) => ({ ...current, [product.id]: Math.max(0, Number(event.target.value) || 0) }))}/><button type="button" className="secondary-button !h-10 !min-h-0 !w-10 !p-0" onClick={() => setQuantities((current) => ({ ...current, [product.id]: (current[product.id] || 0) + 1 }))}>+</button></div></div>)}</div>}</div><div className="glass-card h-fit rounded-2xl p-5 xl:sticky xl:top-6"><h2 className="text-xl font-bold">Request details</h2><div className="mt-4 space-y-4"><Alert type="error">{error}</Alert><Alert type="success">{success}</Alert><div className="rounded-xl border border-slate-200/70 bg-white/55 p-4 text-sm"><p className="text-slate-500">Shipping to</p><p className="mt-1 font-bold">{clinic?.clinic_name}</p><p className="mt-1 text-slate-500">{clinic?.address}<br/>{clinic?.city}, {clinic?.state} {clinic?.zip_code}</p></div><label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-600">Needed by</span><input className="field" type="date" value={neededBy} onChange={(event) => setNeededBy(event.target.value)} /></label><label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-600">Special instructions</span><textarea className="field" value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Urgency, kit preference, collection type, or delivery notes" /></label><div className="rounded-xl bg-[#eaf4fb] px-4 py-3 text-sm text-[#225b7d]"><strong>{selected.length}</strong> supply item{selected.length === 1 ? '' : 's'} selected</div><button className="primary-button w-full" disabled={submitting || !selected.length}>{submitting ? 'Submitting…' : 'Submit to Occu-Med'}</button></div></div></form>;
}

function ClinicHistory({ orders, loading }: { orders: Order[]; loading: boolean }) {
  return <div className="glass-card mt-6 rounded-2xl overflow-hidden"><div className="border-b border-slate-200/70 p-5"><h2 className="text-xl font-bold">Request history</h2><p className="mt-1 text-sm text-slate-500">Live fulfillment status and shipment tracking.</p></div>{loading ? <p className="p-10 text-center text-sm text-slate-500">Loading requests…</p> : !orders.length ? <p className="p-10 text-center text-sm text-slate-500">No supply requests have been submitted.</p> : <div className="divide-y divide-slate-200/70">{orders.map((order) => <article key={order.id} className="p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-3"><span className="font-mono text-sm font-bold text-[#1c5f85]">{order.order_number}</span><StatusBadge status={order.order_status}/></div><p className="mt-2 text-sm text-slate-500">Submitted {formatDateTime(order.created_at)}{order.needed_by ? ` · Needed by ${formatDate(order.needed_by)}` : ''}</p></div>{order.tracking_number && <div className="rounded-xl border border-[#bbd7e6] bg-[#edf7fc] px-4 py-3 text-sm"><span className="text-slate-500">Tracking</span><p className="mt-1 font-mono font-bold text-[#1c5f85]">{order.tracking_number}</p></div>}</div><div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{order.order_items.map((item) => <div key={item.product_id} className="rounded-xl border border-slate-200/70 bg-white/55 px-3 py-2 text-sm"><strong>{item.quantity} {item.unit_label || 'unit(s)'}</strong> · {item.product_name}</div>)}</div></article>)}</div>}</div>;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const login = (value: Session) => { saveSession(value); setSession(value); };
  const logout = () => { saveSession(null); setSession(null); };

  if (!session || session.mode !== MODE || (MODE === 'admin' && session.user.role !== 'admin') || (MODE === 'clinic' && session.user.role !== 'clinic_user')) return <Login onLogin={login} />;
  return MODE === 'admin' ? <AdminShell session={session} onLogout={logout} /> : <ClinicShell session={session} onLogout={logout} />;
}
