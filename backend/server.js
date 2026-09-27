require('dotenv').config({ path: __dirname + '/.env' });

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const { initDatabaseAsync } = require('./config/database');

async function startServer() {
  // Initialize database first
  await initDatabaseAsync();
  console.log('✓ Database connected');

  const app = express();

  // Security & utility middleware
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(morgan('dev'));
  app.use(express.json());

  // Serve frontend as static files
  app.use(express.static(path.join(__dirname, '../frontend')));

  // API routes
  app.use('/api/auth', require('./routes/authRoutes'));
  app.use('/api/logs', require('./routes/logRoutes'));
  app.use('/api/log-entries', require('./middleware/authMiddleware'), (req, res, next) => {
    require('./controllers/logController').getEntries(req, res, next);
  });
  app.use('/api/incidents', require('./routes/incidentRoutes'));
  app.use('/api/dashboard', require('./routes/dashboardRoutes'));
  app.use('/api/reports', require('./routes/reportRoutes'));

  // SPA fallback
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(__dirname, '../frontend/login.html'));
    }
  });

  // Error middleware — MUST be last
  app.use(require('./middleware/errorMiddleware'));

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`✓ Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('✗ Failed to start server:', err);
  process.exit(1);
});
