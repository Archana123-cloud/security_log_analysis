-- Security Log Analysis Database Schema

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS log_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_name VARCHAR(255) NOT NULL,
    stored_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(10),
    file_size INTEGER,
    uploaded_by INTEGER,
    status VARCHAR(30) DEFAULT 'uploaded',
    valid_lines INTEGER DEFAULT 0,
    invalid_lines INTEGER DEFAULT 0,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS log_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    event_time DATETIME,
    source_ip VARCHAR(45),
    username VARCHAR(100),
    method VARCHAR(10),
    endpoint VARCHAR(500),
    status_code INTEGER,
    user_agent TEXT,
    event_type VARCHAR(50),
    raw_message TEXT,
    FOREIGN KEY (file_id) REFERENCES log_files(id)
);

CREATE TABLE IF NOT EXISTS security_incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    log_entry_id INTEGER,
    file_id INTEGER,
    incident_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    source_ip VARCHAR(45),
    description TEXT,
    evidence TEXT,
    signature VARCHAR(255) UNIQUE,
    incident_count INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'open',
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (log_entry_id) REFERENCES log_entries(id),
    FOREIGN KEY (file_id) REFERENCES log_files(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_entries_event_time ON log_entries(event_time);
CREATE INDEX IF NOT EXISTS idx_entries_source_ip ON log_entries(source_ip);
CREATE INDEX IF NOT EXISTS idx_entries_file_id ON log_entries(file_id);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON security_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_detected_at ON security_incidents(detected_at);
CREATE INDEX IF NOT EXISTS idx_incidents_file_id ON security_incidents(file_id);
