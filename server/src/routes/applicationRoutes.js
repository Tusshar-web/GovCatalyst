const express = require('express');
const router = express.Router();
const {
  applyToChallenge,
  getMyApplications,
  getChallengeApplications,
  getApprovedApplications,
} = require('../controllers/applicationController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

// Startup routes
router.post('/challenge/:challenge_id/apply', authenticate, requireRole('startup'), applyToChallenge);
router.get('/my', authenticate, requireRole('startup'), getMyApplications);

// Dept admin / evaluator routes
router.get('/challenge/:challenge_id/approved', authenticate, requireRole('dept_admin', 'super_admin'), getApprovedApplications);
router.get('/challenge/:challenge_id', authenticate, requireRole('dept_admin', 'evaluator', 'super_admin'), getChallengeApplications);

module.exports = router;
