let timeChart = null, sevChart = null;

async function loadDashboard() {
  try {
    // Fire all requests in parallel for speed
    const [summary, timeline, severity, topIps, recent] = await Promise.all([
      api('/dashboard/summary'),
      api('/dashboard/timeline'),
      api('/dashboard/severity'),
      api('/dashboard/top-ips'),
      api('/dashboard/recent')
    ]);

    if (!summary) return;

    // Summary cards
    document.getElementById('cardFiles').textContent = (summary.data.files || 0).toLocaleString();
    document.getElementById('cardEntries').textContent = (summary.data.entries || 0).toLocaleString();
    document.getElementById('cardFailed').textContent = (summary.data.failed || 0).toLocaleString();
    document.getElementById('cardIncidents').textContent = (summary.data.incidents || 0).toLocaleString();

    // Timeline chart
    if (timeChart) timeChart.destroy();
    const timeCtx = document.getElementById('timeChart').getContext('2d');
    timeChart = new Chart(timeCtx, {
      type: 'line',
      data: {
        labels: timeline.data.labels || [],
        datasets: [{
          label: 'Events',
          data: timeline.data.values || [],
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: '#3b82f6',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { color: 'rgba(42,53,80,0.3)' },
            ticks: { color: '#8b98b5', font: { size: 11 }, maxRotation: 45 }
          },
          y: {
            grid: { color: 'rgba(42,53,80,0.3)' },
            ticks: { color: '#8b98b5', font: { size: 11 } },
            beginAtZero: true
          }
        }
      }
    });

    // Severity doughnut chart
    if (sevChart) sevChart.destroy();
    const sevCtx = document.getElementById('sevChart').getContext('2d');
    const sevColors = {
      low: '#10b981', medium: '#f59e0b', high: '#ef4444', critical: '#dc2626'
    };
    sevChart = new Chart(sevCtx, {
      type: 'doughnut',
      data: {
        labels: (severity.data.labels || []).map(l => l.charAt(0).toUpperCase() + l.slice(1)),
        datasets: [{
          data: severity.data.values || [],
          backgroundColor: (severity.data.labels || []).map(l => sevColors[l] || '#6b7280'),
          borderColor: '#1a2235',
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#8b98b5', font: { size: 12 }, padding: 15 }
          }
        },
        cutout: '65%'
      }
    });

    // Top IPs
    const ipList = document.getElementById('topIps');
    if (topIps.data && topIps.data.length) {
      ipList.innerHTML = topIps.data.map(ip =>
        `<li><span class="ip-addr">${escapeHtml(ip.source_ip)}</span><span class="ip-count">${ip.hits} hits</span></li>`
      ).join('');
    } else {
      ipList.innerHTML = '<li style="color:var(--text-muted);text-align:center;padding:1rem;">No data yet</li>';
    }

    // Recent Incidents
    const recentDiv = document.getElementById('recentIncidents');
    if (recent.data && recent.data.length) {
      recentDiv.innerHTML = recent.data.slice(0, 5).map(i => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:0.6rem 0;border-bottom:1px solid rgba(42,53,80,0.4);font-size:0.85rem;">
          <div>
            <span style="color:var(--text-primary);font-weight:500;">${escapeHtml(i.incident_type)}</span>
            <span style="color:var(--text-muted);margin-left:0.5rem;">${escapeHtml(i.source_ip || '')}</span>
          </div>
          ${severityBadge(i.severity)}
        </div>
      `).join('');
    } else {
      recentDiv.innerHTML = '<div style="text-align:center;padding:1rem;color:var(--text-muted);">No incidents detected</div>';
    }
  } catch (err) {
    console.error('Dashboard load error:', err);
  }
}

// XSS-safe text escaping
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', loadDashboard);
