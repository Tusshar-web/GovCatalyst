const express = require('express');
const router = express.Router();
const { getAuditLogs } = require('../controllers/auditController');
const { authenticate } = require('../middleware/authMiddleware');

// Get all audit logs
router.get('/', authenticate, getAuditLogs);

module.exports = router;
