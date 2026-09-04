const pool = require('../config/db');

const User = {
  async create({ name, email, password_hash, role, department_name, designation }) {
    // Startups get instant access; gov officials require super admin approval
    const accountStatus = (role === 'startup') ? 'active' : 'pending';
    const query = `
      INSERT INTO users (name, email, password_hash, role, department_name, designation, account_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, name, email, role, department_name, designation, account_status, created_at
    `;
    const values = [name, email, password_hash, role, department_name || null, designation || null, accountStatus];
    const { rows } = await pool.query(query, values);
    return rows[0];
  },

  async findByEmail(email) {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return rows[0] || null;
  },

  async findById(id) {
    const { rows } = await pool.query(
      `SELECT id, name, email, role, department_name, designation, created_at 
       FROM users WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  async findPendingUsers() {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.department_name, u.designation, u.created_at, u.account_status,
              (SELECT otp_code FROM otp_verifications o WHERE o.user_id = u.id AND o.is_used = false ORDER BY o.created_at DESC LIMIT 1) as otp_code
       FROM users u
       WHERE u.account_status IN ('pending', 'approved') 
       ORDER BY u.created_at ASC`
    );
    return rows;
  },

async updateStatus(userId, status, approvedBy = null) {
  const { rows } = await pool.query(
    `UPDATE users SET account_status = $1, approved_by = $2, approved_at = now()
     WHERE id = $3 RETURNING *`,
    [status, approvedBy, userId]
  );
  return rows[0];
},

  async findAllByRole(role) {
    const { rows } = await pool.query(
      `SELECT id, name, email, role, department_name, designation, created_at, account_status 
       FROM users WHERE role = $1 AND account_status = 'active'`,
      [role]
    );
    return rows;
  },

  async findAllUsers() {
    const { rows } = await pool.query(
      `SELECT id, name, email, role, department_name, designation, created_at, account_status 
       FROM users ORDER BY created_at DESC`
    );
    return rows;
  }
};

module.exports = User;