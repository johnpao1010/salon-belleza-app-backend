const BaseModel = require('./base.model');

class BusinessMember extends BaseModel {
  static init(sequelize) {
    return super.init(sequelize, {
      modelName: 'BusinessMember',
      tableName: 'business_members',
      indexes: [
        { unique: true, fields: ['business_id', 'user_id'], name: 'business_members_business_user' },
      ],
    });
  }

  static associate(models) {
    this.belongsTo(models.Business, { foreignKey: 'business_id', as: 'business' });
    this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  }

  static fields(DataTypes) {
    return {
      business_id: { type: DataTypes.UUID, allowNull: false },
      user_id: { type: DataTypes.UUID, allowNull: false },
      role: {
        type: DataTypes.ENUM('owner', 'admin', 'employee'),
        allowNull: false,
        defaultValue: 'employee',
      },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    };
  }
}

module.exports = BusinessMember;
