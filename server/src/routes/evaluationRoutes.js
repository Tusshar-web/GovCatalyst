/**
 * GovCatalyst — Expert Evaluation Routes
 */

const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/evaluationController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole }  = require('../middleware/roleMiddleware');
const { validators, validateRequest } = require('../utils/validators');

router.use(authenticate);

// ── Criteria (Rubric) ─────────────────────────────────────────────
// Create a single criterion
router.post('/criteria',
  requireRole('dept_admin', 'super_admin'),
  ctrl.createCriterion
);
// Seed the standard 5-criterion rubric for a challenge
router.post('/criteria/seed/:challengeId',
  requireRole('dept_admin', 'super_admin'),
  ctrl.seedDefaultCriteria
);
// Get all criteria for a challenge
router.get('/criteria/:challengeId', ctrl.getCriteria);
// Update a criterion
router.patch('/criteria/:criterionId',
  requireRole('dept_admin', 'super_admin'),
  ctrl.updateCriterion
);
// Soft-delete a criterion
router.delete('/criteria/:criterionId',
  requireRole('dept_admin', 'super_admin'),
  ctrl.deleteCriterion
);

// ── Assignments ───────────────────────────────────────────────────
// Assign an evaluator to an application
router.post('/assign',
  requireRole('dept_admin', 'super_admin'),
  ctrl.assignEvaluator
);
// See all assignments for an application
router.get('/assignments/application/:applicationId',
  requireRole('dept_admin', 'super_admin'),
  ctrl.getAssignmentsByApplication
);
// Evaluator: see their own queue
router.get('/assignments/my',
  requireRole('evaluator'),
  ctrl.getMyAssignments
);
// Evaluator: declare conflict of interest
router.post('/assignments/:assignmentId/conflict',
  requireRole('evaluator'),
  ctrl.declareConflict
);

// ── Scoring ───────────────────────────────────────────────────────
// Evaluator: submit all scores in one shot
router.post('/scores/submit',
  requireRole('evaluator'),
  validateRequest(validators.evaluationScoreSubmit),
  ctrl.submitScores
);
// Evaluator: view their own scores for an application
router.get('/scores/my/:applicationId',
  requireRole('evaluator'),
  ctrl.getMyScores
);
// dept_admin / super_admin: view all scores for an application
router.get('/scores/:applicationId',
  requireRole('dept_admin', 'super_admin'),
  ctrl.getScores
);

// ── Panel Decision ────────────────────────────────────────────────
// Finalize panel — compute weighted avg and generate recommendation
router.post('/panel/:applicationId/finalize',
  requireRole('dept_admin', 'super_admin'),
  ctrl.finalizePanel
);
// View panel decision
router.get('/panel/:applicationId',
  requireRole('dept_admin', 'super_admin', 'evaluator'),
  ctrl.getPanelDecision
);
// Override panel recommendation (written justification required)
router.post('/panel/:applicationId/override',
  requireRole('dept_admin', 'super_admin'),
  ctrl.overrideDecision
);

// ── Full Summary (dashboard) ──────────────────────────────────────
router.get('/summary/:applicationId',
  requireRole('dept_admin', 'super_admin'),
  ctrl.getEvaluationSummary
);

// ── Appeals ───────────────────────────────────────────────────────
// Startup files an appeal
router.post('/appeal/:applicationId',
  requireRole('startup'),
  ctrl.submitAppeal
);
// List all pending appeals
router.get('/appeals/pending',
  requireRole('dept_admin', 'super_admin'),
  ctrl.getPendingAppeals
);
// Review (accept / reject) an appeal
router.patch('/appeal/:applicationId/review',
  requireRole('dept_admin', 'super_admin'),
  ctrl.reviewAppeal
);

module.exports = router;
