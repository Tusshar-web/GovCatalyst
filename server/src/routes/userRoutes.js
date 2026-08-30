const express = require('express');
const router = express.Router();
const { getUsers } = require('../controllers/userController');
const { authenticate } = require('../middleware/authMiddleware');

router.get('/', authenticate, getUsers);

module.exports = router;
