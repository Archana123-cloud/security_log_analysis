async function loadIncidents(page = 1) {
  const q = new URLSearchParams({ page });
  ['severity', 'status', 'type', 'ip', 'from', 'to'].forEach(k => {
    const v = document.getElementById(k).value;
    if (v) q.set(k, v);
  });

  const res = await api('/incidents?' + q);
  if (!res) return;

  const tbody = document.getElementById('rows');

  if (!res.data || !res.data.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding:2rem;color:var(--text-muted);">No incidents found</td></tr>';
    document.getElementById('pagination').innerHTML = '';
    return;
  }

  tbody.innerHTML = res.data.map(i => {
    const tr = document.createElement('tr');
    return `
      <tr>
        <td class="mono">${i.id}</td>
        <td>${formatDate(i.detected_at)}</td>
        <td>${escapeHtml(i.incident_type)}</td>
        <td class="mono">${escapeHtml(i.source_ip || '—')}</td>
        <td>${severityBadge(i.severity)}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(i.description || '—')}</td>
        <td>${statusBadge(i.status)}</td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="viewIncident(${i.id})">View</button>
        </td>
      </tr>
    `;
  }).join('');

  renderPagination(res.page, Math.ceil(res.total / 20));
}

function renderPagination(current, totalPages) {
  const container = document.getElementById('pagination');
  if (totalPages <= 1) { container.innerHTML = ''; return; }

  let html = '';
  html += `<button ${current <= 1 ? 'disabled' : ''} onclick="loadIncidents(${current - 1})">‹ Prev</button>`;

  const start = Math.max(1, current - 2);
  const end = Math.min(totalPages, current + 2);

  for (let p = start; p <= end; p++) {
    html += `<button class="${p === current ? 'active' : ''}" onclick="loadIncidents(${p})">${p}</button>`;
  }

  html += `<button ${current >= totalPages ? 'disabled' : ''} onclick="loadIncidents(${current + 1})">Next ›</button>`;
  container.innerHTML = html;
}

async function viewIncident(id) {
  const res = await api('/incidents/' + id);
  if (!res || !res.data) return;

  const i = res.data;
  const modalBody = document.getElementById('modalBody');

  modalBody.innerHTML = `
    <div class="detail-grid">
      <div class="detail-item">
        <label>Incident ID</label>
        <span class="mono">#${i.id}</span>
      </div>
      <div class="detail-item">
        <label>Type</label>
        <span>${escapeHtml(i.incident_type)}</span>
      </div>
      <div class="detail-item">
        <label>Severity</label>
        <span>${severityBadge(i.severity)}</span>
      </div>
      <div class="detail-item">
        <label>Status</label>
        <span id="currentStatus">${statusBadge(i.status)}</span>
      </div>
      <div class="detail-item">
        <label>Source IP</label>
        <span class="mono">${escapeHtml(i.source_ip || '—')}</span>
      </div>
      <div class="detail-item">
        <label>Detected At</label>
        <span>${formatDate(i.detected_at)}</span>
      </div>
    </div>

    <div class="mb-2">
      <label class="form-label">Description</label>
      <p style="font-size:0.9rem;color:var(--text-secondary);">${escapeHtml(i.description || '—')}</p>
    </div>

    <div class="mb-2">
      <label class="form-label">Evidence</label>
      <div class="evidence-box">${escapeHtml(i.evidence || 'No evidence recorded')}</div>
    </div>

    ${i.relatedEntry ? `
    <div class="mb-2">
      <label class="form-label">Related Log Entry (Raw)</label>
      <div class="evidence-box">${escapeHtml(i.relatedEntry.raw_message || '—')}</div>
    </div>
    ` : ''}

    <div class="mt-2">
      <label class="form-label">Update Status</label>
      <div style="display:flex;gap:0.5rem;margin-top:0.5rem;">
        <button class="btn btn-outline btn-sm" onclick="updateStatus(${i.id},'open')">Open</button>
        <button class="btn btn-outline btn-sm" style="border-color:var(--warning);color:var(--warning);" onclick="updateStatus(${i.id},'investigating')">Investigating</button>
        <button class="btn btn-outline btn-sm" style="border-color:var(--success);color:var(--success);" onclick="updateStatus(${i.id},'resolved')">Resolved</button>
      </div>
    </div>
  `;

  document.getElementById('modal').classList.add('open');
}

async function updateStatus(id, status) {
  const res = await api('/incidents/' + id + '/status', {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });

  if (res && res.success) {
    document.getElementById('currentStatus').innerHTML = statusBadge(status);
    loadIncidents();
  }
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
}

// Close modal on overlay click
document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal')) closeModal();
});

// Close modal on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => loadIncidents(1));
