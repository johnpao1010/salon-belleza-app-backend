const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticate, authorize } = require('../middlewares/authMiddleware');

// All routes require authentication
router.use(authenticate);

// User profile routes (accessible by the user themselves)
router.get('/profile', userController.getMe);
router.patch('/profile', userController.updateUser);
router.patch('/update-password', userController.updatePassword);

// Admin-only routes
router.use(authorize('admin'));

router.get('/', userController.getAllUsers);
router.get('/:id', userController.getUser);
router.patch('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);
router.post('/:id/deactivate', userController.deactivateUser);
router.post('/:id/reactivate', userController.reactivateUser);

module.exports = router;
