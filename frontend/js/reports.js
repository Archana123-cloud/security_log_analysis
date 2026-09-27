function downloadReport() {
  const token = sessionStorage.getItem('token');
  if (!token) { location.href = 'login.html'; return; }

  const params = new URLSearchParams();
  const severity = document.getElementById('rptSeverity').value;
  const type = document.getElementById('rptType').value;
  const status = document.getElementById('rptStatus').value;
  const from = document.getElementById('rptFrom').value;
  const to = document.getElementById('rptTo').value;

  if (severity) params.set('severity', severity);
  if (type) params.set('type', type);
  if (status) params.set('status', status);
  if (from) params.set('from', from);
  if (to) params.set('to', to);

  // Trigger download via a hidden link
  const url = '/api/reports/incidents.csv?' + params.toString();

  fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  })
    .then(res => {
      if (res.status === 401) {
        sessionStorage.clear();
        location.href = 'login.html';
        return;
      }
      return res.blob();
    })
    .then(blob => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'incidents_report.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    })
    .catch(err => {
      alert('Download failed: ' + err.message);
    });
}
