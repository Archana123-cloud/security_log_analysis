// Shared API helper — used by all pages
async function api(path, options = {}) {
  const token = sessionStorage.getItem('token');
  if (!token && !path.includes('/auth/login')) {
    location.href = 'login.html';
    return;
  }

  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  // Don't set Content-Type for FormData (browser adds multipart boundary)
  if (!(options.body instanceof FormData)) {
    if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
  }

  const res = await fetch('/api' + path, { ...options, headers });

  if (res.status === 401) {
    sessionStorage.clear();
    location.href = 'login.html';
    return;
  }

  return res.json();
}

// Logout handler — present on every authenticated page
document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      sessionStorage.clear();
      location.href = 'login.html';
    });
  }

  // Redirect to login if no token on authenticated pages
  const isLoginPage = location.pathname.endsWith('login.html') || location.pathname === '/';
  if (!isLoginPage && !sessionStorage.getItem('token')) {
    location.href = 'login.html';
  }
});

// Format date for display
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

// Format file size
function formatSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return size.toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
}

// Create severity badge
function severityBadge(severity) {
  const s = (severity || '').toLowerCase();
  return `<span class="badge badge-${s}">${severity || '—'}</span>`;
}

// Create status badge
function statusBadge(status) {
  const s = (status || '').toLowerCase();
  return `<span class="badge badge-${s}">${status || '—'}</span>`;
}
