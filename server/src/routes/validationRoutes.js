/**
 * GovCatalyst — Independent Validation Routes
 */

const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/validationController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole }  = require('../middleware/roleMiddleware');

router.use(authenticate);

// ── Validator Assignments ─────────────────────────────────────────
router.post('/assign',
  requireRole('dept_admin', 'super_admin'),
  ctrl.assignValidator
);

router.get('/assignments/pilot/:pilotId',
  requireRole('dept_admin', 'super_admin', 'validator'),
  ctrl.getAssignmentsByPilot
);

router.get('/assignments/my',
  requireRole('validator', 'super_admin'),
  ctrl.getMyAssignments
);

router.patch('/assignments/:id/activate',
  requireRole('validator', 'super_admin'),
  ctrl.activateAssignment
);

// ── Milestone Verifications ───────────────────────────────────────
router.post('/milestones',
  requireRole('validator', 'super_admin'),
  ctrl.recordMilestoneVerification
);

router.patch('/milestones/:id/verify',
  requireRole('validator', 'super_admin'),
  ctrl.submitMilestoneVerification
);

router.get('/milestones/pilot/:pilotId',
  requireRole('dept_admin', 'super_admin', 'validator'),
  ctrl.getMilestoneVerificationsByPilot
);

// ── KPI Validations ───────────────────────────────────────────────
router.post('/kpis',
  requireRole('validator', 'super_admin'),
  ctrl.registerKpiValidation
);

router.patch('/kpis/:id/validate',
  requireRole('validator', 'super_admin'),
  ctrl.submitKpiValidation
);

router.get('/kpis/pilot/:pilotId',
  requireRole('dept_admin', 'super_admin', 'validator'),
  ctrl.getKpiValidationsByPilot
);

// ── Validation Reports ────────────────────────────────────────────
router.post('/reports',
  requireRole('validator', 'super_admin'),
  ctrl.saveValidationReport
);

router.post('/reports/:assignmentId/submit',
  requireRole('validator', 'super_admin'),
  ctrl.submitValidationReport
);

router.get('/reports/assignment/:assignmentId',
  requireRole('dept_admin', 'super_admin', 'validator'),
  ctrl.getValidationReportByAssignment
);

router.get('/reports/pilot/:pilotId',
  requireRole('dept_admin', 'super_admin', 'validator'),
  ctrl.getValidationReportsByPilot
);

// ── Objections & Clarifications ───────────────────────────────────
router.post('/objections',
  requireRole('dept_admin', 'super_admin'),
  ctrl.raiseObjection
);

router.patch('/objections/:id/respond',
  requireRole('validator', 'super_admin'),
  ctrl.respondToObjection
);

router.get('/objections/report/:reportId',
  requireRole('dept_admin', 'super_admin', 'validator'),
  ctrl.getObjectionsByReport
);

// ── Admin Sign-Offs ───────────────────────────────────────────────
router.get('/admin/signoffs',
  requireRole('super_admin'),
  ctrl.getAllSignoffs
);

router.post('/admin/signoffs/:id/execute',
  requireRole('super_admin'),
  ctrl.executeAdminSignoff
);

module.exports = router;
