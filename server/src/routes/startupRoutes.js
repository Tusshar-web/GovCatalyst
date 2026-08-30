const express = require('express');
const router = express.Router();
const { getStartups, aiMatchStartups } = require('../controllers/startupController');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/', authenticate, getStartups);
router.post('/ai-match', authenticate, aiMatchStartups);

module.exports = router;
