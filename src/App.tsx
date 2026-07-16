import { createContext, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';

type Role = 'admin' | 'clinic_user';
type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  clinic_id: string | null;
  clinic_name?: string | null;
  last_login_at?: string | null;
  created_at?: string;
};
type Clinic = {
  id: string;
  clinic_name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  account_status: string;
  last_order_date?: string | null;
  user_count?: number;
  order_count?: number;
};
type Product = {
  id: string;
  product_name: string;
  product_code: string;
  description?: string;
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
  clinic_name?: string;
  submitted_by_name?: string;
  order_number: string;
  order_status: string;
  requested_by?: string;
  needed_by?: string | null;
  tracking_number?: string | null;
  special_instructions?: string;
  order_items: OrderItem[];
  created_at: string;
};
type Session = { token: string; user: User; clinic: Clinic | null };
type AdminView = 'dashboard' | 'orders' | 'clinics' | 'users';

const API_BASE = String(import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? '/api' : 'https://lab-supplies-order-api.onrender.com')).replace(/\/$/, '');
const STORAGE_KEY = 'occu_med_lab_portal_session';

async function api<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'The request could not be completed.');
  return body as T;
}

const AuthContext = createContext<{
  session: Session | null;
  setSession: (session: Session | null) => void;
  logout: () => void;
} | null>(null);

function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('Authentication context is unavailable.');
  return value;
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as Session | null;
    } catch {
      return null;
    }
  });
  const setSession = (next: Session | null) => {
    setSessionState(next);
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  };
  return <AuthContext.Provider value={{ session, setSession, logout: () => setSession(null) }}>{children}</AuthContext.Provider>;
}

const inputClass = 'w-full rounded-xl border border-slate-200/90 bg-white/80 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#6f9fbd] focus:ring-4 focus:ring-[#8bb7d2]/15';
const darkInputClass = 'w-full rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-3 text-white outline-none transition placeholder:text-white/35 focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/10';
const primaryButton = 'inline-flex items-center justify-center rounded-xl bg-[#173b5c] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0e2e4a] disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButton = 'inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50';
const dangerButton = 'inline-flex items-center justify-center rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50';

function OccuMedLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-center ${compact ? 'gap-2.5' : 'gap-3'}`}>
      <div className={`${compact ? 'h-10 w-10' : 'h-12 w-12'} flex items-center justify-center rounded-2xl border border-[#9ebed2] bg-gradient-to-br from-[#dcecf5] to-white shadow-[0_0_18px_rgba(67,112,158,0.25)]`}>
        <span className="text-sm font-black tracking-tight text-[#173b5c]">OM</span>
      </div>
      <div>
        <div className={`${compact ? 'text-sm' : 'text-base'} font-black tracking-[0.18em] text-[#173b5c]`}>OCCU-MED</div>
        <div className="text-xs font-medium text-slate-500">Lab Supply Portal</div>
      </div>
    </div>
  );
}

function GlassPanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-white/80 bg-white/62 shadow-[0_18px_55px_rgba(31,78,121,0.10)] backdrop-blur-2xl ${className}`}>{children}</section>;
}

function DarkPanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-white/10 bg-white/[0.065] shadow-[0_18px_70px_rgba(0,20,70,0.35)] backdrop-blur-2xl ${className}`}>{children}</section>;
}

function ErrorMessage({ message }: { message: string }) {
  return message ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div> : null;
}

function SuccessMessage({ message }: { message: string }) {
  return message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null;
}

function DarkError({ message }: { message: string }) {
  return message ? <div className="rounded-2xl border border-red-300/25 bg-red-400/10 px-4 py-3 text-sm text-red-100">{message}</div> : null;
}

function Protected({ role, children }: { role: Role; children: ReactNode }) {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  if (session.user.role !== role) return <Navigate to={session.user.role === 'admin' ? '/admin' : '/clinic'} replace />;
  return <>{children}</>;
}

function LoginPage() {
  const { session, setSession } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (session) return <Navigate to={session.user.role === 'admin' ? '/admin' : '/clinic'} replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await api<Session>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      setSession(result);
      navigate(result.user.role === 'admin' ? '/admin' : '/clinic', { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#edf4f8] p-4">
      <div className="pointer-events-none absolute left-[8%] top-[12%] h-96 w-96 rounded-full bg-sky-200/45 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[8%] right-[10%] h-96 w-96 rounded-full bg-blue-100/70 blur-[120px]" />
      <GlassPanel className="relative z-10 w-full max-w-md p-8">
        <div className="mb-8 flex flex-col items-center text-center">
          <OccuMedLogo />
          <h1 className="mt-7 text-2xl font-bold tracking-tight text-slate-800">Lab Supply Portal</h1>
          <p className="mt-2 text-sm text-slate-500">One login for Occu-Med administrators and clinic users.</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <ErrorMessage message={error} />
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Email</span>
            <input className={inputClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="name@organization.com" />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-700">Password</span>
            <input className={inputClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" placeholder="••••••••" />
          </label>
          <button className={`${primaryButton} mt-3 w-full`} disabled={loading}>{loading ? 'Opening portal…' : 'Open Portal'}</button>
        </form>
        <p className="mt-6 text-center text-xs text-slate-400">Clinic credentials are created and managed by Occu-Med.</p>
      </GlassPanel>
    </div>
  );
}

const adminNav: Array<{ id: AdminView; label: string; mark: string }> = [
  { id: 'dashboard', label: 'Dashboard', mark: 'DB' },
  { id: 'orders', label: 'Supply Requests', mark: 'SR' },
  { id: 'clinics', label: 'Clinics', mark: 'CL' },
  { id: 'users', label: 'Clinic Users', mark: 'CU' },
];

function AdminLayout({ view, setView, children }: { view: AdminView; setView: (view: AdminView) => void; children: ReactNode }) {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const signOut = () => { logout(); navigate('/login', { replace: true }); };
  return (
    <div className="min-h-screen bg-[#edf4f8] text-slate-800 md:flex">
      <aside className="border-b border-slate-200/80 bg-white/45 p-4 backdrop-blur-2xl md:fixed md:inset-y-0 md:left-0 md:w-64 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between md:block">
          <div className="px-2 py-2 md:pb-5"><OccuMedLogo /></div>
          <button onClick={signOut} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 md:hidden">Sign out</button>
        </div>
        <p className="hidden px-3 pb-3 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 md:block">Lab Administration</p>
        <nav className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 md:flex md:flex-col md:gap-1">
          {adminNav.map((item) => (
            <button key={item.id} onClick={() => setView(item.id)} className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm font-medium transition ${view === item.id ? 'border-[#9ebed2] bg-[#d8e7f1] text-[#173b5c] shadow-sm' : 'border-transparent text-slate-600 hover:bg-white/75 hover:text-[#173b5c]'}`}>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-black ${view === item.id ? 'bg-white/70 text-[#173b5c]' : 'bg-slate-100 text-slate-500'}`}>{item.mark}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="mt-6 hidden border-t border-slate-200/80 pt-4 md:block">
          <div className="px-3 py-2">
            <p className="text-sm font-semibold text-slate-800">{session?.user.name}</p>
            <p className="break-all text-xs text-slate-500">{session?.user.email}</p>
          </div>
          <button onClick={signOut} className="mt-2 w-full rounded-xl px-3 py-3 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50">Sign Out</button>
        </div>
      </aside>
      <main className="relative min-h-screen flex-1 overflow-hidden p-4 md:ml-64 md:p-8">
        <div className="pointer-events-none absolute right-0 top-0 h-[500px] w-[500px] rounded-full bg-sky-200/25 blur-[150px]" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-[500px] w-[500px] rounded-full bg-blue-100/40 blur-[150px]" />
        <div className="relative z-10 mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}

function MetricCard({ label, value, note }: { label: string; value: number; note: string }) {
  return <GlassPanel className="p-5"><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-2 text-3xl font-black tracking-tight text-[#173b5c]">{value}</p><p className="mt-2 text-xs text-slate-400">{note}</p></GlassPanel>;
}

function StatusBadge({ status }: { status: string }) {
  const classes = status === 'Delivered' || status === 'Active'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : status === 'Cancelled' || status === 'Inactive'
      ? 'border-red-200 bg-red-50 text-red-700'
      : status === 'Shipped'
        ? 'border-sky-200 bg-sky-50 text-sky-700'
        : 'border-amber-200 bg-amber-50 text-amber-700';
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${classes}`}>{status}</span>;
}

function AdminPortal() {
  const { session } = useAuth();
  const token = session!.token;
  const [view, setView] = useState<AdminView>('dashboard');
  const [orders, setOrders] = useState<Order[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [orderData, clinicData, userData] = await Promise.all([
        api<Order[]>('/orders', {}, token),
        api<Clinic[]>('/admin/clinics', {}, token),
        api<User[]>('/admin/users', {}, token),
      ]);
      setOrders(orderData);
      setClinics(clinicData);
      setUsers(userData);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Administration data could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  return (
    <AdminLayout view={view} setView={setView}>
      <ErrorMessage message={error} />
      {view === 'dashboard' && <AdminDashboard orders={orders} clinics={clinics} users={users} loading={loading} goTo={setView} />}
      {view === 'orders' && <AdminOrders orders={orders} loading={loading} token={token} reload={load} />}
      {view === 'clinics' && <AdminClinics clinics={clinics} loading={loading} token={token} reload={load} />}
      {view === 'users' && <ClinicUserManager users={users} clinics={clinics} loading={loading} token={token} reload={load} />}
    </AdminLayout>
  );
}

function AdminDashboard({ orders, clinics, users, loading, goTo }: { orders: Order[]; clinics: Clinic[]; users: User[]; loading: boolean; goTo: (view: AdminView) => void }) {
  const open = orders.filter((order) => !['Delivered', 'Cancelled'].includes(order.order_status)).length;
  const pending = orders.filter((order) => order.order_status === 'Pending').length;
  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold tracking-tight text-slate-800">Lab Supply Administration</h1><p className="mt-1 text-sm text-slate-500">Manage clinics, credentials, supply requests, and fulfillment.</p></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Clinics" value={clinics.length} note="Organization accounts" />
        <MetricCard label="Clinic users" value={users.length} note="Admin-generated logins" />
        <MetricCard label="Open requests" value={open} note="Pending through shipped" />
        <MetricCard label="Awaiting review" value={pending} note="New clinic submissions" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <GlassPanel className="p-6"><h2 className="text-lg font-bold text-slate-800">Administration shortcuts</h2><div className="mt-5 grid gap-3 sm:grid-cols-2"><button className={primaryButton} onClick={() => goTo('clinics')}>Add or manage clinics</button><button className={secondaryButton} onClick={() => goTo('users')}>Generate clinic login</button><button className={secondaryButton} onClick={() => goTo('orders')}>Review supply requests</button><button className={secondaryButton} onClick={() => goTo('users')}>Reset user password</button></div></GlassPanel>
        <GlassPanel className="overflow-hidden"><div className="border-b border-slate-200/70 p-5"><h2 className="text-lg font-bold text-slate-800">Recent requests</h2></div>{loading ? <div className="p-8 text-center text-sm text-slate-400">Loading…</div> : orders.length === 0 ? <div className="p-8 text-center text-sm text-slate-400">No requests yet.</div> : <div className="divide-y divide-slate-200/70">{orders.slice(0, 5).map((order) => <div key={order.id} className="flex items-center justify-between gap-4 p-4"><div><p className="font-mono text-xs font-bold text-[#173b5c]">{order.order_number}</p><p className="mt-1 text-sm font-semibold text-slate-700">{order.clinic_name}</p></div><StatusBadge status={order.order_status} /></div>)}</div>}</GlassPanel>
      </div>
    </div>
  );
}

function AdminOrders({ orders, loading, token, reload }: { orders: Order[]; loading: boolean; token: string; reload: () => Promise<void> }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All');
  const filtered = orders.filter((order) => (status === 'All' || order.order_status === status) && `${order.order_number} ${order.clinic_name || ''}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold tracking-tight">Supply Requests</h1><p className="mt-1 text-sm text-slate-500">Review, process, ship, and close clinic requests.</p></div>
      <GlassPanel className="overflow-hidden">
        <div className="grid gap-3 border-b border-slate-200/70 p-5 md:grid-cols-[1fr_220px]"><input className={inputClass} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search request number or clinic" /><select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>{['All', 'Pending', 'Approved', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map((item) => <option key={item}>{item}</option>)}</select></div>
        {loading ? <div className="p-10 text-center text-sm text-slate-400">Loading requests…</div> : filtered.length === 0 ? <div className="p-10 text-center text-sm text-slate-400">No requests match the current filters.</div> : <div className="divide-y divide-slate-200/70">{filtered.map((order) => <AdminOrderRow key={order.id} order={order} token={token} reload={reload} />)}</div>}
      </GlassPanel>
    </div>
  );
}

function AdminOrderRow({ order, token, reload }: { order: Order; token: string; reload: () => Promise<void> }) {
  const [status, setStatus] = useState(order.order_status);
  const [tracking, setTracking] = useState(order.tracking_number || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await api(`/admin/orders/${order.id}`, { method: 'PATCH', body: JSON.stringify({ order_status: status, tracking_number: tracking }) }, token);
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Request update failed.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <article className="p-5">
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div><div className="flex flex-wrap items-center gap-3"><span className="font-mono text-sm font-bold text-[#173b5c]">{order.order_number}</span><StatusBadge status={order.order_status} /></div><h3 className="mt-3 text-lg font-bold text-slate-800">{order.clinic_name || 'Unknown clinic'}</h3><p className="mt-1 text-sm text-slate-500">Submitted {new Date(order.created_at).toLocaleString()} {order.submitted_by_name ? `by ${order.submitted_by_name}` : ''}</p><div className="mt-4 grid gap-2 sm:grid-cols-2">{order.order_items.map((item) => <div key={item.product_id} className="rounded-xl border border-slate-200 bg-white/65 px-3 py-2 text-sm text-slate-600"><span className="font-bold text-slate-800">{item.quantity} {item.unit_label || 'unit(s)'}</span> · {item.product_name}</div>)}</div>{order.special_instructions && <div className="mt-4 rounded-xl border border-slate-200 bg-white/55 p-3 text-sm text-slate-600"><span className="font-semibold text-slate-800">Instructions:</span> {order.special_instructions}</div>}</div>
        <div className="rounded-2xl border border-slate-200 bg-white/55 p-4"><ErrorMessage message={error} /><label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Status</span><select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>{['Pending', 'Approved', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map((item) => <option key={item}>{item}</option>)}</select></label><label className="mt-4 block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">Tracking number</span><input className={inputClass} value={tracking} onChange={(event) => setTracking(event.target.value)} placeholder="Add when shipped" /></label><button onClick={save} className={`${primaryButton} mt-4 w-full`} disabled={saving}>{saving ? 'Saving…' : 'Update request'}</button></div>
      </div>
    </article>
  );
}

function AdminClinics({ clinics, loading, token, reload }: { clinics: Clinic[]; loading: boolean; token: string; reload: () => Promise<void> }) {
  const empty = { clinic_name: '', contact_name: '', email: '', phone: '', address: '', city: '', state: '', zip_code: '' };
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(empty);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const filtered = clinics.filter((clinic) => `${clinic.clinic_name} ${clinic.city || ''} ${clinic.state || ''} ${clinic.email || ''}`.toLowerCase().includes(query.toLowerCase()));
  const createClinic = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setCreating(true);
    try {
      await api('/admin/clinics', { method: 'POST', body: JSON.stringify(form) }, token);
      setForm(empty);
      setSuccess('Clinic account created. You can now add users to it.');
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Clinic could not be created.');
    } finally {
      setCreating(false);
    }
  };
  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold tracking-tight">Clinics</h1><p className="mt-1 text-sm text-slate-500">Create clinic accounts before assigning one or more users.</p></div>
      <div className="grid gap-6 xl:grid-cols-[390px_1fr]">
        <GlassPanel className="h-fit p-6"><h2 className="text-lg font-bold">Create clinic</h2><p className="mt-1 text-sm text-slate-500">This record controls the shared shipping address and clinic identity.</p><form onSubmit={createClinic} className="mt-5 space-y-3"><ErrorMessage message={error} /><SuccessMessage message={success} />{Object.entries(form).map(([key, value]) => <label key={key} className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">{key.replaceAll('_', ' ')}</span><input className={inputClass} value={value} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} required={['clinic_name', 'address', 'city', 'state', 'zip_code'].includes(key)} /></label>)}<button className={`${primaryButton} w-full`} disabled={creating}>{creating ? 'Creating…' : 'Create clinic account'}</button></form></GlassPanel>
        <GlassPanel className="overflow-hidden"><div className="border-b border-slate-200/70 p-5"><input className={inputClass} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search clinics, location, or email" /></div>{loading ? <div className="p-10 text-center text-sm text-slate-400">Loading clinics…</div> : <div className="grid gap-4 p-5 md:grid-cols-2">{filtered.map((clinic) => <ClinicCard key={clinic.id} clinic={clinic} token={token} reload={reload} />)}</div>}</GlassPanel>
      </div>
    </div>
  );
}

function ClinicCard({ clinic, token, reload }: { clinic: Clinic; token: string; reload: () => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const toggle = async () => {
    setSaving(true);
    try {
      await api(`/admin/clinics/${clinic.id}`, { method: 'PATCH', body: JSON.stringify({ ...clinic, account_status: clinic.account_status === 'Active' ? 'Inactive' : 'Active' }) }, token);
      await reload();
    } finally {
      setSaving(false);
    }
  };
  return <div className="rounded-2xl border border-slate-200 bg-white/62 p-5"><div className="flex items-start justify-between gap-3"><h3 className="font-bold text-slate-800">{clinic.clinic_name}</h3><StatusBadge status={clinic.account_status} /></div><div className="mt-3 space-y-1 text-sm text-slate-500"><p>{clinic.contact_name || 'No contact listed'}</p><p>{clinic.email || 'No email listed'}</p><p>{clinic.phone || 'No phone listed'}</p><p>{clinic.address}<br />{clinic.city}, {clinic.state} {clinic.zip_code}</p></div><div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 text-xs font-semibold text-slate-500"><span>{clinic.user_count || 0} user{clinic.user_count === 1 ? '' : 's'} · {clinic.order_count || 0} request{clinic.order_count === 1 ? '' : 's'}</span><button onClick={toggle} disabled={saving} className="text-[#173b5c] hover:underline">{saving ? 'Saving…' : clinic.account_status === 'Active' ? 'Deactivate' : 'Activate'}</button></div></div>;
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

type CredentialHandoff = { name: string; email: string; password: string; clinic: string };

function ClinicUserManager({ users, clinics, loading, token, reload }: { users: User[]; clinics: Clinic[]; loading: boolean; token: string; reload: () => Promise<void> }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [handoff, setHandoff] = useState<CredentialHandoff | null>(null);
  const [resetHandoff, setResetHandoff] = useState<CredentialHandoff | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [form, setForm] = useState({ name: '', email: '', clinic_id: '', password: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const resetCreate = () => { setForm({ name: '', email: '', clinic_id: '', password: '' }); setHandoff(null); setError(''); };
  const createUser = async () => {
    setError('');
    if (!form.name.trim() || !form.email.trim() || !form.clinic_id || form.password.length < 8) return setError('Name, email, clinic, and an 8-character password are required.');
    setSaving(true);
    try {
      const created = await api<User>('/admin/users', { method: 'POST', body: JSON.stringify(form) }, token);
      setHandoff({ name: created.name, email: created.email, password: form.password, clinic: created.clinic_name || 'Clinic' });
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Clinic user could not be created.');
    } finally {
      setSaving(false);
    }
  };
  const updateUser = async (user: User, data: Record<string, unknown>) => {
    await api(`/admin/users/${user.id}`, { method: 'PATCH', body: JSON.stringify(data) }, token);
    await reload();
  };
  const deleteUser = async (user: User) => {
    if (!window.confirm(`Delete ${user.name}?`)) return;
    await api(`/admin/users/${user.id}`, { method: 'DELETE' }, token);
    await reload();
  };
  const resetPasswordForUser = async () => {
    if (!resetUser || resetPassword.length < 8) return setError('Password must be at least 8 characters.');
    setSaving(true);
    setError('');
    try {
      await updateUser(resetUser, { password: resetPassword });
      setResetHandoff({ name: resetUser.name, email: resetUser.email, password: resetPassword, clinic: resetUser.clinic_name || 'Clinic' });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Password reset failed.');
    } finally {
      setSaving(false);
    }
  };
  const copyCredentials = async (credentials: CredentialHandoff) => {
    await navigator.clipboard.writeText(`Occu-Med Lab Supply Portal\nPortal: ${window.location.origin}\nClinic: ${credentials.clinic}\nUsername: ${credentials.email}\nTemporary password: ${credentials.password}`);
  };
  const emailCredentials = (credentials: CredentialHandoff) => {
    const subject = encodeURIComponent('Your Occu-Med Lab Supply Portal credentials');
    const body = encodeURIComponent(`Hello ${credentials.name},\n\nYour Occu-Med Lab Supply Portal access has been created.\n\nPortal: ${window.location.origin}\nClinic: ${credentials.clinic}\nUsername: ${credentials.email}\nTemporary password: ${credentials.password}\n\nPlease store these credentials securely.`);
    window.location.href = `mailto:${credentials.email}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-3xl font-bold tracking-tight">Clinic User Management</h1><p className="mt-1 text-sm text-slate-500">Create credentials, assign users to clinics, reset passwords, and control access.</p></div><button onClick={() => { resetCreate(); setCreateOpen(true); }} className={primaryButton}>Create clinic login</button></div>
      <GlassPanel className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left"><thead className="bg-white/45 text-xs uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-4">User</th><th className="px-5 py-4">Clinic</th><th className="px-5 py-4">Status</th><th className="px-5 py-4">Last login</th><th className="px-5 py-4 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-200/70">{loading ? <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-400">Loading clinic users…</td></tr> : users.length === 0 ? <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-400">No clinic users have been created.</td></tr> : users.map((user) => <tr key={user.id}><td className="px-5 py-4"><div className="font-semibold text-slate-800">{user.name}</div><div className="text-xs text-slate-500">{user.email}</div></td><td className="px-5 py-4 text-sm text-slate-600">{user.clinic_name || 'Unassigned'}</td><td className="px-5 py-4"><button onClick={() => void updateUser(user, { active: !user.active })} className={`relative h-7 w-12 rounded-full transition ${user.active ? 'bg-[#4f88aa]' : 'bg-slate-300'}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${user.active ? 'left-6' : 'left-1'}`} /></button></td><td className="px-5 py-4 text-sm text-slate-500">{user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'}</td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button className={secondaryButton} onClick={() => { setError(''); setResetPassword(''); setResetHandoff(null); setResetUser(user); }}>Reset password</button><button className={dangerButton} onClick={() => void deleteUser(user)}>Delete</button></div></td></tr>)}</tbody></table></div></GlassPanel>
      {createOpen && <Modal title="Create clinic login" description="Generate credentials and attach this user to an existing clinic." onClose={() => { setCreateOpen(false); resetCreate(); }}>{handoff ? <CredentialPanel credentials={handoff} copy={() => void copyCredentials(handoff)} email={() => emailCredentials(handoff)} done={() => { setCreateOpen(false); resetCreate(); }} /> : <div className="space-y-4"><ErrorMessage message={error} /><label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Full name</span><input className={inputClass} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label><label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Email / username</span><input className={inputClass} type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label><label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Clinic</span><select className={inputClass} value={form.clinic_id} onChange={(event) => setForm((current) => ({ ...current, clinic_id: event.target.value }))}><option value="">Select clinic</option>{clinics.filter((clinic) => clinic.account_status === 'Active').map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.clinic_name}</option>)}</select></label><PasswordField value={form.password} onChange={(password) => setForm((current) => ({ ...current, password }))} /><button className={`${primaryButton} w-full`} onClick={() => void createUser()} disabled={saving}>{saving ? 'Creating account…' : 'Create account and prepare credentials'}</button></div>}</Modal>}
      {resetUser && <Modal title={`Set password for ${resetUser.name}`} description="The previous password cannot be viewed. Setting a new one replaces it immediately." onClose={() => { setResetUser(null); setResetPassword(''); setResetHandoff(null); setError(''); }}>{resetHandoff ? <CredentialPanel credentials={resetHandoff} copy={() => void copyCredentials(resetHandoff)} email={() => emailCredentials(resetHandoff)} done={() => { setResetUser(null); setResetPassword(''); setResetHandoff(null); }} /> : <div className="space-y-4"><ErrorMessage message={error} /><PasswordField value={resetPassword} onChange={setResetPassword} label="New password" /><button className={`${primaryButton} w-full`} onClick={() => void resetPasswordForUser()} disabled={saving}>{saving ? 'Saving…' : 'Save new password'}</button></div>}</Modal>}
    </div>
  );
}

function Modal({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-4 backdrop-blur-sm"><div className="w-full max-w-xl rounded-3xl border border-white/90 bg-[#f7fbfd]/95 p-6 shadow-[0_30px_100px_rgba(23,59,92,0.25)]"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-slate-800">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div><button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-lg text-slate-500 hover:text-slate-800">×</button></div><div className="mt-6">{children}</div></div></div>;
}

function PasswordField({ value, onChange, label = 'Password' }: { value: string; onChange: (value: string) => void; label?: string }) {
  return <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">{label}</span><div className="flex gap-2"><input className={inputClass} type="text" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Enter or generate a password" /><button type="button" className={secondaryButton} onClick={() => onChange(generatePassword())}>Generate</button></div></label>;
}

function CredentialPanel({ credentials, copy, email, done }: { credentials: CredentialHandoff; copy: () => void; email: () => void; done: () => void }) {
  return <div className="space-y-4"><div className="space-y-2 rounded-2xl border border-slate-200 bg-white/75 p-4 text-sm"><div><span className="text-slate-500">Portal:</span> <strong>{window.location.origin}</strong></div><div><span className="text-slate-500">Clinic:</span> <strong>{credentials.clinic}</strong></div><div><span className="text-slate-500">Username:</span> <strong>{credentials.email}</strong></div><div><span className="text-slate-500">Password:</span> <strong className="font-mono">{credentials.password}</strong></div></div><p className="text-xs text-slate-500">This is the only point at which the plain-text password is available. Copy or email it now.</p><div className="grid gap-2 sm:grid-cols-2"><button className={secondaryButton} onClick={copy}>Copy credentials</button><button className={secondaryButton} onClick={email}>Email credentials</button></div><button className={`${primaryButton} w-full`} onClick={done}>Done</button></div>;
}

function ClinicPortal() {
  const { session, setSession, logout } = useAuth();
  const navigate = useNavigate();
  const token = session!.token;
  const [tab, setTab] = useState<'overview' | 'request'>('overview');
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clinic, setClinic] = useState<Clinic | null>(session!.clinic);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [orderData, productData, me] = await Promise.all([
        api<Order[]>('/orders', {}, token),
        api<Product[]>('/products', {}, token),
        api<{ user: User; clinic: Clinic | null }>('/me', {}, token),
      ]);
      setOrders(orderData);
      setProducts(productData);
      setClinic(me.clinic);
      setSession({ token, user: me.user, clinic: me.clinic });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Clinic portal could not be loaded.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);
  const signOut = () => { logout(); navigate('/login', { replace: true }); };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020b1f] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(24,190,255,0.18),transparent_32%),radial-gradient(circle_at_85%_75%,rgba(54,98,255,0.18),transparent_34%),linear-gradient(145deg,#020817_0%,#061b3f_52%,#020b1f_100%)]" />
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#020b1f]/72 backdrop-blur-2xl"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-8"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-sm font-black">OM</div><div><div className="text-sm font-black tracking-[0.18em]">OCCU-MED</div><div className="text-xs text-cyan-100/60">{clinic?.clinic_name || 'Clinic Portal'}</div></div></div><div className="flex items-center gap-3"><div className="hidden text-right sm:block"><div className="text-xs font-semibold text-white/80">{session?.user.name}</div><div className="text-[11px] text-cyan-100/50">{session?.user.email}</div></div><button onClick={signOut} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/[0.12]">Sign out</button></div></div></header>
      <main className="relative z-10 mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-8 md:py-8"><div className="flex gap-2 rounded-2xl border border-white/10 bg-white/[0.045] p-2"><button onClick={() => setTab('overview')} className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${tab === 'overview' ? 'bg-gradient-to-r from-blue-600 to-cyan-500' : 'text-white/55 hover:bg-white/[0.07] hover:text-white'}`}>Request History</button><button onClick={() => setTab('request')} className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${tab === 'request' ? 'bg-gradient-to-r from-blue-600 to-cyan-500' : 'text-white/55 hover:bg-white/[0.07] hover:text-white'}`}>New Supply Request</button></div><DarkError message={error} />{tab === 'overview' ? <ClinicOrders orders={orders} loading={loading} startRequest={() => setTab('request')} /> : clinic ? <NewSupplyRequest products={products} clinic={clinic} user={session!.user} token={token} complete={async () => { await load(); setTab('overview'); }} /> : <DarkPanel className="p-8 text-center text-white/50">This user is not attached to a clinic.</DarkPanel>}</main>
    </div>
  );
}

function ClinicOrders({ orders, loading, startRequest }: { orders: Order[]; loading: boolean; startRequest: () => void }) {
  return <DarkPanel className="overflow-hidden"><div className="flex flex-col gap-3 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-xl font-black">Lab supply requests</h1><p className="mt-1 text-sm text-white/45">Track every request submitted by users at your clinic.</p></div><button onClick={startRequest} className="rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 text-sm font-semibold shadow-[0_0_28px_rgba(34,211,238,0.24)]">Create request</button></div>{loading ? <div className="p-10 text-center text-white/45">Loading requests…</div> : orders.length === 0 ? <div className="p-10 text-center text-white/45">No supply requests have been submitted yet.</div> : <div className="divide-y divide-white/10">{orders.map((order) => <article key={order.id} className="p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-3"><span className="font-mono text-sm font-bold text-cyan-100">{order.order_number}</span><span className="rounded-full border border-cyan-200/20 bg-cyan-300/10 px-2.5 py-1 text-xs font-semibold text-cyan-100">{order.order_status}</span></div><div className="mt-2 text-sm text-white/50">Submitted {new Date(order.created_at).toLocaleDateString()} {order.submitted_by_name ? `by ${order.submitted_by_name}` : ''}</div></div>{order.tracking_number && <div className="rounded-2xl border border-cyan-200/15 bg-cyan-300/[0.07] px-4 py-3 text-sm"><span className="text-white/45">Tracking</span><div className="mt-1 font-mono font-bold text-cyan-100">{order.tracking_number}</div></div>}</div><div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{order.order_items.map((item) => <div key={item.product_id} className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-white/65"><span className="font-semibold text-white/85">{item.quantity} {item.unit_label || 'unit(s)'}</span> · {item.product_name}</div>)}</div></article>)}</div>}</DarkPanel>;
}

function NewSupplyRequest({ products, clinic, user, token, complete }: { products: Product[]; clinic: Clinic; user: User; token: string; complete: () => Promise<void> }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [neededBy, setNeededBy] = useState('');
  const [instructions, setInstructions] = useState('');
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const categories = useMemo(() => ['All', ...Array.from(new Set(products.map((product) => product.category)))], [products]);
  const visible = products.filter((product) => (category === 'All' || product.category === category) && `${product.product_name} ${product.product_code}`.toLowerCase().includes(search.toLowerCase()));
  const selected = Object.values(quantities).filter((quantity) => quantity > 0).length;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const items = Object.entries(quantities).filter(([, quantity]) => quantity > 0).map(([product_id, quantity]) => ({ product_id, quantity }));
    if (!items.length) return setError('Select at least one supply item.');
    setSaving(true);
    setError('');
    try {
      await api('/orders', { method: 'POST', body: JSON.stringify({ items, requested_by: user.name, needed_by: neededBy || null, special_instructions: instructions }) }, token);
      await complete();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Request could not be submitted.');
    } finally {
      setSaving(false);
    }
  };
  return <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[1fr_340px]"><DarkPanel className="overflow-hidden"><div className="border-b border-white/10 p-5"><h1 className="text-xl font-black">Select lab supplies</h1><div className="mt-5 grid gap-3 md:grid-cols-[1fr_220px]"><input className={darkInputClass} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search supplies or code" /><select className={darkInputClass} value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option className="bg-slate-950" key={item}>{item}</option>)}</select></div></div><div className="grid gap-4 p-5 md:grid-cols-2">{visible.map((product) => <div key={product.id} className={`rounded-2xl border p-4 transition ${quantities[product.id] > 0 ? 'border-cyan-300/40 bg-cyan-300/[0.08]' : 'border-white/10 bg-white/[0.035]'}`}><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-bold uppercase tracking-wider text-cyan-200/70">{product.category}</div><h3 className="mt-2 font-bold">{product.product_name}</h3><p className="mt-1 font-mono text-xs text-white/35">{product.product_code}</p></div><span className="rounded-xl border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs text-white/60">{product.unit_label}</span></div><p className="mt-3 min-h-10 text-sm text-white/45">{product.description}</p><div className="mt-4 flex items-center gap-3"><button type="button" onClick={() => setQuantities((current) => ({ ...current, [product.id]: Math.max(0, (current[product.id] || 0) - 1) }))} className="h-10 w-10 rounded-xl border border-white/10 bg-white/[0.06] text-lg">−</button><input type="number" min="0" max="999" className="h-10 w-20 rounded-xl border border-white/10 bg-white/[0.07] text-center font-bold outline-none" value={quantities[product.id] || 0} onChange={(event) => setQuantities((current) => ({ ...current, [product.id]: Math.max(0, Number(event.target.value) || 0) }))} /><button type="button" onClick={() => setQuantities((current) => ({ ...current, [product.id]: (current[product.id] || 0) + 1 }))} className="h-10 w-10 rounded-xl border border-white/10 bg-white/[0.06] text-lg">+</button></div></div>)}</div></DarkPanel><DarkPanel className="h-fit p-5 xl:sticky xl:top-28"><h2 className="text-xl font-black">Request details</h2><div className="mt-5 space-y-4"><DarkError message={error} /><div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm"><div className="text-white/45">Shipping to</div><div className="mt-1 font-bold">{clinic.clinic_name}</div><div className="mt-1 text-white/55">{clinic.address}<br />{clinic.city}, {clinic.state} {clinic.zip_code}</div></div><label className="block"><span className="mb-2 block text-sm text-white/65">Needed by</span><input className={darkInputClass} type="date" value={neededBy} onChange={(event) => setNeededBy(event.target.value)} /></label><label className="block"><span className="mb-2 block text-sm text-white/65">Special instructions</span><textarea className={`${darkInputClass} min-h-28 resize-y`} value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Kit preferences, urgency, or delivery notes" /></label><div className="rounded-2xl border border-cyan-200/15 bg-cyan-300/[0.06] p-4 text-sm"><strong>{selected}</strong> supply item{selected === 1 ? '' : 's'} selected</div><button className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 font-semibold shadow-[0_0_28px_rgba(34,211,238,0.24)] disabled:opacity-50" disabled={saving || selected === 0}>{saving ? 'Submitting…' : 'Submit to Occu-Med'}</button></div></DarkPanel></form>;
}

function App() {
  return <AuthProvider><Routes><Route path="/login" element={<LoginPage />} /><Route path="/admin" element={<Protected role="admin"><AdminPortal /></Protected>} /><Route path="/clinic" element={<Protected role="clinic_user"><ClinicPortal /></Protected>} /><Route path="*" element={<Navigate to="/login" replace />} /></Routes></AuthProvider>;
}

export default App;
