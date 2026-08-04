const { createApp } = require('./app');
const { scheduleMonthlyBackup } = require('./services/backupService');

const PORT = process.env.PORT || 4310;

function start() {
  const app = createApp();
  const server = app.listen(PORT, '127.0.0.1', () => {
    console.log(`[server] Asset Tracking System API listening on http://127.0.0.1:${PORT}`);
    scheduleMonthlyBackup();
  });
  return server;
}

if (require.main === module) {
  start();
}

module.exports = { start, PORT };
