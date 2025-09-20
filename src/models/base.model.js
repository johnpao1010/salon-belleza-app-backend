const { Model, DataTypes } = require('sequelize');

class BaseModel extends Model {
  static init(sequelize, options = {}) {
    const fields = this.fields ? this.fields(DataTypes) : {};
    
    super.init(
      {
        id: {
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4,
          primaryKey: true,
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        updated_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        deleted_at: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        ...fields, // Spread the fields from the child class
      },
      {
        sequelize,
        modelName: options.modelName,
        tableName: options.tableName,
        timestamps: true,
        underscored: true,
        paranoid: true, // Enable soft deletes
        ...options,
      }
    );

    return this;
  }

  // Static method to be overridden by child classes
  static fields(DataTypes) {
    return {}; // Base fields (none by default)
  }
}

module.exports = BaseModel;
