const { getDb } = require('../config/database');

exports.list = (req, res, next) => {
  try {
    const db = getDb();
    const { severity, status, type, ip, from, to } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1), limit = 20;
    const where = [], params = [];

    const validSeverities = ['low', 'medium', 'high', 'critical'];
    if (severity && validSeverities.includes(severity)) { where.push('severity = ?'); params.push(severity); }
    if (status) { where.push('status = ?'); params.push(status); }
    if (type) { where.push('incident_type = ?'); params.push(type); }
    if (ip) { where.push('source_ip = ?'); params.push(ip); }
    if (from) { where.push('detected_at >= ?'); params.push(from + ' 00:00:00'); }
    if (to) { where.push('detected_at <= ?'); params.push(to + ' 23:59:59'); }

    const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM security_incidents ${clause}`).get(...params);
    const rows = db.prepare(
      `SELECT * FROM security_incidents ${clause} ORDER BY detected_at DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, (page - 1) * limit);

    res.json({ success: true, data: rows, page, total, message: 'Incidents retrieved successfully' });
  } catch (e) { next(e); }
};

exports.getOne = (req, res, next) => {
  try {
    const db = getDb();
    const incident = db.prepare('SELECT * FROM security_incidents WHERE id = ?').get(req.params.id);
    if (!incident) return res.status(404).json({ success: false, message: 'Incident not found' });

    let entry = null;
    if (incident.log_entry_id) {
      entry = db.prepare('SELECT * FROM log_entries WHERE id = ?').get(incident.log_entry_id);
    }

    res.json({ success: true, data: { ...incident, relatedEntry: entry } });
  } catch (e) { next(e); }
};

exports.updateStatus = (req, res, next) => {
  try {
    const db = getDb();
    const { status } = req.body;
    const valid = ['open', 'investigating', 'resolved'];
    if (!valid.includes(status))
      return res.status(400).json({ success: false, message: 'Status must be open, investigating, or resolved' });

    const result = db.prepare('UPDATE security_incidents SET status = ? WHERE id = ?').run(status, req.params.id);
    if (result.changes === 0) return res.status(404).json({ success: false, message: 'Incident not found' });

    res.json({ success: true, message: 'Status updated' });
  } catch (e) { next(e); }
};
