const { DataTypes } = require('sequelize');
const BaseModel = require('./base.model');

class Appointment extends BaseModel {
  static init(sequelize) {
    return super.init(sequelize, {
      modelName: 'Appointment',
      tableName: 'appointments',
      indexes: [
        {
          unique: true,
          fields: ['service_id', 'appointment_date', 'start_time'],
          name: 'unique_booking_slot',
        },
      ],
    });
  }

  static associate(models) {
    this.belongsTo(models.User, {
      foreignKey: 'user_id',
      targetKey: 'id',
      as: 'user',
    });

    this.belongsTo(models.User, {
      foreignKey: 'employee_id',
      targetKey: 'id',
      as: 'employee',
    });

    this.belongsTo(models.Service, {
      foreignKey: 'service_id',
      targetKey: 'id',
      as: 'service',
    });
  }

  static fields(DataTypes) {
    return {
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users', // This is the table name
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      employee_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users', // This is the table name
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      service_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'services', // This is the table name
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      appointment_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        validate: {
          isDate: true,
        },
      },
      start_time: {
        type: DataTypes.TIME,
        allowNull: false,
        validate: {
          is: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, // HH:MM format
        },
      },
      end_time: {
        type: DataTypes.TIME,
        allowNull: false,
        validate: {
          is: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, // HH:MM format
        },
      },
      status: {
        type: DataTypes.ENUM('scheduled', 'completed', 'cancelled', 'no_show'),
        defaultValue: 'scheduled',
        allowNull: false,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    };
  }

  // Add any instance methods here
  async isTimeSlotAvailable() {
    const existingAppointment = await this.constructor.findOne({
      where: {
        service_id: this.service_id,
        appointment_date: this.appointment_date,
        start_time: this.start_time,
        status: 'scheduled',
      },
    });

    return !existingAppointment;
  }
}

module.exports = Appointment;
