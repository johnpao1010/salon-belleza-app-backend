const { randomUUID } = require('crypto');

// Multi-business support: every service and appointment belongs to a business.
// Existing data is assigned to a first business.
module.exports = {
  async up(queryInterface, Sequelize) {
    const timestamps = {
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    };

    await queryInterface.createTable('businesses', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      ...timestamps,
      name: { type: Sequelize.STRING, allowNull: false },
      slug: { type: Sequelize.STRING, allowNull: false, unique: true },
      address: { type: Sequelize.STRING, allowNull: true },
      phone: { type: Sequelize.STRING, allowNull: true },
      email: { type: Sequelize.STRING, allowNull: true },
      logo_url: { type: Sequelize.STRING, allowNull: true },
      timezone: { type: Sequelize.STRING, allowNull: false, defaultValue: 'America/Bogota' },
      opening_time: { type: Sequelize.TIME, allowNull: false, defaultValue: '09:00' },
      closing_time: { type: Sequelize.TIME, allowNull: false, defaultValue: '19:00' },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    });

    await queryInterface.createTable('business_members', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      ...timestamps,
      business_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'businesses', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      role: {
        type: Sequelize.ENUM('owner', 'admin', 'employee'),
        allowNull: false,
        defaultValue: 'employee',
      },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    });
    await queryInterface.addIndex('business_members', ['business_id', 'user_id'], {
      unique: true,
      name: 'business_members_business_user',
    });
    await queryInterface.addIndex('business_members', ['user_id']);

    const businessRef = {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'businesses', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    };
    await queryInterface.addColumn('services', 'business_id', businessRef);
    await queryInterface.addColumn('appointments', 'business_id', businessRef);

    const [[{ count }]] = await queryInterface.sequelize.query(
      'SELECT (SELECT COUNT(*) FROM users) + (SELECT COUNT(*) FROM services) AS count'
    );
    if (Number(count) > 0) {
      const now = new Date();
      const businessId = randomUUID();
      await queryInterface.bulkInsert('businesses', [{
        id: businessId,
        name: 'Pao W Studio',
        slug: 'pao-w-studio',
        timezone: 'America/Bogota',
        opening_time: '09:00',
        closing_time: '19:00',
        is_active: true,
        created_at: now,
        updated_at: now,
      }]);
      await queryInterface.sequelize.query('UPDATE services SET business_id = :businessId', {
        replacements: { businessId },
      });
      await queryInterface.sequelize.query('UPDATE appointments SET business_id = :businessId', {
        replacements: { businessId },
      });

      const [staff] = await queryInterface.sequelize.query(
        "SELECT id, role FROM users WHERE role IN ('admin', 'employee') AND deleted_at IS NULL"
      );
      if (staff.length) {
        await queryInterface.bulkInsert('business_members', staff.map((user) => ({
          id: randomUUID(),
          business_id: businessId,
          user_id: user.id,
          role: user.role === 'admin' ? 'owner' : 'employee',
          is_active: true,
          created_at: now,
          updated_at: now,
        })));
      }
    }

    await queryInterface.changeColumn('services', 'business_id', { ...businessRef, allowNull: false });
    await queryInterface.changeColumn('appointments', 'business_id', { ...businessRef, allowNull: false });

    await queryInterface.removeConstraint('services', 'services_name_key');
    await queryInterface.addIndex('services', ['business_id', 'name'], {
      unique: true,
      name: 'services_business_name',
    });
    await queryInterface.addIndex('appointments', ['business_id', 'appointment_date']);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('services', 'services_business_name');
    await queryInterface.addConstraint('services', {
      fields: ['name'],
      type: 'unique',
      name: 'services_name_key',
    });
    await queryInterface.removeColumn('appointments', 'business_id');
    await queryInterface.removeColumn('services', 'business_id');
    await queryInterface.dropTable('business_members');
    await queryInterface.dropTable('businesses');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_business_members_role"');
  },
};
