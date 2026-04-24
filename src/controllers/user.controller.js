const { User } = require('../models');
const AppError = require('../utils/AppError');
const { Op } = require('sequelize');

/**
 * Get all users (admin only)
 * Supports pagination, filtering, and sorting
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Number of results per page (default: 10)
 * - sort: Field to sort by (default: 'created_at')
 * - order: Sort order ('ASC' or 'DESC', default: 'DESC')
 * - role: Filter by role
 * - active: Filter by active status (true/false)
 * - search: Search in name and email
 */
const getAllUsers = async (req, res, next) => {
  try {
    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;
    
    // Sorting
    const sortField = req.query.sort || 'created_at';
    const sortOrder = req.query.order?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    // Build where clause for filtering
    const where = {};
    
    // Filter by role
    if (req.query.role) {
      where.role = req.query.role;
    }
    
    // Filter by active status
    if (req.query.active !== undefined) {
      where.is_active = req.query.active === 'true';
    }
    
    // Search in name and email
    if (req.query.search) {
      where[Op.or] = [
        { first_name: { [Op.iLike]: `%${req.query.search}%` } },
        { last_name: { [Op.iLike]: `%${req.query.search}%` } },
        { email: { [Op.iLike]: `%${req.query.search}%` } }
      ];
    }
    
    // Get total count for pagination
    const total = await User.count({ where });
    
    // Get paginated results
    const users = await User.findAll({
      attributes: { 
        exclude: [
          'password', 
          'password_reset_token', 
          'password_reset_expires',
          'verification_token',
          'verification_token_expires'
        ] 
      },
      where,
      order: [[sortField, sortOrder]],
      limit,
      offset,
    });
    
    // Calculate pagination info
    const pages = Math.ceil(total / limit);
    const hasNextPage = page < pages;
    const hasPreviousPage = page > 1;
    
    res.status(200).json({
      status: 'success',
      pagination: {
        total,
        pages,
        page,
        limit,
        hasNextPage,
        hasPreviousPage,
      },
      data: {
        users,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single user by ID (admin only or own profile)
 */
const getUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Input validation
    if (!id || isNaN(parseInt(id, 10))) {
      throw new AppError('Invalid user ID', 400);
    }

    // Check if user is requesting their own profile or is an admin
    if (req.user.id !== parseInt(id, 10) && req.user.role !== 'admin') {
      throw new AppError('You do not have permission to view this user', 403);
    }

    const user = await User.findByPk(id, {
      attributes: { 
        exclude: [
          'password', 
          'password_reset_token', 
          'password_reset_expires',
          'verification_token',
          'verification_token_expires'
        ] 
      },
      include: [
        // Add related models here if needed
        // {
        //   model: Appointment,
        //   as: 'appointments',
        //   attributes: ['id', 'date', 'status']
        // }
      ]
    });

    if (!user) {
      throw new AppError('No user found with that ID', 404);
    }

    res.status(200).json({
      status: 'success',
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user profile (admin or own profile)
 * Admins can update any user's profile
 * Regular users can only update their own profile
 * Role can only be changed by admins
 */
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    
    // Input validation
    if (!id || isNaN(parseInt(id, 10))) {
      throw new AppError('Invalid user ID', 400);
    }
    
    // Check if user exists
    const user = await User.findByPk(id);
    if (!user) {
      throw new AppError('No user found with that ID', 404);
    }
    
    // Check permissions
    const isAdmin = req.user.role === 'admin';
    const isSelf = req.user.id === parseInt(id, 10);
    
    if (!isAdmin && !isSelf) {
      throw new AppError('You do not have permission to update this user', 403);
    }
    
    // Non-admin users cannot update certain fields
    if (!isAdmin) {
      // Remove restricted fields from updates
      const restrictedFields = ['role', 'is_active', 'is_verified', 'verification_token', 'verification_token_expires'];
      restrictedFields.forEach(field => delete updates[field]);
    }
    
    // Check if email is being updated and if it's already in use
    if (updates.email && updates.email !== user.email) {
      const emailExists = await User.findOne({ where: { email: updates.email } });
      if (emailExists) {
        throw new AppError('Email is already in use', 400);
      }
    }
    
    // Don't allow updating password here
    const { password, ...updateData } = updates;

    // Check if user is updating their own profile or is admin
    if (user.id !== req.user.id && req.user.role !== 'admin') {
      throw new AppError('You do not have permission to update this user', 403);
    }

    // Prevent changing role unless admin
    if (updateData.role && req.user.role !== 'admin') {
      throw new AppError('You do not have permission to change user roles', 403);
    }
    
    // Update the user
    await user.update(updateData);
    
    // Get the updated user data (excluding sensitive fields)
    const updatedUser = await User.findByPk(user.id, {
      attributes: { 
        exclude: [
          'password', 
          'password_reset_token', 
          'password_reset_expires',
          'verification_token',
          'verification_token_expires'
        ] 
      }
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        user: updatedUser
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete user (admin only or own account)
 */
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      throw new AppError('No user found with that ID', 404);
    }

    // Check if user is deleting their own account or is admin
    if (user.id !== req.user.id && req.user.role !== 'admin') {
      throw new AppError('You do not have permission to delete this user', 403);
    }

    // Prevent admins from being deleted by non-admins
    if (user.role === 'admin' && req.user.role !== 'admin') {
      throw new AppError('You do not have permission to delete admin users', 403);
    }

    // Soft delete the user
    await user.destroy();

    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deactivate a user (admin only)
 */
const deactivateUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      throw new AppError('No user found with that ID', 404);
    }

    // Prevent deactivating yourself
    if (user.id === req.user.id) {
      throw new AppError('You cannot deactivate your own account', 400);
    }

    // Prevent deactivating other admins unless you're an admin
    if (user.role === 'admin' && req.user.role !== 'admin') {
      throw new AppError('You do not have permission to deactivate admin users', 403);
    }

    user.is_active = false;
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'User deactivated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reactivate a user (admin only)
 */
const reactivateUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);

    if (!user) {
      throw new AppError('No user found with that ID', 404);
    }

    user.is_active = true;
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'User reactivated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user's profile
 */
const getMe = async (req, res, next) => {
  try {
    // El usuario ya está disponible en req.user gracias al middleware de autenticación
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      throw new AppError('No user found with that ID', 404);
    }

    res.status(200).json({
      status: 'success',
      data: {
        user
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update current user's password
 */
const updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findByPk(req.user.id);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Verificar la contraseña actual
    if (!(await user.validatePassword(currentPassword))) {
      throw new AppError('Current password is incorrect', 401);
    }

    // Actualizar la contraseña
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Password updated successfully'
    });
  } catch (error) {
    next(error);
  }
};
/**
 * Get users by role (accessible by authenticated users)
 * Query params:
 * - role: Role to filter by (required)
 * - active: Filter by active status (true/false)
 * - search: Search in name and email
 */
const getUsersByRole = async (req, res, next) => {
  try {
    const { role, active, search } = req.query;

    if (!role) {
      throw new AppError('Role parameter is required', 400);
    }

    // Build where clause
    const where = { role };

    // Filter by active status
    if (active !== undefined) {
      where.is_active = active === 'true';
    }

    // Search in name and email
    if (search) {
      where[Op.or] = [
        { first_name: { [Op.iLike]: `%${search}%` } },
        { last_name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const users = await User.findAll({
      where,
      attributes: { 
        exclude: [
          'password', 
          'password_reset_token', 
          'password_reset_expires',
          'verification_token',
        ]
      },
      order: [['first_name', 'ASC'], ['last_name', 'ASC']],
    });

    res.status(200).json({
      status: 'success',
      results: users.length,
      data: {
        users,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUsers,
  getUser,
  updateUser,
  deleteUser,
  deactivateUser,
  reactivateUser,
  getMe,
  updatePassword,
  getUsersByRole,
};
