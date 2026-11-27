const { Appointment, Business, Service, User } = require('../models');
const { Op, literal } = require('sequelize');
const AppError = require('../utils/AppError');
const { canManageBusiness, findMembership, isPlatformAdmin } = require('../middlewares/businessMiddleware');

const toMinutes = (time) => {
  const [hours, minutes] = String(time).split(':').map(Number);
  return hours * 60 + minutes;
};

// Current wall-clock time in the given timezone, as a local Date (same convention as appointment dates)
const nowInTimezone = (timeZone) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(new Date()).map((part) => [part.type, part.value])
  );
  return new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
};

/**
 * Helper function to check if a time slot is available
 */
const isTimeSlotAvailable = async (employeeId, date, startTime, endTime, excludeAppointmentId = null) => {
  // An employee cannot have overlapping scheduled appointments, whatever the service
  const conditions = {
    employee_id: employeeId,
    appointment_date: date,
    status: 'scheduled',
    start_time: { [Op.lt]: endTime },
    end_time: { [Op.gt]: startTime },
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
    const { serviceId, employeeId, appointmentDate, startTime, notes } = req.body;
    const userId = req.user.id;

    const service = await Service.findByPk(serviceId);
    if (!service || !service.is_active) {
      throw new AppError('Service not found or not available', 404);
    }
    const business = await Business.findOne({ where: { id: service.business_id, is_active: true } });
    if (!business) {
      throw new AppError('Business not found or not available', 404);
    }

    // The employee must be an active member of the service's business
    const employee = await User.findByPk(employeeId);
    if (!employee || !employee.is_active || !(await findMembership(employee.id, business.id))) {
      throw new AppError('Employee not found or not available', 404);
    }

    // Parse and validate the appointment date and time
    const [year, month, day] = appointmentDate.split('-').map(Number);
    const appointment_Date = new Date(year, month - 1, day); // month-1 porque JS usa 0-11
    if (isNaN(appointment_Date.getTime())) {
      throw new AppError('Invalid appointment date', 400);
    }

    // Parse start time
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const startDateTime = new Date(appointment_Date);
    startDateTime.setHours(startHours, startMinutes, 0, 0);

    // Calculate end time based on service duration
    const endDateTime = new Date(startDateTime.getTime() + service.duration * 60000);
    const end_time = `${endDateTime.getHours().toString().padStart(2, '0')}:${endDateTime.getMinutes().toString().padStart(2, '0')}`;

    // Compare against the current wall-clock time of the business
    const localNow = nowInTimezone(business.timezone);
    if (startDateTime <= localNow) {
      throw new AppError('Cannot book an appointment in the past', 400);
    }

    // Check if the time slot is within working hours (e.g., 9 AM to 7 PM)
    const startMinutesOfDay = startHours * 60 + startMinutes;
    if (
      startMinutesOfDay < toMinutes(business.opening_time)
      || startMinutesOfDay + service.duration > toMinutes(business.closing_time)
    ) {
      throw new AppError(
        `Appointments can only be scheduled between ${business.opening_time.slice(0, 5)} and ${business.closing_time.slice(0, 5)}`,
        400
      );
    }

    // Check if the time slot is available
    const isAvailable = await isTimeSlotAvailable(
      employeeId,
      appointment_Date,
      startTime,
      end_time
    );

    if (!isAvailable) {
      throw new AppError('The selected time slot is not available', 400);
    }

    // Create the appointment
    const appointment = await Appointment.create({
      business_id: business.id,
      user_id: userId,
      employee_id: employeeId,
      service_id: serviceId,
      appointment_date: appointment_Date.toISOString().split('T')[0], // Format as YYYY-MM-DD
      start_time: startTime,
      end_time,
      status: 'scheduled',
      notes,
    });

    // Include service, user and employee details in the response
    const appointmentWithDetails = await Appointment.findByPk(appointment.id, {
      include: [
        { model: Service, as: 'service' },
        { model: User, as: 'user', attributes: ['id', 'first_name', 'last_name', 'email', 'phone'] },
        { model: User, as: 'employee', attributes: ['id', 'first_name', 'last_name', 'email', 'phone'] },
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
    const isAdmin = req.business ? await canManageBusiness(req.user, req.business.id) : isPlatformAdmin(req.user);

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

    // mine=true lists the user's own bookings across salons, unless a salon is explicitly requested
    const mine = req.query.mine === 'true';
    const explicitBusiness = req.headers['x-business-id'] || req.query.business_id;
    if (req.business && (!mine || explicitBusiness)) where.business_id = req.business.id;

    // Non-admins can only see their own appointments
    if (mine || !isAdmin) {
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
        { model: User, as: 'employee', attributes: ['id', 'first_name', 'last_name', 'email', 'phone'] },
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
    const where = { id };

    const appointment = await Appointment.findOne({
      where,
      include: [
        { model: Service, as: 'service' },
        { model: User, as: 'user', attributes: ['id', 'first_name', 'last_name', 'email', 'phone'] },
        { model: User, as: 'employee', attributes: ['id', 'first_name', 'last_name', 'email', 'phone'] },
      ],
    });

    if (!appointment) {
      throw new AppError('No appointment found with that ID', 404);
    }

    const canView = appointment.user_id === req.user.id
      || appointment.employee_id === req.user.id
      || (await canManageBusiness(req.user, appointment.business_id));
    if (!canView) {
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
    const { service_id, employee_id, appointment_date, start_time, status, notes } = req.body;

    // Find the appointment
    const appointment = await Appointment.findByPk(id, {
      include: [
        { model: Service, as: 'service' },
        { model: User, as: 'user' },
        { model: User, as: 'employee' },
      ],
    });

    if (!appointment) {
      throw new AppError('No appointment found with that ID', 404);
    }

    const isAdmin = await canManageBusiness(req.user, appointment.business_id);

    // Check permissions
    if (!isAdmin && appointment.user_id !== req.user.id) {
      throw new AppError('You do not have permission to update this appointment', 403);
    }

    // If updating employee, validate it
    if (employee_id) {
      const employee = await User.findByPk(employee_id);
      if (!employee || !employee.is_active || !(await findMembership(employee.id, appointment.business_id))) {
        throw new AppError('Employee not found or not available', 404);
      }
      appointment.employee_id = employee_id;
    }

    // If updating time/date, check availability
    if (appointment_date || start_time || service_id) {
      const service = service_id 
        ? await Service.findByPk(service_id) 
        : await Service.findByPk(appointment.service_id);

      if (!service || !service.is_active || service.business_id !== appointment.business_id) {
        throw new AppError('Service not found or not available', 404);
      }

      const date = appointment_date || appointment.appointment_date;
      const startTime = start_time || appointment.start_time;
      const currentEmployeeId = employee_id || appointment.employee_id;
      
      // Calculate end time based on service duration
      const [hours, minutes] = startTime.split(':').map(Number);
      const startDateTime = new Date(date);
      startDateTime.setHours(hours, minutes, 0, 0);
      const endDateTime = new Date(startDateTime.getTime() + service.duration * 60000);
      const endTime = `${endDateTime.getHours().toString().padStart(2, '0')}:${endDateTime.getMinutes().toString().padStart(2, '0')}`;

      const business = await Business.findByPk(appointment.business_id);
      const startMinutesOfDay = hours * 60 + minutes;
      if (
        startMinutesOfDay < toMinutes(business.opening_time)
        || startMinutesOfDay + service.duration > toMinutes(business.closing_time)
      ) {
        throw new AppError(
          `Appointments can only be scheduled between ${business.opening_time.slice(0, 5)} and ${business.closing_time.slice(0, 5)}`,
          400
        );
      }

      // Check if the time slot is available (excluding the current appointment)
      const isAvailable = await isTimeSlotAvailable(
        currentEmployeeId,
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
        { model: User, as: 'employee', attributes: ['id', 'first_name', 'last_name', 'email', 'phone'] },
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

    const appointment = await Appointment.findByPk(id);

    if (!appointment) {
      throw new AppError('No appointment found with that ID', 404);
    }

    const isAdmin = await canManageBusiness(req.user, appointment.business_id);

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
    const { service_id, employee_id, date } = req.query;

    if (!service_id || !date) {
      throw new AppError('Service ID and date are required', 400);
    }

    // Validate employee if provided
    if (employee_id) {
      const employee = await User.findByPk(employee_id);
      if (!employee || !employee.is_active) {
        throw new AppError('Employee not found or not available', 404);
      }
    }

    // Get the service to determine duration
    const service = await Service.findByPk(service_id);
    if (!service || !service.is_active) {
      throw new AppError('Service not found or not available', 404);
    }
    const business = await Business.findByPk(service.business_id);
    if (employee_id && !(await findMembership(employee_id, service.business_id))) {
      throw new AppError('Employee not found or not available', 404);
    }

    // Parse the date
    const appointmentDate = new Date(date);
    if (isNaN(appointmentDate.getTime())) {
      throw new AppError('Invalid date format', 400);
    }

    // Get working hours (9 AM to 7 PM)
    const workingHours = {
      start: Number(String(business.opening_time).split(':')[0]),
      end: Number(String(business.closing_time).split(':')[0]),
    };

    // Get all appointments for the service and employee on the given date
    const whereConditions = {
      service_id,
      appointment_date: date,
      status: 'scheduled',
    };
    
    if (employee_id) {
      whereConditions.employee_id = employee_id;
    }

    const appointments = await Appointment.findAll({
      where: whereConditions,
      order: [['start_time', 'ASC']],
    });

    // Generate time slots
    const slotDuration = service.duration; // in minutes
    const slots = [];
    const currentTime = new Date(appointmentDate);
    currentTime.setHours(workingHours.start, 0, 0, 0);

    const endTime = new Date(appointmentDate);
    endTime.setHours(workingHours.end, 0, 0, 0);

    // For today, start at the first slot (on the grid from opening time) that hasn't started yet
    const now = nowInTimezone(business.timezone);
    const pad = (n) => String(n).padStart(2, '0');
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    if (String(date).slice(0, 10) === today) {
      const openingMinutes = workingHours.start * 60;
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      if (nowMinutes >= openingMinutes) {
        const elapsedSlots = Math.floor((nowMinutes - openingMinutes) / slotDuration) + 1;
        currentTime.setHours(0, openingMinutes + elapsedSlots * slotDuration, 0, 0);
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
        employee_id,
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

/**
 * Get appointments for a specific employee
 * Query params:
 * - employee_id: Employee ID (required)
 * - start_date: Filter by start date
 * - end_date: Filter by end date
 * - status: Filter by status
 * - page: Page number (default: 1)
 * - limit: Number of results per page (default: 10)
 */
const getEmployeeAppointments = async (req, res, next) => {
  try {
    const { employee_id, start_date, end_date, status } = req.query;
    const isAdmin = req.business ? await canManageBusiness(req.user, req.business.id) : isPlatformAdmin(req.user);

    if (!employee_id) {
      throw new AppError('Employee ID is required', 400);
    }

    // Validate that the employee exists and is actually an employee
    const employee = await User.findByPk(employee_id);
    if (!employee || !employee.is_active || (req.business && !(await findMembership(employee.id, req.business.id)))) {
      throw new AppError('Employee not found or not available', 404);
    }

    // Build where clause
    const where = { employee_id };
    if (req.business) where.business_id = req.business.id;

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

    // Non-admins can only see their own appointments
    if (!isAdmin) {
      // Employees can only see their own appointments
      if (employee_id !== req.user.id) {
        throw new AppError('You can only view your own appointments', 403);
      }
    }

    const appointments = await Appointment.findAll({
      where,
      include: [
        { model: Service, as: 'service' },
        { model: User, as: 'user', attributes: ['id', 'first_name', 'last_name', 'email', 'phone'] },
        { model: User, as: 'employee', attributes: ['id', 'first_name', 'last_name', 'email', 'phone'] },
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
        employee: {
          id: employee.id,
          first_name: employee.first_name,
          last_name: employee.last_name,
          email: employee.email,
        },
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
  getEmployeeAppointments,
};
