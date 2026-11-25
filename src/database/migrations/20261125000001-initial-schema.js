// Baseline of the schema previously created by sequelize.sync().
// Tables that already exist (databases created with sync) are left untouched.
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();

    const timestamps = {
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    };

    if (!tables.includes('users')) {
      await queryInterface.createTable('users', {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        ...timestamps,
        first_name: { type: Sequelize.STRING, allowNull: false },
        last_name: { type: Sequelize.STRING, allowNull: false },
        email: { type: Sequelize.STRING, allowNull: false, unique: true },
        phone: { type: Sequelize.STRING, allowNull: true },
        password: { type: Sequelize.STRING, allowNull: false },
        role: {
          type: Sequelize.ENUM('admin', 'user', 'employee'),
          allowNull: false,
          defaultValue: 'user',
        },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        last_login: { type: Sequelize.DATE, allowNull: true },
      });
    }

    if (!tables.includes('services')) {
      await queryInterface.createTable('services', {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        ...timestamps,
        name: { type: Sequelize.STRING, allowNull: false, unique: true },
        description: { type: Sequelize.TEXT, allowNull: true },
        duration: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 30 },
        price: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      });
    }

    if (!tables.includes('appointments')) {
      await queryInterface.createTable('appointments', {
        id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
        ...timestamps,
        user_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        employee_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        service_id: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: 'services', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        appointment_date: { type: Sequelize.DATEONLY, allowNull: false },
        start_time: { type: Sequelize.TIME, allowNull: false },
        end_time: { type: Sequelize.TIME, allowNull: false },
        status: {
          type: Sequelize.ENUM('scheduled', 'completed', 'cancelled', 'no_show'),
          allowNull: false,
          defaultValue: 'scheduled',
        },
        notes: { type: Sequelize.TEXT, allowNull: true },
      });

      await queryInterface.addIndex('appointments', ['service_id', 'appointment_date', 'start_time'], {
        unique: true,
        name: 'unique_booking_slot',
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('appointments');
    await queryInterface.dropTable('services');
    await queryInterface.dropTable('users');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_appointments_status"');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_users_role"');
  },
};
