// Single-use password reset tokens (only the SHA-256 hash is stored)
// and password_changed_at to revoke sessions issued before a password change
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'password_reset_token', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'password_reset_expires', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'password_changed_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addIndex('users', ['password_reset_token'], {
      name: 'users_password_reset_token',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('users', 'users_password_reset_token');
    await queryInterface.removeColumn('users', 'password_changed_at');
    await queryInterface.removeColumn('users', 'password_reset_expires');
    await queryInterface.removeColumn('users', 'password_reset_token');
  },
};
