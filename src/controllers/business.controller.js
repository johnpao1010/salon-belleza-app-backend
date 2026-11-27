const { randomBytes } = require('crypto');
const { Op } = require('sequelize');
const { Business, BusinessMember, User, sequelize } = require('../models');
const AppError = require('../utils/AppError');
const { normalizeEmail } = require('../utils/email');

const PUBLIC_ATTRIBUTES = [
  'id', 'name', 'slug', 'address', 'phone', 'email', 'logo_url',
  'timezone', 'opening_time', 'closing_time',
];
const EDITABLE_FIELDS = [
  'name', 'address', 'phone', 'email', 'logo_url', 'timezone', 'opening_time', 'closing_time',
];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const slugify = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const pick = (source, fields) =>
  fields.reduce((acc, field) => {
    if (source[field] !== undefined) acc[field] = source[field];
    return acc;
  }, {});

const listBusinesses = async (req, res, next) => {
  try {
    const where = { is_active: true };
    if (req.query.search) where.name = { [Op.iLike]: `%${req.query.search}%` };
    const businesses = await Business.findAll({
      where,
      attributes: PUBLIC_ATTRIBUTES,
      order: [['name', 'ASC']],
    });
    res.status(200).json({ status: 'success', results: businesses.length, data: { businesses } });
  } catch (error) {
    next(error);
  }
};

const getBusiness = async (req, res, next) => {
  try {
    const { idOrSlug } = req.params;
    const where = UUID_REGEX.test(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug };
    const business = await Business.findOne({
      where: { ...where, is_active: true },
      attributes: PUBLIC_ATTRIBUTES,
    });
    if (!business) throw new AppError('Business not found', 404);
    res.status(200).json({ status: 'success', data: { business } });
  } catch (error) {
    next(error);
  }
};

// Public list of a business's stylists, with only what a client needs to pick one
const listEmployees = async (req, res, next) => {
  try {
    const { idOrSlug } = req.params;
    const where = UUID_REGEX.test(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug };
    const business = await Business.findOne({ where: { ...where, is_active: true }, attributes: ['id'] });
    if (!business) throw new AppError('Business not found', 404);

    const members = await BusinessMember.findAll({
      where: { business_id: business.id, role: 'employee', is_active: true },
      attributes: [],
      include: [{
        model: User,
        as: 'user',
        where: { is_active: true },
        attributes: ['id', 'first_name', 'last_name'],
      }],
      order: [[{ model: User, as: 'user' }, 'first_name', 'ASC']],
    });
    const employees = members.map((member) => member.user);
    res.status(200).json({ status: 'success', results: employees.length, data: { employees } });
  } catch (error) {
    next(error);
  }
};

const getMyBusinesses = async (req, res, next) => {
  try {
    const memberships = await BusinessMember.findAll({
      where: { user_id: req.user.id, is_active: true },
      attributes: ['role'],
      include: [{
        model: Business,
        as: 'business',
        where: { is_active: true },
        attributes: PUBLIC_ATTRIBUTES,
      }],
      order: [[{ model: Business, as: 'business' }, 'name', 'ASC']],
    });
    const businesses = memberships.map((membership) => ({
      ...membership.business.get({ plain: true }),
      role: membership.role,
    }));
    res.status(200).json({ status: 'success', results: businesses.length, data: { businesses } });
  } catch (error) {
    next(error);
  }
};

const createBusiness = async (req, res, next) => {
  try {
    const data = pick(req.body, EDITABLE_FIELDS);
    data.slug = slugify(req.body.slug || req.body.name);
    if (!data.slug) throw new AppError('A valid business name is required', 400);
    if (await Business.findOne({ where: { slug: data.slug }, paranoid: false })) {
      if (req.body.slug) throw new AppError('That slug is already taken', 400);
      data.slug = `${data.slug}-${randomBytes(3).toString('hex')}`;
    }

    const business = await sequelize.transaction(async (transaction) => {
      const created = await Business.create(data, { transaction });
      await BusinessMember.create(
        { business_id: created.id, user_id: req.user.id, role: 'owner' },
        { transaction }
      );
      return created;
    });

    res.status(201).json({ status: 'success', data: { business } });
  } catch (error) {
    next(error);
  }
};

const updateBusiness = async (req, res, next) => {
  try {
    const updates = pick(req.body, EDITABLE_FIELDS);
    if (req.body.slug !== undefined) {
      updates.slug = slugify(req.body.slug);
      const taken = await Business.findOne({ where: { slug: updates.slug }, paranoid: false });
      if (taken && taken.id !== req.business.id) throw new AppError('That slug is already taken', 400);
    }
    await req.business.update(updates);
    res.status(200).json({ status: 'success', data: { business: req.business } });
  } catch (error) {
    next(error);
  }
};

const listMembers = async (req, res, next) => {
  try {
    const members = await BusinessMember.findAll({
      where: { business_id: req.business.id },
      attributes: ['id', 'role', 'is_active', 'created_at'],
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'is_active'],
      }],
      order: [[{ model: User, as: 'user' }, 'first_name', 'ASC']],
    });
    res.status(200).json({ status: 'success', results: members.length, data: { members } });
  } catch (error) {
    next(error);
  }
};

// Only owners (or platform admins) may grant, change or remove the owner role.
const assertCanAssignRole = (req, role) => {
  const isOwner = req.user.role === 'admin' || (req.membership && req.membership.role === 'owner');
  if (role === 'owner' && !isOwner) {
    throw new AppError('Only owners can manage owners', 403);
  }
};

const addMember = async (req, res, next) => {
  try {
    const { role = 'employee' } = req.body;
    const email = normalizeEmail(req.body.email);
    if (!['owner', 'admin', 'employee'].includes(role)) throw new AppError('Invalid role', 400);
    assertCanAssignRole(req, role);

    const user = await User.findOne({ where: { email } });
    if (!user) throw new AppError('No user found with that email', 404);

    const [member, created] = await BusinessMember.findOrCreate({
      where: { business_id: req.business.id, user_id: user.id },
      defaults: { role, is_active: true },
    });
    if (!created) {
      if (member.role === 'owner') assertCanAssignRole(req, 'owner');
      await member.update({ role, is_active: true });
    }

    res.status(created ? 201 : 200).json({ status: 'success', data: { member } });
  } catch (error) {
    next(error);
  }
};

const findMemberOrFail = async (req) => {
  const member = await BusinessMember.findOne({
    where: { business_id: req.business.id, user_id: req.params.userId },
  });
  if (!member) throw new AppError('Member not found', 404);
  return member;
};

const updateMember = async (req, res, next) => {
  try {
    const member = await findMemberOrFail(req);
    const updates = pick(req.body, ['role', 'is_active']);
    if (updates.role && !['owner', 'admin', 'employee'].includes(updates.role)) {
      throw new AppError('Invalid role', 400);
    }
    if (member.role === 'owner' || updates.role === 'owner') assertCanAssignRole(req, 'owner');
    await member.update(updates);
    res.status(200).json({ status: 'success', data: { member } });
  } catch (error) {
    next(error);
  }
};

const removeMember = async (req, res, next) => {
  try {
    const member = await findMemberOrFail(req);
    if (member.role === 'owner') assertCanAssignRole(req, 'owner');
    await member.destroy({ force: true });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listBusinesses,
  getBusiness,
  getMyBusinesses,
  listEmployees,
  createBusiness,
  updateBusiness,
  listMembers,
  addMember,
  updateMember,
  removeMember,
};
