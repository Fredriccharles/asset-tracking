const express = require('express');
const cors = require('cors');
const path = require('path');

require('./db/init'); // ensures schema + seed run before routes are used

const authRoutes = require('./routes/auth');
const itemRoutes = require('./routes/items');
const checkoutRoutes = require('./routes/checkouts');
const maintenanceRoutes = require('./routes/maintenance');
const retirementRoutes = require('./routes/retirements');
const dashboardRoutes = require('./routes/dashboard');
const auditRoutes = require('./routes/audit');
  const usersRoutes = require('./routes/users');
const reportRoutes = require('./routes/reports');
const backupRoutes = require('./routes/backup');
const historyRoutes = require('./routes/history');

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

  app.use('/api/auth', authRoutes);
  app.use('/api/items', itemRoutes);
  app.use('/api/checkouts', checkoutRoutes);
  app.use('/api/maintenance', maintenanceRoutes);
  app.use('/api/retirements', retirementRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/audit', auditRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/backups', backupRoutes);
  app.use('/api/history', historyRoutes);

  // In production the built React app is served from client/dist by this
  // same Express process, so the whole app runs on a single local port
  // with no external network dependency (fully offline).
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(clientDist, 'index.html'), (err) => {
      if (err) next();
    });
  });

  // Centralized error handler
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'An unexpected server error occurred.' });
  });

  return app;
}

module.exports = { createApp };
