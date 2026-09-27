const { getDb } = require('../config/database');

// All thresholds in one config object — easy to tune
const RULES = {
  bruteForce:     { attempts: 5, windowMin: 10, highAt: 10 },
  abnormalIp:     { requests: 100, windowMin: 5 },
  errorSpike:     { errors: 30, windowMin: 5 },
  sensitivePaths: ['/admin', '/login', '/config', '/.env', '/wp-admin'],
  injection:      [/'\s*or\s*1=1/i, /\.\.\//, /<script/i, /union\s+select/i]
};

// ─── sliding window helper ─────────────────────────────────────────────
function slidingWindow(events, windowMs, threshold) {
  const groups = [];
  let i = 0;
  while (i < events.length) {
    let j = i;
    while (j < events.length && events[j].t - events[i].t <= windowMs) j++;
    if (j - i >= threshold) {
      groups.push(events.slice(i, j));
      i = j;
    } else {
      i++;
    }
  }
  return groups;
}

// helper to insert/update incident with duplicate prevention via signature
function upsertIncident(logEntryId, fileId, type, severity, ip, description, evidence, signature) {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM security_incidents WHERE signature = ?').get(signature);
  if (existing) {
    db.prepare('UPDATE security_incidents SET incident_count = incident_count + 1 WHERE signature = ?').run(signature);
  } else {
    db.prepare(
      `INSERT INTO security_incidents (log_entry_id, file_id, incident_type, severity, source_ip, description, evidence, signature)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(logEntryId, fileId, type, severity, ip, description, evidence, signature);
  }
}

// ─── Rule 1: Brute Force (repeated failed logins) ──────────────────────
function bruteForce(fileId) {
  const db = getDb();
  const rows = db.prepare(
    `SELECT id, source_ip, event_time FROM log_entries
     WHERE file_id = ? AND status_code = 401 AND (endpoint LIKE '%login%' OR endpoint LIKE '%Login%')
     ORDER BY source_ip, event_time`
  ).all(fileId);

  const byIp = {};
  rows.forEach(r => {
    if (!byIp[r.source_ip]) byIp[r.source_ip] = [];
    byIp[r.source_ip].push({ id: r.id, t: new Date(r.event_time).getTime(), time: r.event_time });
  });

  for (const [ip, evs] of Object.entries(byIp)) {
    for (const g of slidingWindow(evs, RULES.bruteForce.windowMin * 60000, RULES.bruteForce.attempts)) {
      const severity = g.length >= RULES.bruteForce.highAt ? 'high' : 'medium';
      const start = g[0].time;
      const signature = `BRUTE_FORCE|${ip}|${start}`;
      const evidence = `IP ${ip} generated ${g.length} failed login attempts between ${g[0].time} and ${g[g.length - 1].time}. Threshold: ${RULES.bruteForce.attempts}. Entry IDs: ${g.map(x => x.id).join(',')}`;
      upsertIncident(g[0].id, fileId, 'Brute Force', severity, ip, 'Repeated failed login attempts', evidence, signature);
    }
  }
}

// ─── Rule 2: Unauthorized Access (401/403) ─────────────────────────────
function unauthorizedAccess(fileId) {
  const db = getDb();
  const rows = db.prepare(
    `SELECT id, source_ip, endpoint, status_code, event_time FROM log_entries
     WHERE file_id = ? AND status_code IN (401, 403)
     ORDER BY source_ip, event_time`
  ).all(fileId);

  const byIp = {};
  rows.forEach(r => {
    if (!byIp[r.source_ip]) byIp[r.source_ip] = [];
    byIp[r.source_ip].push(r);
  });

  for (const [ip, entries] of Object.entries(byIp)) {
    const severity = entries.length >= 5 ? 'medium' : 'low';
    for (const e of entries) {
      const signature = `UNAUTHORIZED|${ip}|${e.id}`;
      const evidence = `IP ${ip} received ${e.status_code} on ${e.endpoint} at ${e.event_time}`;
      upsertIncident(e.id, fileId, 'Unauthorized Access', severity, ip, `Unauthorized access attempt (${e.status_code})`, evidence, signature);
    }
  }
}

// ─── Rule 3: Abnormal IP Activity (>100 requests in 5 min) ────────────
function abnormalIpActivity(fileId) {
  const db = getDb();
  const rows = db.prepare(
    `SELECT id, source_ip, event_time FROM log_entries
     WHERE file_id = ? ORDER BY source_ip, event_time`
  ).all(fileId);

  const byIp = {};
  rows.forEach(r => {
    if (!byIp[r.source_ip]) byIp[r.source_ip] = [];
    byIp[r.source_ip].push({ id: r.id, t: new Date(r.event_time).getTime(), time: r.event_time });
  });

  for (const [ip, evs] of Object.entries(byIp)) {
    for (const g of slidingWindow(evs, RULES.abnormalIp.windowMin * 60000, RULES.abnormalIp.requests)) {
      const severity = g.length >= 200 ? 'high' : 'medium';
      const signature = `ABNORMAL_IP|${ip}|${g[0].time}`;
      const evidence = `IP ${ip} made ${g.length} requests in ${RULES.abnormalIp.windowMin} minutes. Threshold: ${RULES.abnormalIp.requests}`;
      upsertIncident(g[0].id, fileId, 'Abnormal IP Activity', severity, ip, 'Abnormally high request volume', evidence, signature);
    }
  }
}

// ─── Rule 4: Suspicious Endpoint ──────────────────────────────────────
function suspiciousEndpoint(fileId) {
  const db = getDb();
  const rows = db.prepare(
    `SELECT id, source_ip, endpoint, event_time FROM log_entries WHERE file_id = ?`
  ).all(fileId);

  for (const r of rows) {
    for (const sp of RULES.sensitivePaths) {
      if (r.endpoint && r.endpoint.toLowerCase().includes(sp)) {
        const signature = `SENSITIVE_PATH|${r.source_ip}|${r.id}`;
        const evidence = `IP ${r.source_ip} accessed sensitive path ${r.endpoint} at ${r.event_time}`;
        upsertIncident(r.id, fileId, 'Suspicious Endpoint', 'low', r.source_ip, `Access to sensitive path: ${r.endpoint}`, evidence, signature);
        break;
      }
    }
  }
}

// ─── Rule 5: Error-Rate Anomaly ───────────────────────────────────────
function errorSpike(fileId) {
  const db = getDb();
  const rows = db.prepare(
    `SELECT id, source_ip, event_time, status_code FROM log_entries
     WHERE file_id = ? AND status_code >= 400
     ORDER BY source_ip, event_time`
  ).all(fileId);

  const byIp = {};
  rows.forEach(r => {
    if (!byIp[r.source_ip]) byIp[r.source_ip] = [];
    byIp[r.source_ip].push({ id: r.id, t: new Date(r.event_time).getTime(), time: r.event_time });
  });

  for (const [ip, evs] of Object.entries(byIp)) {
    for (const g of slidingWindow(evs, RULES.errorSpike.windowMin * 60000, RULES.errorSpike.errors)) {
      const signature = `ERROR_SPIKE|${ip}|${g[0].time}`;
      const evidence = `IP ${ip} generated ${g.length} errors in ${RULES.errorSpike.windowMin} minutes. Threshold: ${RULES.errorSpike.errors}`;
      upsertIncident(g[0].id, fileId, 'Error Rate Anomaly', 'medium', ip, 'High error rate detected', evidence, signature);
    }
  }
}

// ─── Rule 6: Suspicious Input (injection patterns) ────────────────────
function suspiciousInput(fileId) {
  const db = getDb();
  const rows = db.prepare(
    `SELECT id, source_ip, endpoint, event_time, raw_message FROM log_entries WHERE file_id = ?`
  ).all(fileId);

  for (const r of rows) {
    const text = (r.endpoint || '') + ' ' + (r.raw_message || '');
    for (const pattern of RULES.injection) {
      if (pattern.test(text)) {
        const signature = `INJECTION|${r.source_ip}|${r.id}`;
        const evidence = `IP ${r.source_ip} sent suspicious input matching pattern ${pattern} at ${r.event_time}. Endpoint: ${r.endpoint}`;
        upsertIncident(r.id, fileId, 'Suspicious Input', 'medium', r.source_ip, 'Potential injection attempt', evidence, signature);
        break;
      }
    }
  }
}

// ─── Main entry: run all rules ────────────────────────────────────────
function runDetection(fileId) {
  bruteForce(fileId);
  unauthorizedAccess(fileId);
  abnormalIpActivity(fileId);
  suspiciousEndpoint(fileId);
  errorSpike(fileId);
  suspiciousInput(fileId);
}

module.exports = { runDetection };
