const fs = require('fs');
const readline = require('readline');
const csvParser = require('csv-parser');
const { getDb } = require('../config/database');

// Apache Combined Log Format regex
const APACHE = /^(\S+) \S+ \S+ \[(.+?)\] "(\S+) (\S+) [^"]*" (\d{3}) (\d+|-)/;
const MONTHS = { Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12' };

function toSqlTime(s) {
  const m = s.match(/(\d{2})\/(\w{3})\/(\d{4}):(\d{2}:\d{2}:\d{2})/);
  return m && MONTHS[m[2]] ? `${m[3]}-${MONTHS[m[2]]}-${m[1]} ${m[4]}` : null;
}

function parseApacheLine(line) {
  const m = line.match(APACHE);
  if (!m) return null;
  const t = toSqlTime(m[2]);
  if (!t) return null;
  return {
    eventTime: t,
    sourceIp: m[1],
    method: m[3],
    endpoint: m[4].slice(0, 500),
    statusCode: +m[5],
    username: null,
    userAgent: null,
    eventType: null,
    rawMessage: line
  };
}

function batchInsert(entries, fileId) {
  const db = getDb();
  const sql = `INSERT INTO log_entries (file_id, event_time, source_ip, username, method, endpoint, status_code, user_agent, event_type, raw_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const stmt = db.prepare(sql);
  for (const e of entries) {
    stmt.run(fileId, e.eventTime, e.sourceIp, e.username, e.method, e.endpoint, e.statusCode, e.userAgent, e.eventType, e.rawMessage);
  }
}

async function parseApacheFile(filePath, fileId) {
  return new Promise((resolve, reject) => {
    let valid = 0, invalid = 0, batch = [];
    const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });

    rl.on('line', (line) => {
      if (!line.trim()) return;
      const e = parseApacheLine(line);
      if (e) {
        batch.push(e);
        valid++;
        if (batch.length >= 500) {
          batchInsert(batch, fileId);
          batch = [];
        }
      } else {
        invalid++;
      }
    });

    rl.on('close', () => {
      if (batch.length > 0) batchInsert(batch, fileId);
      resolve({ valid, invalid });
    });

    rl.on('error', reject);
  });
}

async function parseCsvFile(filePath, fileId) {
  return new Promise((resolve, reject) => {
    let valid = 0, invalid = 0, batch = [];
    const stream = fs.createReadStream(filePath).pipe(csvParser());

    stream.on('data', (row) => {
      const ip = row.ip || row.source_ip || '';
      const ts = row.timestamp || row.event_time || '';
      const status = parseInt(row.status || row.status_code || '0');

      if (!ip || !ts) {
        invalid++;
        return;
      }

      const entry = {
        eventTime: ts,
        sourceIp: ip,
        username: row.username || null,
        method: row.method || null,
        endpoint: (row.endpoint || row.path || '').slice(0, 500),
        statusCode: isNaN(status) ? 0 : status,
        userAgent: row.user_agent || null,
        eventType: row.event_type || null,
        rawMessage: JSON.stringify(row)
      };

      batch.push(entry);
      valid++;

      if (batch.length >= 500) {
        batchInsert(batch, fileId);
        batch = [];
      }
    });

    stream.on('end', () => {
      if (batch.length > 0) batchInsert(batch, fileId);
      resolve({ valid, invalid });
    });

    stream.on('error', reject);
  });
}

async function parseFile(filePath, fileId, fileType) {
  if (fileType === '.csv') {
    return parseCsvFile(filePath, fileId);
  }
  return parseApacheFile(filePath, fileId);
}

module.exports = { parseFile };
