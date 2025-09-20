const { User } = require('../models');
const AppError = require('../utils/AppError');
const { Op } = require('sequelize');

/**
 * Get all users (admin only)
 */
const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] },
      order: [['created_at', 'DESC']],
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

/**
 * Get a single user by ID (admin only)
 */
const getUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] },
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
 */
const updateUser = async (req, res, next) => {
  try {
    // Don't allow updating password here
    const { password, ...updateData } = req.body;
    
    // Find user
    const user = await User.findByPk(req.params.id);
    
    if (!user) {
      throw new AppError('No user found with that ID', 404);
    }

    // Check if user is updating their own profile or is admin
    if (user.id !== req.user.id && req.user.role !== 'admin') {
      throw new AppError('You do not have permission to update this user', 403);
    }

    // Prevent changing role unless admin
    if (updateData.role && req.user.role !== 'admin') {
      throw new AppError('You do not have permission to change user roles', 403);
    }

    // Update user
    await user.update(updateData);

    // Get updated user without password
    const updatedUser = await User.findByPk(user.id, {
      attributes: { exclude: ['password'] },
    });

    res.status(200).json({
      status: 'success',
      data: {
        user: updatedUser,
      },
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

module.exports = {
  getAllUsers,
  getUser,
  updateUser,
  deleteUser,
  deactivateUser,
  reactivateUser,
};
