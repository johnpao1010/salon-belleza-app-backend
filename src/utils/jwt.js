const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRATION } = process.env;

/**
 * Generate JWT token
 * @param {string} userId - User ID to include in the token
 * @param {string} role - User role
 * @returns {string} JWT token
 */
const generateToken = (userId, role = 'user') => {
  return jwt.sign(
    { 
      id: userId,
      role: role 
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRATION || '24h' }
  );
};

/**
 * Verify JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 */
const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

module.exports = {
  generateToken,
  verifyToken,
};
