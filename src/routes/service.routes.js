const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/service.controller');
const { authenticate, authorize } = require('../middlewares/authMiddleware');

// Public routes (no authentication required)
router.get('/', serviceController.getAllServices);
router.get('/:id', serviceController.getService);

// Admin-only routes (require authentication and admin role)
router.use(authenticate);
router.use(authorize('admin'));

router.post('/', serviceController.createService);
router.patch('/:id', serviceController.updateService);
router.delete('/:id', serviceController.deleteService);

module.exports = router;
