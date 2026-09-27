const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../../database/seclog.db');
const schemaPath = path.join(__dirname, '../../database/schema.sql');

let db = null;

// Wrapper that exposes a synchronous-style API matching what our code expects
class DatabaseWrapper {
  constructor(sqliteDb) {
    this._db = sqliteDb;
  }

  // Save to disk
  save() {
    const data = this._db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }

  // Mimics better-sqlite3's prepare().get() — returns first row as object
  prepare(sql) {
    const self = this;
    return {
      get(...params) {
        try {
          const stmt = self._db.prepare(sql);
          stmt.bind(params.length ? params : undefined);
          if (stmt.step()) {
            const cols = stmt.getColumnNames();
            const vals = stmt.get();
            stmt.free();
            const row = {};
            cols.forEach((c, i) => row[c] = vals[i]);
            return row;
          }
          stmt.free();
          return undefined;
        } catch (e) {
          // For queries with no params passed as array
          if (params.length === 0) {
            const stmt = self._db.prepare(sql);
            if (stmt.step()) {
              const cols = stmt.getColumnNames();
              const vals = stmt.get();
              stmt.free();
              const row = {};
              cols.forEach((c, i) => row[c] = vals[i]);
              return row;
            }
            stmt.free();
            return undefined;
          }
          throw e;
        }
      },
      all(...params) {
        const results = [];
        try {
          const stmt = self._db.prepare(sql);
          if (params.length) stmt.bind(params);
          while (stmt.step()) {
            const cols = stmt.getColumnNames();
            const vals = stmt.get();
            const row = {};
            cols.forEach((c, i) => row[c] = vals[i]);
            results.push(row);
          }
          stmt.free();
        } catch (e) {
          throw e;
        }
        return results;
      },
      run(...params) {
        self._db.run(sql, params.length ? params : undefined);
        self.save();
        const info = self._db.getRowsModified ? self._db.getRowsModified() : 0;
        return {
          changes: info,
          lastInsertRowid: self._getLastInsertRowid()
        };
      }
    };
  }

  _getLastInsertRowid() {
    const stmt = this._db.prepare('SELECT last_insert_rowid() as id');
    stmt.step();
    const id = stmt.get()[0];
    stmt.free();
    return id;
  }

  exec(sql) {
    this._db.exec(sql);
    this.save();
  }

  // Transaction helper
  transaction(fn) {
    return (...args) => {
      this._db.exec('BEGIN TRANSACTION');
      try {
        fn(...args);
        this._db.exec('COMMIT');
        this.save();
      } catch (e) {
        this._db.exec('ROLLBACK');
        throw e;
      }
    };
  }
}

// Synchronous initialization using initSqlJs synchronously
let wrapper = null;

function initDatabase() {
  if (wrapper) return wrapper;

  // sql.js requires async init, but we need sync for the app structure.
  // We'll use a blocking approach via the synchronous loader
  const SQL = require('sql.js');

  // This is actually a promise, handled in server startup
  throw new Error('Use initDatabaseAsync() instead');
}

async function initDatabaseAsync() {
  if (wrapper) return wrapper;

  const SQL = await initSqlJs();
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  let sqliteDb;
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    sqliteDb = new SQL.Database(buffer);
  } else {
    sqliteDb = new SQL.Database();
  }

  // Run schema
  sqliteDb.exec(schema);

  wrapper = new DatabaseWrapper(sqliteDb);
  wrapper.save();

  return wrapper;
}

function getDb() {
  if (!wrapper) throw new Error('Database not initialized. Call initDatabaseAsync() first.');
  return wrapper;
}

module.exports = { initDatabaseAsync, getDb };
