const express = require('express');
const router = express.Router();
const { getUsers, createUser } = require('../controllers/userController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.get('/', authenticate, getUsers);
router.post('/', authenticate, requireRole('super_admin'), createUser);

module.exports = router;
