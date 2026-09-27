const { getDb } = require('../config/database');

exports.summary = (req, res, next) => {
  try {
    const db = getDb();
    const data = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM log_files) AS files,
        (SELECT COUNT(*) FROM log_entries) AS entries,
        (SELECT COUNT(*) FROM log_entries WHERE status_code = 401) AS failed,
        (SELECT COUNT(*) FROM security_incidents) AS incidents
    `).get();

    res.json({ success: true, data });
  } catch (e) { next(e); }
};

exports.timeline = (req, res, next) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT strftime('%Y-%m-%d %H:00', event_time) AS label, COUNT(*) AS value
      FROM log_entries
      GROUP BY label
      ORDER BY label
    `).all();

    res.json({
      success: true,
      data: { labels: rows.map(r => r.label), values: rows.map(r => r.value) }
    });
  } catch (e) { next(e); }
};

exports.severity = (req, res, next) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT severity AS label, COUNT(*) AS value
      FROM security_incidents
      GROUP BY severity
      ORDER BY value DESC
    `).all();

    res.json({
      success: true,
      data: { labels: rows.map(r => r.label), values: rows.map(r => r.value) }
    });
  } catch (e) { next(e); }
};

exports.topIps = (req, res, next) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT source_ip, COUNT(*) AS hits
      FROM log_entries
      GROUP BY source_ip
      ORDER BY hits DESC
      LIMIT 5
    `).all();

    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
};

exports.recentIncidents = (req, res, next) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM security_incidents
      ORDER BY detected_at DESC
      LIMIT 10
    `).all();

    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
};
