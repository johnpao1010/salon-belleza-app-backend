const { Service } = require('../models');
const AppError = require('../utils/AppError');

/**
 * Get all services
 */
const getAllServices = async (req, res, next) => {
  try {
    const services = await Service.findAll({
      where: { is_active: true },
      order: [['name', 'ASC']],
    });

    res.status(200).json({
      status: 'success',
      results: services.length,
      data: {
        services,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single service by ID
 */
const getService = async (req, res, next) => {
  try {
    const service = await Service.findByPk(req.params.id);

    if (!service) {
      throw new AppError('No service found with that ID', 404);
    }

    res.status(200).json({
      status: 'success',
      data: {
        service,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new service (admin only)
 */
const createService = async (req, res, next) => {
  try {
    const { name, description, duration, price } = req.body;

    const service = await Service.create({
      name,
      description,
      duration: parseInt(duration, 10),
      price: parseFloat(price),
    });

    res.status(201).json({
      status: 'success',
      data: {
        service,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a service (admin only)
 */
const updateService = async (req, res, next) => {
  try {
    const { name, description, duration, price, is_active } = req.body;

    const service = await Service.findByPk(req.params.id);

    if (!service) {
      throw new AppError('No service found with that ID', 404);
    }

    await service.update({
      name: name || service.name,
      description: description !== undefined ? description : service.description,
      duration: duration ? parseInt(duration, 10) : service.duration,
      price: price ? parseFloat(price) : service.price,
      is_active: is_active !== undefined ? is_active : service.is_active,
    });

    res.status(200).json({
      status: 'success',
      data: {
        service,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a service (admin only, soft delete)
 */
const deleteService = async (req, res, next) => {
  try {
    const service = await Service.findByPk(req.params.id);

    if (!service) {
      throw new AppError('No service found with that ID', 404);
    }

    // Soft delete by setting is_active to false
    await service.update({ is_active: false });

    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllServices,
  getService,
  createService,
  updateService,
  deleteService,
};
