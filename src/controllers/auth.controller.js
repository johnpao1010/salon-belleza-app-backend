const crypto = require('crypto');
const { Op } = require('sequelize');
const { User, sequelize } = require('../models');
const { generateToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');
const { normalizeEmail } = require('../utils/email');
const emailService = require('../services/emailService');

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const RESET_EMAIL_COOLDOWN_MS = 60 * 1000;
const PRIVATE_USER_FIELDS = ['password', 'password_reset_token', 'password_reset_expires', 'password_changed_at'];

const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const toUserResponse = (user) => {
  const userResponse = user.get({ plain: true });
  PRIVATE_USER_FIELDS.forEach((field) => delete userResponse[field]);
  return userResponse;
};

/**
 * Register a new user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const register = async (req, res, next) => {
  try {
    const { first_name, last_name, password, phone } = req.body;
    const email = normalizeEmail(req.body.email);

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
    const token = generateToken(user.id, user.role, user.password_changed_at);

    const userResponse = toUserResponse(user);

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
    const { password } = req.body;
    const email = normalizeEmail(req.body.email);

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
    const token = generateToken(user.id, user.role, user.password_changed_at);

    // 6) Remove private fields from output
    const userResponse = toUserResponse(user);

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
      attributes: { exclude: PRIVATE_USER_FIELDS },
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
    const token = generateToken(user.id, user.role, user.password_changed_at);

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
 * Send a single-use password reset link. Always answers the same way so the
 * response does not reveal whether an account exists.
 */
const forgotPassword = async (req, res, next) => {
  try {
    const email = typeof req.body.email === 'string' ? normalizeEmail(req.body.email) : '';
    if (!email) {
      throw new AppError('Por favor ingresa tu correo electrónico', 400);
    }

    const user = await User.findOne({ where: { email, is_active: true } });
    const now = Date.now();
    const recentlySent =
      user?.password_reset_expires &&
      user.password_reset_expires.getTime() - RESET_TOKEN_TTL_MS > now - RESET_EMAIL_COOLDOWN_MS;

    if (user && !recentlySent) {
      if (!process.env.FRONTEND_URL) {
        console.error('FRONTEND_URL is not set; cannot send password reset link');
      } else {
        const token = crypto.randomBytes(32).toString('hex');
        user.password_reset_token = hashResetToken(token);
        user.password_reset_expires = new Date(now + RESET_TOKEN_TTL_MS);
        await user.save({ hooks: false });

        const resetUrl = `${process.env.FRONTEND_URL.replace(/\/+$/, '')}/#/reset-password?token=${token}`;
        // Not awaited so the response time does not reveal whether the account exists
        emailService.sendPasswordResetEmail(user, resetUrl);
      }
    }

    res.status(200).json({
      status: 'success',
      message: 'Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Set a new password using a valid, unexpired reset token
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (typeof token !== 'string' || !token || typeof password !== 'string' || !password) {
      throw new AppError('Token y nueva contraseña son obligatorios', 400);
    }

    const user = await User.findOne({
      where: {
        password_reset_token: hashResetToken(token),
        password_reset_expires: { [Op.gt]: new Date() },
        is_active: true,
      },
    });
    if (!user) {
      throw new AppError('El enlace no es válido o ya expiró. Solicita uno nuevo.', 400);
    }

    // Claim the token and save in one transaction: a concurrent request finds it already
    // claimed, and a rejected password rolls the claim back so the link can be retried.
    await sequelize.transaction(async (transaction) => {
      const [claimed] = await User.update(
        { password_reset_token: null, password_reset_expires: null },
        {
          where: { id: user.id, password_reset_token: user.password_reset_token },
          hooks: false,
          transaction,
        }
      );
      if (!claimed) {
        throw new AppError('El enlace no es válido o ya expiró. Solicita uno nuevo.', 400);
      }

      user.password = password;
      user.password_reset_token = null;
      user.password_reset_expires = null;
      await user.save({ transaction });
    });

    res.status(200).json({
      status: 'success',
      message: 'Tu contraseña fue actualizada correctamente.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  forgotPassword,
  resetPassword,
  login,
  getMe,
  updatePassword,
};
