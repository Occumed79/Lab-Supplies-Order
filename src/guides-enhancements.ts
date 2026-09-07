export {};

interface GuideRecord {
  id: string;
  title: string;
  category: string;
  file_name: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

const API_BASE = import.meta.env.DEV
  ? '/api'
  : ((import.meta.env.VITE_API_BASE_URL as string | undefined) || 'https://lab-supplies-order-api.onrender.com').replace(/\/$/, '');

const MAX_PDF_BYTES = 12 * 1024 * 1024;
const TAB_ID = 'occu-guides-tab';
const OVERLAY_ID = 'occu-guides-overlay';
const STYLE_ID = 'occu-guides-styles';

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const currentRole = (): 'admin' | 'clinic' | null => {
  try {
    const raw = localStorage.getItem('user_data');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.role === 'admin' || parsed?.role === 'clinic') return parsed.role;
    }
  } catch {
    // Fall through to pathname detection.
  }

  if (window.location.pathname.startsWith('/admin')) return 'admin';
  if (window.location.pathname.startsWith('/clinic')) return 'clinic';
  return null;
};

const currentUserId = (): string | null => {
  try {
    const raw = localStorage.getItem('user_data');
    if (!raw) return null;
    return JSON.parse(raw)?.id || null;
  } catch {
    return null;
  }
};

const injectStyles = () => {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${TAB_ID} {
      display: inline-flex;
      align-items: center;
      gap: .5rem;
      height: 2.5rem;
      padding: 0 .95rem;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,.18);
      background: rgba(255,255,255,.07);
      color: rgb(var(--color-foreground-rgb, 255 255 255));
      font-size: .82rem;
      font-weight: 650;
      letter-spacing: .02em;
      cursor: pointer;
      backdrop-filter: blur(16px) saturate(160%);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.08), 0 8px 24px rgba(0,0,0,.12);
      transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease, background .18s ease;
    }
    #${TAB_ID}:hover {
      transform: translateY(-1px);
      border-color: rgba(72,202,228,.48);
      background: rgba(72,202,228,.10);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.12), 0 0 24px rgba(72,202,228,.15);
    }
    #${OVERLAY_ID} {
      position: fixed;
      inset: 0;
      z-index: 9998;
      overflow: auto;
      color: #eef7ff;
      background:
        radial-gradient(circle at 52% 12%, rgba(66, 138, 215, .18), transparent 32%),
        radial-gradient(circle at 88% 74%, rgba(0, 180, 216, .10), transparent 32%),
        linear-gradient(145deg, rgba(2, 13, 31, .995), rgba(3, 27, 61, .99));
    }
    .occu-guides-shell {
      min-height: 100vh;
      padding: 18px;
      box-sizing: border-box;
    }
    .occu-guides-frame {
      min-height: calc(100vh - 36px);
      border: 1px solid rgba(146, 204, 236, .22);
      border-radius: 30px;
      overflow: hidden;
      background: rgba(2, 16, 39, .74);
      box-shadow:
        0 28px 80px rgba(0, 0, 0, .35),
        inset 0 0 0 1px rgba(255,255,255,.035),
        inset 0 1px 0 rgba(255,255,255,.08),
        0 0 0 6px rgba(64, 140, 180, .035);
      backdrop-filter: blur(22px) saturate(145%);
    }
    .occu-guides-topbar {
      min-height: 78px;
      padding: 16px 22px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      border-bottom: 1px solid rgba(255,255,255,.08);
      background: linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.012));
    }
    .occu-guides-heading {
      display: flex;
      align-items: center;
      gap: 13px;
    }
    .occu-guides-icon {
      width: 42px;
      height: 42px;
      border-radius: 14px;
      display: grid;
      place-items: center;
      background: rgba(72,202,228,.10);
      border: 1px solid rgba(72,202,228,.22);
      color: #91e9f8;
      box-shadow: inset 0 0 18px rgba(72,202,228,.07);
    }
    .occu-guides-heading h2 {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 750;
      letter-spacing: .02em;
    }
    .occu-guides-heading p {
      margin: 3px 0 0;
      color: rgba(224,239,255,.58);
      font-size: .78rem;
    }
    .occu-guides-close,
    .occu-guides-action,
    .occu-guides-danger {
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 999px;
      background: rgba(255,255,255,.055);
      color: #f2f8ff;
      min-height: 40px;
      padding: 0 16px;
      cursor: pointer;
      font-size: .82rem;
      font-weight: 650;
      transition: .18s ease;
    }
    .occu-guides-close:hover,
    .occu-guides-action:hover {
      background: rgba(72,202,228,.10);
      border-color: rgba(72,202,228,.34);
    }
    .occu-guides-danger {
      color: #ffb9bd;
      border-color: rgba(239,68,68,.2);
      background: rgba(239,68,68,.06);
    }
    .occu-guides-danger:hover {
      background: rgba(239,68,68,.14);
      border-color: rgba(239,68,68,.34);
    }
    .occu-guides-body {
      display: grid;
      grid-template-columns: minmax(230px, 285px) minmax(0, 1fr);
      gap: 18px;
      padding: 18px;
      min-height: calc(100vh - 115px);
      box-sizing: border-box;
    }
    .occu-guides-sidebar,
    .occu-guides-viewer,
    .occu-guides-card {
      border: 1px solid rgba(255,255,255,.095);
      border-radius: 24px;
      background: rgba(255,255,255,.035);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.045);
      backdrop-filter: blur(18px) saturate(140%);
    }
    .occu-guides-sidebar {
      padding: 14px;
      align-self: stretch;
    }
    .occu-guides-label {
      margin: 2px 5px 12px;
      color: rgba(210,230,246,.52);
      font-size: .67rem;
      font-weight: 750;
      letter-spacing: .16em;
      text-transform: uppercase;
    }
    .occu-guide-category {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      min-height: 42px;
      padding: 8px 12px;
      margin-bottom: 7px;
      border-radius: 13px;
      border: 1px solid transparent;
      background: transparent;
      color: rgba(230,243,255,.72);
      text-align: left;
      cursor: pointer;
      transition: .16s ease;
    }
    .occu-guide-category:hover,
    .occu-guide-category.active {
      color: #ffffff;
      border-color: rgba(108,190,229,.20);
      background: rgba(61,131,180,.12);
      box-shadow: inset 0 0 22px rgba(72,202,228,.035);
    }
    .occu-guide-count {
      min-width: 26px;
      height: 22px;
      padding: 0 7px;
      border-radius: 999px;
      display: inline-grid;
      place-items: center;
      color: rgba(218,238,251,.72);
      background: rgba(255,255,255,.055);
      font-size: .68rem;
    }
    .occu-guides-list {
      margin-top: 16px;
      padding-top: 14px;
      border-top: 1px solid rgba(255,255,255,.07);
    }
    .occu-guide-item {
      width: 100%;
      padding: 11px 12px;
      margin-bottom: 8px;
      border: 1px solid rgba(255,255,255,.065);
      border-radius: 14px;
      background: rgba(255,255,255,.025);
      color: #eaf4ff;
      text-align: left;
      cursor: pointer;
      transition: .16s ease;
    }
    .occu-guide-item:hover,
    .occu-guide-item.active {
      transform: translateY(-1px);
      border-color: rgba(92,186,230,.27);
      background: rgba(52,118,170,.12);
    }
    .occu-guide-item strong {
      display: block;
      font-size: .81rem;
      line-height: 1.25;
    }
    .occu-guide-item span {
      display: block;
      margin-top: 4px;
      color: rgba(213,232,247,.50);
      font-size: .67rem;
    }
    .occu-guides-viewer {
      position: relative;
      overflow: hidden;
      min-height: 680px;
      display: flex;
      flex-direction: column;
    }
    .occu-guides-viewer-head {
      min-height: 68px;
      padding: 13px 17px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 15px;
      border-bottom: 1px solid rgba(255,255,255,.08);
      background: rgba(255,255,255,.025);
    }
    .occu-guides-viewer-head h3 {
      margin: 0;
      font-size: .96rem;
    }
    .occu-guides-viewer-head p {
      margin: 4px 0 0;
      color: rgba(213,232,247,.52);
      font-size: .72rem;
    }
    .occu-guides-pdf-wrap {
      position: relative;
      flex: 1;
      min-height: 610px;
      background: rgba(0,0,0,.20);
    }
    .occu-guides-pdf-wrap::before {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 1;
      box-shadow: inset 0 0 46px rgba(0,0,0,.30);
    }
    .occu-guides-pdf {
      width: 100%;
      height: 100%;
      min-height: 610px;
      border: 0;
      display: block;
      background: #fff;
    }
    .occu-guides-empty {
      min-height: 500px;
      display: grid;
      place-items: center;
      text-align: center;
      padding: 30px;
      color: rgba(219,235,248,.52);
    }
    .occu-guides-empty i {
      display: block;
      font-size: 2.4rem;
      margin-bottom: 14px;
      color: rgba(110,211,237,.65);
    }
    .occu-guides-admin-grid {
      display: grid;
      grid-template-columns: minmax(300px, 410px) minmax(0, 1fr);
      gap: 18px;
      padding: 18px;
      min-height: calc(100vh - 115px);
      box-sizing: border-box;
    }
    .occu-guides-card {
      padding: 20px;
    }
    .occu-guides-card h3 {
      margin: 0 0 5px;
      font-size: 1rem;
    }
    .occu-guides-card > p {
      margin: 0 0 20px;
      color: rgba(213,232,247,.52);
      font-size: .75rem;
      line-height: 1.45;
    }
    .occu-guide-field {
      margin-bottom: 15px;
    }
    .occu-guide-field label {
      display: block;
      margin: 0 0 6px 2px;
      color: rgba(235,246,255,.86);
      font-size: .74rem;
      font-weight: 650;
    }
    .occu-guide-field input {
      width: 100%;
      min-height: 46px;
      box-sizing: border-box;
      padding: 0 13px;
      border-radius: 13px;
      border: 1px solid rgba(255,255,255,.13);
      outline: none;
      background: rgba(3,17,40,.62);
      color: #f4f9ff;
      font: inherit;
    }
    .occu-guide-field input:focus {
      border-color: rgba(72,202,228,.48);
      box-shadow: 0 0 0 3px rgba(72,202,228,.07);
    }
    .occu-guide-file {
      padding: 10px !important;
      cursor: pointer;
    }
    .occu-guide-submit {
      width: 100%;
      min-height: 48px;
      border: 1px solid rgba(80,200,230,.28);
      border-radius: 14px;
      background: linear-gradient(135deg, rgba(3,62,138,.84), rgba(0,150,199,.70));
      color: white;
      font-weight: 750;
      cursor: pointer;
      box-shadow: inset 0 1px 0 rgba(255,255,255,.12), 0 12px 26px rgba(0,119,182,.12);
    }
    .occu-guide-submit:disabled { opacity: .5; cursor: wait; }
    .occu-guide-status {
      min-height: 20px;
      margin-top: 10px;
      font-size: .72rem;
      color: rgba(210,232,247,.62);
    }
    .occu-guide-admin-list {
      display: grid;
      gap: 10px;
      max-height: calc(100vh - 210px);
      overflow: auto;
      padding-right: 4px;
    }
    .occu-guide-admin-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 14px;
      align-items: center;
      padding: 14px;
      border: 1px solid rgba(255,255,255,.075);
      border-radius: 15px;
      background: rgba(255,255,255,.025);
    }
    .occu-guide-admin-row strong { display: block; font-size: .86rem; }
    .occu-guide-admin-row span { display: block; margin-top: 4px; color: rgba(213,232,247,.50); font-size: .69rem; }
    .occu-guide-admin-actions { display: flex; gap: 7px; }
    @media (max-width: 900px) {
      .occu-guides-body,
      .occu-guides-admin-grid { grid-template-columns: 1fr; }
      .occu-guides-sidebar { max-height: none; }
      .occu-guides-viewer,
      .occu-guides-pdf,
      .occu-guides-pdf-wrap { min-height: 70vh; }
      .occu-guide-admin-list { max-height: none; }
    }
    @media (max-width: 600px) {
      .occu-guides-shell { padding: 8px; }
      .occu-guides-frame { border-radius: 22px; }
      .occu-guides-topbar { padding: 13px; }
      .occu-guides-body,
      .occu-guides-admin-grid { padding: 10px; gap: 10px; }
      #${TAB_ID} span { display: none; }
      #${TAB_ID} { width: 2.5rem; padding: 0; justify-content: center; }
    }
  `;
  document.head.appendChild(style);
};

const guidePdfUrl = (guide: GuideRecord) => `${API_BASE}/guides/${encodeURIComponent(guide.id)}/pdf`;

const fetchGuides = async (): Promise<GuideRecord[]> => {
  const response = await fetch(`${API_BASE}/guides`);
  if (!response.ok) throw new Error('Unable to load guides.');
  const data = await response.json();
  return Array.isArray(data) ? data : [];
};

const closeOverlay = () => {
  document.getElementById(OVERLAY_ID)?.remove();
};

const overlayShell = (role: 'admin' | 'clinic') => {
  closeOverlay();
  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.innerHTML = `
    <div class="occu-guides-shell">
      <section class="occu-guides-frame">
        <header class="occu-guides-topbar">
          <div class="occu-guides-heading">
            <div class="occu-guides-icon"><i class="fa fa-book-open"></i></div>
            <div>
              <h2>${role === 'admin' ? 'Guide Library Management' : 'Guides'}</h2>
              <p>${role === 'admin' ? 'Upload and organize PDF guides for clinics.' : 'Reference guides provided by OCCU-MED.'}</p>
            </div>
          </div>
          <button class="occu-guides-close" type="button"><i class="fa fa-times mr-2"></i> Close</button>
        </header>
        <div class="occu-guides-content"></div>
      </section>
    </div>
  `;
  overlay.querySelector<HTMLButtonElement>('.occu-guides-close')?.addEventListener('click', closeOverlay);
  document.body.appendChild(overlay);
  return overlay.querySelector<HTMLElement>('.occu-guides-content')!;
};

const renderClinicGuides = async () => {
  const content = overlayShell('clinic');
  content.innerHTML = '<div class="occu-guides-empty"><div><i class="fa fa-circle-notch fa-spin"></i><div>Loading guides…</div></div></div>';

  try {
    const guides = await fetchGuides();
    if (!guides.length) {
      content.innerHTML = '<div class="occu-guides-empty"><div><i class="fa fa-book-open"></i><strong>No guides have been published yet.</strong><div style="margin-top:7px">When OCCU-MED adds a guide, it will appear here automatically.</div></div></div>';
      return;
    }

    const categories = Array.from(new Set(guides.map((guide) => guide.category || 'General'))).sort((a, b) => a.localeCompare(b));
    let activeCategory = categories[0];
    let activeGuide = guides.find((guide) => guide.category === activeCategory) || guides[0];

    content.innerHTML = `
      <div class="occu-guides-body">
        <aside class="occu-guides-sidebar">
          <div class="occu-guides-label">Guide categories</div>
          <div class="occu-guide-categories"></div>
          <div class="occu-guides-list">
            <div class="occu-guides-label">Available guides</div>
            <div class="occu-guide-items"></div>
          </div>
        </aside>
        <section class="occu-guides-viewer">
          <div class="occu-guides-viewer-head">
            <div class="occu-guide-view-title"></div>
            <button class="occu-guides-action occu-guide-open" type="button"><i class="fa fa-external-link-alt mr-2"></i> Open PDF</button>
          </div>
          <div class="occu-guides-pdf-wrap"><iframe class="occu-guides-pdf" title="Guide PDF"></iframe></div>
        </section>
      </div>
    `;

    const categoriesHost = content.querySelector<HTMLElement>('.occu-guide-categories')!;
    const itemsHost = content.querySelector<HTMLElement>('.occu-guide-items')!;
    const titleHost = content.querySelector<HTMLElement>('.occu-guide-view-title')!;
    const pdf = content.querySelector<HTMLIFrameElement>('.occu-guides-pdf')!;
    const openButton = content.querySelector<HTMLButtonElement>('.occu-guide-open')!;

    const renderViewer = () => {
      if (!activeGuide) return;
      titleHost.innerHTML = `<h3>${escapeHtml(activeGuide.title)}</h3><p>${escapeHtml(activeGuide.category)} · ${escapeHtml(activeGuide.file_name)}</p>`;
      const url = `${guidePdfUrl(activeGuide)}#toolbar=1&navpanes=0&view=FitH`;
      pdf.src = url;
      openButton.onclick = () => window.open(guidePdfUrl(activeGuide), '_blank', 'noopener,noreferrer');
    };

    const renderGuideItems = () => {
      const visible = guides.filter((guide) => guide.category === activeCategory);
      if (!visible.some((guide) => guide.id === activeGuide?.id)) activeGuide = visible[0] || guides[0];
      itemsHost.innerHTML = visible.map((guide) => `
        <button class="occu-guide-item ${guide.id === activeGuide?.id ? 'active' : ''}" data-guide-id="${escapeHtml(guide.id)}" type="button">
          <strong>${escapeHtml(guide.title)}</strong>
          <span>${escapeHtml(guide.file_name)}</span>
        </button>
      `).join('');
      itemsHost.querySelectorAll<HTMLButtonElement>('.occu-guide-item').forEach((button) => {
        button.addEventListener('click', () => {
          activeGuide = guides.find((guide) => guide.id === button.dataset.guideId) || activeGuide;
          renderGuideItems();
          renderViewer();
        });
      });
    };

    const renderCategories = () => {
      categoriesHost.innerHTML = categories.map((category) => {
        const count = guides.filter((guide) => guide.category === category).length;
        return `
          <button class="occu-guide-category ${category === activeCategory ? 'active' : ''}" data-category="${escapeHtml(category)}" type="button">
            <span>${escapeHtml(category)}</span><span class="occu-guide-count">${count}</span>
          </button>`;
      }).join('');
      categoriesHost.querySelectorAll<HTMLButtonElement>('.occu-guide-category').forEach((button) => {
        button.addEventListener('click', () => {
          activeCategory = button.dataset.category || activeCategory;
          activeGuide = guides.find((guide) => guide.category === activeCategory) || activeGuide;
          renderCategories();
          renderGuideItems();
          renderViewer();
        });
      });
    };

    renderCategories();
    renderGuideItems();
    renderViewer();
  } catch (error) {
    console.error(error);
    content.innerHTML = '<div class="occu-guides-empty"><div><i class="fa fa-exclamation-circle"></i><strong>Guides could not be loaded.</strong><div style="margin-top:7px">Please try again in a moment.</div></div></div>';
  }
};

const readFileAsBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const result = String(reader.result || '');
    resolve(result.includes(',') ? result.split(',')[1] : result);
  };
  reader.onerror = () => reject(reader.error || new Error('Unable to read PDF.'));
  reader.readAsDataURL(file);
});

const renderAdminGuides = async () => {
  const content = overlayShell('admin');
  content.innerHTML = `
    <div class="occu-guides-admin-grid">
      <section class="occu-guides-card">
        <h3>Upload a guide</h3>
        <p>The title and guide type are what clinics will use to find the document. PDFs are displayed directly inside the clinic guide viewer.</p>
        <form class="occu-guide-form">
          <div class="occu-guide-field">
            <label for="occu-guide-title">Guide title</label>
            <input id="occu-guide-title" name="title" type="text" required maxlength="160" placeholder="e.g. CRL Specimen Packaging Guide" />
          </div>
          <div class="occu-guide-field">
            <label for="occu-guide-category">Guide type / category</label>
            <input id="occu-guide-category" name="category" type="text" list="occu-guide-category-options" required maxlength="100" placeholder="e.g. Shipping & Packaging" />
            <datalist id="occu-guide-category-options">
              <option value="Collection Procedures"></option>
              <option value="Laboratory"></option>
              <option value="Shipping & Packaging"></option>
              <option value="Drug Testing"></option>
              <option value="Forms & Documentation"></option>
              <option value="General Reference"></option>
            </datalist>
          </div>
          <div class="occu-guide-field">
            <label for="occu-guide-file">PDF guide</label>
            <input id="occu-guide-file" class="occu-guide-file" name="pdf" type="file" accept="application/pdf,.pdf" required />
          </div>
          <button class="occu-guide-submit" type="submit"><i class="fa fa-cloud-upload-alt mr-2"></i> Publish Guide</button>
          <div class="occu-guide-status"></div>
        </form>
      </section>
      <section class="occu-guides-card">
        <h3>Published guides</h3>
        <p>These are immediately available in the clinic Guides tab.</p>
        <div class="occu-guide-admin-list"><div class="occu-guides-empty"><div><i class="fa fa-circle-notch fa-spin"></i><div>Loading guides…</div></div></div></div>
      </section>
    </div>
  `;

  const form = content.querySelector<HTMLFormElement>('.occu-guide-form')!;
  const status = content.querySelector<HTMLElement>('.occu-guide-status')!;
  const list = content.querySelector<HTMLElement>('.occu-guide-admin-list')!;
  const submitButton = content.querySelector<HTMLButtonElement>('.occu-guide-submit')!;

  const refreshList = async () => {
    try {
      const guides = await fetchGuides();
      if (!guides.length) {
        list.innerHTML = '<div class="occu-guides-empty"><div><i class="fa fa-book-open"></i><strong>No guides published yet.</strong></div></div>';
        return;
      }
      list.innerHTML = guides.map((guide) => `
        <div class="occu-guide-admin-row">
          <div>
            <strong>${escapeHtml(guide.title)}</strong>
            <span>${escapeHtml(guide.category)} · ${escapeHtml(guide.file_name)}</span>
          </div>
          <div class="occu-guide-admin-actions">
            <button class="occu-guides-action" type="button" data-preview="${escapeHtml(guide.id)}" title="Preview guide"><i class="fa fa-eye"></i></button>
            <button class="occu-guides-danger" type="button" data-delete="${escapeHtml(guide.id)}" title="Delete guide"><i class="fa fa-trash"></i></button>
          </div>
        </div>
      `).join('');

      list.querySelectorAll<HTMLButtonElement>('[data-preview]').forEach((button) => {
        button.addEventListener('click', () => {
          const guide = guides.find((item) => item.id === button.dataset.preview);
          if (guide) window.open(guidePdfUrl(guide), '_blank', 'noopener,noreferrer');
        });
      });

      list.querySelectorAll<HTMLButtonElement>('[data-delete]').forEach((button) => {
        button.addEventListener('click', async () => {
          const guide = guides.find((item) => item.id === button.dataset.delete);
          if (!guide || !window.confirm(`Remove “${guide.title}” from the clinic guide library?`)) return;
          button.disabled = true;
          try {
            const response = await fetch(`${API_BASE}/guides/${encodeURIComponent(guide.id)}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Delete failed');
            await refreshList();
          } catch (error) {
            console.error(error);
            window.alert('The guide could not be removed.');
            button.disabled = false;
          }
        });
      });
    } catch (error) {
      console.error(error);
      list.innerHTML = '<div class="occu-guides-empty"><div><i class="fa fa-exclamation-circle"></i><strong>Unable to load guides.</strong></div></div>';
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const titleInput = form.elements.namedItem('title') as HTMLInputElement;
    const categoryInput = form.elements.namedItem('category') as HTMLInputElement;
    const fileInput = form.elements.namedItem('pdf') as HTMLInputElement;
    const file = fileInput.files?.[0];

    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      status.textContent = 'Please choose a PDF file.';
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      status.textContent = 'This PDF is larger than 12 MB. Please use a smaller PDF.';
      return;
    }

    submitButton.disabled = true;
    status.textContent = 'Preparing PDF…';

    try {
      const pdfBase64 = await readFileAsBase64(file);
      status.textContent = 'Publishing guide…';
      const response = await fetch(`${API_BASE}/guides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: titleInput.value.trim(),
          category: categoryInput.value.trim(),
          file_name: file.name,
          pdf_base64: pdfBase64,
          created_by: currentUserId()
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.error || 'Upload failed');
      form.reset();
      status.textContent = 'Guide published. It is now visible to clinics.';
      await refreshList();
    } catch (error: any) {
      console.error(error);
      status.textContent = error?.message || 'The guide could not be published.';
    } finally {
      submitButton.disabled = false;
    }
  });

  await refreshList();
};

const openGuides = () => {
  const role = currentRole();
  if (role === 'admin') void renderAdminGuides();
  if (role === 'clinic') void renderClinicGuides();
};

const ensureTab = () => {
  injectStyles();
  const role = currentRole();
  const pathname = window.location.pathname;
  const eligible = (role === 'clinic' && pathname === '/clinic/dashboard') || (role === 'admin' && pathname === '/admin/dashboard');
  const existing = document.getElementById(TAB_ID);

  if (!eligible) {
    existing?.remove();
    return;
  }
  if (existing) return;

  const nav = document.querySelector<HTMLElement>('nav.glass-panel-strong');
  if (!nav) return;

  const rightHost = nav.lastElementChild as HTMLElement | null;
  if (!rightHost || rightHost === nav.firstElementChild) return;
  rightHost.style.display = 'flex';
  rightHost.style.alignItems = 'center';
  rightHost.style.gap = '8px';

  const button = document.createElement('button');
  button.id = TAB_ID;
  button.type = 'button';
  button.innerHTML = '<i class="fa fa-book-open"></i><span>Guides</span>';
  button.setAttribute('aria-label', 'Open guides');
  button.addEventListener('click', openGuides);
  rightHost.prepend(button);
};

let syncScheduled = false;
const scheduleSync = () => {
  if (syncScheduled) return;
  syncScheduled = true;
  window.requestAnimationFrame(() => {
    syncScheduled = false;
    ensureTab();
  });
};

const observer = new MutationObserver(scheduleSync);
window.addEventListener('DOMContentLoaded', () => {
  observer.observe(document.body, { childList: true, subtree: true });
  scheduleSync();
});
window.addEventListener('popstate', scheduleSync);
