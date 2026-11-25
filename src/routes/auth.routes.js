const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/authMiddleware');

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);

// Protected routes (require authentication)
router.use(authenticate);

router.get('/me', authController.getMe);
router.patch('/update-password', authController.updatePassword);

module.exports = router;
