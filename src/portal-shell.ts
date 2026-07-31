type PortalRole = 'clinic' | 'admin';

type NavItem = {
  label: string;
  icon: string;
  path: string;
  match: (pathname: string) => boolean;
};

const SHELL_ID = 'occu-med-lab-portal-shell';
const MOBILE_TOGGLE_ID = 'occu-med-lab-portal-toggle';
const SCRIM_ID = 'occu-med-lab-portal-scrim';

const clinicItems: NavItem[] = [
  {
    label: 'Dashboard',
    icon: 'fa-chart-pie',
    path: '/clinic/dashboard',
    match: pathname => pathname === '/clinic/dashboard',
  },
  {
    label: 'Order Supplies',
    icon: 'fa-box-open',
    path: '/clinic/order',
    match: pathname => pathname === '/clinic/order',
  },
  {
    label: 'Checkout',
    icon: 'fa-shopping-bag',
    path: '/clinic/checkout',
    match: pathname => pathname === '/clinic/checkout',
  },
  {
    label: 'Clinic Profile',
    icon: 'fa-hospital-user',
    path: '/clinic/profile',
    match: pathname => pathname === '/clinic/profile',
  },
];

const adminItems: NavItem[] = [
  {
    label: 'Dashboard',
    icon: 'fa-chart-line',
    path: '/admin/dashboard',
    match: pathname => pathname === '/admin/dashboard',
  },
  {
    label: 'Clinic Directory',
    icon: 'fa-hospital',
    path: '/admin/dashboard#clinics',
    match: pathname => pathname.startsWith('/admin/clinic/'),
  },
  {
    label: 'Orders',
    icon: 'fa-clipboard-list',
    path: '/admin/dashboard#orders',
    match: () => false,
  },
];

const readStoredJson = <T>(key: string): T | null => {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : null;
  } catch {
    return null;
  }
};

const getRole = (pathname: string): PortalRole | null => {
  if (pathname.startsWith('/clinic/')) return 'clinic';
  if (pathname.startsWith('/admin/')) return 'admin';
  return null;
};

const closeMobileShell = () => {
  document.body.classList.remove('lab-shell-open');
};

const goTo = (path: string) => {
  closeMobileShell();

  const url = new URL(path, window.location.origin);
  const current = `${window.location.pathname}${window.location.hash}`;
  const target = `${url.pathname}${url.hash}`;

  if (current === target) return;

  window.history.pushState({}, '', target);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.setTimeout(syncPortalShell, 0);
};

const logout = () => {
  window.localStorage.removeItem('user_data');
  window.localStorage.removeItem('clinic_data');
  window.localStorage.removeItem('cart_data');
  window.location.assign('/login');
};

const createShell = () => {
  const shell = document.createElement('aside');
  shell.id = SHELL_ID;
  shell.className = 'lab-portal-shell';
  shell.setAttribute('aria-label', 'Lab portal navigation');
  shell.innerHTML = `
    <div class="lab-portal-shell__shine" aria-hidden="true"></div>
    <div class="lab-portal-shell__brand">
      <div class="lab-portal-shell__logo-wrap">
        <img src="/brand-text-logo.svg" alt="Occu-Med" class="lab-portal-shell__logo" />
      </div>
      <div>
        <strong>Lab Supplies</strong>
        <span data-portal-label>Portal</span>
      </div>
    </div>

    <div class="lab-portal-shell__account">
      <div class="lab-portal-shell__avatar" data-portal-avatar>O</div>
      <div class="lab-portal-shell__identity">
        <strong data-portal-name>Occu-Med</strong>
        <span data-portal-email>Lab Supply Portal</span>
      </div>
      <span class="lab-portal-shell__status" title="Active"></span>
    </div>

    <div class="lab-portal-shell__section-label">Workspace</div>
    <nav class="lab-portal-shell__nav" data-portal-nav></nav>

    <div class="lab-portal-shell__footer">
      <div class="lab-portal-shell__secure">
        <i class="fa fa-shield-alt" aria-hidden="true"></i>
        <span>Secure clinic workspace</span>
      </div>
      <button type="button" class="lab-portal-shell__logout" data-portal-action="logout">
        <i class="fa fa-sign-out-alt" aria-hidden="true"></i>
        <span>Sign Out</span>
      </button>
    </div>
  `;

  shell.addEventListener('click', event => {
    const target = event.target as HTMLElement;
    const routeButton = target.closest<HTMLButtonElement>('[data-portal-path]');
    if (routeButton?.dataset.portalPath) {
      goTo(routeButton.dataset.portalPath);
      return;
    }

    const actionButton = target.closest<HTMLButtonElement>('[data-portal-action="logout"]');
    if (actionButton) logout();
  });

  document.body.appendChild(shell);

  const toggle = document.createElement('button');
  toggle.id = MOBILE_TOGGLE_ID;
  toggle.className = 'lab-portal-shell__toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'Open portal navigation');
  toggle.innerHTML = '<i class="fa fa-bars" aria-hidden="true"></i>';
  toggle.addEventListener('click', () => {
    document.body.classList.toggle('lab-shell-open');
  });
  document.body.appendChild(toggle);

  const scrim = document.createElement('button');
  scrim.id = SCRIM_ID;
  scrim.className = 'lab-portal-shell__scrim';
  scrim.type = 'button';
  scrim.setAttribute('aria-label', 'Close portal navigation');
  scrim.addEventListener('click', closeMobileShell);
  document.body.appendChild(scrim);

  return shell;
};

const removeShell = () => {
  document.getElementById(SHELL_ID)?.remove();
  document.getElementById(MOBILE_TOGGLE_ID)?.remove();
  document.getElementById(SCRIM_ID)?.remove();
  document.body.classList.remove(
    'lab-shell-active',
    'lab-shell-open',
    'lab-shell-clinic',
    'lab-shell-admin',
    'lab-route-dashboard',
    'lab-route-order',
    'lab-route-checkout',
    'lab-route-profile',
    'lab-route-admin-clinic',
  );
};

const routeClassFor = (pathname: string) => {
  if (pathname.endsWith('/dashboard')) return 'lab-route-dashboard';
  if (pathname === '/clinic/order') return 'lab-route-order';
  if (pathname === '/clinic/checkout') return 'lab-route-checkout';
  if (pathname === '/clinic/profile') return 'lab-route-profile';
  if (pathname.startsWith('/admin/clinic/')) return 'lab-route-admin-clinic';
  return '';
};

const renderNavigation = (shell: HTMLElement, role: PortalRole, pathname: string) => {
  const nav = shell.querySelector<HTMLElement>('[data-portal-nav]');
  if (!nav) return;

  const items = role === 'clinic' ? clinicItems : adminItems;
  nav.replaceChildren(...items.map(item => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `lab-portal-shell__nav-item${item.match(pathname) ? ' is-active' : ''}`;
    button.dataset.portalPath = item.path;
    if (item.match(pathname)) button.setAttribute('aria-current', 'page');
    button.innerHTML = `
      <span class="lab-portal-shell__nav-icon"><i class="fa ${item.icon}" aria-hidden="true"></i></span>
      <span>${item.label}</span>
      <i class="fa fa-chevron-right lab-portal-shell__nav-arrow" aria-hidden="true"></i>
    `;
    return button;
  }));
};

const updateIdentity = (shell: HTMLElement, role: PortalRole) => {
  const user = readStoredJson<{ email?: string }>('user_data');
  const clinic = readStoredJson<{ clinic_name?: string }>('clinic_data');
  const name = role === 'clinic' ? (clinic?.clinic_name || 'Clinic Portal') : 'Occu-Med Administration';
  const email = user?.email || (role === 'clinic' ? 'Clinic account' : 'Administrator');
  const avatar = name.trim().charAt(0).toUpperCase() || 'O';

  const labelElement = shell.querySelector<HTMLElement>('[data-portal-label]');
  const nameElement = shell.querySelector<HTMLElement>('[data-portal-name]');
  const emailElement = shell.querySelector<HTMLElement>('[data-portal-email]');
  const avatarElement = shell.querySelector<HTMLElement>('[data-portal-avatar]');

  if (labelElement) labelElement.textContent = role === 'clinic' ? 'Clinic Portal' : 'Admin Portal';
  if (nameElement) nameElement.textContent = name;
  if (emailElement) emailElement.textContent = email;
  if (avatarElement) avatarElement.textContent = avatar;
};

function syncPortalShell() {
  const pathname = window.location.pathname;
  const role = getRole(pathname);

  if (!role) {
    removeShell();
    return;
  }

  let shell = document.getElementById(SHELL_ID);
  if (!shell) shell = createShell();

  document.body.classList.add('lab-shell-active');
  document.body.classList.toggle('lab-shell-clinic', role === 'clinic');
  document.body.classList.toggle('lab-shell-admin', role === 'admin');

  const routeClasses = [
    'lab-route-dashboard',
    'lab-route-order',
    'lab-route-checkout',
    'lab-route-profile',
    'lab-route-admin-clinic',
  ];
  document.body.classList.remove(...routeClasses);
  const routeClass = routeClassFor(pathname);
  if (routeClass) document.body.classList.add(routeClass);

  renderNavigation(shell, role, pathname);
  updateIdentity(shell, role);
}

const wrapHistoryMethod = (method: 'pushState' | 'replaceState') => {
  const original = window.history[method].bind(window.history);
  window.history[method] = ((...args: Parameters<History[typeof method]>) => {
    const result = original(...args);
    window.setTimeout(syncPortalShell, 0);
    return result;
  }) as History[typeof method];
};

wrapHistoryMethod('pushState');
wrapHistoryMethod('replaceState');
window.addEventListener('popstate', syncPortalShell);
window.addEventListener('storage', syncPortalShell);
window.addEventListener('DOMContentLoaded', syncPortalShell);

const observer = new MutationObserver(() => {
  if (getRole(window.location.pathname) && !document.getElementById(SHELL_ID)) {
    syncPortalShell();
  }
});
observer.observe(document.documentElement, { childList: true, subtree: true });

syncPortalShell();
