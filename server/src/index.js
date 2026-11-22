'use strict';
const fs = require('fs');
const config = require('./config');
const { migrate } = require('./db/migrate');
const { createApp } = require('./app');
const { startScheduler } = require('./services/backupService');

async function main() {
  for (const d of [config.storageDir, config.uploadDir, config.backupDir]) fs.mkdirSync(d, { recursive: true });
  await migrate({ quiet: true });
  const app = createApp();
  app.listen(config.port, config.host, () => {
    console.log(`FAISAL HOMES running on http://localhost:${config.port}`);
  });
  if (!config.disableScheduler) startScheduler();
}
main().catch((e) => { console.error('Failed to start:', e.message); process.exit(1); });
