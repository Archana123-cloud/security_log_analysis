// Seed script — creates the default admin user
// Run once: node backend/seed.js

require('dotenv').config({ path: __dirname + '/.env' });
const bcrypt = require('bcryptjs');
const { initDatabaseAsync, getDb } = require('./config/database');

async function seed() {
  await initDatabaseAsync();
  const db = getDb();

  const username = 'admin';
  const password = 'admin123';

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    console.log('Admin user already exists. Skipping seed.');
    return;
  }

  const hash = await bcrypt.hash(password, 10);
  db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username, hash, 'admin');

  console.log('✓ Admin user created');
  console.log('  Username: admin');
  console.log('  Password: admin123');
  console.log('  (Change this password in production!)');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
