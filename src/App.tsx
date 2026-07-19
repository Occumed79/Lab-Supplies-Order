import React, { useState, useEffect, createContext, useContext, useMemo } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';

// --- Constants & Config ---
const BASE_URL = import.meta.env.DEV ? '/api' : 'https://alex6oks0k.lastapp.dev';
const APP_ID = 'b78d6439-5723-4316-aa1a-1239face6db1';

// --- Types ---
interface User {
  id: string;
  email: string;
  provider: string;
  role?: 'admin' | 'clinic';
}

interface Clinic {
  id: string;
  user_id: string;
  clinic_name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  account_status: string;
  last_order_date: string | null;
}

interface Product {
  id: string;
  product_name: string;
  product_code: string;
  description: string;
  category: string;
  price: number;
  stock_quantity: number;
  is_available: boolean;
}

const PRODUCT_IMAGE_RULES: Array<{ image: string; aliases: string[] }> = [
  { image: 'lc-clinical-collection-kit.png', aliases: ['lcclinicalcollectionkit', 'labcorclinicalcollectionkit', 'labcorpclinicalcollectionkit'] },
  { image: 'crl-clinical-collection-kit.png', aliases: ['crlclinicalcollectionkit', 'clinicalreferencelaboratoryclinicalcollectionkit'] },
  { image: 'fedex-shipping-envelope.png', aliases: ['fedexshippingenvelope', 'fedexclinicalpak', 'clinicalshippingpak', 'shippingpak'] },
  { image: 'lithium-heparin-green-top.png', aliases: ['lithiumheparingreentop', 'greentoptube', 'lithiumheparintube'] },
  { image: 'edta-lavender-top.png', aliases: ['edtalavendertop', 'lavendertoptube', 'edtatube'] },
  { image: 'plain-serum-red-top.png', aliases: ['plainserumredtop', 'redtoptube', 'plainserumtube'] },
  { image: 'sodium-citrate-light-blue-top.png', aliases: ['sodiumcitratelightbluetop', 'lightbluetoptube', 'sodiumcitratetube'] },
  { image: 'tiger-top-sst.png', aliases: ['tigertopsst', 'tigertoptube'] },
  { image: 'gold-sst.png', aliases: ['goldsst', 'goldtoptube'] },
  { image: 'royal-blue-trace-element.png', aliases: ['royalbluetraceelement', 'royalbluetoptube', 'traceelementtube'] },
  { image: 'exempt-specimen-box.png', aliases: ['exemptspecimenbox', 'exempthumanspecimenbox', 'specimenshippingbox'] },
  { image: 'fedex-shipping-label.png', aliases: ['fedexshippinglabel', 'shippinglabel'] },
  { image: 'biohazard-bag.png', aliases: ['biohazardbag', 'tamperevidentbag', 'specimenbag'] },
  { image: 'lc-split-urine-cup.png', aliases: ['lcspliturinecup', 'labcorpspliturinecup', 'labcorpspecimencollectioncup'] },
  { image: 'crl-split-urine-cup.png', aliases: ['crlspliturinecup', 'clinicalreferencelaboratoryspliturinecup', 'crlspecimencollectioncup'] },
  { image: 'lc-chain-of-custody.png', aliases: ['lcchainofcustody', 'labcorpchainofcustody', 'labcorpchainofcustodyform'] },
  { image: 'crl-chain-of-custody.png', aliases: ['crlchainofcustody', 'clinicalreferencelaboratorychainofcustody', 'crlchainofcustodyform'] },
  { image: 'lc-lab-requisition.png', aliases: ['lclabrequisition', 'labcorplabrequisition', 'labcorprequisitionform'] },
  { image: 'crl-lab-requisition.png', aliases: ['crllabrequisition', 'clinicalreferencelaboratorylabrequisition', 'crlrequisitionform'] }
];

const getProductImage = (product: Product): string | undefined => {
  const searchable = `${product.product_name} ${product.product_code}`
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  const match = PRODUCT_IMAGE_RULES.find(rule =>
    rule.aliases.some(alias => searchable.includes(alias))
  );

  return match ? `/${match.image}` : undefined;
};

interface OrderItem {
  product_id: string;
  product_name: string;
  product_code: string;
  quantity: number;
  unit_price: number;
}

interface Order {
  id: string;
  clinic_id: string;
  order_number: string;
  order_status: string;
  delivery_address: string;
  delivery_city: string;
  delivery_state: string;
  delivery_zip: string;
  delivery_method: string;
  special_instructions: string;
  subtotal: number;
  shipping_cost: number;
  total_cost: number;
  estimated_delivery_date: string;
  order_items: OrderItem[];
}

// --- Contexts ---
interface AppContextType {
  user: User | null;
  clinic: Clinic | null;
  setUser: (user: User | null) => void;
  setClinic: (clinic: Clinic | null) => void;
  cart: OrderItem[];
  addToCart: (product: Product, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  logout: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};

// --- Helper Components ---
const GlassCard: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({ children, className = '', onClick }) => (
  <div onClick={onClick} className={`glass-panel rounded-card p-6 ${onClick ? 'cursor-pointer hover:shadow-luminous transition-all duration-300 hover:-translate-y-1' : ''} ${className}`}>
    {children}
  </div>
);

const Navbar: React.FC<{ title: string; showBack?: boolean; onBack?: () => void; rightElement?: React.ReactNode }> = ({ title, showBack, onBack, rightElement }) => {
  const navigate = useNavigate();
  return (
    <nav className="sticky top-0 z-50 glass-panel-strong border-b-0 rounded-b-2xl mb-6 px-4 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        {showBack && (
          <button onClick={onBack || (() => navigate(-1))} className="w-10 h-10 rounded-full flex items-center justify-center bg-surface/50 dark:bg-surface/20 hover:bg-surface dark:hover:bg-surface/40 transition-colors text-foreground">
            <i className="fa fa-arrow-left"></i>
          </button>
        )}
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-primary">{title}</h1>
      </div>
      {rightElement && <div>{rightElement}</div>}
    </nav>
  );
};

// --- Screens ---

// 1. Splash Screen
const SplashScreen: React.FC = () => {
  const navigate = useNavigate();
  useEffect(() => {
    const timer = setTimeout(() => navigate('/login'), 2500);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-hero bg-background dark:bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 mix-blend-overlay pointer-events-none"></div>
      <div className="z-10 flex flex-col items-center animate-float">
        <div className="w-32 h-32 rounded-3xl glass-panel flex items-center justify-center shadow-luminous mb-8">
          <i className="fa fa-hospital text-6xl text-primary"></i>
        </div>
        <h1 className="text-4xl font-bold text-foreground mb-4 tracking-tight">OCCU-MED</h1>
        <h2 className="text-xl text-muted-foreground mb-12 font-light">Lab Supply Portal</h2>
        <div className="flex items-center gap-3 text-primary">
          <i className="fa fa-circle-notch fa-spin text-2xl"></i>
          <span className="font-medium tracking-widest uppercase text-sm">LOADING</span>
        </div>
      </div>
    </div>
  );
};

// 2. Authentication Screen
const AuthScreen: React.FC = () => {
  const [isClinic, setIsClinic] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setUser, setClinic } = useAppContext();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BASE_URL}/data/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: APP_ID, email, password, provider: 'email' })
      });
      if (!res.ok) throw new Error('Invalid credentials');
      const userData = await res.json();
      
      // Determine role based on toggle (in a real app, this would be securely checked)
      const role = isClinic ? 'clinic' : 'admin';
      const userWithRole = { ...userData, role };
      setUser(userWithRole);
      localStorage.setItem('user_data', JSON.stringify(userWithRole));

      if (isClinic) {
        // Fetch clinic profile
        const clinicRes = await fetch(`${BASE_URL}/data?app_id=${APP_ID}&table_name=clinics&user_id=${userData.id}`);
        const clinics = await clinicRes.json();
        if (clinics && clinics.length > 0) {
          setClinic(clinics[0]);
          localStorage.setItem('clinic_data', JSON.stringify(clinics[0]));
          navigate('/clinic/dashboard');
        } else {
          // No profile found, force registration
          navigate('/register');
        }
      } else {
        navigate('/admin/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-hero bg-background dark:bg-background">
      <GlassCard className="w-full max-w-md relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-primary"></div>
        <div className="text-center mb-8 mt-4">
          <div className="w-16 h-16 mx-auto rounded-2xl glass-panel flex items-center justify-center mb-4 shadow-luminous">
            <i className="fa fa-lock text-2xl text-primary"></i>
          </div>
          <h2 className="text-2xl font-bold text-foreground">Welcome Back</h2>
          <p className="text-muted-foreground text-sm mt-2">Sign in to access your portal</p>
        </div>

        <div className="flex p-1 bg-surface/50 dark:bg-surface/20 rounded-xl mb-8 backdrop-blur-sm border border-border">
          <button 
            type="button"
            onClick={() => setIsClinic(true)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${isClinic ? 'bg-white dark:bg-gray-800 shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Clinic Login
          </button>
          <button 
            type="button"
            onClick={() => setIsClinic(false)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${!isClinic ? 'bg-white dark:bg-gray-800 shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Admin Login
          </button>
        </div>

        {error && <div className="mb-4 p-3 bg-error/10 border border-error/20 text-error rounded-lg text-sm text-center">{error}</div>}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1 ml-1">Email Address</label>
            <div className="relative">
              <i className="fa fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"></i>
              <input 
                type="email" 
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="glass-input pl-11" 
                placeholder="name@clinic.com" 
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-1 ml-1">
              <label className="block text-sm font-medium text-foreground">Password</label>
              <button type="button" className="text-xs text-primary hover:underline">Forgot?</button>
            </div>
            <div className="relative">
              <i className="fa fa-key absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"></i>
              <input 
                type="password" 
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="glass-input pl-11" 
                placeholder="••••••••" 
              />
            </div>
          </div>
          <button type="submit" disabled={loading} className="glass-button-primary w-full mt-6">
            {loading ? <i className="fa fa-spinner fa-spin"></i> : 'Sign In'}
          </button>
        </form>

        {isClinic && (
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              New clinic? <button onClick={() => navigate('/register')} className="text-primary font-medium hover:underline">Register here</button>
            </p>
          </div>
        )}
      </GlassCard>
    </div>
  );
};

// 3. Clinic Registration Screen
const RegistrationScreen: React.FC = () => {
  const navigate = useNavigate();
  const { setUser, setClinic } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    clinic_name: '', email: '', phone: '', address: '', city: '', state: '', zip_code: '', password: '', confirm_password: ''
  });

  const validatePassword = (pass: string) => {
    const minLength = pass.length >= 6;
    const hasCapital = /[A-Z]/.test(pass);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pass);
    return minLength && hasCapital && hasSpecial;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirm_password) {
      return setError('Passwords do not match');
    }
    if (!validatePassword(formData.password)) {
      return setError('Password does not meet requirements');
    }

    setLoading(true);
    setError('');
    try {
      // 1. Create User
      const userRes = await fetch(`${BASE_URL}/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: APP_ID,
          table_name: 'users',
          data: { email: formData.email, password: formData.password, provider: 'email' }
        })
      });
      if (!userRes.ok) throw new Error('Failed to create user account');
      const userData = await userRes.json();
      const userWithRole = { ...userData, role: 'clinic' };

      // 2. Create Clinic Profile
      const clinicRes = await fetch(`${BASE_URL}/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: APP_ID,
          table_name: 'clinics',
          data: {
            user_id: userData.id,
            clinic_name: formData.clinic_name,
            phone: formData.phone,
            address: formData.address,
            city: formData.city,
            state: formData.state,
            zip_code: formData.zip_code,
            account_status: 'Active',
            last_order_date: null
          }
        })
      });
      if (!clinicRes.ok) throw new Error('Failed to create clinic profile');
      const clinicData = await clinicRes.json();

      setUser(userWithRole);
      setClinic(clinicData);
      localStorage.setItem('user_data', JSON.stringify(userWithRole));
      localStorage.setItem('clinic_data', JSON.stringify(clinicData));
      
      navigate('/clinic/dashboard');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 bg-gradient-hero bg-background dark:bg-background flex items-center justify-center">
      <GlassCard className="w-full max-w-2xl">
        <div className="flex items-center mb-6">
          <button onClick={() => navigate('/login')} className="w-10 h-10 rounded-full flex items-center justify-center bg-surface/50 dark:bg-surface/20 hover:bg-surface text-foreground mr-4">
            <i className="fa fa-arrow-left"></i>
          </button>
          <h2 className="text-2xl font-bold text-foreground">Clinic Registration</h2>
        </div>

        {error && <div className="mb-6 p-4 bg-error/10 border border-error/20 text-error rounded-xl text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-foreground mb-1 ml-1">Clinic Name</label>
            <div className="relative">
              <i className="fa fa-hospital absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"></i>
              <input required type="text" className="glass-input pl-11" value={formData.clinic_name} onChange={e => setFormData({...formData, clinic_name: e.target.value})} placeholder="General Hospital Lab" />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-1 ml-1">Email Address</label>
            <div className="relative">
              <i className="fa fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"></i>
              <input required type="email" className="glass-input pl-11" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="contact@clinic.com" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1 ml-1">Phone Number</label>
            <div className="relative">
              <i className="fa fa-phone absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"></i>
              <input required type="tel" className="glass-input pl-11" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="(555) 123-4567" />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-foreground mb-1 ml-1">Street Address</label>
            <div className="relative">
              <i className="fa fa-map-marker-alt absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"></i>
              <input required type="text" className="glass-input pl-11" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="123 Medical Way" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1 ml-1">City</label>
            <div className="relative">
              <i className="fa fa-city absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"></i>
              <input required type="text" className="glass-input pl-11" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} placeholder="Metropolis" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1 ml-1">State</label>
              <input required type="text" className="glass-input" value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} placeholder="NY" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1 ml-1">Zip Code</label>
              <input required type="text" className="glass-input" value={formData.zip_code} onChange={e => setFormData({...formData, zip_code: e.target.value})} placeholder="10001" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1 ml-1">Password</label>
            <div className="relative">
              <i className="fa fa-key absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"></i>
              <input required type="password" className="glass-input pl-11" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="••••••••" />
            </div>
            <p className="text-xs text-muted-foreground mt-2 ml-1">At least 6 characters, 1 capital letter, and 1 special character.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1 ml-1">Confirm Password</label>
            <div className="relative">
              <i className="fa fa-key absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"></i>
              <input required type="password" className="glass-input pl-11" value={formData.confirm_password} onChange={e => setFormData({...formData, confirm_password: e.target.value})} placeholder="••••••••" />
            </div>
          </div>

          <div className="md:col-span-2 mt-4">
            <button type="submit" disabled={loading} className="glass-button-primary w-full">
              {loading ? <i className="fa fa-spinner fa-spin"></i> : 'Create Account'}
            </button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
};

// 4. Clinic Dashboard
const ClinicDashboard: React.FC = () => {
  const { clinic, logout } = useAppContext();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (clinic) {
      fetch(`${BASE_URL}/data?app_id=${APP_ID}&table_name=orders&clinic_id=${clinic.id}`)
        .then(res => res.json())
        .then(data => {
          setOrders(Array.isArray(data) ? data.sort((a, b) => new Date(b.estimated_delivery_date).getTime() - new Date(a.estimated_delivery_date).getTime()) : []);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [clinic]);

  const lastOrder = orders.length > 0 ? orders[0] : null;

  return (
    <div className="min-h-screen bg-background dark:bg-background pb-20 md:pb-8">
      <Navbar 
        title="Dashboard" 
        rightElement={
          <div className="flex gap-2">
            <button onClick={() => navigate('/clinic/profile')} className="w-10 h-10 rounded-full glass-panel flex items-center justify-center text-primary hover:bg-primary/10 transition-colors">
              <i className="fa fa-user-circle"></i>
            </button>
            <button onClick={logout} className="w-10 h-10 rounded-full glass-panel flex items-center justify-center text-error hover:bg-error/10 transition-colors">
              <i className="fa fa-sign-out-alt"></i>
            </button>
          </div>
        }
      />
      
      <main className="max-w-screen-xl mx-auto px-4 lg:px-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-foreground">Welcome,</h2>
            <p className="text-xl text-primary font-medium mt-1">{clinic?.clinic_name}</p>
          </div>
          <button onClick={() => navigate('/clinic/order')} className="glass-button-primary shadow-luminous">
            <i className="fa fa-plus-circle mr-2"></i> New Order
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Last Order Card */}
          <div className="lg:col-span-1">
            <GlassCard className="h-full bg-gradient-to-br from-primary/10 to-secondary/10 border-primary/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                  <i className="fa fa-calendar-check"></i>
                </div>
                <h3 className="text-lg font-semibold text-foreground">Last Order</h3>
              </div>
              
              {loading ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                </div>
              ) : lastOrder ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">Order #</span>
                    <span className="font-mono text-sm font-medium text-foreground">{lastOrder.order_number}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">Date</span>
                    <span className="text-sm font-medium text-foreground">{new Date(lastOrder.estimated_delivery_date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">Status</span>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${lastOrder.order_status === 'Delivered' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>
                      {lastOrder.order_status}
                    </span>
                  </div>
                  <div className="pt-4 border-t border-border/50 flex justify-between items-center">
                    <span className="font-semibold text-foreground">Total</span>
                    <span className="font-bold text-primary">${lastOrder.total_cost.toFixed(2)}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <i className="fa fa-box-open text-3xl mb-2 opacity-50"></i>
                  <p>No previous orders found.</p>
                </div>
              )}
            </GlassCard>
          </div>

          {/* Order History List */}
          <div className="lg:col-span-2">
            <GlassCard className="h-full">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <i className="fa fa-list text-primary"></i> Order History
                </h3>
              </div>

              {loading ? (
                <div className="space-y-4">
                  {[1,2,3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl"></div>)}
                </div>
              ) : orders.length > 0 ? (
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                  {orders.map(order => (
                    <div key={order.id} className="p-4 rounded-xl bg-surface/50 dark:bg-surface/20 border border-border hover:bg-surface dark:hover:bg-surface/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-semibold text-foreground">{order.order_number}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${order.order_status === 'Delivered' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>
                            {order.order_status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{order.order_items.length} items • Ordered on {new Date(order.estimated_delivery_date).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-4">
                        <span className="font-bold text-foreground">${order.total_cost.toFixed(2)}</span>
                        <button className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-colors">
                          <i className="fa fa-chevron-right text-xs"></i>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p>Your order history will appear here.</p>
                </div>
              )}
            </GlassCard>
          </div>
        </div>
      </main>
    </div>
  );
};

// 5. Order Placement Screen
const OrderPlacementScreen: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const { cart, addToCart } = useAppContext();
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${BASE_URL}/data?app_id=${APP_ID}&table_name=products`)
      .then(res => res.json())
      .then(data => setProducts(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];
  
  const filteredProducts = products.filter(p => 
    (category === 'All' || p.category === category) &&
    (p.product_name.toLowerCase().includes(search.toLowerCase()) || p.product_code.toLowerCase().includes(search.toLowerCase()))
  );

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-background dark:bg-background pb-24">
      <Navbar 
        title="Order Supplies" 
        showBack 
        rightElement={
          <button onClick={() => navigate('/clinic/checkout')} className="relative w-12 h-12 rounded-full glass-panel flex items-center justify-center text-primary hover:shadow-luminous transition-all">
            <i className="fa fa-shopping-bag text-xl"></i>
            {cartItemCount > 0 && (
              <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-error text-white text-xs font-bold flex items-center justify-center shadow-lg animate-bounce">
                {cartItemCount}
              </span>
            )}
          </button>
        }
      />

      <main className="max-w-screen-xl mx-auto px-4 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="md:col-span-2 relative">
            <i className="fa fa-search absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"></i>
            <input 
              type="text" 
              className="glass-input pl-11" 
              placeholder="Search by name or code..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="relative">
            <i className="fa fa-filter absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground z-10"></i>
            <select 
              className="glass-input pl-11 appearance-none cursor-pointer"
              value={category}
              onChange={e => setCategory(e.target.value)}
            >
              {categories.map(c => <option key={c} value={c} className="bg-surface text-foreground">{c}</option>)}
            </select>
            <i className="fa fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none text-xs"></i>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="h-64 bg-muted animate-pulse rounded-card"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map(product => (
              <ProductCard key={product.id} product={product} onAdd={(qty) => addToCart(product, qty)} />
            ))}
            {filteredProducts.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <i className="fa fa-search text-4xl mb-4 opacity-50"></i>
                <p className="text-lg">No products found matching your criteria.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

const ProductCard: React.FC<{ product: Product, onAdd: (qty: number) => void }> = ({ product, onAdd }) => {
  const [qty, setQty] = useState(1);
  const productImage = getProductImage(product);

  return (
    <GlassCard className="flex flex-col h-full">
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-mono bg-surface/50 dark:bg-surface/30 px-2 py-1 rounded text-muted-foreground border border-border">{product.product_code}</span>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${product.is_available ? 'bg-success/20 text-success' : 'bg-error/20 text-error'}`}>
          {product.is_available ? 'In Stock' : 'Out of Stock'}
        </span>
      </div>
      {productImage && (
        <div className="h-40 mb-4 flex items-center justify-center overflow-hidden rounded-2xl bg-white/5 border border-white/10">
          <img
            src={productImage}
            alt={product.product_name}
            className="w-full h-full object-contain p-3 drop-shadow-lg"
            loading="lazy"
          />
        </div>
      )}
      <h3 className="text-lg font-bold text-foreground leading-tight mb-1">{product.product_name}</h3>
      <p className="text-xs text-primary font-medium mb-3">{product.category}</p>
      <p className="text-sm text-muted-foreground flex-grow line-clamp-3 mb-4">{product.description}</p>
      
      <div className="mt-auto pt-4 border-t border-border/50">
        <div className="flex items-center justify-between mb-4">
          <span className="text-2xl font-bold text-foreground">${product.price.toFixed(2)}</span>
          <div className="flex items-center bg-surface/50 dark:bg-surface/30 rounded-lg border border-border overflow-hidden">
            <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} className="w-8 h-8 flex items-center justify-center text-foreground hover:bg-surface dark:hover:bg-surface/50 transition-colors">-</button>
            <input type="number" min="1" value={qty} onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))} className="w-10 h-8 text-center bg-transparent text-sm font-medium focus:outline-none text-foreground" />
            <button type="button" onClick={() => setQty(qty + 1)} className="w-8 h-8 flex items-center justify-center text-foreground hover:bg-surface dark:hover:bg-surface/50 transition-colors">+</button>
          </div>
        </div>
        <button 
          onClick={() => onAdd(qty)}
          disabled={!product.is_available}
          className="glass-button-primary w-full py-3 h-auto text-sm"
        >
          <i className="fa fa-cart-plus mr-2"></i> Add to Cart
        </button>
      </div>
    </GlassCard>
  );
};

// 6. Order Checkout Screen
const OrderCheckoutScreen: React.FC = () => {
  const { cart, clinic, clearCart } = useAppContext();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState('Standard Shipping');
  const [instructions, setInstructions] = useState('');

  const subtotal = cart.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  const shippingCost = deliveryMethod === 'Express Shipping' ? 35.00 : 15.00;
  const totalCost = subtotal + shippingCost;

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-background dark:bg-background flex flex-col items-center justify-center p-4">
        <div className="w-24 h-24 rounded-full glass-panel flex items-center justify-center text-muted-foreground mb-6">
          <i className="fa fa-shopping-cart text-4xl"></i>
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Your cart is empty</h2>
        <p className="text-muted-foreground mb-8">Add some lab supplies to proceed to checkout.</p>
        <button onClick={() => navigate('/clinic/order')} className="glass-button-primary">
          Browse Supplies
        </button>
      </div>
    );
  }

  const handlePlaceOrder = async () => {
    if (!clinic) return;
    setLoading(true);
    
    const orderNumber = `OCCU-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}${String(new Date().getDate()).padStart(2,'0')}-${Math.floor(Math.random()*1000).toString().padStart(3,'0')}`;
    const estDate = new Date();
    estDate.setDate(estDate.getDate() + (deliveryMethod === 'Express Shipping' ? 2 : 5));

    const orderData = {
      clinic_id: clinic.id,
      order_number: orderNumber,
      order_status: 'Pending',
      delivery_address: clinic.address,
      delivery_city: clinic.city,
      delivery_state: clinic.state,
      delivery_zip: clinic.zip_code,
      delivery_method: deliveryMethod,
      special_instructions: instructions,
      subtotal,
      shipping_cost: shippingCost,
      total_cost: totalCost,
      estimated_delivery_date: estDate.toISOString().split('T')[0],
      order_items: cart
    };

    try {
      const res = await fetch(`${BASE_URL}/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: APP_ID,
          table_name: 'orders',
          data: orderData
        })
      });
      
      if (!res.ok) throw new Error('Failed to place order');
      const savedOrder = await res.json();
      
      clearCart();
      navigate('/clinic/confirmation', { state: { order: savedOrder } });
    } catch (err) {
      console.error(err);
      alert('Failed to place order. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background dark:bg-background pb-24">
      <Navbar title="Checkout" showBack />
      
      <main className="max-w-screen-xl mx-auto px-4 lg:px-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <GlassCard>
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <i className="fa fa-map-marker-alt text-primary"></i> Delivery Address
            </h3>
            <div className="p-4 rounded-xl bg-surface/50 dark:bg-surface/20 border border-border flex justify-between items-start">
              <div>
                <p className="font-medium text-foreground">{clinic?.clinic_name}</p>
                <p className="text-sm text-muted-foreground mt-1">{clinic?.address}</p>
                <p className="text-sm text-muted-foreground">{clinic?.city}, {clinic?.state} {clinic?.zip_code}</p>
              </div>
              <button onClick={() => navigate('/clinic/profile')} className="text-primary text-sm font-medium hover:underline">Edit</button>
            </div>
          </GlassCard>

          <GlassCard>
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <i className="fa fa-truck text-primary"></i> Delivery Options
            </h3>
            <div className="space-y-3">
              <label className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${deliveryMethod === 'Standard Shipping' ? 'border-primary bg-primary/5' : 'border-border bg-surface/50 dark:bg-surface/20'}`}>
                <div className="flex items-center gap-3">
                  <input type="radio" name="delivery" checked={deliveryMethod === 'Standard Shipping'} onChange={() => setDeliveryMethod('Standard Shipping')} className="w-4 h-4 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">Standard Shipping</p>
                    <p className="text-xs text-muted-foreground">3-5 business days</p>
                  </div>
                </div>
                <span className="font-medium text-foreground">$15.00</span>
              </label>
              <label className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${deliveryMethod === 'Express Shipping' ? 'border-primary bg-primary/5' : 'border-border bg-surface/50 dark:bg-surface/20'}`}>
                <div className="flex items-center gap-3">
                  <input type="radio" name="delivery" checked={deliveryMethod === 'Express Shipping'} onChange={() => setDeliveryMethod('Express Shipping')} className="w-4 h-4 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">Express Shipping</p>
                    <p className="text-xs text-muted-foreground">1-2 business days</p>
                  </div>
                </div>
                <span className="font-medium text-foreground">$35.00</span>
              </label>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-foreground mb-2">Special Instructions (Optional)</label>
              <textarea 
                className="glass-input h-24 py-3 resize-none" 
                placeholder="E.g., Deliver to receiving dock..."
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
              ></textarea>
            </div>
          </GlassCard>
        </div>

        <div className="lg:col-span-1">
          <GlassCard className="sticky top-24">
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <i className="fa fa-receipt text-primary"></i> Order Summary
            </h3>
            
            <div className="space-y-4 mb-6 max-h-60 overflow-y-auto pr-2">
              {cart.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <div className="flex-1 pr-4">
                    <p className="font-medium text-foreground line-clamp-1">{item.product_name}</p>
                    <p className="text-muted-foreground text-xs">Qty: {item.quantity} × ${item.unit_price.toFixed(2)}</p>
                  </div>
                  <span className="font-medium text-foreground">${(item.quantity * item.unit_price).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-3 pt-4 border-t border-border/50 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Shipping</span>
                <span>${shippingCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-border/50">
                <span className="font-bold text-foreground text-base">Total</span>
                <span className="font-bold text-primary text-xl">${totalCost.toFixed(2)}</span>
              </div>
            </div>

            <button 
              onClick={handlePlaceOrder} 
              disabled={loading}
              className="glass-button-primary w-full mt-8 shadow-luminous"
            >
              {loading ? <i className="fa fa-spinner fa-spin"></i> : 'Place Order'}
            </button>
          </GlassCard>
        </div>
      </main>
    </div>
  );
};

// 7. Order Confirmation Screen
const OrderConfirmationScreen: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const order = location.state?.order as Order;

  if (!order) return <Navigate to="/clinic/dashboard" />;

  return (
    <div className="min-h-screen bg-gradient-hero bg-background dark:bg-background flex flex-col items-center justify-center p-4">
      <GlassCard className="w-full max-w-2xl text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-success"></div>
        
        <div className="w-20 h-20 mx-auto rounded-full bg-success/20 flex items-center justify-center mb-6 shadow-luminous-success">
          <i className="fa fa-check-double text-4xl text-success"></i>
        </div>
        
        <h2 className="text-3xl font-bold text-foreground mb-2">Order Placed Successfully!</h2>
        <p className="text-muted-foreground mb-8">Thank you for your order. We've sent a confirmation email.</p>

        <div className="bg-surface/50 dark:bg-surface/20 rounded-2xl p-6 border border-border text-left mb-8">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Order Number</p>
              <p className="font-mono font-bold text-foreground">{order.order_number}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Est. Delivery</p>
              <p className="font-medium text-foreground">{new Date(order.estimated_delivery_date).toLocaleDateString()}</p>
            </div>
          </div>
          
          <div className="border-t border-border/50 pt-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Total Amount Paid</span>
              <span className="text-xl font-bold text-primary">${order.total_cost.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button onClick={() => navigate('/clinic/order')} className="glass-button-primary">
            <i className="fa fa-shopping-cart mr-2"></i> Continue Shopping
          </button>
          <button onClick={() => navigate('/clinic/dashboard')} className="glass-button-secondary">
            <i className="fa fa-home mr-2"></i> Back to Dashboard
          </button>
        </div>
      </GlassCard>
    </div>
  );
};

// 8. Clinic Profile Screen
const ClinicProfileScreen: React.FC = () => {
  const { clinic, setClinic } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<Clinic>>(clinic || {});

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinic) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: APP_ID,
          table_name: 'clinics',
          data: { ...clinic, ...formData }
        })
      });
      if (!res.ok) throw new Error('Failed to update profile');
      const updated = await res.json();
      setClinic(updated);
      localStorage.setItem('clinic_data', JSON.stringify(updated));
      alert('Profile updated successfully!');
    } catch (err) {
      console.error(err);
      alert('Error updating profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background dark:bg-background pb-24">
      <Navbar title="Clinic Profile" showBack />
      
      <main className="max-w-screen-md mx-auto px-4">
        <GlassCard>
          <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border/50">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary text-2xl shadow-inner">
              <i className="fa fa-hospital"></i>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">{clinic?.clinic_name}</h2>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/20 text-success mt-1">
                {clinic?.account_status} Account
              </span>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1 ml-1">Clinic Name</label>
                <input type="text" className="glass-input" value={formData.clinic_name || ''} onChange={e => setFormData({...formData, clinic_name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1 ml-1">Phone Number</label>
                <input type="tel" className="glass-input" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1 ml-1">Street Address</label>
                <input type="text" className="glass-input" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1 ml-1">City</label>
                <input type="text" className="glass-input" value={formData.city || ''} onChange={e => setFormData({...formData, city: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1 ml-1">State</label>
                  <input type="text" className="glass-input" value={formData.state || ''} onChange={e => setFormData({...formData, state: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1 ml-1">Zip Code</label>
                  <input type="text" className="glass-input" value={formData.zip_code || ''} onChange={e => setFormData({...formData, zip_code: e.target.value})} />
                </div>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-border/50 flex flex-col sm:flex-row gap-4 justify-end">
              <button type="button" className="glass-button-secondary">
                <i className="fa fa-key mr-2"></i> Change Password
              </button>
              <button type="submit" disabled={loading} className="glass-button-primary">
                {loading ? <i className="fa fa-spinner fa-spin"></i> : <><i className="fa fa-save mr-2"></i> Save Changes</>}
              </button>
            </div>
          </form>
        </GlassCard>
      </main>
    </div>
  );
};

// 9. Admin Dashboard
const AdminDashboard: React.FC = () => {
  const { logout } = useAppContext();
  const navigate = useNavigate();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${BASE_URL}/data?app_id=${APP_ID}&table_name=clinics`).then(r => r.json()),
      fetch(`${BASE_URL}/data?app_id=${APP_ID}&table_name=orders`).then(r => r.json())
    ]).then(([clinicsData, ordersData]) => {
      setClinics(Array.isArray(clinicsData) ? clinicsData : []);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filteredClinics = clinics.filter(c => c.clinic_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-background dark:bg-background pb-24">
      <Navbar 
        title="Admin Dashboard" 
        rightElement={
          <button onClick={logout} className="w-10 h-10 rounded-full glass-panel flex items-center justify-center text-error hover:bg-error/10 transition-colors">
            <i className="fa fa-sign-out-alt"></i>
          </button>
        }
      />

      <main className="max-w-screen-xl mx-auto px-4 lg:px-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <GlassCard className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium mb-1">Total Clinics</p>
                <h3 className="text-3xl font-bold text-foreground">{clinics.length}</h3>
              </div>
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xl">
                <i className="fa fa-hospital"></i>
              </div>
            </div>
          </GlassCard>
          <GlassCard className="bg-gradient-to-br from-secondary/10 to-transparent border-secondary/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium mb-1">Total Orders</p>
                <h3 className="text-3xl font-bold text-foreground">{orders.length}</h3>
              </div>
              <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center text-secondary text-xl">
                <i className="fa fa-shopping-bag"></i>
              </div>
            </div>
          </GlassCard>
          <GlassCard className="flex items-center justify-center p-0 overflow-hidden">
            <button onClick={() => setShowInviteModal(true)} className="w-full h-full py-6 flex flex-col items-center justify-center text-primary hover:bg-primary/5 transition-colors">
              <i className="fa fa-envelope-open-text text-3xl mb-2"></i>
              <span className="font-medium">Invite New Clinic</span>
            </button>
          </GlassCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Clinics List */}
          <GlassCard className="flex flex-col h-[600px]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <i className="fa fa-list text-primary"></i> Registered Clinics
              </h3>
            </div>
            <div className="relative mb-4">
              <i className="fa fa-search absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"></i>
              <input 
                type="text" 
                className="glass-input pl-11 h-10 text-sm" 
                placeholder="Search clinics..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
              {loading ? (
                <div className="animate-pulse space-y-3">
                  {[1,2,3,4].map(i => <div key={i} className="h-16 bg-muted rounded-xl"></div>)}
                </div>
              ) : filteredClinics.map(clinic => (
                <div key={clinic.id} className="p-3 rounded-xl bg-surface/50 dark:bg-surface/20 border border-border flex items-center justify-between hover:bg-surface dark:hover:bg-surface/40 transition-colors">
                  <div>
                    <p className="font-medium text-foreground text-sm">{clinic.clinic_name}</p>
                    <p className="text-xs text-muted-foreground">{clinic.city}, {clinic.state}</p>
                  </div>
                  <button onClick={() => navigate(`/admin/clinic/${clinic.id}`)} className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-colors">
                    <i className="fa fa-eye text-xs"></i>
                  </button>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Recent Orders */}
          <GlassCard className="flex flex-col h-[600px]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <i className="fa fa-clock text-primary"></i> Recent Orders
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
              {loading ? (
                <div className="animate-pulse space-y-3">
                  {[1,2,3,4].map(i => <div key={i} className="h-20 bg-muted rounded-xl"></div>)}
                </div>
              ) : orders.sort((a,b) => new Date(b.estimated_delivery_date).getTime() - new Date(a.estimated_delivery_date).getTime()).slice(0, 10).map(order => {
                const clinicName = clinics.find(c => c.id === order.clinic_id)?.clinic_name || 'Unknown Clinic';
                return (
                  <div key={order.id} className="p-3 rounded-xl bg-surface/50 dark:bg-surface/20 border border-border flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <span className="font-mono text-xs font-semibold text-foreground">{order.order_number}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${order.order_status === 'Delivered' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>
                        {order.order_status}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground line-clamp-1">{clinicName}</p>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs text-muted-foreground">{new Date(order.estimated_delivery_date).toLocaleDateString()}</span>
                      <span className="font-bold text-primary text-sm">${order.total_cost.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </div>
      </main>

      {showInviteModal && <InviteClinicModal onClose={() => setShowInviteModal(false)} />}
    </div>
  );
};

// 10. Invite Clinic Modal
const InviteClinicModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { user } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ email: '', name: '', message: '' });

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch(`${BASE_URL}/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: APP_ID,
          table_name: 'invitations',
          data: {
            admin_user_id: user?.id,
            clinic_email: formData.email,
            clinic_name: formData.name,
            invitation_message: formData.message || 'You are invited to join the OCCU MED Lab Supply Portal!',
            invitation_status: 'Sent',
            sent_at: new Date().toISOString()
          }
        })
      });
      alert('Invitation sent successfully!');
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <GlassCard className="w-full max-w-md animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
            <i className="fa fa-envelope-open-text text-primary"></i> Invite Clinic
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <i className="fa fa-times text-xl"></i>
          </button>
        </div>

        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1 ml-1">Clinic Name</label>
            <div className="relative">
              <i className="fa fa-hospital absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"></i>
              <input required type="text" className="glass-input pl-11" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Wellness Center" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1 ml-1">Email Address</label>
            <div className="relative">
              <i className="fa fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"></i>
              <input required type="email" className="glass-input pl-11" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="admin@wellness.com" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1 ml-1">Custom Message (Optional)</label>
            <textarea className="glass-input h-24 py-3 resize-none" value={formData.message} onChange={e => setFormData({...formData, message: e.target.value})} placeholder="Join our portal to order supplies..."></textarea>
          </div>
          
          <div className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} className="glass-button-secondary flex-1">Cancel</button>
            <button type="submit" disabled={loading} className="glass-button-primary flex-1">
              {loading ? <i className="fa fa-spinner fa-spin"></i> : <><i className="fa fa-paper-plane mr-2"></i> Send Invite</>}
            </button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
};

// 11. Admin Clinic Details Screen
const AdminClinicDetailsScreen: React.FC = () => {
  const location = useLocation();
  const clinicId = location.pathname.split('/').pop();
  
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clinicId) return;
    Promise.all([
      fetch(`${BASE_URL}/data?app_id=${APP_ID}&table_name=clinics`).then(r => r.json()),
      fetch(`${BASE_URL}/data?app_id=${APP_ID}&table_name=orders&clinic_id=${clinicId}`).then(r => r.json())
    ]).then(([clinicsData, ordersData]) => {
      const found = Array.isArray(clinicsData) ? clinicsData.find(c => c.id === clinicId) : null;
      setClinic(found || null);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
    }).catch(console.error).finally(() => setLoading(false));
  }, [clinicId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background dark:bg-background"><i className="fa fa-spinner fa-spin text-4xl text-primary"></i></div>;
  if (!clinic) return <div className="min-h-screen flex items-center justify-center bg-background dark:bg-background text-foreground">Clinic not found</div>;

  return (
    <div className="min-h-screen bg-background dark:bg-background pb-24">
      <Navbar title="Clinic Details" showBack />
      
      <main className="max-w-screen-xl mx-auto px-4 lg:px-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <GlassCard>
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary text-2xl mb-4">
              <i className="fa fa-hospital"></i>
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-1">{clinic.clinic_name}</h2>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/20 text-success mb-6">
              {clinic.account_status}
            </span>

            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <i className="fa fa-map-marker-alt text-muted-foreground mt-1 w-4 text-center"></i>
                <div>
                  <p className="text-foreground">{clinic.address}</p>
                  <p className="text-muted-foreground">{clinic.city}, {clinic.state} {clinic.zip_code}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <i className="fa fa-phone text-muted-foreground w-4 text-center"></i>
                <p className="text-foreground">{clinic.phone}</p>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-border/50">
              <button className="glass-button-secondary w-full text-error hover:bg-error/10 hover:border-error/30">
                <i className="fa fa-ban mr-2"></i> Deactivate Account
              </button>
            </div>
          </GlassCard>
        </div>

        <div className="lg:col-span-2">
          <GlassCard className="h-full">
            <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
              <i className="fa fa-list text-primary"></i> Order History
            </h3>
            
            <div className="space-y-4">
              {orders.length > 0 ? orders.sort((a,b) => new Date(b.estimated_delivery_date).getTime() - new Date(a.estimated_delivery_date).getTime()).map(order => (
                <div key={order.id} className="p-4 rounded-xl bg-surface/50 dark:bg-surface/20 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-semibold text-foreground">{order.order_number}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${order.order_status === 'Delivered' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}`}>
                        {order.order_status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{order.order_items.length} items • {new Date(order.estimated_delivery_date).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <span className="font-bold text-foreground">${order.total_cost.toFixed(2)}</span>
                    <button className="glass-button-secondary h-8 px-3 text-xs rounded-lg">
                      View Details
                    </button>
                  </div>
                </div>
              )) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No orders placed by this clinic yet.</p>
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      </main>
    </div>
  );
};

// --- Main App Component ---
export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user_data');
    return saved ? JSON.parse(saved) : null;
  });
  const [clinic, setClinic] = useState<Clinic | null>(() => {
    const saved = localStorage.getItem('clinic_data');
    return saved ? JSON.parse(saved) : null;
  });
  const [cart, setCart] = useState<OrderItem[]>([]);

  const addToCart = (product: Product, quantity: number) => {
    setCart(prev => {
      const existing = prev.find(item => item.product_id === product.id);
      if (existing) {
        return prev.map(item => item.product_id === product.id ? { ...item, quantity: item.quantity + quantity } : item);
      }
      return [...prev, {
        product_id: product.id,
        product_name: product.product_name,
        product_code: product.product_code,
        quantity,
        unit_price: product.price
      }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product_id !== productId));
  };

  const clearCart = () => setCart([]);

  const logout = () => {
    setUser(null);
    setClinic(null);
    setCart([]);
    localStorage.removeItem('user_data');
    localStorage.removeItem('clinic_data');
    window.location.href = '/login';
  };

  const contextValue = useMemo(() => ({
    user, clinic, setUser, setClinic, cart, addToCart, removeFromCart, clearCart, logout
  }), [user, clinic, cart]);

  return (
    <AppContext.Provider value={contextValue}>
      <Routes>
        <Route path="/" element={<SplashScreen />} />
        <Route path="/login" element={!user ? <AuthScreen /> : <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/clinic/dashboard'} />} />
        <Route path="/register" element={!user ? <RegistrationScreen /> : <Navigate to="/clinic/dashboard" />} />
        
        {/* Clinic Routes */}
        <Route path="/clinic/dashboard" element={user?.role === 'clinic' ? <ClinicDashboard /> : <Navigate to="/login" />} />
        <Route path="/clinic/order" element={user?.role === 'clinic' ? <OrderPlacementScreen /> : <Navigate to="/login" />} />
        <Route path="/clinic/checkout" element={user?.role === 'clinic' ? <OrderCheckoutScreen /> : <Navigate to="/login" />} />
        <Route path="/clinic/confirmation" element={user?.role === 'clinic' ? <OrderConfirmationScreen /> : <Navigate to="/login" />} />
        <Route path="/clinic/profile" element={user?.role === 'clinic' ? <ClinicProfileScreen /> : <Navigate to="/login" />} />
        
        {/* Admin Routes */}
        <Route path="/admin/dashboard" element={user?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/login" />} />
        <Route path="/admin/clinic/:id" element={user?.role === 'admin' ? <AdminClinicDetailsScreen /> : <Navigate to="/login" />} />
        
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </AppContext.Provider>
  );
}