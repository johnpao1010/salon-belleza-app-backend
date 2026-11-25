const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointment.controller');
const { authenticate } = require('../middlewares/authMiddleware');
const { resolveBusiness } = require('../middlewares/businessMiddleware');

// Public route to check available slots
router.get('/available-slots', appointmentController.getAvailableSlots);

// All other routes require authentication
router.use(authenticate);

// Appointment routes
router.post('/', appointmentController.createAppointment);
router.get('/', resolveBusiness({ required: false }), appointmentController.getAllAppointments);
router.get('/employee', resolveBusiness({ required: false }), appointmentController.getEmployeeAppointments);
router.get('/:id', appointmentController.getAppointment);
router.patch('/:id', appointmentController.updateAppointment);
router.delete('/:id/cancel', appointmentController.cancelAppointment);

module.exports = router;
