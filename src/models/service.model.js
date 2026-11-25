const { DataTypes } = require('sequelize');
const BaseModel = require('./base.model');

class Service extends BaseModel {
  static init(sequelize) {
    return super.init(sequelize, {
      modelName: 'Service',
      tableName: 'services',
      indexes: [
        { unique: true, fields: ['business_id', 'name'], name: 'services_business_name' },
      ],
    });
  }

  static associate(models) {
    this.belongsTo(models.Business, { foreignKey: 'business_id', as: 'business' });
    this.hasMany(models.Appointment, {
      foreignKey: 'service_id',
      as: 'appointments',
    });
  }

  static fields(DataTypes) {
    return {
      business_id: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [2, 100],
        },
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      duration: {
        type: DataTypes.INTEGER, // Duration in minutes
        allowNull: false,
        defaultValue: 30,
        validate: {
          min: 5,
          isInt: true,
        },
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          min: 0,
        },
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
    };
  }
}

module.exports = Service;
