const express = require('express');
const router = express.Router();
const { getStartups } = require('../controllers/startupController');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/', authenticate, getStartups);

module.exports = router;
