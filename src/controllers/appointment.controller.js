const { Appointment, Service, User } = require('../models');
const { Op, literal } = require('sequelize');
const AppError = require('../utils/AppError');

/**
 * Helper function to check if a time slot is available
 */
const isTimeSlotAvailable = async (serviceId, date, startTime, endTime, excludeAppointmentId = null) => {
  const conditions = {
    service_id: serviceId,
    appointment_date: date,
    status: 'scheduled',
    [Op.or]: [
      // New appointment starts during an existing appointment
      {
        start_time: { [Op.lt]: endTime },
        end_time: { [Op.gt]: startTime },
      },
      // New appointment ends during an existing appointment
      {
        start_time: { [Op.lt]: endTime },
        end_time: { [Op.gt]: startTime },
      },
    ],
  };

  if (excludeAppointmentId) {
    conditions.id = { [Op.ne]: excludeAppointmentId };
  }

  const conflictingAppointment = await Appointment.findOne({ where: conditions });
  return !conflictingAppointment;
};

/**
 * Create a new appointment
 */
const createAppointment = async (req, res, next) => {
  try {
    const { service_id, appointment_date, start_time, notes } = req.body;
    const userId = req.user.id;

    // Get the service to check duration and other details
    const service = await Service.findByPk(service_id);
    if (!service || !service.is_active) {
      throw new AppError('Service not found or not available', 404);
    }

    // Parse and validate the appointment date and time
    const appointmentDate = new Date(appointment_date);
    if (isNaN(appointmentDate.getTime())) {
      throw new AppError('Invalid appointment date', 400);
    }

    // Parse start time
    const [startHours, startMinutes] = start_time.split(':').map(Number);
    const startDateTime = new Date(appointmentDate);
    startDateTime.setHours(startHours, startMinutes, 0, 0);

    // Calculate end time based on service duration
    const endDateTime = new Date(startDateTime.getTime() + service.duration * 60000);
    const end_time = `${endDateTime.getHours().toString().padStart(2, '0')}:${endDateTime.getMinutes().toString().padStart(2, '0')}`;

    // Check if the time slot is in the future
    const now = new Date();
    if (startDateTime < now) {
      throw new AppError('Cannot book an appointment in the past', 400);
    }

    // Check if the time slot is within working hours (e.g., 9 AM to 7 PM)
    const startHour = startDateTime.getHours();
    if (startHour < 9 || startHour >= 19) {
      throw new AppError('Appointments can only be scheduled between 9 AM and 7 PM', 400);
    }

    // Check if the time slot is available
    const isAvailable = await isTimeSlotAvailable(
      service_id,
      appointment_date,
      start_time,
      end_time
    );

    if (!isAvailable) {
      throw new AppError('The selected time slot is not available', 400);
    }

    // Create the appointment
    const appointment = await Appointment.create({
      user_id: userId,
      service_id,
      appointment_date,
      start_time,
      end_time,
      status: 'scheduled',
      notes,
    });

    // Include service and user details in the response
    const appointmentWithDetails = await Appointment.findByPk(appointment.id, {
      include: [
        { model: Service, as: 'service' },
        { model: User, as: 'user', attributes: ['id', 'first_name', 'last_name', 'email', 'phone'] },
      ],
    });

    res.status(201).json({
      status: 'success',
      data: {
        appointment: appointmentWithDetails,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all appointments (with filters for admins and users)
 */
const getAllAppointments = async (req, res, next) => {
  try {
    const { start_date, end_date, status, service_id, user_id } = req.query;
    const isAdmin = req.user.role === 'admin';

    const where = {};
    
    // Filter by date range
    if (start_date && end_date) {
      where.appointment_date = {
        [Op.between]: [start_date, end_date],
      };
    } else if (start_date) {
      where.appointment_date = { [Op.gte]: start_date };
    } else if (end_date) {
      where.appointment_date = { [Op.lte]: end_date };
    }

    // Filter by status
    if (status) {
      where.status = status;
    }

    // Filter by service
    if (service_id) {
      where.service_id = service_id;
    }

    // Non-admins can only see their own appointments
    if (!isAdmin) {
      where.user_id = req.user.id;
    } else if (user_id) {
      // Admins can filter by user_id
      where.user_id = user_id;
    }

    const appointments = await Appointment.findAll({
      where,
      include: [
        { model: Service, as: 'service' },
        { model: User, as: 'user', attributes: ['id', 'first_name', 'last_name', 'email', 'phone'] },
      ],
      order: [
        ['appointment_date', 'ASC'],
        ['start_time', 'ASC'],
      ],
    });

    res.status(200).json({
      status: 'success',
      results: appointments.length,
      data: {
        appointments,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single appointment by ID
 */
const getAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user.role === 'admin';

    const where = { id };
    
    // Non-admins can only see their own appointments
    if (!isAdmin) {
      where.user_id = req.user.id;
    }

    const appointment = await Appointment.findOne({
      where,
      include: [
        { model: Service, as: 'service' },
        { model: User, as: 'user', attributes: ['id', 'first_name', 'last_name', 'email', 'phone'] },
      ],
    });

    if (!appointment) {
      throw new AppError('No appointment found with that ID', 404);
    }

    res.status(200).json({
      status: 'success',
      data: {
        appointment,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update an appointment
 */
const updateAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { service_id, appointment_date, start_time, status, notes } = req.body;
    const isAdmin = req.user.role === 'admin';

    // Find the appointment
    const appointment = await Appointment.findByPk(id, {
      include: [
        { model: Service, as: 'service' },
        { model: User, as: 'user' },
      ],
    });

    if (!appointment) {
      throw new AppError('No appointment found with that ID', 404);
    }

    // Check permissions
    if (!isAdmin && appointment.user_id !== req.user.id) {
      throw new AppError('You do not have permission to update this appointment', 403);
    }

    // If updating time/date, check availability
    if (appointment_date || start_time || service_id) {
      const service = service_id 
        ? await Service.findByPk(service_id) 
        : await Service.findByPk(appointment.service_id);

      if (!service || !service.is_active) {
        throw new AppError('Service not found or not available', 404);
      }

      const date = appointment_date || appointment.appointment_date;
      const startTime = start_time || appointment.start_time;
      
      // Calculate end time based on service duration
      const [hours, minutes] = startTime.split(':').map(Number);
      const startDateTime = new Date(date);
      startDateTime.setHours(hours, minutes, 0, 0);
      const endDateTime = new Date(startDateTime.getTime() + service.duration * 60000);
      const endTime = `${endDateTime.getHours().toString().padStart(2, '0')}:${endDateTime.getMinutes().toString().padStart(2, '0')}`;

      // Check if the time slot is available (excluding the current appointment)
      const isAvailable = await isTimeSlotAvailable(
        service.id,
        date,
        startTime,
        endTime,
        id
      );

      if (!isAvailable) {
        throw new AppError('The selected time slot is not available', 400);
      }

      // Update the appointment with the new time/date
      appointment.appointment_date = date;
      appointment.start_time = startTime;
      appointment.end_time = endTime;
      appointment.service_id = service.id;
    }

    // Update status if provided (only admins can change status)
    if (status && isAdmin) {
      appointment.status = status;
    }

    // Update notes if provided
    if (notes !== undefined) {
      appointment.notes = notes;
    }

    await appointment.save();

    // Get the updated appointment with all associations
    const updatedAppointment = await Appointment.findByPk(appointment.id, {
      include: [
        { model: Service, as: 'service' },
        { model: User, as: 'user', attributes: ['id', 'first_name', 'last_name', 'email', 'phone'] },
      ],
    });

    res.status(200).json({
      status: 'success',
      data: {
        appointment: updatedAppointment,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel an appointment
 */
const cancelAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user.role === 'admin';

    const appointment = await Appointment.findByPk(id);

    if (!appointment) {
      throw new AppError('No appointment found with that ID', 404);
    }

    // Check permissions
    if (!isAdmin && appointment.user_id !== req.user.id) {
      throw new AppError('You do not have permission to cancel this appointment', 403);
    }

    // Check if the appointment can be cancelled (e.g., not already cancelled/completed)
    if (appointment.status !== 'scheduled') {
      throw new AppError(`Cannot cancel an appointment that is ${appointment.status}`, 400);
    }

    // Update status to cancelled
    appointment.status = 'cancelled';
    await appointment.save();

    res.status(200).json({
      status: 'success',
      message: 'Appointment cancelled successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get available time slots for a service on a specific date
 */
const getAvailableSlots = async (req, res, next) => {
  try {
    const { service_id, date } = req.query;

    if (!service_id || !date) {
      throw new AppError('Service ID and date are required', 400);
    }

    // Get the service to determine duration
    const service = await Service.findByPk(service_id);
    if (!service || !service.is_active) {
      throw new AppError('Service not found or not available', 404);
    }

    // Parse the date
    const appointmentDate = new Date(date);
    if (isNaN(appointmentDate.getTime())) {
      throw new AppError('Invalid date format', 400);
    }

    // Get working hours (9 AM to 7 PM)
    const workingHours = {
      start: 9,  // 9 AM
      end: 19,   // 7 PM
    };

    // Get all appointments for the service on the given date
    const appointments = await Appointment.findAll({
      where: {
        service_id,
        appointment_date: date,
        status: 'scheduled',
      },
      order: [['start_time', 'ASC']],
    });

    // Generate time slots
    const slotDuration = service.duration; // in minutes
    const slots = [];
    const currentTime = new Date(appointmentDate);
    currentTime.setHours(workingHours.start, 0, 0, 0);

    const endTime = new Date(appointmentDate);
    endTime.setHours(workingHours.end, 0, 0, 0);

    // Check if the current time is in the past for today
    const now = new Date();
    if (appointmentDate.toDateString() === now.toDateString()) {
      // If the current time is later than the working hours start, start from the next available slot
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      
      if (currentHour > workingHours.start || (currentHour === workingHours.start && currentMinute >= 0)) {
        // Round up to the next slot
        const minutesToAdd = slotDuration - (currentMinute % slotDuration);
        currentTime.setMinutes(currentMinute + minutesToAdd);
      }
    }

    // Generate slots for the day
    while (currentTime < endTime) {
      const slotEndTime = new Date(currentTime.getTime() + slotDuration * 60000);
      
      // Skip if the slot goes beyond working hours
      if (slotEndTime.getHours() > workingHours.end || 
          (slotEndTime.getHours() === workingHours.end && slotEndTime.getMinutes() > 0)) {
        break;
      }

      // Format the time slot
      const slot = {
        start_time: currentTime.toTimeString().slice(0, 5), // HH:MM format
        end_time: slotEndTime.toTimeString().slice(0, 5),
        available: true,
      };

      // Check if the slot is available
      const isAvailable = await isTimeSlotAvailable(
        service_id,
        date,
        slot.start_time,
        slot.end_time
      );

      slot.available = isAvailable;
      slots.push(slot);

      // Move to the next slot
      currentTime.setTime(slotEndTime.getTime());
    }

    res.status(200).json({
      status: 'success',
      data: {
        date,
        service: {
          id: service.id,
          name: service.name,
          duration: service.duration,
        },
        available_slots: slots.filter(slot => slot.available).map(slot => ({
          start_time: slot.start_time,
          end_time: slot.end_time,
        })),
        all_slots: slots,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAppointment,
  getAllAppointments,
  getAppointment,
  updateAppointment,
  cancelAppointment,
  getAvailableSlots,
};
