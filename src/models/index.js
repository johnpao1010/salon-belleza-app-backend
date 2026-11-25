const { sequelize } = require('../config/database');
const User = require('./user.model');
const Service = require('./service.model');
const Appointment = require('./appointment.model');
const Business = require('./business.model');
const BusinessMember = require('./businessMember.model');

// Initialize all models
const models = {
  User: User.init(sequelize),
  Service: Service.init(sequelize),
  Appointment: Appointment.init(sequelize),
  Business: Business.init(sequelize),
  BusinessMember: BusinessMember.init(sequelize),
};

// Run .associate for each model to set up associations
Object.values(models)
  .filter(model => typeof model.associate === 'function')
  .forEach(model => model.associate(models));

// Export the models and sequelize instance
module.exports = {
  ...models,
  sequelize,
};
