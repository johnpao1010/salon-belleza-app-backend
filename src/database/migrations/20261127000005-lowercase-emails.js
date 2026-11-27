// Store every email in lowercase (lookups are now case-insensitive).
// Lowercased in JS so stored values match normalizeEmail exactly.
const normalize = (email) => email.trim().toLowerCase();

module.exports = {
  async up(queryInterface) {
    const [users] = await queryInterface.sequelize.query('SELECT id, email FROM users');

    const byEmail = new Map();
    users.forEach((user) => {
      const email = normalize(user.email);
      byEmail.set(email, (byEmail.get(email) || 0) + 1);
    });
    const duplicates = [...byEmail].filter(([, count]) => count > 1).map(([email]) => email);
    if (duplicates.length) {
      throw new Error(
        `Users share an email that differs only in capitalization: ${duplicates.join(', ')}. ` +
          'Merge or rename them before running this migration.'
      );
    }

    for (const user of users) {
      const email = normalize(user.email);
      if (email !== user.email) {
        await queryInterface.sequelize.query('UPDATE users SET email = :email WHERE id = :id', {
          replacements: { email, id: user.id },
        });
      }
    }
  },

  async down() {},
};
