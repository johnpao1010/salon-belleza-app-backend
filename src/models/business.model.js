const BaseModel = require('./base.model');

class Business extends BaseModel {
  static init(sequelize) {
    return super.init(sequelize, {
      modelName: 'Business',
      tableName: 'businesses',
    });
  }

  static associate(models) {
    this.hasMany(models.BusinessMember, { foreignKey: 'business_id', as: 'members' });
    this.hasMany(models.Service, { foreignKey: 'business_id', as: 'services' });
    this.hasMany(models.Appointment, { foreignKey: 'business_id', as: 'appointments' });
  }

  static fields(DataTypes) {
    return {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: { notEmpty: true, len: [2, 100] },
      },
      slug: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: { is: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
      },
      address: { type: DataTypes.STRING, allowNull: true },
      phone: { type: DataTypes.STRING, allowNull: true },
      email: { type: DataTypes.STRING, allowNull: true, validate: { isEmail: true } },
      logo_url: { type: DataTypes.STRING, allowNull: true },
      timezone: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'America/Bogota',
        validate: {
          isValidTimezone(value) {
            try {
              new Intl.DateTimeFormat('en-US', { timeZone: value });
            } catch (error) {
              throw new Error('Invalid timezone');
            }
          },
        },
      },
      opening_time: { type: DataTypes.TIME, allowNull: false, defaultValue: '09:00' },
      closing_time: { type: DataTypes.TIME, allowNull: false, defaultValue: '19:00' },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    };
  }
}

module.exports = Business;
