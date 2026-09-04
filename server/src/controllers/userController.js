const User = require('../models/userModel');
const { hashPassword } = require('../utils/authUtils');
const { logAction } = require('./auditController');

async function getUsers(req, res) {
  try {
    const { role } = req.query;
    let users = [];
    if (role) {
      users = await User.findAllByRole(role);
    } else {
      users = await User.findAllUsers();
    }
    return res.json({ success: true, users });
  } catch (err) {
    console.error('Error fetching users:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch users', error: err.message });
  }
}

async function createUser(req, res) {
  try {
    const { name, email, role, department, designation } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const hashedPassword = await hashPassword('DefaultPass@123');
    const newUser = await User.create({
      name,
      email,
      password_hash: hashedPassword,
      role,
      department_name: department || null,
      designation: designation || null
    });

    // Make account active immediately since it's provisioned by super admin
    await User.updateStatus(newUser.id, 'active', req.user ? req.user.id : null);

    // Write to audit log
    const actorId = req.user ? req.user.id : newUser.id;
    await logAction(
      actorId,
      'User Provisioned',
      'Admin',
      newUser.id,
      `Provisioned new ${role} account for ${name} (${email})`
    );

    return res.json({ success: true, user: newUser });
  } catch (err) {
    console.error('Error creating user:', err);
    return res.status(500).json({ success: false, message: 'Failed to provision user', error: err.message });
  }
}

module.exports = { getUsers, createUser };
