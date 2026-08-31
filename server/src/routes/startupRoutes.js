const express = require('express');
const router = express.Router();
const { getStartups, aiMatchStartups, updateMyProfile } = require('../controllers/startupController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

router.get('/', authenticate, getStartups);
router.post('/ai-match', authenticate, aiMatchStartups);
router.put('/profile', authenticate, requireRole('startup'), updateMyProfile);

module.exports = router;
