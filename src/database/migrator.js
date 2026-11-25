const { Sequelize } = require('sequelize');
const { Umzug, SequelizeStorage } = require('umzug');
const { sequelize } = require('../config/database');

// Migrations use the sequelize-cli format: module.exports = { up(queryInterface, Sequelize), down(...) }
const migrator = new Umzug({
  migrations: {
    glob: ['migrations/*.js', { cwd: __dirname }],
    resolve: ({ name, path, context }) => {
      const migration = require(path);
      return {
        name,
        up: () => migration.up(context, Sequelize),
        down: () => migration.down(context, Sequelize),
      };
    },
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize }),
  logger: console,
});

const runMigrations = async () => {
  const executed = await migrator.up();
  console.log(`Migrations applied: ${executed.length}`);
};

module.exports = { migrator, runMigrations };
