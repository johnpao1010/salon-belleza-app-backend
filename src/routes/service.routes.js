const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/service.controller');
const { authenticate } = require('../middlewares/authMiddleware');
const { optionalAuthenticate, resolveBusiness, requireBusinessRole } = require('../middlewares/businessMiddleware');

// Public routes (no authentication required)
router.get('/', optionalAuthenticate, resolveBusiness(), serviceController.getAllServices);
router.get('/:id', serviceController.getService);

// Admin-only routes (require authentication and admin role)
router.use(authenticate);
router.use(resolveBusiness(), requireBusinessRole('owner', 'admin'));

router.post('/', serviceController.createService);
router.patch('/:id', serviceController.updateService);
router.delete('/:id', serviceController.deleteService);

module.exports = router;
