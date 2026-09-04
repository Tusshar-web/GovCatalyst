const pool = require('../config/db');

const AuditLog = {
  /**
   * Log an action in the audit trail
   */
  async create({ actorId, action, entityType, entityId, details }) {
    const { rows } = await pool.query(
      `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [actorId, action, entityType, entityId, details ? JSON.stringify(details) : null]
    );
    return rows[0];
  },

  /**
   * Fetch all audit logs with user details, ordered by latest first
   */
  async findAll() {
    const { rows } = await pool.query(
      `SELECT a.id, a.action, a.entity_type, a.entity_id, a.details, a.created_at,
              u.name AS actor_name, u.role AS actor_role
       FROM audit_logs a
       LEFT JOIN users u ON a.actor_id = u.id
       ORDER BY a.created_at DESC`
    );
    return rows;
  }
};

module.exports = AuditLog;
