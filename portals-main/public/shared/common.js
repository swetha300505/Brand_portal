/* ==========================================================================
   Mobileum Caller ID Platform - Shared Common Utilities
   ========================================================================== */

const $ = id => document.getElementById(id);

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[c]));

const peso = n => '₱' + Number(n || 0).toLocaleString('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const initials = n => String(n || '?')
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map(w => w[0].toUpperCase())
  .join('');

async function api(url, opt) {
  const r = await fetch(url, opt);
  let j = null;
  try { j = await r.json(); } catch (e) {}
  if (!r.ok) {
    const e = new Error((j && j.error) || r.statusText);
    e.data = j;
    e.status = r.status;
    throw e;
  }
  return j;
}

// Mobileum signature dots loader HTML
function dotsLoader() {
  return '<div class="mobileum-dots" title="Loading..."><span></span><span></span><span></span></div>';
}

// Toast notification helper
function showToast(title, message, type = 'info', duration = 4000) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠'
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || 'ℹ'}</div>
    <div class="toast-content">
      <div class="toast-title">${esc(title)}</div>
      ${message ? `<div class="toast-message">${esc(message)}</div>` : ''}
    </div>
    <button class="toast-close" aria-label="Close">&times;</button>
  `;

  toast.querySelector('.toast-close').onclick = () => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 200);
  };

  container.appendChild(toast);
  // Trigger animation frame
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  if (duration > 0) {
    setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 250);
      }
    }, duration);
  }
  return toast;
}

// Modern enterprise "what the customer will see" card
function callerCard(o) {
  const lgHtml = o.logoUrl
    ? `<div class="lg"><img src="${esc(o.logoUrl)}" alt="${esc(o.brandName || 'Logo')}" onerror="this.onerror=null;this.parentElement.style.display='none';"></div>`
    : '';
  const isVerified = o.verified !== false;
  const reason = o.callReason || o.tagline || '';
  const showBrand = o.brandName && o.brandName.trim();
  return `
    <div class="cid">
      ${lgHtml}
      <div style="flex:1;min-width:0;">
        ${showBrand ? `<div class="nm">${esc(o.brandName)}</div>` : ''}
        <div class="sub">${esc(o.department || '')}${o.department && o.display ? ' &middot; ' : ''}${esc(o.display || '')}</div>
        ${reason ? `<div class="sub" style="font-style:italic;opacity:0.85;">"${esc(reason)}"</div>` : ''}
        ${isVerified ? '<div class="vf"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg> Verified business</div>' : '<div style="color:#F59E0B;font-size:11.5px;margin-top:3px;">⚠ Unverified preview</div>'}
      </div>
    </div>
  `;
}

// Shows where the data is saved
function dbStatus(el, s) {
  if (!el) return;
  if (s.error && !s.backend) {
    el.innerHTML = `<span class="err">⚠ Database unavailable: ${esc(s.error)}</span>`;
    return;
  }
  if (s.backend === 'mongodb') {
    const dbName = (s.database || 'MongoDB').replace(/^MongoDB:\s*/, '');
    el.innerHTML = `<span class="db-live-chip"><span class="pulse-dot" style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#22c55e;margin-right:6px;animation:pulse 2s infinite;"></span>Database: MongoDB &mdash; <b>${esc(dbName)}</b> &mdash; Live</span>`;
  } else {
    el.innerHTML = `<span style="background:#FFF3CD;color:#856404;border:1px solid #FFEEBA;padding:6px 14px;border-radius:var(--radius-sm);font-weight:600;display:inline-flex;align-items:center;gap:8px;">⚠️ Warning: MONGODB_URI is not set. Data is running on temporary storage and will NOT persist across restarts!</span>`;
  }
}

// In-app non-blocking confirmation modal dialog
function showConfirmModal(opts) {
  const {
    title = 'Confirm Removal',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Remove',
    confirmClass = 'no',
    onConfirm
  } = opts || {};

  let modal = document.getElementById('mobileumConfirmModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'mobileumConfirmModal';
    modal.className = 'confirm-modal-backdrop';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="confirm-modal-box">
      <div class="confirm-modal-header">
        <h3 class="confirm-modal-title">${esc(title)}</h3>
        <button type="button" class="confirm-modal-close" id="btnConfirmClose" title="Cancel">&times;</button>
      </div>
      <div class="confirm-modal-body">
        <p style="margin:0;font-size:13.5px;color:var(--deep-navy);line-height:1.5;">${esc(message)}</p>
      </div>
      <div class="confirm-modal-footer">
        <button type="button" class="btn sm" id="btnConfirmCancel">Cancel</button>
        <button type="button" class="btn sm ${esc(confirmClass)}" id="btnConfirmOk">${esc(confirmText)}</button>
      </div>
    </div>
  `;

  modal.classList.add('open');

  const close = () => {
    modal.classList.remove('open');
  };

  modal.querySelector('#btnConfirmClose').onclick = close;
  modal.querySelector('#btnConfirmCancel').onclick = close;
  modal.onclick = e => {
    if (e.target === modal) close();
  };

  modal.querySelector('#btnConfirmOk').onclick = () => {
    close();
    if (typeof onConfirm === 'function') {
      try { onConfirm(); } catch (err) { console.error(err); }
    }
  };
}

// Cross-port shared removal state for packages, numbers, and requests
function getSharedList(key) {
  let list = [];
  try {
    const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + key + '=([^;]*)'));
    if (match && match[1]) {
      list = JSON.parse(decodeURIComponent(match[1]));
    }
  } catch (e) {}

  if (!Array.isArray(list) || !list.length) {
    try {
      const stored = localStorage.getItem(key);
      if (stored) list = JSON.parse(stored);
    } catch (e) {}
  }
  return Array.isArray(list) ? list : [];
}

function addToSharedList(key, item) {
  const current = getSharedList(key);
  if (!current.includes(item)) {
    current.push(item);
  }
  const str = encodeURIComponent(JSON.stringify(current));
  document.cookie = `${key}=${str}; path=/; max-age=2592000; SameSite=Lax`;
  try { document.cookie = `${key}=${str}; path=/; domain=localhost; max-age=2592000; SameSite=Lax`; } catch (e) {}
  try { localStorage.setItem(key, JSON.stringify(current)); } catch (e) {}
  return current;
}

function removeFromSharedList(key, item) {
  let current = getSharedList(key);
  current = current.filter(x => x !== item);
  const str = encodeURIComponent(JSON.stringify(current));
  document.cookie = `${key}=${str}; path=/; max-age=2592000; SameSite=Lax`;
  try { document.cookie = `${key}=${str}; path=/; domain=localhost; max-age=2592000; SameSite=Lax`; } catch (e) {}
  try { localStorage.setItem(key, JSON.stringify(current)); } catch (e) {}
  return current;
}

async function migrateLegacyPackageRemovals() {
  const ids = getSharedList('deleted_packages');
  for (const id of ids) {
    try {
      await api('/api/packages/' + encodeURIComponent(id), { method: 'DELETE' });
    } catch (e) {
      if (e.status !== 404) throw e;
    }
    removeFromSharedList('deleted_packages', id);
  }
}

// ==========================================================================
// Cross-Portal Synchronization & State Persistence (Vercel Serverless Resilient)
// Prevents requests and packages from disappearing across instances & tabs
// ==========================================================================
const MOBILEUM_SYNC_KEY = 'mobileum_persisted_requests';
const MOBILEUM_STATUS_KEY = 'mobileum_status_overrides';
const MOBILEUM_PACKAGES_KEY = 'mobileum_persisted_packages';
const MOBILEUM_DELETED_PACKAGES_KEY = 'mobileum_deleted_packages';

const syncChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('mobileum_sync_channel') : null;

// ---------- Package Persistence & Sync ----------
function getClientPackages() {
  try {
    const raw = localStorage.getItem(MOBILEUM_PACKAGES_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    }
  } catch (e) {}
  return [];
}

function getDeletedPackageIds() {
  const ids = new Set();
  try {
    const raw = localStorage.getItem(MOBILEUM_DELETED_PACKAGES_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) arr.forEach(id => ids.add(id));
    }
  } catch (e) {}
  const shared = getSharedList('deleted_packages');
  shared.forEach(id => ids.add(id));
  return ids;
}

function saveClientPackage(pkg) {
  // No-op: MongoDB is the source of truth. API call handles persistence.
  if (!pkg || !pkg.packageId) return;
}

function removeClientPackage(packageId) {
  // No-op: MongoDB is the source of truth. API DELETE call handles persistence.
}

function mergePackages(serverPackages) {
  // MongoDB is the single source of truth — always use server data
  // localStorage is only used as a fallback for offline scenarios
  const serverList = Array.isArray(serverPackages) ? serverPackages : [];
  return serverList.filter(p => p && p.packageId && p.status !== 'removed');
}

// ---------- Request Persistence & Sync ----------
function getClientRequests() {
  try {
    const raw = localStorage.getItem(MOBILEUM_SYNC_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    }
  } catch (e) {}
  return [];
}

function saveClientRequest(req) {
  if (!req || !req.requestId) return;
  const copy = { ...req };
  if (copy.logoUrl && copy.logoUrl.startsWith('data:') && copy.logoFileId) {
    copy.logoUrl = `/api/files/${copy.logoFileId}`;
  }
  const list = getClientRequests();
  const idx = list.findIndex(r => r.requestId === copy.requestId);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...copy };
  } else {
    list.push(copy);
  }
  try {
    localStorage.setItem(MOBILEUM_SYNC_KEY, JSON.stringify(list));
  } catch (e) {
    try {
      const pruned = list.slice(-15);
      localStorage.setItem(MOBILEUM_SYNC_KEY, JSON.stringify(pruned));
    } catch (err) {}
  }

  if (syncChannel) {
    try { syncChannel.postMessage({ type: 'sync_update', requestId: copy.requestId }); } catch (e) {}
  }
  syncWithServer();
}

function getStatusOverrides() {
  try {
    const raw = localStorage.getItem(MOBILEUM_STATUS_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === 'object') return obj;
    }
  } catch (e) {}
  return {};
}

function statusBadge(status) {
  const norm = String(status || 'pending').toLowerCase().trim();
  const cls = (norm === 'partially approved' || norm === 'partially_approved') ? 'partially-approved' : norm;
  const label = (norm === 'partially approved' || norm === 'partially_approved') ? 'Partially Approved' : (norm.charAt(0).toUpperCase() + norm.slice(1));
  return `<span class="badge ${cls}" data-status="${norm}">${label}</span>`;
}

function saveStatusOverride(requestId, status, remarks = '', numberDecisions = null) {
  if (!requestId || !status) return;
  const overrides = getStatusOverrides();
  const now = new Date().toISOString();
  overrides[requestId] = {
    status,
    remarks: remarks || '',
    decisions: numberDecisions,
    at: now
  };
  try {
    localStorage.setItem(MOBILEUM_STATUS_KEY, JSON.stringify(overrides));
  } catch (e) {}

  const list = getClientRequests();
  const req = list.find(r => r.requestId === requestId);
  if (req) {
    req.status = status;
    if (remarks) req.remarks = remarks;
    if (numberDecisions && Array.isArray(numberDecisions) && req.numbers) {
      numberDecisions.forEach(d => {
        const n = req.numbers.find(x => (d.numberId && x.numberId === d.numberId) || (x.phoneE164 && x.phoneE164 === d.phoneE164));
        if (n) {
          n.status = d.status;
          n.remarks = d.remarks || '';
          n.decidedAt = now;
        }
      });
    } else if (req.numbers) {
      req.numbers.forEach(n => {
        n.status = status;
        if (status === 'rejected' && remarks) n.remarks = remarks;
        n.decidedAt = now;
      });
    }
    try { localStorage.setItem(MOBILEUM_SYNC_KEY, JSON.stringify(list)); } catch (e) {}
  }

  if (syncChannel) {
    try { syncChannel.postMessage({ type: 'status_override', requestId, status, remarks, numberDecisions }); } catch (e) {}
  }
  syncWithServer();
}

function mergeRequests(serverRequests) {
  // MongoDB is the single source of truth — always use server data
  const serverList = Array.isArray(serverRequests) ? serverRequests : [];
  return serverList.filter(r => r && r.requestId);
}

function mergeNumbers(serverNumbers) {
  // MongoDB is the single source of truth
  return Array.isArray(serverNumbers) ? serverNumbers : [];
}

function lookupLocalNumber(phoneInput) {
  const clientRequests = getClientRequests();
  const overrides = getStatusOverrides();
  const norm = typeof PH !== 'undefined' ? PH.normalize(phoneInput) : null;
  const e164 = norm && norm.ok ? norm.e164 : String(phoneInput || '').replace(/[^0-9+]/g, '');

  for (const r of clientRequests) {
    const ov = overrides[r.requestId];
    if (Array.isArray(r.numbers)) {
      const numHit = r.numbers.find(n => n.phoneE164 === e164);
      if (numHit) {
        let numStatus = numHit.status || 'pending';
        if (ov && typeof ov === 'object' && Array.isArray(ov.decisions)) {
          const d = ov.decisions.find(item => (item.numberId && item.numberId === numHit.numberId) || (item.phoneE164 && item.phoneE164 === numHit.phoneE164));
          if (d) numStatus = d.status;
        } else if (ov) {
          numStatus = typeof ov === 'string' ? ov : (ov.status || numStatus);
        }
        // ONLY approved numbers show the verified branded caller ID
        if (numStatus === 'approved') {
          const reason = r.callReason || r.tagline || '';
          return {
            registered: true,
            verified: true,
            brandName: r.brandName,
            callReason: reason,
            tagline: reason,
            department: numHit.department,
            display: numHit.phoneDisplay || (norm && norm.display) || e164,
            logoUrl: r.logoUrl || null,
            numberType: numHit.numberType || (norm && norm.type) || 'Phone'
          };
        }
      }
    }
  }
  return null;
}

function syncWithServer() {
  // No-op: MongoDB is the single source of truth for all data.
  // The /api/sync endpoint is no longer needed when MONGODB_URI is set.
}

// -------------------------------------------------------------------------
// Persistent Generated Numbers & Enterprise Departments
// -------------------------------------------------------------------------
const DEFAULT_ENTERPRISE_DEPTS = [
  'Customer Service',
  'Marketing',
  'Collections',
  'Credit Cards',
  'Fraud & Security',
  'Sales',
  'CEO Office'
];

function getEnterpriseDepartments() {
  try {
    const raw = localStorage.getItem('mobileum_enterprise_departments');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch (e) {}
  return [...DEFAULT_ENTERPRISE_DEPTS];
}

function saveEnterpriseDepartments(departments) {
  try {
    const clean = Array.from(new Set((departments || []).map(d => String(d || '').trim()).filter(Boolean)));
    localStorage.setItem('mobileum_enterprise_departments', JSON.stringify(clean));
    if (syncChannel) {
      syncChannel.postMessage({ type: 'departments_update', departments: clean });
    }
    return clean;
  } catch (e) {
    return DEFAULT_ENTERPRISE_DEPTS;
  }
}

function getPersistentGeneratedNumbers() {
  try {
    const raw = localStorage.getItem('mobileum_persistent_generated_numbers');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

function savePersistentGeneratedNumbers(numbers) {
  try {
    const existing = new Set(getPersistentGeneratedNumbers());
    (numbers || []).forEach(n => {
      if (n) {
        const norm = typeof PH !== 'undefined' ? PH.normalize(n) : null;
        const e164 = norm && norm.ok ? norm.e164 : String(n).trim();
        if (e164) existing.add(e164);
      }
    });
    const arr = Array.from(existing);
    localStorage.setItem('mobileum_persistent_generated_numbers', JSON.stringify(arr));
    if (syncChannel) {
      syncChannel.postMessage({ type: 'generated_numbers_update', numbers: arr });
    }
    return arr;
  } catch (e) {
    return [];
  }
}

function addPersistentGeneratedNumber(e164) {
  return savePersistentGeneratedNumbers([e164]);
}
