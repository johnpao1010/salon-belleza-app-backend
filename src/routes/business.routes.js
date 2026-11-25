const express = require('express');
const businessController = require('../controllers/business.controller');
const { authenticate } = require('../middlewares/authMiddleware');
const { loadBusinessFromParam, requireBusinessRole } = require('../middlewares/businessMiddleware');

const router = express.Router();
const manage = [loadBusinessFromParam, requireBusinessRole('owner', 'admin')];

router.get('/', businessController.listBusinesses);
router.get('/mine', authenticate, businessController.getMyBusinesses);
router.get('/:idOrSlug', businessController.getBusiness);

router.use(authenticate);

router.post('/', businessController.createBusiness);
router.patch('/:id', ...manage, businessController.updateBusiness);
router.get('/:id/members', ...manage, businessController.listMembers);
router.post('/:id/members', ...manage, businessController.addMember);
router.patch('/:id/members/:userId', ...manage, businessController.updateMember);
router.delete('/:id/members/:userId', ...manage, businessController.removeMember);

module.exports = router;
