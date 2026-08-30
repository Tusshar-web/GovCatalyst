const User = require('../models/userModel');

async function getUsers(req, res) {
  try {
    const { role } = req.query;
    let users = [];
    if (role) {
      users = await User.findAllByRole(role);
    } else {
      // For now, if no role is passed, we can just return empty or implement a findAll
      users = [];
    }
    return res.json({ success: true, users });
  } catch (err) {
    console.error('Error fetching users:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch users', error: err.message });
  }
}

module.exports = { getUsers };
