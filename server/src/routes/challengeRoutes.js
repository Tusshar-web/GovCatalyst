const express = require('express');
const router = express.Router();
const {
  createChallenge,
  listChallenges,
  getChallenge,
  getMyChallenges,
  updateChallenge,
  publishChallenge,
  draftWithAI
} = require('../controllers/challengeController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { validators, validateRequest } = require('../utils/validators');

router.post('/', authenticate, requireRole('dept_admin', 'super_admin'), validateRequest(validators.challengeCreate), createChallenge);
router.post('/ai-draft', authenticate, requireRole('dept_admin', 'super_admin'), draftWithAI);
router.get('/', authenticate, listChallenges);                 // all logged-in roles can browse
router.get('/my', authenticate, requireRole('dept_admin', 'super_admin'), getMyChallenges);
router.get('/:id', authenticate, getChallenge);
router.patch('/:id', authenticate, requireRole('dept_admin', 'super_admin'), validateRequest(validators.challengeUpdate), updateChallenge);
router.patch('/:id/publish', authenticate, requireRole('dept_admin', 'super_admin'), publishChallenge);

module.exports = router;