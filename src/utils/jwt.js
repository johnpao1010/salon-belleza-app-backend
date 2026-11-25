const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRATION } = process.env;

/**
 * Generate JWT token
 * @param {string} userId - User ID to include in the token
 * @param {string} role - User role
 * @param {Date|null} passwordChangedAt - Tokens stop working once the password changes again
 * @returns {string} JWT token
 */
const generateToken = (userId, role = 'user', passwordChangedAt = null) => {
  return jwt.sign(
    { 
      id: userId,
      role: role,
      pwd: passwordChangedAt ? passwordChangedAt.getTime() : undefined,
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
