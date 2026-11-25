const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { sequelize } = require('../src/config/database');
const { migrator } = require('../src/database/migrator');

// Usage: node scripts/migrate.js [up|down|status]
const run = async () => {
  const command = process.argv[2] || 'up';
  if (command === 'up') {
    await migrator.up();
  } else if (command === 'down') {
    await migrator.down();
  } else if (command === 'status') {
    const executed = await migrator.executed();
    const pending = await migrator.pending();
    console.log('Executed:', executed.map((m) => m.name));
    console.log('Pending:', pending.map((m) => m.name));
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
