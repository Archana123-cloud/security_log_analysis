const path = require('path');
const fs = require('fs');
const { getDb } = require('../config/database');
const { parseFile } = require('../services/parserService');
const { runDetection } = require('../services/detectionService');

exports.upload = async (req, res, next) => {
  try {
    const db = getDb();
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded', errorCode: 'NO_FILE' });

    const file = req.file;
    if (file.size === 0) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ success: false, message: 'File is empty', errorCode: 'EMPTY_FILE' });
    }

    const ext = path.extname(file.originalname).toLowerCase();
    const fileType = ext.replace('.', '');

    const result = db.prepare(
      `INSERT INTO log_files (original_name, stored_name, file_type, file_size, uploaded_by, status)
       VALUES (?, ?, ?, ?, ?, 'uploaded')`
    ).run(file.originalname, file.filename, fileType, file.size, req.user.id);

    const fileId = result.lastInsertRowid;

    db.prepare('UPDATE log_files SET status = ? WHERE id = ?').run('processing', fileId);

    const { valid, invalid } = await parseFile(file.path, fileId, ext);

    runDetection(fileId);

    let status = 'completed';
    if (valid === 0) status = 'failed';
    else if (invalid > 0) status = 'completed_with_errors';

    db.prepare('UPDATE log_files SET status = ?, valid_lines = ?, invalid_lines = ? WHERE id = ?')
      .run(status, valid, invalid, fileId);

    res.status(201).json({
      success: true,
      data: { fileId, status, validLines: valid, invalidLines: invalid },
      message: 'File uploaded and analyzed successfully'
    });
  } catch (e) { next(e); }
};

exports.list = (req, res, next) => {
  try {
    const db = getDb();
    const files = db.prepare(
      `SELECT lf.*, u.username as uploaded_by_name
       FROM log_files lf LEFT JOIN users u ON lf.uploaded_by = u.id
       ORDER BY lf.uploaded_at DESC`
    ).all();
    res.json({ success: true, data: files });
  } catch (e) { next(e); }
};

exports.getOne = (req, res, next) => {
  try {
    const db = getDb();
    const file = db.prepare('SELECT * FROM log_files WHERE id = ?').get(req.params.id);
    if (!file) return res.status(404).json({ success: false, message: 'File not found' });

    const entryCount = db.prepare('SELECT COUNT(*) as count FROM log_entries WHERE file_id = ?').get(req.params.id);
    const incidentCount = db.prepare('SELECT COUNT(*) as count FROM security_incidents WHERE file_id = ?').get(req.params.id);

    res.json({
      success: true,
      data: { ...file, entryCount: entryCount.count, incidentCount: incidentCount.count }
    });
  } catch (e) { next(e); }
};

exports.getEntries = (req, res, next) => {
  try {
    const db = getDb();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 20;
    const where = [], params = [];

    if (req.query.ip) { where.push('source_ip = ?'); params.push(req.query.ip); }
    if (req.query.file_id) { where.push('file_id = ?'); params.push(req.query.file_id); }
    if (req.query.status_code) { where.push('status_code = ?'); params.push(req.query.status_code); }

    const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM log_entries ${clause}`).get(...params);
    const rows = db.prepare(
      `SELECT * FROM log_entries ${clause} ORDER BY event_time DESC LIMIT ? OFFSET ?`
    ).all(...params, limit, (page - 1) * limit);

    res.json({ success: true, data: rows, page, total });
  } catch (e) { next(e); }
};
