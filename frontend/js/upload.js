const MAX = 10 * 1024 * 1024;
const OK = ['.log', '.txt', '.csv'];

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const uploadResult = document.getElementById('uploadResult');
const uploadProgress = document.getElementById('uploadProgress');

// Click to browse
dropZone.addEventListener('click', () => fileInput.click());

// File selected
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) upload(fileInput.files[0]);
});

// Drag and drop
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files[0]) upload(e.dataTransfer.files[0]);
});

async function upload(file) {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();

  // Frontend validation
  uploadResult.className = 'upload-result';
  uploadResult.style.display = 'none';

  if (!file.size) return showResult('File is empty', 'error');
  if (!OK.includes(ext)) return showResult('Unsupported file type. Use .log, .txt, or .csv', 'error');
  if (file.size > MAX) return showResult('File exceeds 10 MB limit', 'error');

  // Show progress
  uploadProgress.style.display = 'block';

  try {
    const fd = new FormData();
    fd.append('logFile', file);
    const res = await api('/logs/upload', { method: 'POST', body: fd });

    if (!res || !res.success) {
      showResult(res?.message || 'Upload failed', 'error');
      return;
    }

    showResult(
      `✅ File uploaded successfully!\n` +
      `File ID: ${res.data.fileId} | Status: ${res.data.status}\n` +
      `Valid lines: ${res.data.validLines} | Invalid lines: ${res.data.invalidLines}`,
      'success'
    );
    loadHistory();
  } catch (err) {
    showResult('Upload failed: ' + err.message, 'error');
  } finally {
    uploadProgress.style.display = 'none';
    fileInput.value = '';
  }
}

function showResult(msg, type) {
  uploadResult.textContent = msg;
  uploadResult.className = 'upload-result ' + type;
  uploadResult.style.whiteSpace = 'pre-line';
}

// Load upload history
async function loadHistory() {
  const res = await api('/logs');
  if (!res) return;

  const tbody = document.getElementById('historyRows');
  if (!res.data || !res.data.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding:2rem;color:var(--text-muted);">No files uploaded yet</td></tr>';
    return;
  }

  tbody.innerHTML = res.data.map(f => `
    <tr>
      <td class="mono">${f.id}</td>
      <td>${escapeHtml(f.original_name)}</td>
      <td><span class="badge badge-open">${f.file_type || '—'}</span></td>
      <td>${formatSize(f.file_size)}</td>
      <td style="color:var(--success)">${f.valid_lines || 0}</td>
      <td style="color:${f.invalid_lines > 0 ? 'var(--danger)' : 'var(--text-muted)'}">${f.invalid_lines || 0}</td>
      <td>${statusBadge(f.status)}</td>
      <td>${formatDate(f.uploaded_at)}</td>
    </tr>
  `).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', loadHistory);
