// A slot is taken per employee (not per service), and cancelled or deleted
// appointments no longer block it. Runs in a transaction so a failure keeps the previous index.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS "unique_booking_slot"', { transaction });
      await queryInterface.addIndex('appointments', ['employee_id', 'appointment_date', 'start_time'], {
        unique: true,
        name: 'unique_employee_booking_slot',
        where: { status: 'scheduled', deleted_at: null },
        transaction,
      });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeIndex('appointments', 'unique_employee_booking_slot', { transaction });
      await queryInterface.addIndex('appointments', ['service_id', 'appointment_date', 'start_time'], {
        unique: true,
        name: 'unique_booking_slot',
        transaction,
      });
    });
  },
};
