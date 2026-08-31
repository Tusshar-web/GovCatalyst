const express = require('express');
const router = express.Router();
const { register, login, getMe, getPendingUsers, approveUser, rejectUser, verifyOtp } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, getMe);
router.get('/pending-users', authenticate, requireRole('super_admin'), getPendingUsers);
router.post('/approve/:id', authenticate, requireRole('super_admin'), approveUser);
router.post('/reject/:id', authenticate, requireRole('super_admin'), rejectUser);
router.post('/verify-otp', verifyOtp);

module.exports = router;