// Application Controller for "ދަނޑު ހިސާބު" (Dhandu Hisaabu)

import { 
  t, 
  getLanguage, 
  setLanguage, 
  translateDOM 
} from './i18n.js?v=1.1.6';

import {
  initDB,
  authenticate,
  getActiveUser,
  queryTable,
  insertRecord,
  updateRecord,
  deleteRecord,
  getOutbox,
  syncOfflineData,
  logAuditEvent,
  createFarm,
  registerFarmSelf,
  toggleFarmStatus,
  resetPassword
} from './database.js';

// Global 2 decimal places number formatter
function format2DP(val) {
  if (val === null || val === undefined || val === '') return '-';
  const num = parseFloat(val);
  if (isNaN(num)) return '-';
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const CURRENCY_HTML = ' <span class="mvr-symbol">$</span>';

// Helper to choose the best emoji for a crop based on name keywords (supporting English and Dhivehi)
function getCropEmoji(cropName) {
  const name = (cropName || '').toLowerCase();
  if (name.includes('watermelon') || name.includes('ކަރާ')) return '🍉';
  if (name.includes('melon') || name.includes('މެލަން')) return '🍈';
  if (name.includes('cucumber') || name.includes('ކެކުރި') || name.includes('ކިޔުކަންބާ')) return '🥒';
  if (name.includes('pumpkin') || name.includes('ބަރަބޯ')) return '🎃';
  if (name.includes('banana') || name.includes('ކެޔޮ') || name.includes('ދޮންކެޔޮ')) return '🍌';
  if (name.includes('papaya') || name.includes('ފަޅޯ')) return '🥭';
  if (name.includes('mango') || name.includes('އަނބު') || name.includes('ހިތަދޫ')) return '🥭';
  return '🌱';
}

// Reusable DhivehiInput Web Component
class DhivehiInput extends HTMLElement {
  connectedCallback() {
    const type = this.getAttribute('type') || 'text';
    const id = this.getAttribute('id') || '';
    const label = this.getAttribute('label') || '';
    const placeholder = this.getAttribute('placeholder') || '';
    const required = this.hasAttribute('required');
    const autocomplete = this.getAttribute('autocomplete') || '';
    const readonly = this.hasAttribute('readonly');
    const min = this.getAttribute('min') || '';
    let step = this.getAttribute('step') || '';
    if (type === 'number' && !step) {
      step = '0.01';
    }
    const oninput = this.getAttribute('oninput') || '';
    const value = this.getAttribute('value') || '';
    const list = this.getAttribute('list') || '';

    // Remove ID from the wrapper tag so only the native input has it (avoiding duplicate IDs)
    this.removeAttribute('id');

    this.className = 'form-group';
    let labelHtml = label ? `<label for="${id}">${label}</label>` : '';
    
    // Explicitly configure auto-correct, capitalization, and hints for Dhivehi keyboard layout
    let inputHtml = '';
    if (type === 'textarea') {
      inputHtml = `<textarea id="${id}" class="form-input" ${required ? 'required' : ''} placeholder="${placeholder}" lang="dv" dir="rtl" autocorrect="on" autocapitalize="none" ${readonly ? 'readonly' : ''}>${value}</textarea>`;
    } else {
      inputHtml = `<input type="${type}" id="${id}" class="form-input" ${required ? 'required' : ''} placeholder="${placeholder}" lang="dv" dir="rtl" autocorrect="on" autocapitalize="none" ${autocomplete ? `autocomplete="${autocomplete}"` : ''} ${readonly ? 'readonly' : ''} ${min ? `min="${min}"` : ''} ${step ? `step="${step}"` : ''} ${oninput ? `oninput="${oninput}"` : ''} ${list ? `list="${list}"` : ''} value="${value}">`;
    }

    this.innerHTML = `${labelHtml}${inputHtml}`;

    // Attach real-time QWERTY-to-Thaana translation listener
    const inputEl = this.querySelector('input, textarea');
    if (inputEl) {
      inputEl.addEventListener('keypress', this.handlePhoneticKeyPress.bind(this));
    }
  }

  handlePhoneticKeyPress(e) {
    if (!e) var e = window.event;
    // Let modifiers pass normally
    if (e.ctrlKey || e.altKey || e.metaKey) return true;

    const keycode = e.which || e.keyCode;
    const charStr = String.fromCharCode(keycode);

    // Standard QWERTY-to-Thaana layout lookup matrix
    const transFrom = 'qwertyuiop[]\\asdfghjkl;\'zxcvbnm,./QWERTYUIOP{}|ASDFGHJKL:\"ZXCVBNM<>?()';
    const transTo =   'ްއެރތޔުިޮޕ][\\ަސދފގހޖކލ؛\'ޒ×ޗވބނމ،./ޤޢޭޜޓޠޫީޯ÷}{|ާށޑﷲޣޙޛޚޅ:\"ޡޘޝޥޞޏޟ><؟)(';

    const transIndex = transFrom.indexOf(charStr);
    // If the key is not in our translation matrix, let the default behavior continue
    if (transIndex === -1) return true;

    const transChar = transTo.charAt(transIndex);

    // Intercept character insertion
    e.preventDefault();

    const el = e.target;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const val = el.value;

    el.value = val.substring(0, start) + transChar + val.substring(end);
    el.setSelectionRange(start + 1, start + 1);

    // Fire the reactive input events
    const event = new Event('input', { bubbles: true });
    el.dispatchEvent(event);
  }

  get value() {
    const el = this.querySelector('input, textarea');
    return el ? el.value : '';
  }

  set value(val) {
    const el = this.querySelector('input, textarea');
    if (el) el.value = val;
  }

  focus() {
    const el = this.querySelector('input, textarea');
    if (el) el.focus();
  }
}
customElements.define('dhivehi-input', DhivehiInput);

// Reusable EnglishInput Web Component
class EnglishInput extends HTMLElement {
  connectedCallback() {
    const type = this.getAttribute('type') || 'text';
    const id = this.getAttribute('id') || '';
    const label = this.getAttribute('label') || '';
    const placeholder = this.getAttribute('placeholder') || '';
    const required = this.hasAttribute('required');
    const autocomplete = this.getAttribute('autocomplete') || '';
    const readonly = this.hasAttribute('readonly');
    const min = this.getAttribute('min') || '';
    let step = this.getAttribute('step') || '';
    if (type === 'number' && !step) {
      step = '0.01';
    }
    const oninput = this.getAttribute('oninput') || '';
    const value = this.getAttribute('value') || '';
    const list = this.getAttribute('list') || '';

    // Remove ID from the wrapper tag so only the native input has it (avoiding duplicate IDs)
    this.removeAttribute('id');

    this.className = 'form-group';
    let labelHtml = label ? `<label for="${id}">${label}</label>` : '';
    
    // Set appropriate input mode for English technical & numeric fields to trigger correct keyboards on mobile OS
    let inputMode = '';
    if (type === 'number' || id.toLowerCase().includes('size') || id.toLowerCase().includes('stock') || id.toLowerCase().includes('quantity') || id.toLowerCase().includes('amount') || id.toLowerCase().includes('cost') || id.toLowerCase().includes('price')) {
      inputMode = 'inputmode="decimal"';
    } else if (type === 'tel' || id.toLowerCase().includes('phone') || id.toLowerCase().includes('contact')) {
      inputMode = 'inputmode="tel"';
    } else if (type === 'email') {
      inputMode = 'inputmode="email"';
    } else if (type === 'url') {
      inputMode = 'inputmode="url"';
    }

    let inputHtml = '';
    if (type === 'textarea') {
      inputHtml = `<textarea id="${id}" class="form-input" ${required ? 'required' : ''} placeholder="${placeholder}" lang="en" dir="ltr" ${readonly ? 'readonly' : ''}>${value}</textarea>`;
    } else {
      inputHtml = `<input type="${type}" id="${id}" class="form-input" ${required ? 'required' : ''} placeholder="${placeholder}" lang="en" dir="ltr" ${autocomplete ? `autocomplete="${autocomplete}"` : ''} ${readonly ? 'readonly' : ''} ${min ? `min="${min}"` : ''} ${step ? `step="${step}"` : ''} ${oninput ? `oninput="${oninput}"` : ''} ${inputMode} ${list ? `list="${list}"` : ''} value="${value}">`;
    }

    this.innerHTML = `${labelHtml}${inputHtml}`;
  }

  get value() {
    const el = this.querySelector('input, textarea');
    return el ? el.value : '';
  }

  set value(val) {
    const el = this.querySelector('input, textarea');
    if (el) el.value = val;
  }

  focus() {
    const el = this.querySelector('input, textarea');
    if (el) el.focus();
  }
}
customElements.define('english-input', EnglishInput);

// Reusable AppInput Router Component
class AppInput extends HTMLElement {
  connectedCallback() {
    const type = this.getAttribute('type') || 'text';
    const id = this.getAttribute('id') || '';
    const label = this.getAttribute('label') || '';
    const placeholder = this.getAttribute('placeholder') || '';
    const required = this.hasAttribute('required') ? 'required' : '';
    const autocomplete = this.getAttribute('autocomplete') || '';
    const readonly = this.hasAttribute('readonly') ? 'readonly' : '';
    const min = this.getAttribute('min') || '';
    let step = this.getAttribute('step') || '';
    if (type === 'number' && !step) {
      step = '0.01';
    }
    const oninput = this.getAttribute('oninput') || '';
    const value = this.getAttribute('value') || '';
    const list = this.getAttribute('list') || '';

    // Determine language configuration:
    // Username, Password, Email, Phone, URL, API Keys, System IDs, and Numeric fields are English (LTR).
    // All other fields are Dhivehi (RTL).
    const isEnglishField = [
      'password', 'email', 'url', 'number', 'tel'
    ].includes(type) || [
      'username', 'password', 'email', 'url', 'id', 'key', 'phone', 'contact', 'size', 'price', 'quantity', 'amount', 'stock', 'min-stock', 'cost'
    ].some(keyword => id.toLowerCase().includes(keyword)) || 
    this.getAttribute('lang') === 'en';

    // Remove the ID from the parent so the child wrapper or inner element has the unique ID
    this.removeAttribute('id');

    let innerHtml = '';
    const listAttr = list ? `list="${list}"` : '';
    const attrs = `type="${type}" id="${id}" label="${label}" placeholder="${placeholder}" ${required} autocomplete="${autocomplete}" ${readonly} min="${min}" step="${step}" oninput="${oninput}" value="${value}" ${listAttr}`;
    
    if (isEnglishField) {
      innerHtml = `<english-input ${attrs}></english-input>`;
    } else {
      innerHtml = `<dhivehi-input ${attrs}></dhivehi-input>`;
    }
    
    this.innerHTML = innerHtml;
  }

  get value() {
    const sub = this.querySelector('english-input, dhivehi-input');
    return sub ? sub.value : '';
  }

  set value(val) {
    const sub = this.querySelector('english-input, dhivehi-input');
    if (sub) sub.value = val;
  }

  focus() {
    const sub = this.querySelector('english-input, dhivehi-input');
    if (sub) sub.focus();
  }
}
customElements.define('app-input', AppInput);

class App {
  constructor() {
    this.currentView = 'login';
    this.isOnline = true;
    
    // Bind methods to this context
    this.handleLogin = this.handleLogin.bind(this);
    this.logout = this.logout.bind(this);
    this.toggleNetwork = this.toggleNetwork.bind(this);
    this.toggleUserMenu = this.toggleUserMenu.bind(this);
    this.switchDemoRole = this.switchDemoRole.bind(this);
    
    this.init();
  }

  init() {
    initDB();
    
    // Set default RTL status
    const lang = getLanguage();
    setLanguage(lang);
    translateDOM();
    
    this.initSuggestedUnits();
    
    // Check session
    const session = getActiveUser();
    if (session) {
      this.isOnline = localStorage.getItem("dhandu_hisaabu_online_state") !== "offline";
      this.updateNetworkUI();
      this.loginSuccess(session);
    } else {
      this.showView('login');
    }
    
    // Setup event listeners for closing modal dropdowns
    document.addEventListener('click', (e) => {
      const dropdown = document.getElementById('role-dropdown');
      const avatarBtn = document.getElementById('avatar-btn');
      if (dropdown && avatarBtn && !avatarBtn.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove('show');
      }
    });
  }

  initSuggestedUnits() {
    const defaults = {
      unit: ['ކިލޯ', 'ޕެކެޓް', 'ލީޓަރު', 'ފުޅި', 'އަދަދު', 'ބަސްތާ'],
      buyer: ['ރިސޯޓް', 'ލޯކަލް މާރުކޭޓް', 'ސުޕަމާކެޓް'],
      supplier: ['އެގްރޯ ބާޒާރު', 'ސިޓީ ގާޑަން', 'ލޯކަލް ފިހާރަ'],
      crop: ['ކަރާ', 'ކޮޕީފަތް', 'ބަރަބޯ', 'ކެކުރި', 'ދޮންކެޔޮ', 'ފަޅޯ', 'މިރުސް'],
      category: ['Seeds', 'Fertilizer', 'Fuel', 'Labour', 'Equipment', 'Transport', 'Water', 'Electricity', 'Other']
    };

    for (const key in defaults) {
      let stored = localStorage.getItem(`dhandu_hisaabu_suggested_${key}s`);
      if (!stored) {
        localStorage.setItem(`dhandu_hisaabu_suggested_${key}s`, JSON.stringify(defaults[key]));
        stored = JSON.stringify(defaults[key]);
      }
      this.renderSuggestedList(key, JSON.parse(stored));
    }
  }

  saveSuggestedItem(type, val) {
    if (!val) return;
    const cleanVal = val.trim();
    if (!cleanVal) return;
    
    let stored = JSON.parse(localStorage.getItem(`dhandu_hisaabu_suggested_${type}s`) || '[]');
    if (!stored.includes(cleanVal)) {
      stored.push(cleanVal);
      localStorage.setItem(`dhandu_hisaabu_suggested_${type}s`, JSON.stringify(stored));
      this.renderSuggestedList(type, stored);
    }
  }

  saveSuggestedUnit(unit) {
    this.saveSuggestedItem('unit', unit);
  }

  renderSuggestedList(type, items) {
    const datalist = document.getElementById(`suggested-${type}s`);
    if (datalist) {
      datalist.innerHTML = items.map(u => `<option value="${u}"></option>`).join('');
    }

    if (type === 'category') {
      const select = document.getElementById('tx-category');
      if (select) {
        select.innerHTML = items.map(cat => `<option value="${cat}">${t(cat) || cat}</option>`).join('');
      }
    }

    const listContainer = document.getElementById(`list-items-${type}`);
    if (listContainer) {
      listContainer.innerHTML = items.map(item => `
        <div class="lookup-item">
          <span>${t(item) || item}</span>
          <button type="button" class="lookup-delete-btn" onclick="window.app.deleteLookupItem('${type}', '${item.replace(/'/g, "\\'")}')">&times;</button>
        </div>
      `).join('');
    }
  }

  addLookupItem(type, inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const val = input.value.trim();
    if (!val) return;

    let stored = JSON.parse(localStorage.getItem(`dhandu_hisaabu_suggested_${type}s`) || '[]');
    if (!stored.includes(val)) {
      stored.push(val);
      localStorage.setItem(`dhandu_hisaabu_suggested_${type}s`, JSON.stringify(stored));
      this.renderSuggestedList(type, stored);
      input.value = '';
      this.showToast("ލިސްޓަށް އިތުރުކުރެވިއްޖެ!");
    } else {
      this.showToast("މި އައިޓަމް މިހާރުވެސް އެބަހުރި!");
    }
  }

  deleteLookupItem(type, val) {
    if (confirm(`މި ލިސްޓުން "${val}" ޑިލީޓްކޮށްލަން ބޭނުންތަ؟`)) {
      let stored = JSON.parse(localStorage.getItem(`dhandu_hisaabu_suggested_${type}s`) || '[]');
      stored = stored.filter(item => item !== val);
      localStorage.setItem(`dhandu_hisaabu_suggested_${type}s`, JSON.stringify(stored));
      this.renderSuggestedList(type, stored);
      this.showToast("ލިސްޓުން އުނިކުރެވިއްޖެ!");
    }
  }

  // Network Switch (Online / Offline Toggle)
  toggleNetwork() {
    this.isOnline = !this.isOnline;
    localStorage.setItem("dhandu_hisaabu_online_state", this.isOnline ? "online" : "offline");
    this.updateNetworkUI();
    
    if (this.isOnline) {
      syncOfflineData().then(syncResult => {
        if (syncResult && syncResult.success && syncResult.count > 0) {
          this.showToast(`${t('syncSuccess')} (${syncResult.count} ރެކޯޑް)`);
          this.showView(this.currentView);
        }
      }).catch(err => {
        console.error("Sync failed:", err);
      });
    } else {
      this.showToast(t('offline'));
    }
  }

  updateNetworkUI() {
    const badge = document.getElementById('network-status');
    const text = document.getElementById('network-text');
    if (!badge || !text) return;

    if (this.isOnline) {
      badge.className = "status-badge online";
      text.setAttribute('data-i18n', 'online');
      text.textContent = t('online');
    } else {
      badge.className = "status-badge offline";
      text.setAttribute('data-i18n', 'offline');
      text.textContent = t('offline');
    }
    
    this.updatePendingSyncUI();
  }

  updatePendingSyncUI() {
    const banner = document.getElementById('notification-banner');
    const message = document.getElementById('notification-message');
    if (!banner || !message) return;
    
    const outbox = getOutbox();
    const activeUser = getActiveUser();
    
    if (outbox.length > 0 && activeUser && activeUser.role !== 'platform_admin') {
      banner.classList.remove('hidden');
      message.textContent = `${t('pendingSync')} ${outbox.length}. ${this.isOnline ? 'ސިންކް ކުރުމަށް އޮންލައިން ސްޓޭޓަސް ރީލޯޑް ކުރަމުންދަނީ...' : 'އޮފްލައިން ކޮށް މަސައްކަތްކުރަމުންދަނީ.'}`;
    } else {
      banner.classList.add('hidden');
    }
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '80px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.backgroundColor = 'var(--primary-dark)';
    toast.style.color = 'white';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '30px';
    toast.style.zIndex = '9999';
    toast.style.boxShadow = 'var(--shadow-lg)';
    toast.style.fontFamily = 'var(--font-dhivehi)';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  async handleLogin(e) {
    e.preventDefault();
    const userEl = document.getElementById('login-username');
    const passEl = document.getElementById('login-password');
    const errEl = document.getElementById('login-error');
    
    try {
      const session = await authenticate(userEl.value, passEl.value);
      errEl.classList.add('hidden');
      this.loginSuccess(session);
      userEl.value = '';
      passEl.value = '';
    } catch (err) {
      errEl.classList.remove('hidden');
      errEl.textContent = err.message;
    }
  }

  quickLogin(username, password) {
    const userEl = document.getElementById('login-username');
    const passEl = document.getElementById('login-password');
    if (userEl && passEl) {
      userEl.value = username;
      passEl.value = password;
      document.getElementById('login-form').dispatchEvent(new Event('submit'));
    }
  }

  loginSuccess(session) {
    // Show Header
    document.getElementById('app-header').classList.remove('hidden');
    
    // Render Bottom Nav for this role
    this.renderNav(session.role);
    document.getElementById('app-nav').classList.remove('hidden');
    
    // Navigate to default view
    if (session.role === 'platform_admin') {
      this.showView('platform-dashboard');
    } else if (session.role === 'staff') {
      this.showView('staff-dashboard');
    } else {
      this.showView('farm-dashboard');
    }
    
    // Highlight demo dropdown status
    const buttons = document.querySelectorAll('#role-dropdown button');
    buttons.forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`switch-${session.username}`);
    if (activeBtn) activeBtn.classList.add('active');
  }

  logout() {
    sessionStorage.removeItem("dhandu_hisaabu_session");
    document.getElementById('app-header').classList.add('hidden');
    document.getElementById('app-nav').classList.add('hidden');
    this.showView('login');
    document.getElementById('role-dropdown').classList.remove('show');
  }

  toggleUserMenu() {
    const dropdown = document.getElementById('role-dropdown');
    if (dropdown) dropdown.classList.toggle('show');
  }

  switchDemoRole(username) {
    const accounts = {
      sysadmin: 'sysadminpassword',
      villa_admin: 'villaadminpassword',
      villa_worker: 'villaworkerpassword',
      garden_admin: 'gardenadminpassword'
    };
    
    if (accounts[username]) {
      this.logout();
      this.quickLogin(username, accounts[username]);
    }
  }

  // Routing View Switching
  showView(viewId) {
    this.currentView = viewId;
    
    // Hide all view sections
    const views = [
      'login', 
      'staff-dashboard', 
      'platform-dashboard', 
      'farm-dashboard', 
      'crops', 
      'transactions', 
      'income',
      'expense',
      'fertilizer', 
      'harvests', 
      'inventory', 
      'staff', 
      'reports', 
      'logs', 
      'profile',
      'treatments'
    ];
    
    views.forEach(v => {
      const el = document.getElementById(`view-${v}`);
      if (el) el.classList.add('hidden');
    });
    
    // Show active view
    const activeEl = document.getElementById(`view-${viewId}`);
    if (activeEl) {
      activeEl.classList.remove('hidden');
      window.scrollTo(0, 0);
    }
    
    // Update active nav state
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      if (item.getAttribute('onclick').includes(viewId)) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Execute loaders
    this.updatePendingSyncUI();
    
    if (viewId === 'farm-dashboard') this.loadFarmDashboard();
    else if (viewId === 'staff-dashboard') this.loadStaffDashboard();
    else if (viewId === 'platform-dashboard') this.loadPlatformDashboard();
    else if (viewId === 'crops') this.loadCrops();
    else if (viewId === 'income') this.loadIncome();
    else if (viewId === 'expense') this.loadExpenses();
    else if (viewId === 'fertilizer') this.loadFertilizer();
    else if (viewId === 'harvests') this.loadHarvests();
    else if (viewId === 'inventory') this.loadInventory();
    else if (viewId === 'staff') this.loadStaff();
    else if (viewId === 'reports') this.loadReports();
    else if (viewId === 'logs') this.loadLogs();
    else if (viewId === 'profile') this.loadProfile();
    else if (viewId === 'treatments') this.loadTreatments();
    
    translateDOM();
  }

  // Dynamic Navigation Generator depending on Roles
  renderNav(role) {
    const nav = document.getElementById('app-nav');
    if (!nav) return;
    
    let html = '';
    
    if (role === 'platform_admin') {
      html = `
        <button class="nav-item active" onclick="window.app.showView('platform-dashboard')">
          <svg viewBox="0 0 24 24"><path d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"></path></svg>
          <span data-i18n="platformAdminTab">ޕްލެޓްފޯމް</span>
        </button>
      `;
    } else if (role === 'staff') {
      html = `
        <button class="nav-item active" onclick="window.app.showView('staff-dashboard')">
          <svg viewBox="0 0 24 24"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
          <span data-i18n="dashboard">ޑޭޝްބޯޑް</span>
        </button>
        <button class="nav-item" onclick="window.app.showView('treatments')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 11V6a1 1 0 011-1h4a1 1 0 011 1v5" />
            <path d="M7 11h10l1 9a2 2 0 01-2 2H8a2 2 0 01-2-2l1-9z" />
            <path d="M14 6h3.5a1.5 1.5 0 011.5 1.5v1.5" />
            <path d="M18.5 7.5H16.5" />
            <path d="M21 7.5c1 0 2-.5 2-1s-1-1-2-1" />
            <path d="M10 16c1-2.5 3-2.5 4-1s-1 3-4 1z" />
          </svg>
          <span data-i18n="treatments">ބޭސް/ކާނާ</span>
        </button>
      `;
    } else {
      // Farm Admin Nav
      html = `
        <button class="nav-item active" onclick="window.app.showView('farm-dashboard')">
          <svg viewBox="0 0 24 24"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
          <span data-i18n="dashboard">ޑޭޝްބޯޑް</span>
        </button>
        <button class="nav-item nav-item-income" onclick="window.app.showView('income')">
          <svg viewBox="0 0 24 24"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <span data-i18n="income">އާމްދަނީ</span>
        </button>
        <button class="nav-item nav-item-expense" onclick="window.app.showView('expense')">
          <svg viewBox="0 0 24 24"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <span data-i18n="expenses">ޚަރަދު</span>
        </button>
        <button class="nav-item" onclick="window.app.showView('treatments')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 11V6a1 1 0 011-1h4a1 1 0 011 1v5" />
            <path d="M7 11h10l1 9a2 2 0 01-2 2H8a2 2 0 01-2-2l1-9z" />
            <path d="M14 6h3.5a1.5 1.5 0 011.5 1.5v1.5" />
            <path d="M18.5 7.5H16.5" />
            <path d="M21 7.5c1 0 2-.5 2-1s-1-1-2-1" />
            <path d="M10 16c1-2.5 3-2.5 4-1s-1 3-4 1z" />
          </svg>
          <span data-i18n="treatments">ބޭސް/ކާނާ</span>
        </button>
        <button class="nav-item" onclick="window.app.showView('crops')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 20c3-3 6-4 9-4s6 1 9 4" />
            <path d="M12 16V9" />
            <path d="M12 9c-2-1.5-3-4.5 0-7 3 2.5 2 5.5 0 7z" />
            <path d="M12 16c-2-2-4-3-5-3.5" />
            <path d="M7 12.5c-2-.5-4-2.5-4.5-4.5 2 0 4 1.5 4.5 4.5z" />
            <path d="M12 16c2-2 4-3 5-3.5" />
            <path d="M17 12.5c2-.5 4-2.5 4.5-4.5-2 0-4 1.5-4.5 4.5z" />
          </svg>
          <span data-i18n="crops">ގަސްތައް</span>
        </button>
        <button class="nav-item" onclick="window.app.showView('reports')">
          <svg viewBox="0 0 24 24"><path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          <span data-i18n="reports">ރިޕޯޓްތައް</span>
        </button>
        <button class="nav-item" onclick="window.app.showView('profile')">
          <svg viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
          <span data-i18n="profile">ޕްރޮފައިލް</span>
        </button>
      `;
    }
    
    nav.innerHTML = html;
  }

  // Load View Operations
  loadFarmDashboard() {
    const user = getActiveUser();
    const farms = queryTable('farms');
    const myFarm = farms.find(f => f.id === user.farmId);
    
    if (myFarm) {
      document.getElementById('farm-dashboard-welcome').textContent = myFarm.name;
      document.getElementById('farm-dashboard-island').textContent = `${myFarm.owner} • ${myFarm.island}`;
    }
    
    // Financial calculations
    const transactions = queryTable('transactions');
    const crops = queryTable('crops');
    const fertilizer = queryTable('fertilizer_records');
    
    const todayStr = new Date().toISOString().split('T')[0];
    
    let todayIncome = 0;
    let todayExpense = 0;
    let totalIncome = 0;
    let totalExpense = 0;
    
    transactions.forEach(t => {
      const amt = parseFloat(t.amount) || 0;
      if (t.type === 'income') {
        totalIncome += amt;
        if (t.date === todayStr) todayIncome += amt;
      } else {
        totalExpense += amt;
        if (t.date === todayStr) todayExpense += amt;
      }
    });
    
    // Also add fertilizer costs to expenses
    fertilizer.forEach(f => {
      const c = parseFloat(f.cost) || 0;
      totalExpense += c;
      if (f.date === todayStr) todayExpense += c;
    });

    const netProfit = totalIncome - totalExpense;
    const activeCropsCount = crops.filter(c => c.status === 'growing').length;
    
    // Set UI values
    document.getElementById('dash-today-income').innerHTML = `${format2DP(todayIncome)}${CURRENCY_HTML}`;
    document.getElementById('dash-today-expense').innerHTML = `${format2DP(todayExpense)}${CURRENCY_HTML}`;
    
    const profitEl = document.getElementById('dash-net-profit');
    profitEl.innerHTML = `${format2DP(netProfit)}${CURRENCY_HTML}`;
    if (netProfit >= 0) {
      profitEl.className = "stats-value profit-positive";
    } else {
      profitEl.className = "stats-value profit-negative";
    }
    
    // Upcoming Harvests (Crops due to harvest in next 30 days)
    const upcomingHarvestList = document.getElementById('dash-harvests-list');
    upcomingHarvestList.innerHTML = '';
    
    const today = new Date();
    const upcoming = crops.filter(c => {
      if (c.status !== 'growing') return false;
      const hDate = new Date(c.expectedHarvest);
      const diffTime = hDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 30;
    }).sort((a,b) => new Date(a.expectedHarvest) - new Date(b.expectedHarvest));
    
    if (upcoming.length === 0) {
      upcomingHarvestList.innerHTML = `<div class="text-muted" style="text-align: center; padding: 12px 0;">ކުރިއަށް އޮތް 30 ދުވަހު ކަނޑަންވެފައިވާ އެއްވެސް ބާވަތެއް ނެތް.</div>`;
    } else {
      upcoming.forEach(c => {
        const item = document.createElement('div');
        item.className = 'activity-item';
        const emoji = getCropEmoji(c.name);
        item.innerHTML = `
          <div class="activity-details" style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.5rem; flex-shrink: 0;">${emoji}</span>
            <div>
              <span class="activity-title" style="font-weight: 700;">${t(c.name)} (${c.variety})</span>
              <span class="activity-meta" style="display: block; margin-block-start: 2px;">އިންދީ: <span class="date-num">${c.plantingDate}</span> • ސަރަހައްދު: ${c.area}</span>
            </div>
          </div>
          <div style="text-align: end;">
            <div class="badge badge-growing" data-i18n="expectedHarvest">ލަފާކުރާ ތާރީޚް</div>
            <div class="date-num" style="font-size: 0.85rem; font-weight: 700; margin-block-start: 4px;">${c.expectedHarvest}</div>
          </div>
        `;
        upcomingHarvestList.appendChild(item);
      });
    }
    
    // Recent transactions list
    const recentActivityList = document.getElementById('dash-activities-list');
    recentActivityList.innerHTML = '';
    
    const txs = (queryTable('transactions') || []).sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
    
    if (txs.length === 0) {
      recentActivityList.innerHTML = `<div class="text-muted" style="text-align: center; padding: 12px 0;">އެއްވެސް މުއާމަލާތެއް ރެކޯޑް ކުރެވިފައެއް ނެތް.</div>`;
    } else {
      txs.forEach(tx => {
        const item = document.createElement('div');
        item.className = 'activity-item';
        
        const emoji = tx.type === 'income' ? '💰' : '💸';
        const titleText = tx.type === 'income' ? `${t(tx.crop)} (އާމްދަނީ)` : `${t(tx.category) || tx.category} (ޚަރަދު)`;
        const partner = tx.type === 'income' ? tx.buyer : tx.supplier;
        
        item.innerHTML = `
          <div style="font-size: 1.5rem; padding-inline-end: 8px;">${emoji}</div>
          <div class="activity-details">
            <span class="activity-title" style="font-weight: 700;">${titleText}</span>
            <span class="activity-meta">ތާރީޚް: <span class="date-num">${tx.date}</span> ${partner ? `• ${partner}` : ''}</span>
          </div>
          <div class="activity-amount ${tx.type === 'income' ? 'text-success' : 'text-danger'}" style="font-weight: 700; text-align: end; white-space: nowrap;">
            ${tx.type === 'income' ? '+' : '-'}${format2DP(tx.amount)}${CURRENCY_HTML}
          </div>
        `;
        recentActivityList.appendChild(item);
      });
    }

    // Upcoming Treatments (Next 7 Days)
    const upcomingTreatmentsList = document.getElementById('dash-treatments-list');
    if (upcomingTreatmentsList) {
      upcomingTreatmentsList.innerHTML = '';
      const treatmentApps = queryTable('treatment_applications') || [];
      const next7DaysStr = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
      const upcomingApps = treatmentApps.filter(app => 
        app.nextScheduledDate && 
        app.nextScheduledDate >= todayStr && 
        app.nextScheduledDate <= next7DaysStr
      ).sort((a,b) => new Date(a.nextScheduledDate) - new Date(b.nextScheduledDate));

      if (upcomingApps.length === 0) {
        upcomingTreatmentsList.innerHTML = `<div class="text-muted" style="text-align: center; padding: 12px 0;">ކުރިއަށް އޮތް 7 ދުވަހު ތާވަލުކުރެވިފައިވާ ފަރުވާއެއް ނެތް.</div>`;
      } else {
        upcomingApps.forEach(item => {
          const div = document.createElement('div');
          div.className = 'activity-item';
          div.style.borderInlineStart = '4px solid var(--primary)';
          div.style.padding = '8px 12px';
          div.style.marginBlockEnd = '8px';
          div.style.background = 'white';
          div.style.borderRadius = '6px';
          div.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
          div.innerHTML = `
            <div style="font-weight: bold; color: var(--primary); font-size: 0.85rem;">ތާވަލު ތާރީޚް: ${item.nextScheduledDate}</div>
            <div style="font-size: 0.95rem; margin-block-start: 4px;">
              <strong>${t(item.category)}: ${item.productName}</strong> (ބެޗް: ${item.crop} - ${item.plot || '-'})
            </div>
          `;
          upcomingTreatmentsList.appendChild(div);
        });
      }
    }
    
    // Inventory low stock alert trigger
    const inventory = queryTable('inventory');
    const lowStockItems = inventory.filter(item => item.currentStock <= item.minimumStock);
    const banner = document.getElementById('notification-banner');
    const msg = document.getElementById('notification-message');
    
    if (lowStockItems.length > 0) {
      banner.classList.remove('hidden');
      msg.innerHTML = `<strong>${t('lowStockAlert')}</strong> ބައެއް ތަކެތި މަދުވަނީ: ` + 
        lowStockItems.map(item => `${item.name} (${item.currentStock} ${item.unit})`).join(', ');
    } else {
      banner.classList.add('hidden');
    }
  }

  loadStaffDashboard() {
    const user = getActiveUser();
    const farms = queryTable('farms');
    const myFarm = farms.find(f => f.id === user.farmId);
    
    document.getElementById('staff-name').textContent = user.name;
    if (myFarm) {
      document.getElementById('staff-farm-name').textContent = myFarm.name;
    }
    
    // Load Today's entries by this staff member
    const staffActivityList = document.getElementById('staff-activity-list');
    staffActivityList.innerHTML = '';
    
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Filter transactions created by this user today
    const tx = queryTable('transactions').filter(t => t.createdBy === user.username && t.date === todayStr);
    const fert = queryTable('fertilizer_records').filter(f => f.createdBy === user.username && f.date === todayStr);
    
    const allActivities = [
      ...tx.map(item => ({ ...item, activityType: 'tx' })),
      ...fert.map(item => ({ ...item, activityType: 'fert' }))
    ].sort((a,b) => new Date(b.createdDate) - new Date(a.createdDate));
    
    if (allActivities.length === 0) {
      staffActivityList.innerHTML = `<div class="text-muted" style="text-align: center; padding: 12px 0;">މިއަދު އަދި އެއްވެސް މަސައްކަތެއް ރެކޯޑް ކުރެވިފައެއް ނެތް.</div>`;
    } else {
      allActivities.forEach(act => {
        const item = document.createElement('div');
        item.className = 'activity-item';
        
        if (act.activityType === 'tx') {
          item.innerHTML = `
            <div class="activity-details">
              <span class="activity-title">💰 އާމްދަނީ: ${t(act.crop)} (${act.quantity} ${act.unit})</span>
              <span class="activity-meta">${act.buyer} • ޕޭމަންޓް: <span class="badge ${act.paymentStatus === 'paid' ? 'badge-paid' : 'badge-pending'}">${act.paymentStatus === 'paid' ? 'ދައްކާފައި' : 'ނުދައްކާ'}</span></span>
            </div>
            <div class="activity-amount text-success">+${format2DP(act.amount)}${CURRENCY_HTML}</div>
          `;
        } else {
          item.innerHTML = `
            <div class="activity-details">
              <span class="activity-title">🌿 ގަސްކާނާ އެޅުން: ${act.fertilizerName}</span>
              <span class="activity-meta">ގަސް: ${t(act.crop)} • މިންވަރު: ${format2DP(act.quantity)} ${act.unit} (${t(act.applicationMethod)})</span>
            </div>
            <div class="activity-amount text-danger" style="font-size: 0.85rem;">${act.cost > 0 ? `-${format2DP(act.cost)}${CURRENCY_HTML}` : ''}</div>
          `;
        }
        staffActivityList.appendChild(item);
      });
    }
  }

  loadPlatformDashboard() {
    const farms = queryTable('farms');
    const localDB = JSON.parse(localStorage.getItem('dhandu_hisaabu_local_db') || '{}');
    const usersCount = (localDB.users || []).length;
    
    document.getElementById('platform-total-farms').textContent = farms.length;
    document.getElementById('platform-active-farms').textContent = farms.filter(f => f.status === 'active').length;
    document.getElementById('platform-total-users').textContent = usersCount;
    
    const dbSize = Math.round((localStorage.getItem('dhandu_hisaabu_local_db') || '').length / 1024);
    document.getElementById('platform-db-size').textContent = `${dbSize} KB`;
    
    // Populate Farms Table
    const tableBody = document.getElementById('platform-farms-table');
    tableBody.innerHTML = '';
    
    farms.forEach(farm => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 700;">${farm.name}</td>
        <td>${farm.owner} <br><span class="text-muted" style="font-size:0.8rem;">${farm.island}</span></td>
        <td class="date-num">${farm.contact}</td>
        <td><span class="badge ${farm.status === 'active' ? 'badge-paid' : 'badge-suspended'}">${farm.status.toUpperCase()}</span></td>
        <td>
          <button class="btn btn-secondary" style="padding: 6px 12px; min-height:36px; font-size:0.85rem;" onclick="window.app.toggleFarmStatus('${farm.id}')">
            ${farm.status === 'active' ? 'Suspend' : 'Activate'}
          </button>
        </td>
      `;
      tableBody.appendChild(tr);
    });
    
    // Populate Platform System Logs
    const logsBody = document.getElementById('platform-logs-table');
    logsBody.innerHTML = '';
    const logs = queryTable('audit_logs').sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    logs.forEach(log => {
      const tr = document.createElement('tr');
      const timeStr = new Date(log.timestamp).toLocaleString();
      tr.innerHTML = `
        <td class="date-num" style="font-size:0.8rem;">${timeStr}</td>
        <td style="font-weight: 600;">${log.username}</td>
        <td style="font-size:0.85rem;"><strong>${log.eventType}</strong></td>
        <td style="font-size:0.85rem;">${log.message}</td>
      `;
      logsBody.appendChild(tr);
    });
  }

  loadCrops() {
    const list = document.getElementById('crops-list');
    list.innerHTML = '';
    
    const crops = queryTable('crops');
    
    if (crops.length === 0) {
      list.innerHTML = `<div class="card text-muted" style="text-align: center;">ހެއްދުމަށް ގަހެއް ރަޖިސްޓްރީ ކޮށްފައެއް ނެތް. އާ ގަހެއް އިތުރުކުރައްވާ!</div>`;
      return;
    }
    
    crops.forEach(crop => {
      const card = document.createElement('div');
      card.className = 'card high-contrast-card';
      
      const emoji = getCropEmoji(crop.name);
      
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start; margin-block-end: 12px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="font-size: 2rem;">${emoji}</div>
            <div>
              <h3 style="font-weight: 700; color: var(--primary-dark);">${t(crop.name)}</h3>
              <span class="text-muted" style="font-size: 0.85rem;">ވައްތަރު: ${crop.variety || '-'}</span>
            </div>
          </div>
          <span class="badge ${crop.status === 'growing' ? 'badge-growing' : 'badge-completed'}">${crop.status === 'growing' ? 'ހެދެމުންދަނީ' : 'ނިމިފައި'}</span>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-block-end: 12px; font-size: 0.9rem;">
          <div><strong>އިންދީ:</strong> <span class="date-num">${crop.plantingDate}</span></div>
          <div><strong>ކަނޑާނީ:</strong> <span class="date-num">${crop.expectedHarvest}</span></div>
          <div><strong>ގަސްތަކުގެ އަދަދު:</strong> ${crop.plantsCount || crop.area || '-'}</div>
          <div><strong>ބެޗް ނަންބަރު:</strong> ${crop.batchNumber || '-'}</div>
          <div style="grid-column: span 2;"><strong>ލިބުނު މިންވަރު:</strong> ${crop.actualHarvest || '-'}</div>
        </div>
        
        <p style="font-size: 0.85rem; background-color: var(--bg-base); padding: 8px 12px; border-radius: var(--radius-sm); margin-block-end: 12px;">
          ${crop.notes || 'ނޯޓެއް ނެތް.'}
        </p>

        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button class="btn btn-secondary" style="padding: 6px 16px; min-height:36px; font-size: 0.85rem;" onclick="window.app.editCrop('${crop.id}')" data-i18n="edit">އިސްލާހުކުރަން</button>
          <button class="btn btn-danger" style="padding: 6px 16px; min-height:36px; font-size: 0.85rem; flex: none;" onclick="window.app.deleteRecord('crops', '${crop.id}')" data-i18n="delete">ޑިލީޓް</button>
        </div>
      `;
      list.appendChild(card);
    });
  }

  loadIncome() {
    const tableBody = document.getElementById('income-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    
    const transactions = queryTable('transactions')
      .filter(t => t.type === 'income')
      .sort((a,b) => new Date(b.date) - new Date(a.date));
      
    transactions.forEach(tx => {
      const tr = document.createElement('tr');
      const statusBadge = tx.paymentStatus === 'paid' ? 
        `<span class="badge badge-paid">ދައްކާފައި</span>` : 
        `<span class="badge badge-pending">ނުދައްކާ</span>`;
        
      const settleBtn = tx.paymentStatus !== 'paid' ? 
        `<button class="btn btn-primary" style="padding: 4px 8px; min-height:30px; font-size:0.75rem; background-color: var(--success); border-color: var(--success); margin-inline-end: 6px;" onclick="window.app.settleTransaction('${tx.id}')">ޚަލާޞްކުރަން</button>` : 
        '';
        
      tr.innerHTML = `
        <td class="date-num" style="white-space: nowrap;">${tx.date}</td>
        <td style="font-weight: 600;">${t(tx.crop)} (${format2DP(tx.quantity)} ${tx.unit})</td>
        <td>${tx.buyer || '-'}</td>
        <td style="font-size: 0.85rem;">${tx.description || '-'}<br><span class="text-muted" style="font-size:0.75rem;">Recorded by: ${tx.createdBy || ''}</span></td>
        <td class="date-num" style="font-weight: 700; color: var(--success);">${format2DP(tx.amount)}</td>
        <td>${statusBadge}</td>
        <td>
          ${settleBtn}
          <button class="btn btn-secondary" style="padding: 4px 8px; min-height:30px; font-size:0.75rem;" onclick="window.app.deleteRecord('transactions', '${tx.id}')" data-i18n="delete">ޑިލީޓް</button>
        </td>
      `;
      tableBody.appendChild(tr);
    });
  }

  loadExpenses() {
    const tableBody = document.getElementById('expenses-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    
    const transactions = queryTable('transactions')
      .filter(t => t.type === 'expense')
      .sort((a,b) => new Date(b.date) - new Date(a.date));
      
    transactions.forEach(tx => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="date-num" style="white-space: nowrap;">${tx.date}</td>
        <td style="font-weight: 600;">${t(tx.category)}</td>
        <td>${tx.supplier || '-'}</td>
        <td style="font-size: 0.85rem;">${tx.description || '-'}<br><span class="text-muted" style="font-size:0.75rem;">Recorded by: ${tx.createdBy || ''}</span></td>
        <td class="date-num" style="font-weight: 700; color: var(--danger);">${format2DP(tx.amount)}</td>
        <td>
          <button class="btn btn-secondary" style="padding: 4px 8px; min-height:30px; font-size:0.75rem;" onclick="window.app.deleteRecord('transactions', '${tx.id}')" data-i18n="delete">ޑިލީޓް</button>
        </td>
      `;
      tableBody.appendChild(tr);
    });
  }

  loadFertilizer() {
    const tableBody = document.getElementById('fertilizer-table-body');
    tableBody.innerHTML = '';
    
    const records = queryTable('fertilizer_records').sort((a,b) => new Date(b.date) - new Date(a.date));
    
    records.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="date-num">${r.date}</td>
        <td style="font-weight: 700;">${t(r.crop)}</td>
        <td>${r.fertilizerName}</td>
        <td class="date-num">${format2DP(r.quantity)} ${r.unit}</td>
        <td>${r.appliedBy}</td>
        <td>
          <button class="btn btn-secondary" style="padding: 4px 8px; min-height:30px; font-size:0.75rem;" onclick="window.app.deleteRecord('fertilizer_records', '${r.id}')" data-i18n="delete">ޑިލީޓް</button>
        </td>
      `;
      tableBody.appendChild(tr);
    });
  }

  loadHarvests() {
    const tableBody = document.getElementById('harvests-table-body');
    tableBody.innerHTML = '';
    
    const harvests = queryTable('harvest_records') || [];
    const sorted = harvests.sort((a,b) => new Date(b.harvestDate) - new Date(a.harvestDate));
    
    sorted.forEach(h => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="date-num">${h.harvestDate}</td>
        <td style="font-weight: 700;">${t(h.crop)}</td>
        <td class="date-num">${format2DP(h.quantity)} ${h.unit}</td>
        <td><span class="badge badge-growing">${t(h.grade)}</span></td>
        <td class="date-num" style="font-weight: 700;">${h.sellingPrice ? format2DP(h.sellingPrice) + CURRENCY_HTML : '-'}</td>
        <td>
          <button class="btn btn-secondary" style="padding: 4px 8px; min-height:30px; font-size:0.75rem;" onclick="window.app.deleteRecord('harvest_records', '${h.id}')" data-i18n="delete">ޑިލީޓް</button>
        </td>
      `;
      tableBody.appendChild(tr);
    });
  }

  loadInventory() {
    const tableBody = document.getElementById('inventory-table-body');
    tableBody.innerHTML = '';
    
    const inventory = queryTable('inventory');
    
    inventory.forEach(item => {
      const tr = document.createElement('tr');
      const isLow = item.currentStock <= item.minimumStock;
      
      tr.innerHTML = `
        <td><span class="badge ${isLow ? 'badge-suspended' : 'badge-growing'}">${t(item.category)}</span></td>
        <td style="font-weight: 700;">${item.name}</td>
        <td class="date-num" style="font-weight:700; ${isLow ? 'color: var(--danger); font-size: 1.1rem;' : ''}">${format2DP(item.currentStock)} ${item.unit}</td>
        <td class="date-num">${format2DP(item.minimumStock)} ${item.unit}</td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-secondary" style="padding: 4px 8px; min-height:30px; font-size:0.75rem;" onclick="window.app.editInventory('${item.id}')" data-i18n="edit">އިސްލާހުކުރަން</button>
            <button class="btn btn-secondary" style="padding: 4px 8px; min-height:30px; font-size:0.75rem;" onclick="window.app.deleteRecord('inventory', '${item.id}')" data-i18n="delete">ޑިލީޓް</button>
          </div>
        </td>
      `;
      tableBody.appendChild(tr);
    });
  }

  loadStaff() {
    const tableBody = document.getElementById('staff-table-body');
    tableBody.innerHTML = '';
    
    const localDB = JSON.parse(localStorage.getItem('dhandu_hisaabu_local_db') || '{}');
    const user = getActiveUser();
    const staff = (localDB.users || []).filter(u => u.farmId === user.farmId && u.role === 'staff');
    
    staff.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 700;">${s.name}</td>
        <td class="date-num">${s.phone || '-'}</td>
        <td style="font-family: var(--font-latin);">${s.username}</td>
        <td><span class="badge ${s.status === 'active' ? 'badge-paid' : 'badge-suspended'}">${s.status.toUpperCase()}</span></td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-secondary" style="padding: 4px 8px; min-height:30px; font-size:0.75rem;" onclick="window.app.resetStaffPassword('${s.username}')">Reset Pass</button>
            <button class="btn btn-secondary" style="padding: 4px 8px; min-height:30px; font-size:0.75rem;" onclick="window.app.toggleStaffStatus('${s.username}')">Toggle</button>
          </div>
        </td>
      `;
      tableBody.appendChild(tr);
    });
  }

  loadLogs() {
    const tableBody = document.getElementById('farm-logs-table-body');
    tableBody.innerHTML = '';
    
    const logs = queryTable('audit_logs').sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    logs.forEach(log => {
      const tr = document.createElement('tr');
      const timeStr = new Date(log.timestamp).toLocaleString();
      tr.innerHTML = `
        <td class="date-num" style="font-size:0.8rem; white-space: nowrap;">${timeStr}</td>
        <td style="font-weight: 600;">${log.username}</td>
        <td><span class="badge badge-growing">${log.eventType}</span></td>
        <td style="font-size: 0.85rem;">${log.message}</td>
      `;
      tableBody.appendChild(tr);
    });
  }

  loadProfile() {
    const user = getActiveUser();
    const farms = queryTable('farms');
    const myFarm = farms.find(f => f.id === user.farmId);
    
    if (myFarm) {
      document.getElementById('profile-farm-name').value = myFarm.name;
      document.getElementById('profile-owner-name').value = myFarm.owner;
      document.getElementById('profile-island').value = myFarm.island;
      document.getElementById('profile-address').value = myFarm.address;
      document.getElementById('profile-size').value = myFarm.size;
      document.getElementById('profile-contact').value = myFarm.contact;
      document.getElementById('profile-gps').value = myFarm.gpsLocation || '';
    }
    this.initSuggestedUnits();
  }

  // Report Generator Logic
  loadReports() {
    this.generateReport();
  }

  generateReport() {
    const type = document.getElementById('report-select-type').value;
    const user = getActiveUser();
    const farms = queryTable('farms');
    const myFarm = farms.find(f => f.id === user.farmId);
    
    if (myFarm) {
      document.getElementById('report-sheet-farm-info').textContent = `${myFarm.name} • ${myFarm.island}`;
    }
    
    const startDateVal = document.getElementById('report-start-date').value;
    const endDateVal = document.getElementById('report-end-date').value;
    
    let dateStr = new Date().toLocaleDateString();
    if (startDateVal || endDateVal) {
      const startDisp = startDateVal ? startDateVal : '...';
      const endDisp = endDateVal ? endDateVal : '...';
      dateStr = `${startDisp} ން ${endDisp} އަށް`;
    }
    document.getElementById('report-sheet-date').textContent = dateStr;
    
    const titleEl = document.getElementById('report-sheet-title');
    const chartContainer = document.getElementById('report-chart-container');
    const tableHead = document.getElementById('report-table-head');
    const tableBody = document.getElementById('report-table-body');
    
    chartContainer.classList.add('hidden');
    chartContainer.innerHTML = '';
    tableHead.innerHTML = '';
    tableBody.innerHTML = '';
    
    let transactions = queryTable('transactions');
    let crops = queryTable('crops');
    let fertilizer = queryTable('fertilizer_records');
    let harvests = queryTable('harvest_records') || [];
    
    if (startDateVal) {
      transactions = transactions.filter(t => new Date(t.date) >= new Date(startDateVal));
      fertilizer = fertilizer.filter(f => new Date(f.date) >= new Date(startDateVal));
      harvests = harvests.filter(h => new Date(h.harvestDate) >= new Date(startDateVal));
    }
    if (endDateVal) {
      transactions = transactions.filter(t => new Date(t.date) <= new Date(endDateVal));
      fertilizer = fertilizer.filter(f => new Date(f.date) <= new Date(endDateVal));
      harvests = harvests.filter(h => new Date(h.harvestDate) <= new Date(endDateVal));
    }
    
    if (type === 'pl') {
      titleEl.textContent = t('profitAndLoss');
      
      let totalIncome = 0;
      let totalExpense = 0;
      const categories = {};
      
      transactions.forEach(t => {
        const amt = parseFloat(t.amount) || 0;
        if (t.type === 'income') {
          totalIncome += amt;
        } else {
          totalExpense += amt;
          categories[t.category] = (categories[t.category] || 0) + amt;
        }
      });
      
      // Add fertilizer cost as transaction expense
      let fertTotalCost = 0;
      fertilizer.forEach(f => {
        const c = parseFloat(f.cost) || 0;
        fertTotalCost += c;
      });
      if (fertTotalCost > 0) {
        totalExpense += fertTotalCost;
        categories['Fertilizer'] = (categories['Fertilizer'] || 0) + fertTotalCost;
      }
      
      const net = totalIncome - totalExpense;
      
      tableHead.innerHTML = `
        <tr>
          <th>ޚާއްޞަ ތަފްސީލް</th>
          <th style="text-align: end;">އަދަދު (ރ)</th>
        </tr>
      `;
      
      tableBody.innerHTML = `
        <tr>
          <td style="font-weight: 700; color: var(--success);">ޖުމްލަ އާމްދަނީ</td>
          <td class="date-num text-success" style="text-align: end; font-weight: 700;">+${format2DP(totalIncome)}</td>
        </tr>
        <tr>
          <td style="font-weight: 700; color: var(--danger);">ޖުމްލަ ޚަރަދު</td>
          <td class="date-num text-danger" style="text-align: end; font-weight: 700;">-${format2DP(totalExpense)}</td>
        </tr>
        <tr style="border-block-start: 2px solid var(--border-color);">
          <td style="font-weight: 700; font-size: 1.1rem;">ސާފު ފައިދާ</td>
            ${net >= 0 ? '+' : ''}${format2DP(net)}${CURRENCY_HTML}
          </td>
        </tr>
      `;
      
      // Draw small profit/loss bar chart
      chartContainer.classList.remove('hidden');
      const maxVal = Math.max(totalIncome, totalExpense) || 1;
      const incPct = (totalIncome / maxVal) * 100;
      const expPct = (totalExpense / maxVal) * 100;
      
      chartContainer.innerHTML = `
        <div class="chart-bar-row">
          <span class="chart-label">އާމްދަނީ</span>
          <div class="chart-bar-wrapper"><div class="chart-bar" style="width: ${incPct}%"></div></div>
          <span class="chart-value">${format2DP(totalIncome)}</span>
        </div>
        <div class="chart-bar-row">
          <span class="chart-label">ޚަރަދު</span>
          <div class="chart-bar-wrapper"><div class="chart-bar expense" style="width: ${expPct}%"></div></div>
          <span class="chart-value">${format2DP(totalExpense)}</span>
        </div>
      `;
      
    } else if (type === 'crop') {
      titleEl.textContent = t('cropPerformance');
      
      // Aggregate performance by Crop Name
      const cropPerf = {};
      crops.forEach(c => {
        cropPerf[c.name] = { income: 0, expense: 0, count: 0 };
      });
      
      transactions.forEach(t => {
        if (t.crop && cropPerf[t.crop]) {
          const amt = parseFloat(t.amount) || 0;
          if (t.type === 'income') {
            cropPerf[t.crop].income += amt;
          } else {
            cropPerf[t.crop].expense += amt;
          }
        }
      });
      
      // Add fertilizer cost as crop-specific expense
      fertilizer.forEach(f => {
        if (f.crop && cropPerf[f.crop]) {
          cropPerf[f.crop].expense += parseFloat(f.cost) || 0;
        }
      });
      
      tableHead.innerHTML = `
        <tr>
          <th>ގަހުގެ ބާވަތް</th>
          <th style="text-align: end;">ލިބުނު އާމްދަނީ</th>
          <th style="text-align: end;">ޚަރަދުވީ އަދަދު</th>
          <th style="text-align: end;">ސާފު ފައިދާ</th>
        </tr>
      `;
      
      chartContainer.classList.remove('hidden');
      let maxVal = 0;
      
      Object.keys(cropPerf).forEach(name => {
        const p = cropPerf[name];
        const profit = p.income - p.expense;
        maxVal = Math.max(maxVal, p.income, p.expense);
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-weight:700;">${t(name)}</td>
          <td class="date-num text-success" style="text-align: end;">${format2DP(p.income)}</td>
          <td class="date-num text-danger" style="text-align: end;">${format2DP(p.expense)}</td>
          <td class="date-num ${profit >= 0 ? 'text-success' : 'text-danger'}" style="text-align: end; font-weight:700;">${format2DP(profit)}</td>
        `;
        tableBody.appendChild(tr);
        
        // Add chart bars
        const incPct = maxVal > 0 ? (p.income / maxVal) * 100 : 0;
        const expPct = maxVal > 0 ? (p.expense / maxVal) * 100 : 0;
        
        const chartRowHtml = `
          <div style="font-size:0.85rem; font-weight:700; margin-block-start: 6px;">${t(name)}</div>
          <div class="chart-bar-row" style="margin-block-start: 4px;">
            <span class="chart-label" style="font-size: 0.75rem; color:var(--success);">އާމްދަނީ</span>
            <div class="chart-bar-wrapper"><div class="chart-bar" style="width: ${incPct}%"></div></div>
            <span class="chart-value">${format2DP(p.income)}</span>
          </div>
          <div class="chart-bar-row" style="margin-block-start: 2px;">
            <span class="chart-label" style="font-size: 0.75rem; color:var(--danger);">ޚަރަދު</span>
            <div class="chart-bar-wrapper"><div class="chart-bar expense" style="width: ${expPct}%"></div></div>
            <span class="chart-value">${format2DP(p.expense)}</span>
          </div>
        `;
        chartContainer.innerHTML += chartRowHtml;
      });
      
    } else if (type === 'fertilizer') {
      titleEl.textContent = t('fertilizerUsage');
      
      tableHead.innerHTML = `
        <tr>
          <th>ތާރީޚް</th>
          <th>ގަސް</th>
          <th>ގަސްކާނާގެ ބާވަތް</th>
          <th style="text-align: end;">މިންވަރު</th>
          <th style="text-align: end;">ޚަރަދުވީ އަގު</th>
        </tr>
      `;
      
      let grandTotal = 0;
      fertilizer.forEach(f => {
        const cost = parseFloat(f.cost) || 0;
        grandTotal += cost;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="date-num">${f.date}</td>
          <td>${t(f.crop)}</td>
          <td>${f.fertilizerName}</td>
          <td class="date-num" style="text-align: end;">${format2DP(f.quantity)} ${f.unit}</td>
          <td class="date-num" style="text-align: end;">${format2DP(cost)}</td>
        `;
        tableBody.appendChild(tr);
      });
      
      const trTotal = document.createElement('tr');
      trTotal.style.borderBlockStart = "2px solid var(--border-color)";
      trTotal.innerHTML = `
        <td colspan="4" style="font-weight:700;">ޖުމްލަ ޚަރަދު</td>
        <td class="date-num" style="text-align: end; font-weight:700;">${format2DP(grandTotal)}${CURRENCY_HTML}</td>
      `;
      tableBody.appendChild(trTotal);
      
    } else if (type === 'harvest') {
      titleEl.textContent = t('harvestSummary');
      
      tableHead.innerHTML = `
        <tr>
          <th>ތާރީޚް</th>
          <th>ގަހުގެ ބާވަތް</th>
          <th>ކޮލިޓީ / ގްރޭޑް</th>
          <th style="text-align: end;">މިންވަރު</th>
          <th style="text-align: end;">ވިއްކި ޖުމްލަ އަގު</th>
        </tr>
      `;
      
      let grandTotalHarvest = 0;
      let grandTotalIncome = 0;
      
      harvests.forEach(h => {
        const qty = parseFloat(h.quantity) || 0;
        const price = parseFloat(h.sellingPrice) || 0;
        grandTotalHarvest += qty;
        grandTotalIncome += price;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="date-num">${h.harvestDate}</td>
          <td style="font-weight:700;">${t(h.crop)}</td>
          <td>${t(h.grade)}</td>
          <td class="date-num" style="text-align: end;">${format2DP(qty)} ${h.unit}</td>
          <td class="date-num" style="text-align: end;">${format2DP(price)}</td>
        `;
        tableBody.appendChild(tr);
      });
      
      const trTotal = document.createElement('tr');
      trTotal.style.borderBlockStart = "2px solid var(--border-color)";
      trTotal.innerHTML = `
        <td colspan="3" style="font-weight:700;">ޖުމްލަ</td>
        <td class="date-num" style="text-align: end; font-weight:700;">${format2DP(grandTotalHarvest)} ކިލޯ</td>
        <td class="date-num text-success" style="text-align: end; font-weight:700;">${format2DP(grandTotalIncome)}${CURRENCY_HTML}</td>
      `;
      tableBody.appendChild(trTotal);
      
    } else if (type === 'expense-cat') {
      titleEl.textContent = t('expenseByCategory');
      
      const categories = {};
      transactions.filter(t => t.type === 'expense').forEach(t => {
        categories[t.category] = (categories[t.category] || 0) + (parseFloat(t.amount) || 0);
      });
      
      // Add fertilizer cost as Fertilizer Category expense
      let fertTotalCost = 0;
      fertilizer.forEach(f => {
        fertTotalCost += parseFloat(f.cost) || 0;
      });
      if (fertTotalCost > 0) {
        categories['Fertilizer'] = (categories['Fertilizer'] || 0) + fertTotalCost;
      }
      
      tableHead.innerHTML = `
        <tr>
          <th>ޚަރަދުގެ ބާވަތް</th>
          <th style="text-align: end;">ޖުމްލަ ޚަރަދު (ރ)</th>
        </tr>
      `;
      
      chartContainer.classList.remove('hidden');
      let maxVal = 0;
      Object.keys(categories).forEach(cat => {
        maxVal = Math.max(maxVal, categories[cat]);
      });
      
      Object.keys(categories).forEach(cat => {
        const amt = categories[cat];
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-weight:700;">${t(cat) || cat}</td>
          <td class="date-num text-danger" style="text-align: end;">${format2DP(amt)}</td>
        `;
        tableBody.appendChild(tr);
        
        // Add chart bar
        const pct = maxVal > 0 ? (amt / maxVal) * 100 : 0;
        const chartRowHtml = `
          <div class="chart-bar-row">
            <span class="chart-label">${t(cat) || cat}</span>
            <div class="chart-bar-wrapper"><div class="chart-bar expense" style="width: ${pct}%"></div></div>
            <span class="chart-value">${format2DP(amt)}</span>
          </div>
        `;
        chartContainer.innerHTML += chartRowHtml;
      });
    }
  }

  exportReport(format) {
    if (format === 'pdf') {
      // Direct print simulation using media query print stylesheet
      window.print();
    } else if (format === 'excel') {
      // Build simulated CSV download
      const table = document.querySelector('#report-table-wrapper table');
      if (!table) return;
      
      let csvContent = '\uFEFF'; // UTF-8 BOM for RTL Thaana characters in Excel
      
      const rows = table.querySelectorAll('tr');
      rows.forEach(row => {
        const cols = row.querySelectorAll('th, td');
        const rowData = [];
        cols.forEach(col => {
          // Replace commas and remove extra spaces
          let text = col.textContent.replace(/,/g, '').trim();
          rowData.push(`"${text}"`);
        });
        csvContent += rowData.join(',') + '\r\n';
      });
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      
      const fileName = `dhandu_report_${document.getElementById('report-select-type').value}.csv`;
      link.setAttribute("download", fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      this.showToast("އެކްސެލް ފައިލް ޑައުންލޯޑް ކުރެވިއްޖެ!");
    }
  }

  // Modals Open / Close Operations
  openModal(modalId) {
    const modal = document.getElementById(`modal-${modalId}`);
    if (modal) modal.classList.add('show');
  }

  closeModal(modalId) {
    const modal = document.getElementById(`modal-${modalId}`);
    if (modal) modal.classList.remove('show');
  }
  openRecordModal(type) {
    const modalTitle = document.getElementById('modal-transaction-title');
    const form = document.getElementById('form-transaction');
    form.reset();
    
    // Set transaction date to today's local date in YYYY-MM-DD
    document.getElementById('tx-date').value = new Date().toISOString().split('T')[0];
    
    // Set type
    document.getElementById('tx-type').value = type;
    
    // Setup select options for crops
    const crops = queryTable('crops').filter(c => c.status === 'growing');
    const cropSelect = document.getElementById('tx-crop');
    cropSelect.innerHTML = crops.map(c => `<option value="${c.name}">${t(c.name)} (${c.variety})</option>`).join('');
    
    if (type === 'income') {
      modalTitle.textContent = t('recordIncome');
      document.getElementById('tx-crop-group').classList.remove('hidden');
      document.getElementById('tx-buyer-group').classList.remove('hidden');
      document.getElementById('tx-paystatus-group').classList.remove('hidden');
      document.getElementById('tx-price-unit-group').classList.remove('hidden');
      
      document.getElementById('tx-category-group').classList.add('hidden');
      document.getElementById('tx-supplier-group').classList.add('hidden');
    } else if (type === 'expense') {
      modalTitle.textContent = 'ޚަރަދެއް ރެކޯޑްކުރަން';
      document.getElementById('tx-category-group').classList.remove('hidden');
      document.getElementById('tx-supplier-group').classList.remove('hidden');
      
      document.getElementById('tx-crop-group').classList.add('hidden');
      document.getElementById('tx-buyer-group').classList.add('hidden');
      document.getElementById('tx-paystatus-group').classList.add('hidden');
      document.getElementById('tx-price-unit-group').classList.add('hidden');
    }
    
    this.openModal('transaction');
  }

  openHarvestModal() {
    const form = document.getElementById('form-harvest');
    form.reset();
    document.getElementById('harvest-date').value = new Date().toISOString().split('T')[0];
    
    const crops = queryTable('crops').filter(c => c.status === 'growing');
    const cropSelect = document.getElementById('harvest-crop');
    cropSelect.innerHTML = crops.map(c => `<option value="${c.name}">${t(c.name)} (${c.variety})</option>`).join('');
    
    this.openModal('harvest');
  }

  openFertilizerModal() {
    const form = document.getElementById('form-fertilizer');
    form.reset();
    document.getElementById('fert-date').value = new Date().toISOString().split('T')[0];
    
    // Populate active crops
    const crops = queryTable('crops').filter(c => c.status === 'growing');
    const cropSelect = document.getElementById('fert-crop');
    cropSelect.innerHTML = crops.map(c => `<option value="${c.name}">${t(c.name)} (${c.variety})</option>`).join('');
    
    // Populate active fertilizers from stock
    const user = getActiveUser();
    const fertNameSelect = document.getElementById('fert-name');
    if (user && fertNameSelect) {
      const localDB = JSON.parse(localStorage.getItem('dhandu_hisaabu_local_db') || '{}');
      const inventory = localDB.inventory || [];
      const fertItems = inventory.filter(item => item.farmId === user.farmId && item.category === 'Fertilizer');
      
      fertNameSelect.innerHTML = fertItems.map(item => 
        `<option value="${item.name}">${item.name} (ހުރީ: ${item.currentStock} ${item.unit})</option>`
      ).join('');
      
      // Auto-set unit when fertilizer is selected
      const fertUnitInput = document.getElementById('fert-unit');
      const updateUnit = () => {
        const selectedFertName = fertNameSelect.value;
        const item = fertItems.find(i => i.name === selectedFertName);
        if (item && fertUnitInput) {
          fertUnitInput.value = item.unit;
        }
      };
      fertNameSelect.addEventListener('change', updateUnit);
      updateUnit(); // Initial run
    }
    
    this.openModal('fertilizer');
  }

  openCropModal() {
    const form = document.getElementById('form-crop');
    form.reset();
    document.getElementById('crop-id').value = '';
    document.getElementById('modal-crop-title').textContent = 'އަލަށް ގަހެއް އިންދުން';
    document.getElementById('crop-planting-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('crop-harvest-days').value = '60';
    
    // Add expected harvest 60 days later as a default helper
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + 60);
    document.getElementById('crop-expected-harvest').value = expDate.toISOString().split('T')[0];
    
    this.openModal('crop');
  }

  calculateCropHarvestDate() {
    const plantingDateVal = document.getElementById('crop-planting-date').value;
    const daysVal = document.getElementById('crop-harvest-days').value;
    
    if (plantingDateVal && daysVal) {
      const days = parseInt(daysVal, 10);
      if (!isNaN(days) && days > 0) {
        const pDate = new Date(plantingDateVal);
        pDate.setDate(pDate.getDate() + days);
        document.getElementById('crop-expected-harvest').value = pDate.toISOString().split('T')[0];
      }
    }
  }

  openInventoryModal() {
    const form = document.getElementById('form-inventory');
    form.reset();
    document.getElementById('inventory-id').value = '';
    this.openModal('inventory');
  }

  openStaffModal() {
    const form = document.getElementById('form-staff');
    form.reset();
    document.getElementById('staff-id').value = '';
    this.openModal('staff');
  }

  openCreateFarmModal() {
    const form = document.getElementById('form-create-farm');
    form.reset();
    this.openModal('create-farm');
  }

  openRegisterModalSelf() {
    const form = document.getElementById('form-create-farm');
    form.reset();
    this.openModal('create-farm');
  }

  // Record Form Calculations & Math
  calculateTxTotal() {
    const qty = parseFloat(document.getElementById('tx-quantity').value) || 0;
    const unitPrice = parseFloat(document.getElementById('tx-price-unit').value) || 0;
    const amountEl = document.getElementById('tx-amount');
    
    if (qty > 0 && unitPrice > 0) {
      amountEl.value = (qty * unitPrice).toFixed(2);
    }
  }

  // Modals Save Record Form Submissions
  saveTransaction(e) {
    e.preventDefault();
    const type = document.getElementById('tx-type').value;
    const date = document.getElementById('tx-date').value;
    const crop = document.getElementById('tx-crop').value;
    const category = document.getElementById('tx-category').value;
    const amount = document.getElementById('tx-amount').value;
    const quantity = document.getElementById('tx-quantity').value;
    const unit = document.getElementById('tx-unit').value;
    const buyer = document.getElementById('tx-buyer').value;
    const supplier = document.getElementById('tx-supplier').value;
    const description = document.getElementById('tx-description').value;
    const paymentStatus = document.getElementById('tx-paystatus').value;
    
    const data = {
      date,
      type,
      crop: type === 'income' ? crop : null,
      category: type === 'expense' ? category : null,
      amount,
      quantity,
      unit,
      buyer: type === 'income' ? buyer : null,
      supplier: type === 'expense' ? supplier : null,
      description,
      paymentStatus: type === 'income' ? paymentStatus : 'paid'
    };
    
    this.saveSuggestedUnit(unit);
    if (buyer) this.saveSuggestedItem('buyer', buyer);
    if (supplier) this.saveSuggestedItem('supplier', supplier);
    if (type === 'expense' && category) this.saveSuggestedItem('category', category);
    insertRecord('transactions', data, this.isOnline);
    this.closeModal('transaction');
    
    this.showToast(this.isOnline ? "އާމްދަނީ/ޚަރަދު ރެކޯޑް ކުރެވިއްޖެ!" : "އޮފްލައިންކޮށް ސޭވްކުރެވިއްޖެ! ނެޓްވޯކް ލިބުމުން ސިންކްވާނެ.");
    this.showView(this.currentView);
  }

  saveFertilizer(e) {
    e.preventDefault();
    const date = document.getElementById('fert-date').value;
    const crop = document.getElementById('fert-crop').value;
    const fertilizerName = document.getElementById('fert-name').value;
    const quantity = document.getElementById('fert-quantity').value;
    const unit = document.getElementById('fert-unit').value;
    const method = document.getElementById('fert-method').value;
    const cost = document.getElementById('fert-cost').value;
    const notes = document.getElementById('fert-notes').value;
    
    const data = {
      date,
      crop,
      fertilizerName,
      quantity,
      unit,
      applicationMethod: method,
      cost,
      notes,
      appliedBy: getActiveUser().name
    };
    
    insertRecord('fertilizer_records', data, this.isOnline);
    this.closeModal('fertilizer');
    
    this.showToast("ގަސްކާނާ އެޅުން ރެކޯޑް ކުރެވި، އިންވެންޓްރީން މަދު ކުރެވިއްޖެ!");
    this.showView(this.currentView);
  }

  saveHarvest(e) {
    e.preventDefault();
    const date = document.getElementById('harvest-date').value;
    const crop = document.getElementById('harvest-crop').value;
    const quantity = document.getElementById('harvest-quantity').value;
    const unit = document.getElementById('harvest-unit').value;
    const grade = document.getElementById('harvest-grade').value;
    const buyer = document.getElementById('harvest-buyer').value;
    const sellingPrice = document.getElementById('harvest-price').value;
    const notes = document.getElementById('harvest-notes').value;
    
    const data = {
      harvestDate: date,
      crop,
      quantity,
      unit,
      grade,
      buyer,
      sellingPrice,
      notes
    };
    
    // Save harvest
    this.saveSuggestedUnit(unit);
    if (buyer) this.saveSuggestedItem('buyer', buyer);
    insertRecord('harvest_records', data, this.isOnline);
    
    // Also automatically create an Income Transaction if a selling price was entered!
    if (sellingPrice > 0) {
      const txData = {
        date,
        type: 'income',
        crop,
        amount: sellingPrice,
        quantity,
        unit,
        buyer,
        description: `މައުސޫލު ހޮވައި ވިއްކުން: ${grade}`,
        paymentStatus: 'paid'
      };
      insertRecord('transactions', txData, this.isOnline);
    }
    
    this.closeModal('harvest');
    this.showToast("މައުސޫލު ރެކޯޑް ކުރެވިއްޖެ!");
    this.showView(this.currentView);
  }

  saveCrop(e) {
    e.preventDefault();
    const id = document.getElementById('crop-id').value;
    const name = document.getElementById('crop-name').value;
    const variety = document.getElementById('crop-variety').value;
    const plantingDate = document.getElementById('crop-planting-date').value;
    const expectedHarvest = document.getElementById('crop-expected-harvest').value;
    const plantsCount = document.getElementById('crop-plants-count').value;
    const batchNumber = document.getElementById('crop-batch-number').value;
    const status = document.getElementById('crop-status').value;
    const notes = document.getElementById('crop-notes').value;
    
    const data = {
      name,
      variety,
      plantingDate,
      expectedHarvest,
      plantsCount: parseInt(plantsCount, 10) || 0,
      batchNumber,
      status,
      notes
    };
    
    this.saveSuggestedItem('crop', name);
    if (id) {
      updateRecord('crops', id, data, this.isOnline);
      this.showToast("ގަހުގެ މައުލޫމާތު އިސްލާހު ކުރެވިއްޖެ!");
    } else {
      insertRecord('crops', data, this.isOnline);
      this.showToast("އާ ގަހެއް ހެއްދުމަށް ރަޖިސްޓްރީ ކުރެވިއްޖެ!");
    }
    
    this.closeModal('crop');
    this.showView(this.currentView);
  }

  saveInventory(e) {
    e.preventDefault();
    const id = document.getElementById('inventory-id').value;
    const category = document.getElementById('inv-category').value;
    const name = document.getElementById('inv-name').value;
    const currentStock = document.getElementById('inv-stock').value;
    const unit = document.getElementById('inv-unit').value;
    const minimumStock = document.getElementById('inv-min-stock').value;
    
    const data = {
      category,
      name,
      currentStock,
      unit,
      minimumStock
    };
    
    this.saveSuggestedUnit(unit);
    if (id) {
      updateRecord('inventory', id, data, this.isOnline);
      this.showToast("އިންވެންޓްރީ ސާމާނު އިސްލާހު ކުރެވިއްޖެ!");
    } else {
      insertRecord('inventory', data, this.isOnline);
      this.showToast("އާ ސާމާނެއް އިންވެންޓްރީއަށް އިތުރުކުރެވިއްޖެ!");
    }
    
    this.closeModal('inventory');
    this.showView(this.currentView);
  }

  saveStaff(e) {
    e.preventDefault();
    const id = document.getElementById('staff-id').value;
    const name = document.getElementById('staff-name-input').value;
    const phone = document.getElementById('staff-phone').value;
    const username = document.getElementById('staff-username-input').value;
    const password = document.getElementById('staff-password-input').value;
    const status = document.getElementById('staff-status').value;
    
    const localDB = JSON.parse(localStorage.getItem('dhandu_hisaabu_local_db') || '{}');
    const serverDB = JSON.parse(localStorage.getItem('dhandu_hisaabu_server_db') || '{}');
    
    const newStaffUser = {
      username,
      password,
      role: 'staff',
      name,
      phone,
      farmId: getActiveUser().farmId,
      status
    };
    
    if (id) {
      // Update
      const uIdxL = localDB.users.findIndex(u => u.username === username);
      if (uIdxL !== -1) localDB.users[uIdxL] = newStaffUser;
      
      const uIdxS = serverDB.users.findIndex(u => u.username === username);
      if (uIdxS !== -1) serverDB.users[uIdxS] = newStaffUser;
      
      logAuditEvent("UPDATE_STAFF", `Updated staff credentials: ${username}`);
    } else {
      // Check duplicate
      const duplicate = localDB.users.find(u => u.username === username);
      if (duplicate) {
        alert("މި ޔޫޒަރނޭމް މިހާރުވެސް ބޭނުންކުރެވެމުންދަނީ. އެހެން ޔޫޒަރނޭމެއް ޖައްސަވާ.");
        return;
      }
      localDB.users.push(newStaffUser);
      serverDB.users.push(newStaffUser);
      logAuditEvent("CREATE_STAFF", `Added new staff member: ${username}`);
    }
    
    localStorage.setItem('dhandu_hisaabu_local_db', JSON.stringify(localDB));
    localStorage.setItem('dhandu_hisaabu_server_db', JSON.stringify(serverDB));
    
    this.closeModal('staff');
    this.showToast("މުވައްޒަފުގެ ތަފްސީލް ރައްކާކުރެވިއްޖެ!");
    this.showView(this.currentView);
  }

  saveProfile(e) {
    e.preventDefault();
    const user = getActiveUser();
    const name = document.getElementById('profile-farm-name').value;
    const owner = document.getElementById('profile-owner-name').value;
    const island = document.getElementById('profile-island').value;
    const address = document.getElementById('profile-address').value;
    const size = document.getElementById('profile-size').value;
    const contact = document.getElementById('profile-contact').value;
    const gpsLocation = document.getElementById('profile-gps').value;
    
    const updatedFields = {
      name,
      owner,
      island,
      address,
      size,
      contact,
      gpsLocation
    };
    
    updateRecord('farms', user.farmId, updatedFields, this.isOnline);
    this.showToast("ދަނޑުގެ ޕްރޮފައިލް އަޕްޑޭޓް ކުރެވިއްޖެ!");
    this.showView(this.currentView);
  }

  saveNewFarm(e) {
    e.preventDefault();
    const name = document.getElementById('farm-name-input').value;
    const owner = document.getElementById('farm-owner-input').value;
    const island = document.getElementById('farm-island-input').value;
    const size = document.getElementById('farm-size-input').value;
    const contact = document.getElementById('farm-contact-input').value;
    const adminUsername = document.getElementById('farm-admin-username').value;
    const adminPassword = document.getElementById('farm-admin-password').value;
    
    const activeUser = getActiveUser();
    
    try {
      if (activeUser && activeUser.role === 'platform_admin') {
        createFarm({
          name,
          owner,
          island,
          size,
          contact,
          adminUsername,
          adminPassword
        });
        this.closeModal('create-farm');
        this.showToast("ދަނޑު ރަޖިސްޓްރީ ކުރެވި، އެޑްމިން ޔޫޒަރ ހެދިއްޖެ!");
        this.showView('platform-dashboard');
      } else {
        // Self registration by a guest farmer
        registerFarmSelf({
          name,
          owner,
          island,
          size,
          contact,
          adminUsername,
          adminPassword
        });
        this.closeModal('create-farm');
        this.showToast("ދަނޑު ރަޖިސްޓްރީ ކުރެވިއްޖެ! ލޮގިންވެވަޑައިގަންނަވާ.");
        
        // Auto-fill login credentials
        document.getElementById('login-username').value = adminUsername;
        document.getElementById('login-password').value = adminPassword;
      }
    } catch (err) {
      alert(err.message);
    }
  }

  // Mutators and Helpers
  editCrop(id) {
    const crops = queryTable('crops');
    const crop = crops.find(c => c.id === id);
    if (!crop) return;
    
    document.getElementById('crop-id').value = crop.id;
    document.getElementById('crop-name').value = crop.name;
    document.getElementById('crop-variety').value = crop.variety;
    document.getElementById('crop-planting-date').value = crop.plantingDate;
    document.getElementById('crop-expected-harvest').value = crop.expectedHarvest;
    document.getElementById('crop-plants-count').value = crop.plantsCount || crop.area || '';
    document.getElementById('crop-batch-number').value = crop.batchNumber || '';
    document.getElementById('crop-status').value = crop.status;
    document.getElementById('crop-notes').value = crop.notes || '';
    
    // Calculate difference in days to populate the crop-harvest-days field
    const pDate = new Date(crop.plantingDate);
    const hDate = new Date(crop.expectedHarvest);
    const diffTime = Math.abs(hDate - pDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    document.getElementById('crop-harvest-days').value = isNaN(diffDays) ? '' : diffDays;
    
    document.getElementById('modal-crop-title').textContent = 'ގަހުގެ މައުލޫމާތު އިސްލާހުކުރުން';
    this.openModal('crop');
  }

  editInventory(id) {
    const inventory = queryTable('inventory');
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    
    document.getElementById('inventory-id').value = item.id;
    document.getElementById('inv-category').value = item.category;
    document.getElementById('inv-name').value = item.name;
    document.getElementById('inv-stock').value = item.currentStock;
    document.getElementById('inv-unit').value = item.unit;
    document.getElementById('inv-min-stock').value = item.minimumStock;
    
    this.openModal('inventory');
  }

  resetStaffPassword(username) {
    const newPass = prompt("އާ ޕާސްވޯޑް ޖައްސަވާ:");
    if (newPass) {
      resetPassword(username, newPass);
      this.showToast("ޕާސްވޯޑް ރީސެޓް ކުރެވިއްޖެ!");
      this.showView(this.currentView);
    }
  }

  toggleStaffStatus(username) {
    const localDB = JSON.parse(localStorage.getItem('dhandu_hisaabu_local_db') || '{}');
    const serverDB = JSON.parse(localStorage.getItem('dhandu_hisaabu_server_db') || '{}');
    
    const uIdxL = localDB.users.findIndex(u => u.username === username);
    if (uIdxL !== -1) {
      const cur = localDB.users[uIdxL].status;
      const next = cur === 'active' ? 'suspended' : 'active';
      
      localDB.users[uIdxL].status = next;
      
      const uIdxS = serverDB.users.findIndex(u => u.username === username);
      if (uIdxS !== -1) serverDB.users[uIdxS].status = next;
      
      localStorage.setItem('dhandu_hisaabu_local_db', JSON.stringify(localDB));
      localStorage.setItem('dhandu_hisaabu_server_db', JSON.stringify(serverDB));
      
      logAuditEvent("TOGGLE_STAFF_STATUS", `Toggled staff ${username} status to ${next}`);
      this.showToast("މުވައްޒަފުގެ ހާލަތު ބަދަލުކުރެވިއްޖެ!");
      this.showView(this.currentView);
    }
  }

  toggleFarmStatus(farmId) {
    toggleFarmStatus(farmId);
    this.showToast("ދަނޑުގެ ހާލަތު ބަދަލުކުރެވިއްޖެ!");
    this.showView(this.currentView);
  }

  // Deletions Handler
  deleteRecord(table, id) {
    if (confirm("މި ރެކޯޑް އެއްކޮށް ޑިލީޓް ކޮށްލަން ބޭނުންތަ؟")) {
      try {
        deleteRecord(table, id, this.isOnline);
        this.showToast("ރެކޯޑް ޑިލީޓް ކުރެވިއްޖެ!");
        this.showView(this.currentView);
      } catch (err) {
        alert(err.message);
      }
    }
  }



  settleTransaction(txId) {
    if (confirm("މި ޓްރާންސެކްޝަން ޚަލާޞްކުރަން (ފައިސާ ލިބިއްޖެ ކަމަށް ހަދަން) ބޭނުންތަ؟")) {
      try {
        updateRecord('transactions', txId, { paymentStatus: 'paid' }, this.isOnline);
        this.showToast("މި ޓްރާންސެކްޝަން ޚަލާޞްކުރެވިއްޖެ!");
        this.showView(this.currentView);
      } catch (err) {
        alert(err.message);
      }
    }
  }

  // Set up modal helpers inside the form view for staff recording
  openRecordModalForStaff(type) {
    this.openRecordModal(type);
  }

  // CROP TREATMENTS MODULE IMPLEMENTATION
  switchTreatmentTab(tabId) {
    this.currentTreatmentTab = tabId;
    
    // Toggle active buttons
    const btns = document.querySelectorAll('.t-tab-btn');
    btns.forEach(btn => {
      if (btn.getAttribute('onclick').includes(tabId)) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Toggle tab content visibility
    const contents = document.querySelectorAll('.t-tab-content');
    contents.forEach(el => {
      if (el.id === `t-tab-content-${tabId}`) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    });

    // Load content
    if (tabId === 'dashboard') this.loadTreatmentsDashboard();
    else if (tabId === 'new-app') this.loadNewTreatmentApplicationForm();
    else if (tabId === 'records') this.loadTreatmentRecords();
    else if (tabId === 'products') this.loadTreatmentProducts();
    else if (tabId === 'calendar') this.loadTreatmentCalendar();
    else if (tabId === 'reports') this.loadTreatmentReports();
  }

  loadTreatments() {
    const user = getActiveUser();
    if (!user) return;

    // Show/hide admin blocks
    const adminElements = document.querySelectorAll('.admin-only');
    if (user.role === 'staff') {
      adminElements.forEach(el => el.classList.add('hidden'));
      const prodTab = document.getElementById('t-tab-btn-products');
      if (prodTab) prodTab.classList.add('hidden');
      const repTab = document.getElementById('t-tab-btn-reports');
      if (repTab) repTab.classList.add('hidden');
    } else {
      adminElements.forEach(el => el.classList.remove('hidden'));
      const prodTab = document.getElementById('t-tab-btn-products');
      if (prodTab) prodTab.classList.remove('hidden');
      const repTab = document.getElementById('t-tab-btn-reports');
      if (repTab) repTab.classList.remove('hidden');
    }

    if (!this.currentTreatmentTab) this.currentTreatmentTab = 'dashboard';
    this.switchTreatmentTab(this.currentTreatmentTab);
  }

  loadTreatmentsDashboard() {
    const user = getActiveUser();
    if (!user) return;

    const localDB = JSON.parse(localStorage.getItem('dhandu_hisaabu_local_db') || '{}');
    const apps = (localDB.treatment_applications || []).filter(a => a.farmId === user.farmId);
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Applications Today
    const todayApps = apps.filter(a => a.date === todayStr);
    document.getElementById('t-dash-today-count').textContent = todayApps.length;

    // 3. Overdue & Upcoming List logic
    let overdueCount = 0;
    const overdueItems = [];
    apps.forEach(app => {
      if (app.nextScheduledDate && app.nextScheduledDate < todayStr) {
        const hasLater = apps.some(a => 
          a.cropId === app.cropId && 
          a.category === app.category && 
          a.date >= app.nextScheduledDate
        );
        if (!hasLater) {
          overdueCount++;
          overdueItems.push(app);
        }
      }
    });
    document.getElementById('t-dash-overdue-count').textContent = overdueCount;

    const banner = document.getElementById('t-dash-overdue-banner');
    const overdueList = document.getElementById('t-dash-overdue-list');
    if (overdueCount > 0) {
      banner.classList.remove('hidden');
      overdueList.innerHTML = overdueItems.map(item => `
        <div class="activity-item" style="border-inline-start: 4px solid var(--danger); padding: 8px 12px; margin-block-end: 8px; background: white; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="font-weight: bold; color: var(--danger); font-size: 0.85rem;">ޖަހަންޖެހޭ ތާރީޚް ފާއިތުވެއްޖެ: ${item.nextScheduledDate}</div>
          <div style="font-size: 0.95rem; margin-block-start: 4px;">
            <strong>${t(item.category)}: ${item.productName}</strong> (ބެޗް: ${item.crop} - ${item.plot})
          </div>
        </div>
      `).join('');
    } else {
      banner.classList.add('hidden');
    }

    // Upcoming Treatments
    const next7DaysStr = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    const upcomingApps = apps.filter(app => 
      app.nextScheduledDate && 
      app.nextScheduledDate >= todayStr && 
      app.nextScheduledDate <= next7DaysStr
    );
    document.getElementById('t-dash-upcoming-list').innerHTML = upcomingApps.length ? upcomingApps.map(item => `
      <div class="activity-item" style="border-inline-start: 4px solid var(--primary); padding: 8px 12px; margin-block-end: 8px; background: white; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <div style="font-weight: bold; color: var(--primary); font-size: 0.85rem;">ތާވަލު ތާރީޚް: ${item.nextScheduledDate}</div>
        <div style="font-size: 0.95rem; margin-block-start: 4px;">
          <strong>${t(item.category)}: ${item.productName}</strong> (ބެޗް: ${item.crop} - ${item.plot})
        </div>
      </div>
    `).join('') : '<div class="text-muted" style="padding: 10px;">ކުރިއަށް އޮތް 7 ދުވަހު ތާވަލުކުރެވިފައިވާ ފަރުވާއެއް ނެތް.</div>';

    // 4. Most Used Product
    const counts = {};
    apps.forEach(a => {
      if (a.productName) {
        counts[a.productName] = (counts[a.productName] || 0) + 1;
      }
    });
    let mostUsed = '-';
    let maxVal = 0;
    for (const prod in counts) {
      if (counts[prod] > maxVal) {
        maxVal = counts[prod];
        mostUsed = prod;
      }
    }
    document.getElementById('t-dash-most-used').textContent = mostUsed;
  }

  loadNewTreatmentApplicationForm() {
    const user = getActiveUser();
    if (!user) return;

    document.getElementById('t-app-date').value = new Date().toISOString().split('T')[0];

    const localDB = JSON.parse(localStorage.getItem('dhandu_hisaabu_local_db') || '{}');
    const crops = (localDB.crops || []).filter(c => c.farmId === user.farmId && c.status === 'growing');
    const cropSelect = document.getElementById('t-app-crop');
    cropSelect.innerHTML = crops.map(c => `<option value="${c.id}">${c.name} (${c.batchNumber})</option>`).join('');
    
    const products = (localDB.treatment_products || []).filter(p => p.farmId === user.farmId && p.status === 'active');
    const productSelect = document.getElementById('t-app-product');
    productSelect.innerHTML = products.map(p => `<option value="${p.id}">${p.name} (${t(p.category)})</option>`).join('');

    this.onTreatmentCropChange();
    this.onTreatmentProductChange();
  }

  onTreatmentCropChange() {
    const cropSelect = document.getElementById('t-app-crop');
    const varietyInput = document.getElementById('t-app-variety');
    if (!cropSelect || !varietyInput) return;

    const localDB = JSON.parse(localStorage.getItem('dhandu_hisaabu_local_db') || '{}');
    const crop = (localDB.crops || []).find(c => c.id === cropSelect.value);
    if (crop) {
      varietyInput.value = crop.variety || '';
    }
  }

  onTreatmentProductChange() {
    const productSelect = document.getElementById('t-app-product');
    const unitInput = document.getElementById('t-app-unit');
    const ratioInput = document.getElementById('t-app-ratio');
    if (!productSelect || !unitInput) return;

    const localDB = JSON.parse(localStorage.getItem('dhandu_hisaabu_local_db') || '{}');
    const product = (localDB.treatment_products || []).find(p => p.id === productSelect.value);
    if (product) {
      unitInput.value = product.defaultUnit || '';
      ratioInput.value = product.defaultDosage || '';
    }
  }

  async fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  }

  async saveTreatmentApplication(event) {
    event.preventDefault();
    const user = getActiveUser();
    if (!user) return;

    const date = document.getElementById('t-app-date').value;
    const cropId = document.getElementById('t-app-crop').value;
    const plot = document.getElementById('t-app-plot').value;
    const growthStage = document.getElementById('t-app-stage').value;
    const productId = document.getElementById('t-app-product').value;
    const qty = Number(document.getElementById('t-app-qty').value) || 0;
    const unit = document.getElementById('t-app-unit').value;
    const ratio = document.getElementById('t-app-ratio').value;
    const water = document.getElementById('t-app-water').value;
    const method = document.getElementById('t-app-method').value;
    const nextDays = Number(document.getElementById('t-app-next-days').value) || 0;
    const remarks = document.getElementById('t-app-remarks').value;
    const photoFile = document.getElementById('t-app-photo-file').files[0];

    let photoBase64 = null;
    if (photoFile) {
      photoBase64 = await this.fileToBase64(photoFile);
    }

    const localDB = JSON.parse(localStorage.getItem('dhandu_hisaabu_local_db') || '{}');
    const crop = (localDB.crops || []).find(c => c.id === cropId);
    const product = (localDB.treatment_products || []).find(p => p.id === productId);

    let nextScheduledDate = null;
    if (nextDays > 0 && date) {
      const d = new Date(date);
      d.setDate(d.getDate() + nextDays);
      nextScheduledDate = d.toISOString().split('T')[0];
    }

    if (this.editingApplicationId) {
      const updatedFields = {
        date, cropId, plot, growthStage, productId, quantityUsed: qty, unit, mixRatio: ratio, waterVolume: water,
        applicationMethod: method, nextScheduledDate, remarks, photo: photoBase64 || undefined,
        updatedDate: new Date().toISOString()
      };
      if (!photoBase64) delete updatedFields.photo;
      
      try {
        updateRecord('treatment_applications', this.editingApplicationId, updatedFields, this.isOnline);
        this.editingApplicationId = null;
        this.showToast("ފަރުވާގެ ރެކޯޑް ބަދަލުކުރެވިއްޖެ!");
        document.getElementById('treatment-app-form').reset();
        this.switchTreatmentTab('records');
      } catch (err) {
        alert(err.message);
      }
      return;
    }

    const newApp = {
      id: "ta_" + Date.now(),
      farmId: user.farmId,
      cropId,
      productId,
      userId: user.username,
      date,
      crop: crop ? crop.name : '',
      variety: crop ? crop.variety : '',
      plot,
      growthStage,
      category: product ? product.category : '',
      productName: product ? product.name : '',
      quantityUsed: qty,
      unit,
      mixRatio: ratio,
      waterVolume: water,
      applicationMethod: method,
      appliedBy: user.username,
      nextScheduledDate,
      remarks,
      photo: photoBase64,
      status: user.role === 'farm_admin' ? 'approved' : 'pending_approval',
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString()
    };

    try {
      insertRecord('treatment_applications', newApp, this.isOnline);
      
      const logEntry = {
        id: "log_" + Date.now(),
        farmId: user.farmId,
        timestamp: new Date().toISOString(),
        username: user.username,
        eventType: "RECORD_TREATMENT",
        message: `${user.name} ޖެހީ: ${t(newApp.category)} - ${newApp.productName} (ގަސް: ${newApp.crop})`,
        type: "farm"
      };
      insertRecord('audit_logs', logEntry, this.isOnline);

      this.showToast("ފަރުވާގެ ރެކޯޑް ކާމިޔާކުރެވިއްޖެ!");
      document.getElementById('treatment-app-form').reset();
      this.switchTreatmentTab('dashboard');
    } catch (err) {
      alert(err.message);
    }
  }

  loadTreatmentRecords() {
    const user = getActiveUser();
    if (!user) return;

    const localDB = JSON.parse(localStorage.getItem('dhandu_hisaabu_local_db') || '{}');
    const apps = (localDB.treatment_applications || []).filter(a => a.farmId === user.farmId);
    
    apps.sort((a,b) => {
      const d1 = `${a.date}T${a.time || '00:00'}`;
      const d2 = `${b.date}T${b.time || '00:00'}`;
      return d2.localeCompare(d1);
    });

    const filterCropSelect = document.getElementById('t-records-filter-crop');
    const prevVal = filterCropSelect.value;
    const crops = (localDB.crops || []).filter(c => c.farmId === user.farmId);
    filterCropSelect.innerHTML = `<option value="">ހުރިހާ ގަހެއް</option>` + 
      crops.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    filterCropSelect.value = prevVal;

    const searchVal = document.getElementById('t-records-search').value.toLowerCase();
    const categoryFilter = document.getElementById('t-records-filter-cat').value;
    const cropFilter = document.getElementById('t-records-filter-crop').value;

    const filtered = apps.filter(a => {
      const matchSearch = !searchVal || 
        a.productName.toLowerCase().includes(searchVal) || 
        a.crop.toLowerCase().includes(searchVal) || 
        (a.remarks && a.remarks.toLowerCase().includes(searchVal));
      const matchCategory = !categoryFilter || a.category === categoryFilter;
      const matchCrop = !cropFilter || a.crop === cropFilter;
      return matchSearch && matchCategory && matchCrop;
    });

    const tbody = document.getElementById('t-records-table-body');
    tbody.innerHTML = filtered.length ? filtered.map(item => {
      const statusClass = item.status === 'approved' ? 't-status-approved' : 't-status-pending';
      const statusText = item.status === 'approved' ? 'ހުއްދަދެވިފައި' : 'ހުއްދަ ނޫން';
      
      let actions = '';
      if (user.role === 'farm_admin') {
        if (item.status === 'pending_approval') {
          actions += `<button class="btn" style="display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; padding:0; min-height:auto; border-radius:50%; background:#2e7d32; border:none; color:white; cursor:pointer;" onclick="window.app.approveTreatmentApplication('${item.id}')" title="ހުއްދަދޭން"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></button>`;
        }
        actions += `<button class="btn" style="display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; padding:0; min-height:auto; border-radius:50%; background:#f0f0f0; border:none; color:#333; cursor:pointer;" onclick="window.app.editTreatmentApplication('${item.id}')" title="ބަދަލުކުރަން"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg></button>`;
        actions += `<button class="btn" style="display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; padding:0; min-height:auto; border-radius:50%; background:#c62828; border:none; color:white; cursor:pointer;" onclick="window.app.deleteTreatmentApplication('${item.id}')" title="ފޮހެލަން"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>`;
      } else {
        if (item.appliedBy === user.username && item.status === 'pending_approval') {
          actions += `<button class="btn" style="display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; padding:0; min-height:auto; border-radius:50%; background:#f0f0f0; border:none; color:#333; cursor:pointer;" onclick="window.app.editTreatmentApplication('${item.id}')" title="ބަދަލުކުރަން"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg></button>`;
        } else {
          actions += `<span style="display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:50%; background:#f5f5f5; color:#9e9e9e;" title="ބަދަލެއް ނުގެނެވޭނެ"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg></span>`;
        }
      }

      let photoHTML = '';
      if (item.photo) {
        photoHTML = ` <button class="btn btn-secondary" style="padding:2px 6px; font-size:0.7rem; min-height:auto;" onclick="const w = window.open(); w.document.write('<img src=\x22${item.photo}\x22 style=\x22max-width:100%;\x22>');">📷</button>`;
      }

      return `
        <tr>
          <td>${item.date} ${item.time || ''}</td>
          <td><strong>${item.crop}</strong> (${item.plot || '-'})${photoHTML}</td>
          <td>${item.productName}</td>
          <td>${t(item.category)}</td>
          <td style="text-align: end; font-weight: bold;">${item.quantityUsed} ${item.unit}</td>
          <td>${item.nextScheduledDate || '-'}</td>
          <td><div style="display:flex; gap:6px; align-items:center;">${actions}</div></td>
        </tr>
      `;
    }).join('') : `<tr><td colspan="7" class="text-center text-muted">އެއްވެސް ރެކޯޑެއް ފެންނާކަށް ނެތް.</td></tr>`;
  }

  approveTreatmentApplication(id) {
    try {
      updateRecord('treatment_applications', id, { status: 'approved' }, this.isOnline);
      this.showToast("ފަރުވާ ރެކޯޑަށް ހުއްދަ ދެވިއްޖެ!");
      this.loadTreatmentRecords();
    } catch (err) {
      alert(err.message);
    }
  }

  deleteTreatmentApplication(id) {
    if (confirm("މި ފަރުވާގެ ރެކޯޑް ފޮހެލަން ބޭނުންތަ؟")) {
      try {
        deleteRecord('treatment_applications', id, this.isOnline);
        this.showToast("ރެކޯޑް ފޮހެލެވިއްޖެ!");
        this.loadTreatmentRecords();
      } catch (err) {
        alert(err.message);
      }
    }
  }

  editTreatmentApplication(id) {
    const localDB = JSON.parse(localStorage.getItem('dhandu_hisaabu_local_db') || '{}');
    const app = (localDB.treatment_applications || []).find(a => a.id === id);
    if (!app) return;

    this.editingApplicationId = id;
    this.switchTreatmentTab('new-app');

    document.getElementById('t-app-date').value = app.date;
    document.getElementById('t-app-crop').value = app.cropId;
    document.getElementById('t-app-plot').value = app.plot;
    document.getElementById('t-app-stage').value = app.growthStage;
    document.getElementById('t-app-product').value = app.productId;
    document.getElementById('t-app-qty').value = app.quantityUsed;
    document.getElementById('t-app-unit').value = app.unit;
    document.getElementById('t-app-ratio').value = app.mixRatio || '';
    document.getElementById('t-app-water').value = app.waterVolume || '';
    document.getElementById('t-app-method').value = app.applicationMethod;
    let intervalDays = '';
    if (app.nextScheduledDate && app.date) {
      const diffTime = Math.abs(new Date(app.nextScheduledDate) - new Date(app.date));
      intervalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    document.getElementById('t-app-next-days').value = intervalDays;
    document.getElementById('t-app-remarks').value = app.remarks || '';
  }

  loadTreatmentProducts() {
    const user = getActiveUser();
    if (!user) return;

    const localDB = JSON.parse(localStorage.getItem('dhandu_hisaabu_local_db') || '{}');
    const products = (localDB.treatment_products || []).filter(p => p.farmId === user.farmId);

    const tbody = document.getElementById('t-products-table-body');
    tbody.innerHTML = products.length ? products.map(item => {
      const statusText = item.status === 'active' ? 'އެކްޓިވް' : 'އިންއެކްޓިވް';
      const statusClass = item.status === 'active' ? 'text-success' : 'text-muted';
      
      let actions = '';
      if (user.role === 'farm_admin') {
        actions = `
          <td>
            <button class="btn btn-secondary" style="padding:4px 8px; font-size:0.75rem; min-height:auto; margin-inline-end:4px;" onclick="window.app.editTreatmentProduct('${item.id}')">ބަދަލުކުރަން</button>
            <button class="btn btn-danger" style="padding:4px 8px; font-size:0.75rem; min-height:auto; background:#d32f2f; color:white;" onclick="window.app.deleteTreatmentProduct('${item.id}')">ފޮހެލަން</button>
          </td>
        `;
      }

      return `
        <tr>
          <td><strong>${item.name}</strong></td>
          <td>${t(item.category)}</td>
          <td>${item.brand || '-'}</td>
          <td>${item.defaultDosage || '-'}</td>
          <td>${item.preHarvestInterval || '-'}</td>
          <td><span class="${statusClass}" style="font-weight: bold;">${statusText}</span></td>
          ${actions}
        </tr>
      `;
    }).join('') : `<tr><td colspan="7" class="text-center text-muted">އެއްވެސް ބާވަތެއް މާސްޓަރ ލިސްޓުގައި ނެތް.</td></tr>`;
  }

  saveTreatmentProduct(event) {
    event.preventDefault();
    const user = getActiveUser();
    if (!user) return;

    const id = document.getElementById('t-prod-id').value;
    const name = document.getElementById('t-prod-name').value;
    const brand = document.getElementById('t-prod-brand').value;
    const category = document.getElementById('t-prod-cat').value;
    const unit = document.getElementById('t-prod-unit').value;
    const dosage = document.getElementById('t-prod-dosage').value;
    const phi = document.getElementById('t-prod-phi').value;
    const status = document.getElementById('t-prod-status').value;

    if (id) {
      const updatedFields = {
        name, brand, category, defaultUnit: unit, defaultDosage: dosage,
        preHarvestInterval: phi, status,
        updatedDate: new Date().toISOString()
      };
      try {
        updateRecord('treatment_products', id, updatedFields, this.isOnline);
        this.showToast("ބާވަތުގެ މަޢުލޫމާތު ބަދަލުކުރެވިއްޖެ!");
        document.getElementById('treatment-product-form').reset();
        document.getElementById('t-prod-id').value = '';
        this.loadTreatmentProducts();
      } catch (err) {
        alert(err.message);
      }
    } else {
      const newProd = {
        id: "p_" + Date.now(),
        farmId: user.farmId,
        name, brand, category, defaultUnit: unit, defaultDosage: dosage,
        preHarvestInterval: phi, status,
        createdDate: new Date().toISOString(),
        updatedDate: new Date().toISOString()
      };
      try {
        insertRecord('treatment_products', newProd, this.isOnline);
        this.showToast("އާ ބާވަތެއް މާސްޓަރ ލިސްޓަށް އިތުރުކުރެވިއްޖެ!");
        document.getElementById('treatment-product-form').reset();
        this.loadTreatmentProducts();
      } catch (err) {
        alert(err.message);
      }
    }
  }

  editTreatmentProduct(id) {
    const localDB = JSON.parse(localStorage.getItem('dhandu_hisaabu_local_db') || '{}');
    const p = (localDB.treatment_products || []).find(prod => prod.id === id);
    if (!p) return;

    document.getElementById('t-prod-id').value = p.id;
    document.getElementById('t-prod-name').value = p.name;
    document.getElementById('t-prod-brand').value = p.brand || '';
    document.getElementById('t-prod-cat').value = p.category;
    document.getElementById('t-prod-unit').value = p.defaultUnit || '';
    document.getElementById('t-prod-dosage').value = p.defaultDosage || '';
    document.getElementById('t-prod-phi').value = p.preHarvestInterval || '';
    document.getElementById('t-prod-status').value = p.status;
    
    document.getElementById('t-product-form-container').scrollIntoView({ behavior: 'smooth' });
  }

  deleteTreatmentProduct(id) {
    if (confirm("މި ބާވަތް މާސްޓަރ ލިސްޓުން ފޮހެލަން ބޭނުންތަ؟")) {
      try {
        deleteRecord('treatment_products', id, this.isOnline);
        this.showToast("ބާވަތް ފޮހެލެވިއްޖެ!");
        this.loadTreatmentProducts();
      } catch (err) {
        alert(err.message);
      }
    }
  }

  changeTreatmentMonth(offset) {
    if (!this.currentCalendarMonth) {
      this.currentCalendarMonth = new Date();
    }
    this.currentCalendarMonth.setMonth(this.currentCalendarMonth.getMonth() + offset);
    this.loadTreatmentCalendar();
  }

  loadTreatmentCalendar() {
    if (!this.currentCalendarMonth) {
      this.currentCalendarMonth = new Date();
    }
    const user = getActiveUser();
    if (!user) return;

    const year = this.currentCalendarMonth.getFullYear();
    const month = this.currentCalendarMonth.getMonth();

    const monthsDhivehi = ["ޖެނުއަރީ", "ފެބްރުއަރީ", "މާރޗް", "އެޕްރީލް", "މޭ", "ޖޫން", "ޖުލައި", "އޮގަސްޓް", "ސެޕްޓެމްބަރ", "އޮކްޓޯބަރ", "ނޮވެމްބަރ", "ޑިސެމްބަރ"];
    document.getElementById('t-cal-month-title').textContent = `${monthsDhivehi[month]} ${year}`;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const adjustedOffset = (firstDayIndex + 1) % 7; 
    const totalDays = new Date(year, month + 1, 0).getDate();

    const localDB = JSON.parse(localStorage.getItem('dhandu_hisaabu_local_db') || '{}');
    const apps = (localDB.treatment_applications || []).filter(a => a.farmId === user.farmId);

    const daysGrid = document.getElementById('t-cal-days-grid');
    daysGrid.innerHTML = '';

    for (let i = 0; i < adjustedOffset; i++) {
      daysGrid.innerHTML += `<div class="t-cal-day-cell empty"></div>`;
    }

    const todayLocalStr = new Date().toISOString().split('T')[0];

    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const scheduledTreatments = apps.filter(a => a.nextScheduledDate === dateStr);
      
      let eventsHTML = '';
      if (scheduledTreatments.length > 0) {
        eventsHTML = `
          <div class="t-cal-events-container">
            ${scheduledTreatments.map(tApp => {
              const dotClass = `t-dot-${tApp.category.toLowerCase().replace(' ', '')}`;
              let isOverdue = false;
              if (dateStr < todayLocalStr) {
                const hasLater = apps.some(a => 
                  a.cropId === tApp.cropId && 
                  a.category === tApp.category && 
                  a.date >= dateStr
                );
                if (!hasLater) isOverdue = true;
              }
              const statusClass = isOverdue ? 't-cal-overdue' : (dateStr === todayLocalStr ? 't-cal-due-today' : '');
              return `<span class="t-cal-event-dot ${dotClass} ${statusClass}" title="${t(tApp.category)}: ${tApp.productName} (${tApp.crop})" onclick="alert('${t(tApp.category)}: ${tApp.productName}\\nގަސް: ${tApp.crop}\\nޕްލޮޓް: ${tApp.plot}')"></span>`;
            }).join('')}
          </div>
        `;
      }

      const isToday = dateStr === todayLocalStr ? 'today' : '';

      daysGrid.innerHTML += `
        <div class="t-cal-day-cell ${isToday}">
          <div class="t-cal-day-number">${day}</div>
          ${eventsHTML}
        </div>
      `;
    }
  }

  loadTreatmentReports() {
    const user = getActiveUser();
    if (!user) return;

    const localDB = JSON.parse(localStorage.getItem('dhandu_hisaabu_local_db') || '{}');
    const now = new Date();
    document.getElementById('t-rep-from').value = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    document.getElementById('t-rep-to').value = now.toISOString().split('T')[0];

    const crops = (localDB.crops || []).filter(c => c.farmId === user.farmId);
    const cropSelect = document.getElementById('t-rep-crop');
    cropSelect.innerHTML = `<option value="">ހުރިހާ ގަހެއް</option>` + 
      crops.map(c => `<option value="${c.name}">${c.name}</option>`).join('');

    const users = (localDB.users || []).filter(u => u.farmId === user.farmId);
    const staffSelect = document.getElementById('t-rep-staff');
    staffSelect.innerHTML = `<option value="">ހުރިހާ މުވައްޒަފުން</option>` + 
      users.map(u => `<option value="${u.username}">${u.name}</option>`).join('');
  }

  generateTreatmentReport(event) {
    if (event) event.preventDefault();
    const user = getActiveUser();
    if (!user) return;

    const reportType = document.getElementById('t-rep-type').value;
    const fromDate = document.getElementById('t-rep-from').value;
    const toDate = document.getElementById('t-rep-to').value;
    const cropFilter = document.getElementById('t-rep-crop').value;
    const staffFilter = document.getElementById('t-rep-staff').value;

    const localDB = JSON.parse(localStorage.getItem('dhandu_hisaabu_local_db') || '{}');
    let apps = (localDB.treatment_applications || []).filter(a => 
      a.farmId === user.farmId && 
      a.date >= fromDate && 
      a.date <= toDate
    );

    if (cropFilter) apps = apps.filter(a => a.crop === cropFilter);
    if (staffFilter) apps = apps.filter(a => a.appliedBy === staffFilter);

    const resultContainer = document.getElementById('t-rep-result-container');
    const resultTitle = document.getElementById('t-rep-result-title');
    const resultTable = document.getElementById('t-rep-result-table');
    
    resultContainer.classList.remove('hidden');

    let headersHTML = '';
    let bodyHTML = '';

    if (reportType === 'fertilizer' || reportType === 'pesticide') {
      const catFilter = reportType === 'fertilizer' ? 'Fertilizer' : null;
      let displayApps = apps;
      if (catFilter) {
        displayApps = apps.filter(a => a.category === 'Fertilizer');
        resultTitle.textContent = "ގަސްކާނާ ބޭނުންކުރި މިންވަރުގެ ރިޕޯޓް";
      } else {
        displayApps = apps.filter(a => a.category !== 'Fertilizer');
        resultTitle.textContent = "ބޭސް ބޭނުންކުރި މިންވަރުގެ ރިޕޯޓް";
      }

      headersHTML = `
        <tr>
          <th>ތާރީޚް</th>
          <th>ގަސް</th>
          <th>އެއްޗެއް</th>
          <th>މިންވަރު</th>
          <th>މެތަޑް</th>
          <th>ޖެހި މީހާ</th>
        </tr>
      `;

      bodyHTML = displayApps.length ? displayApps.map(item => `
        <tr>
          <td>${item.date}</td>
          <td>${item.crop} (${item.plot})</td>
          <td>${item.productName}</td>
          <td>${item.quantityUsed} ${item.unit}</td>
          <td>${t(item.applicationMethod)}</td>
          <td>${item.appliedBy}</td>
        </tr>
      `).join('') : `<tr><td colspan="6" class="text-center text-muted">އެއްވެސް ރެކޯޑެއް ފެންނާކަށް ނެތް.</td></tr>`;

    } else if (reportType === 'summary') {
      resultTitle.textContent = "މަހުގެ ފަރުވާގެ ޚުލާސާ";
      const summary = {};
      apps.forEach(a => {
        summary[a.category] = (summary[a.category] || 0) + 1;
      });

      headersHTML = `
        <tr>
          <th>ކެޓަގަރީ</th>
          <th style="text-align: end;">ޖެހި ޖުމްލަ ޢަދަދު (Applications Count)</th>
        </tr>
      `;

      bodyHTML = Object.keys(summary).length ? Object.keys(summary).map(cat => `
        <tr>
          <td><strong>${t(cat)}</strong></td>
          <td style="text-align: end; font-weight: bold;">${summary[cat]}</td>
        </tr>
      `).join('') : `<tr><td colspan="2" class="text-center text-muted">އެއްވެސް ރެކޯޑެއް ފެންނާކަށް ނެތް.</td></tr>`;



    } else if (reportType === 'crop-history') {
      resultTitle.textContent = "ގަސްތަކުގެ ފަރުވާގެ ތާރީޚް";
      headersHTML = `
        <tr>
          <th>ގަސް</th>
          <th>ތާރީޚް</th>
          <th>ފަރުވާ</th>
          <th>މިންވަރު</th>
          <th>އިތުރު ނޯޓް</th>
        </tr>
      `;

      bodyHTML = apps.length ? apps.map(item => `
        <tr>
          <td><strong>${item.crop}</strong> (${item.plot})</td>
          <td>${item.date}</td>
          <td>${t(item.category)}: ${item.productName}</td>
          <td>${item.quantityUsed} ${item.unit}</td>
          <td>${item.remarks || '-'}</td>
        </tr>
      `).join('') : `<tr><td colspan="5" class="text-center text-muted">އެއްވެސް ރެކޯޑެއް ފެންނާކަށް ނެތް.</td></tr>`;
    }

    resultTable.querySelector('thead').innerHTML = headersHTML;
    document.getElementById('t-rep-result-body').innerHTML = bodyHTML;
  }

  exportTreatmentReport(format) {
    this.generateTreatmentReport();
    
    const title = document.getElementById('t-rep-result-title').textContent;
    const table = document.getElementById('t-rep-result-table');
    
    if (format === 'excel') {
      let csvContent = '\uFEFF'; 
      const rows = table.querySelectorAll('tr');
      rows.forEach(row => {
        const cols = row.querySelectorAll('th, td');
        const rowData = [];
        cols.forEach(col => {
          let text = col.textContent.replace(/"/g, '""').trim();
          rowData.push(`"${text}"`);
        });
        csvContent += rowData.join(',') + '\r\n';
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `${title.replace(/\s+/g, '_')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      this.showToast("އެކްސެލް ފައިލް ޑައުންލޯޑް ކުރެވިއްޖެ!");
    } else if (format === 'pdf') {
      window.print();
    }
  }
}

// Instantiate and expose to window
window.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
  
  // Web layout and keyboard language selection are handled by <dhivehi-input> and <english-input> custom components.
  
  // Dynamic setup for Fertilizer Modal stock items
  const fertNameSelect = document.getElementById('fert-name');
  if (fertNameSelect) {
    const updateFertSelect = () => {
      const user = getActiveUser();
      if (!user) return;
      
      const localDB = JSON.parse(localStorage.getItem('dhandu_hisaabu_local_db') || '{}');
      const inventory = localDB.inventory || [];
      const fertItems = inventory.filter(item => item.farmId === user.farmId && item.category === 'Fertilizer');
      
      fertNameSelect.innerHTML = fertItems.map(item => 
        `<option value="${item.name}">${item.name} (ހުރީ: ${item.currentStock} ${item.unit})</option>`
      ).join('');
    };
    
    // Listen to profile dropdown triggers or view loaders to populate fertilizer select options
    document.getElementById('view-staff-dashboard').addEventListener('click', updateFertSelect);
    const fertBtn = document.querySelector('[onclick*="fertilizer"]');
    if (fertBtn) fertBtn.addEventListener('click', updateFertSelect);
  }
});
