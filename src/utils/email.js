// Emails are stored and compared in lowercase so "Juan@Gmail.com" and "juan@gmail.com" are the same account
const normalizeEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : email);

module.exports = { normalizeEmail };
