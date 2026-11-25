const { User } = require('../models');
const { generateToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');
const emailService = require('../services/emailService');

/**
 * Register a new user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const register = async (req, res, next) => {
  try {
    const { first_name, last_name, email, password, phone } = req.body;

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
      role: 'user',
    });

    // Generate JWT token
    const token = generateToken(user.id, user.role);

    // Remove password from response
    const userResponse = user.get({ plain: true });
    delete userResponse.password;

    // Send welcome email for 'user' role
    if (user.role === 'user') {
      // Enviar correo de forma asíncrona para no retrasar la respuesta
      emailService.sendWelcomeEmail(user).catch(error => {
        console.error('Error al enviar correo de bienvenida:', error);
      });
    }

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

/**
 * Verify user email exists for password recovery
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      throw new AppError('Por favor ingresa tu correo electrónico', 400);
    }

    const user = await User.findOne({ where: { email } });

    if (!user) {
      throw new AppError('No existe una cuenta con ese correo electrónico', 404);
    }

    if (!user.is_active) {
      throw new AppError('Tu cuenta está desactivada. Contacta al soporte.', 401);
    }

    res.status(200).json({
      status: 'success',
      data: {
        message: 'Correo verificado correctamente',
        email: user.email,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset user password using verified email
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const resetPassword = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError('Por favor ingresa el correo y la nueva contraseña', 400);
    }

    const user = await User.findOne({ where: { email } });

    if (!user) {
      throw new AppError('No existe una cuenta con ese correo electrónico', 404);
    }

    if (!user.is_active) {
      throw new AppError('Tu cuenta está desactivada. Contacta al soporte.', 401);
    }

    user.password = password;
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Contraseña actualizada correctamente',
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
  forgotPassword,
  resetPassword,
};
