// Store every email in lowercase (lookups are now case-insensitive)
module.exports = {
  async up(queryInterface) {
    const [duplicates] = await queryInterface.sequelize.query(
      'SELECT LOWER(TRIM(email)) AS email FROM users GROUP BY LOWER(TRIM(email)) HAVING COUNT(*) > 1'
    );
    if (duplicates.length) {
      throw new Error(
        `Users share an email that differs only in capitalization: ${duplicates.map((d) => d.email).join(', ')}. ` +
          'Merge or rename them before running this migration.'
      );
    }
    await queryInterface.sequelize.query('UPDATE users SET email = LOWER(TRIM(email)) WHERE email <> LOWER(TRIM(email))');
  },

  async down() {},
};
