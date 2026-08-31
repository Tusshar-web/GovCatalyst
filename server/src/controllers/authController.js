const { hashPassword, comparePassword, generateToken } = require('../utils/authUtils');
const User = require('../models/userModel');
const Startup = require('../models/startupModel');
const Otp = require('../models/otpModel');
const { sendNewRegistrationToAdmin, sendOtpToUser, sendRejectionToUser } = require('../utils/emailService');

const Joi = require('joi');

async function register(req, res) {
  try {
    // 1. Edge Case: Missing required fields -> 400 with clear message
    // 1. Validation schema allowing startup and government official profile fields
    const schema = Joi.object({
      name: Joi.string().required().messages({
        'any.required': 'Name is required.',
        'string.empty': 'Name cannot be empty.'
      }),
      email: Joi.string().email().required().messages({
        'any.required': 'Email is required.',
        'string.email': 'Email must be a valid email address.',
        'string.empty': 'Email cannot be empty.'
      }),
      password: Joi.string().min(6).required().messages({
        'any.required': 'Password is required.',
        'string.min': 'Password must be at least 6 characters long.',
        'string.empty': 'Password cannot be empty.'
      }),
      role: Joi.string().valid('dept_admin', 'startup', 'evaluator', 'validator', 'super_admin').required().messages({
        'any.required': 'Role is required.',
        'any.only': 'Invalid role provided.'
      }),
      department_name: Joi.string().optional().allow(null, ''),
      designation: Joi.string().optional().allow(null, ''),
      company_name: Joi.string().optional().allow(null, ''),
      sector: Joi.string().optional().allow(null, ''),
      dpiit_reg_number: Joi.string().optional().allow(null, '')
    }).unknown(true);

    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    const { name, email, password, role, department_name, designation, company_name, sector, dpiit_reg_number } = value;

    // Prevent self-registration of super_admin
    if (role === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Super Admin accounts cannot be self-registered. Contact system administrator.'
      });
    }

    // Block logged-in government officials from registering startup accounts
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const { verifyToken } = require('../utils/authUtils');
        const token = authHeader.split(' ')[1];
        const decoded = verifyToken(token);
        if (decoded && decoded.role && decoded.role !== 'startup') {
          return res.status(403).json({
            success: false,
            message: `Active session detected for ${decoded.role}. Government accounts cannot register startups.`
          });
        }
      } catch (e) {
        // Ignore invalid token
      }
    }

    // 2. Edge Case: Register with an email that already exists -> 409
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already registered. Please log in or check your account status.' });
    }

    const password_hash = await hashPassword(password);

    const newUser = await User.create({
      name,
      email,
      password_hash,
      role,
      department_name: role === 'dept_admin' ? department_name : null,
      designation,
    });

    if (role === 'startup') {
      await Startup.create({ 
        user_id: newUser.id, 
        company_name: company_name || name,
        sector: sector || null,
        dpiit_reg_number: dpiit_reg_number || null
      });
    } else if (role !== 'super_admin') {
      // 3. Notify superadmin for non-startup, non-superadmin registrations
      await sendNewRegistrationToAdmin(newUser);
    }

    const token = generateToken(newUser);

    return res.status(201).json({
      success: true,
      token,
      user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Registration failed' });
  }
}

async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findByEmail(email);
  if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

  //  New check
  if (user.account_status === 'pending') {
    return res.status(403).json({ success: false, message: 'Your account is awaiting admin approval' });
  }
  if (user.account_status === 'rejected') {
    return res.status(403).json({ success: false, message: 'Access denied — registration was rejected' });
  }
  if (user.account_status === 'approved') {
    return res.status(403).json({ success: false, message: 'Please verify OTP to activate your account' });
  }
  // only 'active' proceeds

  const isMatch = await comparePassword(password, user.password_hash);
  if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid credentials' });

  const token = generateToken(user);
  return res.json({ success: true, token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}

async function getMe(req, res) {
  try {
    const user = await User.findById(req.user.user_id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.status(200).json({ success: true, user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: 'Failed to fetch user' });
  }
}


// GET /api/auth/pending-users  (super_admin only)
async function getPendingUsers(req, res) {
  const users = await User.findPendingUsers();
  return res.json({ success: true, users });
}

// POST /api/auth/approve/:id  (super_admin only)
async function approveUser(req, res) {
  try {
    const userId = req.params.id || req.params.userId;
    const approvedBy = req.user?.user_id || null;
    const user = await User.updateStatus(userId, 'approved', approvedBy);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    await Otp.create(userId, otpCode);

    // Send the actual OTP email via Nodemailer
    await sendOtpToUser(user.email, otpCode);
    console.log(`OTP for ${user.email}: ${otpCode}`);

    return res.json({ 
      success: true, 
      message: 'User approved, OTP generated', 
      otp: otpCode
    });
  } catch (err) {
    console.error('approveUser error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

async function rejectUser(req, res) {
  try {
    const userId = req.params.id || req.params.userId;
    const rejectedBy = req.user?.user_id || null;
    const user = await User.updateStatus(userId, 'rejected', rejectedBy);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // Send rejection email via Nodemailer
    await sendRejectionToUser(user.email);

    return res.json({ success: true, message: 'User rejected' });
  } catch (err) {
    console.error('rejectUser error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}

// POST /api/auth/verify-otp
async function verifyOtp(req, res) {
  const { email, otp } = req.body;
  const user = await User.findByEmail(email);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  const isValid = await Otp.verify(user.id, otp);
  if (!isValid) return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });

  await User.updateStatus(user.id, 'active', user.approved_by);
  return res.json({ success: true, message: 'Account activated. You can now log in.' });
}

module.exports = { register, login, getMe, getPendingUsers, approveUser, rejectUser, verifyOtp};