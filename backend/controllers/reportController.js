const { getDb } = require('../config/database');

exports.downloadCsv = (req, res, next) => {
  try {
    const db = getDb();
    const { severity, status, type, ip, from, to } = req.query;
    const where = [], params = [];

    if (severity) { where.push('severity = ?'); params.push(severity); }
    if (status) { where.push('status = ?'); params.push(status); }
    if (type) { where.push('incident_type = ?'); params.push(type); }
    if (ip) { where.push('source_ip = ?'); params.push(ip); }
    if (from) { where.push('detected_at >= ?'); params.push(from + ' 00:00:00'); }
    if (to) { where.push('detected_at <= ?'); params.push(to + ' 23:59:59'); }

    const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const rows = db.prepare(`SELECT * FROM security_incidents ${clause} ORDER BY detected_at DESC`).all(...params);

    const headers = ['id', 'incident_type', 'severity', 'source_ip', 'description', 'evidence', 'status', 'detected_at'];
    let csv = headers.join(',') + '\n';

    rows.forEach(row => {
      csv += headers.map(h => {
        const val = (row[h] || '').toString().replace(/"/g, '""');
        return `"${val}"`;
      }).join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=incidents_report.csv');
    res.send(csv);
  } catch (e) { next(e); }
};
