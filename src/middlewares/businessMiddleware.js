const { Business, BusinessMember } = require('../models');
const { verifyToken } = require('../utils/jwt');
const { User } = require('../models');

const STAFF_ROLES = ['owner', 'admin'];

const isPlatformAdmin = (user) => Boolean(user && user.role === 'admin');

const findMembership = (userId, businessId) =>
  BusinessMember.findOne({ where: { user_id: userId, business_id: businessId, is_active: true } });

/**
 * Attaches req.user when a valid Bearer token is sent; never rejects the request.
 */
const optionalAuthenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return next();
  try {
    const decoded = verifyToken(authHeader.split(' ')[1]);
    const user = await User.findByPk(decoded.id, { attributes: { exclude: ['password'] } });
    if (user && user.is_active) req.user = user;
  } catch (error) {
    // Invalid tokens are treated as anonymous on public routes
  }
  next();
};

/**
 * Resolves the active business into req.business (and req.membership for members).
 * Source: X-Business-Id header, ?business_id, or the user's only membership.
 */
const resolveBusiness = ({ required = true } = {}) => async (req, res, next) => {
  try {
    let businessId = req.headers['x-business-id'] || req.query.business_id;

    if (!businessId && req.user) {
      const memberships = await BusinessMember.findAll({
        where: { user_id: req.user.id, is_active: true },
        attributes: ['business_id'],
      });
      if (memberships.length === 1) businessId = memberships[0].business_id;
    }

    if (!businessId) {
      if (!required) return next();
      return res.status(400).json({ status: 'fail', message: 'Business is required (X-Business-Id header)' });
    }

    const business = await Business.findOne({ where: { id: businessId, is_active: true } }).catch(() => null);
    if (!business) {
      return res.status(404).json({ status: 'fail', message: 'Business not found' });
    }

    req.business = business;
    if (req.user) req.membership = await findMembership(req.user.id, business.id);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Loads req.business from the :id route param (and req.membership).
 */
const loadBusinessFromParam = async (req, res, next) => {
  try {
    const business = await Business.findByPk(req.params.id).catch(() => null);
    if (!business) {
      return res.status(404).json({ status: 'fail', message: 'Business not found' });
    }
    req.business = business;
    if (req.user) req.membership = await findMembership(req.user.id, business.id);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Requires a membership role in req.business. Platform admins always pass.
 */
const requireBusinessRole = (...roles) => (req, res, next) => {
  if (isPlatformAdmin(req.user)) return next();
  if (req.membership && roles.includes(req.membership.role)) return next();
  return res.status(403).json({
    status: 'fail',
    message: 'You do not have permission to perform this action in this business',
  });
};

/**
 * True when the user can manage everything in the business (owner/admin or platform admin).
 */
const canManageBusiness = async (user, businessId) => {
  if (isPlatformAdmin(user)) return true;
  const membership = await findMembership(user.id, businessId);
  return Boolean(membership && STAFF_ROLES.includes(membership.role));
};

module.exports = {
  STAFF_ROLES,
  isPlatformAdmin,
  findMembership,
  optionalAuthenticate,
  resolveBusiness,
  loadBusinessFromParam,
  requireBusinessRole,
  canManageBusiness,
};
