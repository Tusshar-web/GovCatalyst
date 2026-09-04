const AuditLog = require('../models/auditModel');

async function getAuditLogs(req, res) {
  try {
    const logs = await AuditLog.findAll();
    return res.json({ success: true, logs });
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch audit logs', error: err.message });
  }
}

/**
 * Utility function to log actions directly from other controllers
 */
async function logAction(actorId, action, entityType, entityId, details) {
  try {
    await AuditLog.create({
      actorId,
      action,
      entityType,
      entityId,
      details
    });
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
}

module.exports = {
  getAuditLogs,
  logAction
};
