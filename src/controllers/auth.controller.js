const { User } = require('../models');
const { generateToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');

/**
 * Register a new user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const register = async (req, res, next) => {
  try {
    const { first_name, last_name, email, password, phone, role = 'user' } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      throw new AppError('User with this email already exists', 400);
    }

    // Create new user
    const user = await User.create({
      first_name,
      last_name,
      email,
      password,
      phone,
      role: role === 'admin' && req.user?.role !== 'admin' ? 'user' : role, // Only admins can create other admins
    });

    // Generate JWT token
    const token = generateToken(user.id, user.role);

    // Remove password from response
    const userResponse = user.get({ plain: true });
    delete userResponse.password;

    res.status(201).json({
      status: 'success',
      data: {
        user: userResponse,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1) Check if email and password exist
    if (!email || !password) {
      throw new AppError('Please provide email and password!', 400);
    }

    // 2) Check if user exists && password is correct
    const user = await User.findOne({ where: { email } });

    if (!user || !(await user.validatePassword(password))) {
      throw new AppError('Incorrect email or password', 401);
    }

    // 3) Check if user is active
    if (!user.is_active) {
      throw new AppError('Your account has been deactivated. Please contact support.', 401);
    }

    // 4) Update last login
    user.last_login = new Date();
    await user.save();

    // 5) Generate JWT token
    const token = generateToken(user.id, user.role);

    // 6) Remove password from output
    const userResponse = user.get({ plain: true });
    delete userResponse.password;

    // 7) Send response
    res.status(200).json({
      status: 'success',
      data: {
        user: userResponse,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user's profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
    });

    if (!user) {
      throw new AppError('User not found', 404);
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
 * Update current user's password
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findByPk(req.user.id);

    // 1) Check if user exists
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // 2) Check if current password is correct
    if (!(await user.validatePassword(currentPassword))) {
      throw new AppError('Your current password is incorrect', 401);
    }

    // 3) Update password
    user.password = newPassword;
    await user.save();

    // 4) Generate new JWT token
    const token = generateToken(user.id, user.role);

    res.status(200).json({
      status: 'success',
      message: 'Password updated successfully',
      token,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe,
  updatePassword,
};
